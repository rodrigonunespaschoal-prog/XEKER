const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  createInitialMatchState,
  applyCommandToState,
  calculateEloDelta
} = require('./gameEngine');

initializeApp();
const db = getFirestore();

/**
 * Pareamento automático quando um jogador entra em matchmaking_queue com status 'searching'.
 */
exports.onMatchmakingJoin = onDocumentCreated(
  'matchmaking_queue/{uid}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const entry = snap.data();
    if (!entry || entry.status !== 'searching') return;

    const uid = event.params.uid;
    const queueCol = db.collection('matchmaking_queue');

    await db.runTransaction(async (tx) => {
      const currentEntryDoc = await tx.get(queueCol.doc(uid));
      if (!currentEntryDoc.exists || currentEntryDoc.data().status !== 'searching') {
        return;
      }

      const searchingSnap = await tx.get(
        queueCol.where('status', '==', 'searching').limit(10)
      );

      const candidates = searchingSnap.docs.filter((d) => d.id !== uid);
      if (candidates.length === 0) return;

      // Escolhe o candidato com Elo mais próximo
      const myElo = Number(entry.elo) || 1200;
      candidates.sort((a, b) => {
        const diffA = Math.abs((Number(a.data().elo) || 1200) - myElo);
        const diffB = Math.abs((Number(b.data().elo) || 1200) - myElo);
        return diffA - diffB;
      });

      const oppDoc = candidates[0];
      const oppData = oppDoc.data();

      // Sorteia quem joga de Brancas e quem joga de Pretas
      const whiteIsMe = Math.random() < 0.5;
      const whiteUid = whiteIsMe ? uid : oppDoc.id;
      const blackUid = whiteIsMe ? oppDoc.id : uid;
      const whiteName = whiteIsMe ? (entry.name || 'Brancas') : (oppData.name || 'Brancas');
      const blackName = whiteIsMe ? (oppData.name || 'Pretas') : (entry.name || 'Pretas');
      const whiteEloBefore = whiteIsMe ? myElo : (Number(oppData.elo) || 1200);
      const blackEloBefore = whiteIsMe ? (Number(oppData.elo) || 1200) : myElo;
      const timeControlSec = Number(entry.timeControlSec) || Number(oppData.timeControlSec) || 300;
      const unrated = Boolean(entry.unrated || oppData.unrated);

      const engineState = createInitialMatchState({
        whiteUid,
        blackUid,
        whiteName,
        blackName,
        timeControlSec,
        unrated
      });

      const matchRef = db.collection('matches').doc();
      const matchId = matchRef.id;

      tx.set(matchRef, {
        status: 'active',
        whiteUid,
        blackUid,
        whiteName,
        blackName,
        whiteEloBefore,
        blackEloBefore,
        timeControlSec,
        unrated,
        eloApplied: false,
        engineState,
        whiteViewJson: JSON.stringify({
          board: engineState.board,
          flop: engineState.flop,
          deckCount: engineState.deck.length,
          turn: engineState.turn,
          turnNumber: engineState.turnNumber,
          actionsLeft: engineState.actionsLeft,
          mySide: 'white',
          myCoins: engineState.players.white.coins,
          oppCoins: engineState.players.black.coins,
          myHand: engineState.players.white.hand,
          oppHandCount: engineState.players.black.hand.length,
          boughtThisTurn: engineState.players.white.boughtThisTurn,
          clocks: engineState.clocks,
          pendingCombat: null,
          gameOver: false,
          gameOverData: null
        }),
        blackViewJson: JSON.stringify({
          board: engineState.board,
          flop: engineState.flop,
          deckCount: engineState.deck.length,
          turn: engineState.turn,
          turnNumber: engineState.turnNumber,
          actionsLeft: engineState.actionsLeft,
          mySide: 'black',
          myCoins: engineState.players.black.coins,
          oppCoins: engineState.players.white.coins,
          myHand: engineState.players.black.hand,
          oppHandCount: engineState.players.white.hand.length,
          boughtThisTurn: engineState.players.black.boughtThisTurn,
          clocks: engineState.clocks,
          pendingCombat: null,
          gameOver: false,
          gameOverData: null
        }),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Atualiza entradas da fila apontando para o matchId criado
      tx.update(queueCol.doc(uid), {
        status: 'matched',
        matchId,
        matchedAt: FieldValue.serverTimestamp()
      });
      tx.update(oppDoc.ref, {
        status: 'matched',
        matchId,
        matchedAt: FieldValue.serverTimestamp()
      });
    });
  }
);

/**
 * Processa comandos enviados pelos jogadores em matches/{matchId}/commands/{cmdId}.
 */
exports.processMatchCommand = onDocumentCreated(
  'matches/{matchId}/commands/{cmdId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const cmd = snap.data();
    const { matchId } = event.params;
    const matchRef = db.collection('matches').doc(matchId);

    await db.runTransaction(async (tx) => {
      const matchDoc = await tx.get(matchRef);
      if (!matchDoc.exists) return;

      const matchData = matchDoc.data();
      if (matchData.status !== 'active') return;

      const senderSide =
        cmd.uid === matchData.whiteUid ? 'white' :
        cmd.uid === matchData.blackUid ? 'black' : null;

      if (!senderSide) return;

      const result = applyCommandToState(matchData.engineState, senderSide, cmd);
      if (!result || !result.valid) return;

      const nextState = result.nextState;
      const updates = {
        engineState: nextState,
        whiteViewJson: JSON.stringify(result.whiteView),
        blackViewJson: JSON.stringify(result.blackView),
        clocksJson: JSON.stringify(nextState.clocks),
        lastFxEvent: result.fxEvent || null,
        lastSummary: result.summary || null,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (nextState.gameOver && nextState.gameOverData) {
        const winnerSide = nextState.gameOverData.winnerSide;
        updates.status = 'finished';
        updates.winnerSide = winnerSide;
        updates.endReason = nextState.gameOverData.reason || 'Fim de partida';

        if (!matchData.unrated && !matchData.eloApplied) {
          const whiteRef = db.collection('users').doc(matchData.whiteUid);
          const blackRef = db.collection('users').doc(matchData.blackUid);
          const [wSnap, bSnap] = await Promise.all([tx.get(whiteRef), tx.get(blackRef)]);

          const wElo = wSnap.exists ? (Number(wSnap.data().elo) || 1200) : (matchData.whiteEloBefore || 1200);
          const bElo = bSnap.exists ? (Number(bSnap.data().elo) || 1200) : (matchData.blackEloBefore || 1200);

          const { whiteDelta, blackDelta } = calculateEloDelta(wElo, bElo, winnerSide);

          tx.update(whiteRef, {
            elo: Math.max(100, wElo + whiteDelta),
            wins: FieldValue.increment(winnerSide === 'white' ? 1 : 0),
            losses: FieldValue.increment(winnerSide === 'white' ? 0 : 1),
            updatedAt: FieldValue.serverTimestamp()
          });

          tx.update(blackRef, {
            elo: Math.max(100, bElo + blackDelta),
            wins: FieldValue.increment(winnerSide === 'black' ? 1 : 0),
            losses: FieldValue.increment(winnerSide === 'black' ? 0 : 1),
            updatedAt: FieldValue.serverTimestamp()
          });

          updates.eloApplied = true;
          updates.eloDelta = { white: whiteDelta, black: blackDelta };
        }
      }

      tx.update(matchRef, updates);
    });

    await snap.ref.delete().catch(() => {});
  }
);
