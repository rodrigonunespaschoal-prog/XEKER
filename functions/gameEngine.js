// Módulo compartilhado de regras e estado do Xeker para o host autoritativo no Firebase

const PIECE_DATA = {
  king:   { name: 'Rei',       maxHp: 6, symbol: '♔', move: 'king',   attack: 'king',   range: 1 },
  queen:  { name: 'Rainha',    maxHp: 5, symbol: '♕', move: 'queen',  attack: 'queen',  range: 3 },
  rook:   { name: 'Torre',     maxHp: 5, symbol: '♖', move: 'rook',   attack: 'rook',   range: 3 },
  bishop: { name: 'Bispo',     maxHp: 4, symbol: '♗', move: 'bishop', attack: 'bishop', range: 3 },
  knight: { name: 'Cavaleiro', maxHp: 4, symbol: '♘', move: 'knight', attack: 'knight', range: 2 },
  pawn:   { name: 'Peão',      maxHp: 2, symbol: '♙', move: 'pawn',   attack: 'pawn',   range: 1 }
};

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function rankLabel(rank) {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

function createDeck() {
  const deck = [];
  let id = 1;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `c_${id++}`,
        rank,
        suit,
        label: `${rankLabel(rank)}${suit}`
      });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createInitialBoard() {
  const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  let pid = 1;

  for (let c = 0; c < 8; c++) {
    const bType = backRow[c];
    board[0][c] = {
      id: `p_${pid++}`,
      side: 'black',
      type: bType,
      hp: PIECE_DATA[bType].maxHp,
      maxHp: PIECE_DATA[bType].maxHp,
      moved: false,
      skillCooldown: 0
    };
    board[1][c] = {
      id: `p_${pid++}`,
      side: 'black',
      type: 'pawn',
      hp: PIECE_DATA.pawn.maxHp,
      maxHp: PIECE_DATA.pawn.maxHp,
      moved: false,
      skillCooldown: 0
    };
    board[6][c] = {
      id: `p_${pid++}`,
      side: 'white',
      type: 'pawn',
      hp: PIECE_DATA.pawn.maxHp,
      maxHp: PIECE_DATA.pawn.maxHp,
      moved: false,
      skillCooldown: 0
    };
    const wType = backRow[c];
    board[7][c] = {
      id: `p_${pid++}`,
      side: 'white',
      type: wType,
      hp: PIECE_DATA[wType].maxHp,
      maxHp: PIECE_DATA[wType].maxHp,
      moved: false,
      skillCooldown: 0
    };
  }
  return board;
}

function evaluateFiveCards(cards) {
  if (!cards || cards.length === 0) {
    return { score: 0, label: 'Sem cartas', power: 0 };
  }
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([r, cnt]) => ({ rank: Number(r), count: cnt }))
    .sort((a, b) => (b.count - a.count) || (b.rank - a.rank));

  const isFlush = cards.length === 5 && suits.every((s) => s === suits[0]);
  const uniqueDesc = [...new Set(ranks)].sort((a, b) => b - a);

  let isStraight = false;
  let straightHigh = 0;
  if (cards.length === 5 && uniqueDesc.length === 5) {
    if (uniqueDesc[0] - uniqueDesc[4] === 4) {
      isStraight = true;
      straightHigh = uniqueDesc[0];
    } else if (
      uniqueDesc[0] === 14 &&
      uniqueDesc[1] === 5 &&
      uniqueDesc[2] === 4 &&
      uniqueDesc[3] === 3 &&
      uniqueDesc[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  let category = 1;
  let label = 'Carta Alta';
  let tiebreakers = groups.map((g) => g.rank);

  if (isFlush && isStraight && straightHigh === 14) {
    category = 9;
    label = 'Royal Flush';
    tiebreakers = [14];
  } else if (isFlush && isStraight) {
    category = 8;
    label = 'Straight Flush';
    tiebreakers = [straightHigh];
  } else if (groups[0].count === 4) {
    category = 7;
    label = 'Quadra';
    tiebreakers = [groups[0].rank, groups[1] ? groups[1].rank : 0];
  } else if (groups[0].count === 3 && groups[1] && groups[1].count >= 2) {
    category = 6;
    label = 'Full House';
    tiebreakers = [groups[0].rank, groups[1].rank];
  } else if (isFlush) {
    category = 5;
    label = 'Flush';
    tiebreakers = ranks;
  } else if (isStraight) {
    category = 4;
    label = 'Sequência';
    tiebreakers = [straightHigh];
  } else if (groups[0].count === 3) {
    category = 3;
    label = 'Trinca';
    tiebreakers = [groups[0].rank, ...ranks.filter((r) => r !== groups[0].rank)];
  } else if (groups[0].count === 2 && groups[1] && groups[1].count === 2) {
    category = 2;
    label = 'Dois Pares';
    tiebreakers = [
      Math.max(groups[0].rank, groups[1].rank),
      Math.min(groups[0].rank, groups[1].rank),
      ...ranks.filter((r) => r !== groups[0].rank && r !== groups[1].rank)
    ];
  } else if (groups[0].count === 2) {
    category = 1.5;
    label = 'Um Par';
    tiebreakers = [groups[0].rank, ...ranks.filter((r) => r !== groups[0].rank)];
  } else {
    category = 1;
    label = 'Carta Alta';
    tiebreakers = ranks;
  }

  let score = category * 1000000;
  let mult = 10000;
  for (let i = 0; i < Math.min(tiebreakers.length, 4); i++) {
    score += tiebreakers[i] * mult;
    mult = Math.floor(mult / 20);
  }

  const power = Math.max(1, Math.round(category) + Math.floor((ranks[0] || 2) / 5));
  return { score, label, power };
}

function bestHandFromPool(poolCards) {
  if (!poolCards || poolCards.length === 0) {
    return { score: 0, label: 'Sem cartas', power: 0, cards: [] };
  }
  if (poolCards.length <= 5) {
    const ev = evaluateFiveCards(poolCards);
    return { ...ev, cards: poolCards };
  }

  let best = null;
  const n = poolCards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const combo = [poolCards[a], poolCards[b], poolCards[c], poolCards[d], poolCards[e]];
            const ev = evaluateFiveCards(combo);
            if (!best || ev.score > best.score) {
              best = { ...ev, cards: combo };
            }
          }
        }
      }
    }
  }
  return best;
}

function isPathClear(board, r1, c1, r2, c2) {
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  let r = r1 + dr;
  let c = c1 + dc;
  while (r !== r2 || c !== c2) {
    if (board[r][c] !== null) return false;
    r += dr;
    c += dc;
  }
  return true;
}

function canPieceAct(board, side, r1, c1, r2, c2, mode) {
  if (r1 === r2 && c1 === c2) return false;
  if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) return false;
  const piece = board[r1][c1];
  if (!piece || piece.side !== side) return false;

  const target = board[r2][c2];
  if (mode === 'move' && target !== null) return false;
  if (mode === 'attack' && (!target || target.side === side)) return false;

  const dr = r2 - r1;
  const dc = c2 - c1;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  const dist = Math.max(adr, adc);
  const info = PIECE_DATA[piece.type];

  switch (piece.type) {
    case 'king':
      return dist === 1;
    case 'queen':
      return (adr === 0 || adc === 0 || adr === adc) && dist <= info.range && isPathClear(board, r1, c1, r2, c2);
    case 'rook':
      return (adr === 0 || adc === 0) && dist <= info.range && isPathClear(board, r1, c1, r2, c2);
    case 'bishop':
      return adr === adc && dist <= info.range && isPathClear(board, r1, c1, r2, c2);
    case 'knight':
      return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
    case 'pawn': {
      const dir = side === 'white' ? -1 : 1;
      if (mode === 'move') {
        if (dc === 0 && dr === dir) return true;
        if (!piece.moved && dc === 0 && dr === dir * 2 && board[r1 + dir][c1] === null) return true;
        return false;
      }
      return dr === dir && adc === 1;
    }
    default:
      return false;
  }
}

function hasAnyKing(board, side) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.side === side && p.type === 'king') return true;
    }
  }
  return false;
}

function createInitialMatchState({ whiteUid, blackUid, whiteName, blackName, timeControlSec = 300, unrated = false }) {
  const deck = createDeck();
  const whiteHand = deck.splice(0, 3);
  const blackHand = deck.splice(0, 3);
  const flop = deck.splice(0, 3);

  return {
    board: createInitialBoard(),
    deck,
    flop,
    turn: 'white',
    turnNumber: 1,
    actionsLeft: 2,
    players: {
      white: {
        uid: whiteUid,
        name: whiteName || 'Brancas',
        coins: 3,
        hand: whiteHand,
        boughtThisTurn: false
      },
      black: {
        uid: blackUid,
        name: blackName || 'Pretas',
        coins: 3,
        hand: blackHand,
        boughtThisTurn: false
      }
    },
    clocks: {
      whiteMs: timeControlSec * 1000,
      blackMs: timeControlSec * 1000,
      lastTickAt: Date.now()
    },
    pendingCombat: null,
    gameOver: false,
    gameOverData: null,
    unrated: Boolean(unrated)
  };
}

function advanceTurn(state) {
  const nextTurn = state.turn === 'white' ? 'black' : 'white';
  state.turn = nextTurn;
  if (nextTurn === 'white') {
    state.turnNumber += 1;
  }
  state.actionsLeft = 2;
  state.players[nextTurn].boughtThisTurn = false;
  state.players[nextTurn].coins = Math.min(10, state.players[nextTurn].coins + 1);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.side === nextTurn && p.skillCooldown > 0) {
        p.skillCooldown -= 1;
      }
    }
  }
}

function finalizeCombatResolution(state, combat) {
  const atkEval = bestHandFromPool([...combat.attackerPicked, ...state.flop]);
  const defEval = bestHandFromPool([...combat.defenderPicked, ...state.flop]);

  const atkSide = combat.attackerSide;
  const defSide = combat.defenderSide;
  const atkPlayer = state.players[atkSide];
  const defPlayer = state.players[defSide];

  // Remove cartas usadas da mão
  const usedAtkIds = new Set(combat.attackerPicked.map((c) => c.id));
  const usedDefIds = new Set(combat.defenderPicked.map((c) => c.id));
  atkPlayer.hand = atkPlayer.hand.filter((c) => !usedAtkIds.has(c.id));
  defPlayer.hand = defPlayer.hand.filter((c) => !usedDefIds.has(c.id));

  // Repõe 1 carta se o baralho tiver cartas
  if (state.deck.length > 0 && atkPlayer.hand.length < 5) {
    atkPlayer.hand.push(state.deck.pop());
  }
  if (state.deck.length > 0 && defPlayer.hand.length < 5) {
    defPlayer.hand.push(state.deck.pop());
  }

  // Avança flop se necessário a cada 2 combates
  if (state.deck.length > 0 && state.flop.length < 5) {
    state.flop.push(state.deck.pop());
  }

  const atkPiece = state.board[combat.from.r][combat.from.c];
  const defPiece = state.board[combat.to.r][combat.to.c];

  let outcome = 'attacker_win';
  let damageToDef = Math.max(1, atkEval.power);
  let damageToAtk = 0;

  if (atkEval.score > defEval.score) {
    outcome = 'attacker_win';
    damageToDef = Math.max(1, atkEval.power);
    damageToAtk = 0;
  } else if (defEval.score > atkEval.score) {
    outcome = 'defender_win';
    damageToDef = 0;
    damageToAtk = Math.max(1, defEval.power);
  } else {
    outcome = 'draw';
    damageToDef = Math.max(1, Math.floor(atkEval.power / 2));
    damageToAtk = Math.max(1, Math.floor(defEval.power / 2));
  }

  if (defPiece && damageToDef > 0) {
    defPiece.hp -= damageToDef;
    if (defPiece.hp <= 0) {
      state.board[combat.to.r][combat.to.c] = null;
      if (outcome === 'attacker_win' && atkPiece && canPieceAct(state.board, atkSide, combat.from.r, combat.from.c, combat.to.r, combat.to.c, 'move')) {
        state.board[combat.to.r][combat.to.c] = atkPiece;
        state.board[combat.from.r][combat.from.c] = null;
      }
    }
  }

  if (atkPiece && damageToAtk > 0) {
    const curAtkPos = state.board[combat.from.r][combat.from.c] === atkPiece
      ? combat.from
      : (state.board[combat.to.r][combat.to.c] === atkPiece ? combat.to : null);
    atkPiece.hp -= damageToAtk;
    if (atkPiece.hp <= 0 && curAtkPos) {
      state.board[curAtkPos.r][curAtkPos.c] = null;
    }
  }

  state.pendingCombat = null;

  const whiteAlive = hasAnyKing(state.board, 'white');
  const blackAlive = hasAnyKing(state.board, 'black');
  if (!whiteAlive || !blackAlive) {
    const winnerSide = whiteAlive ? 'white' : 'black';
    state.gameOver = true;
    state.gameOverData = {
      winnerSide,
      reason: 'Rei abatido em combate'
    };
  } else {
    state.actionsLeft -= 1;
    if (state.actionsLeft <= 0) {
      advanceTurn(state);
    }
  }

  return {
    type: 'combat_resolved',
    outcome,
    attackerSide: atkSide,
    defenderSide: defSide,
    atkHandLabel: atkEval.label,
    defHandLabel: defEval.label,
    damageToDef,
    damageToAtk,
    targetCell: combat.to
  };
}

function buildViewForSide(state, viewerSide) {
  const oppSide = viewerSide === 'white' ? 'black' : 'white';
  return {
    board: state.board,
    flop: state.flop,
    deckCount: state.deck.length,
    turn: state.turn,
    turnNumber: state.turnNumber,
    actionsLeft: state.actionsLeft,
    mySide: viewerSide,
    myCoins: state.players[viewerSide].coins,
    oppCoins: state.players[oppSide].coins,
    myHand: state.players[viewerSide].hand,
    oppHandCount: state.players[oppSide].hand.length,
    boughtThisTurn: state.players[viewerSide].boughtThisTurn,
    clocks: state.clocks,
    pendingCombat: state.pendingCombat,
    gameOver: state.gameOver,
    gameOverData: state.gameOverData
  };
}

function applyCommandToState(prevState, senderSide, cmd) {
  if (!prevState || prevState.gameOver || !cmd || !cmd.type) {
    return { valid: false };
  }

  const state = JSON.parse(JSON.stringify(prevState));
  const now = Date.now();

  // Atualiza relógio do jogador ativo antes de aplicar o comando
  if (state.clocks && state.clocks.lastTickAt) {
    const elapsed = Math.max(0, now - state.clocks.lastTickAt);
    if (state.turn === 'white') {
      state.clocks.whiteMs = Math.max(0, state.clocks.whiteMs - elapsed);
    } else {
      state.clocks.blackMs = Math.max(0, state.clocks.blackMs - elapsed);
    }
    state.clocks.lastTickAt = now;

    if (state.clocks.whiteMs <= 0 || state.clocks.blackMs <= 0) {
      const winnerSide = state.clocks.whiteMs <= 0 ? 'black' : 'white';
      state.gameOver = true;
      state.gameOverData = {
        winnerSide,
        reason: 'Tempo esgotado'
      };
      return {
        valid: true,
        nextState: state,
        publicView: buildViewForSide(state, 'white'),
        whiteView: buildViewForSide(state, 'white'),
        blackView: buildViewForSide(state, 'black'),
        fxEvent: { type: 'timeout', winnerSide },
        summary: { winnerSide, reason: 'Tempo esgotado' }
      };
    }
  }

  if (cmd.type === 'surrender') {
    const winnerSide = senderSide === 'white' ? 'black' : 'white';
    state.gameOver = true;
    state.gameOverData = {
      winnerSide,
      reason: 'Oponente rendeu-se'
    };
    return {
      valid: true,
      nextState: state,
      publicView: buildViewForSide(state, 'white'),
      whiteView: buildViewForSide(state, 'white'),
      blackView: buildViewForSide(state, 'black'),
      fxEvent: { type: 'surrender', loserSide: senderSide, winnerSide },
      summary: { winnerSide, reason: 'Oponente rendeu-se' }
    };
  }

  // Se houver combate pendente, aceita apenas escolhas de cartas da fase atual
  if (state.pendingCombat) {
    const pc = state.pendingCombat;
    if (pc.stage === 'pick_attacker' && senderSide === pc.attackerSide) {
      const cardIds = Array.isArray(cmd.cardIds) ? cmd.cardIds : [];
      const handMap = new Map(state.players[senderSide].hand.map((c) => [c.id, c]));
      const chosen = cardIds.map((id) => handMap.get(id)).filter(Boolean);
      pc.attackerPicked = chosen.slice(0, 2);
      pc.stage = 'pick_defender';
    } else if (pc.stage === 'pick_defender' && senderSide === pc.defenderSide) {
      const cardIds = Array.isArray(cmd.cardIds) ? cmd.cardIds : [];
      const handMap = new Map(state.players[senderSide].hand.map((c) => [c.id, c]));
      const chosen = cardIds.map((id) => handMap.get(id)).filter(Boolean);
      pc.defenderPicked = chosen.slice(0, 2);
      const combatFx = finalizeCombatResolution(state, pc);
      return {
        valid: true,
        nextState: state,
        publicView: buildViewForSide(state, 'white'),
        whiteView: buildViewForSide(state, 'white'),
        blackView: buildViewForSide(state, 'black'),
        fxEvent: combatFx,
        summary: null
      };
    } else {
      return { valid: false };
    }

    return {
      valid: true,
      nextState: state,
      publicView: buildViewForSide(state, 'white'),
      whiteView: buildViewForSide(state, 'white'),
      blackView: buildViewForSide(state, 'black'),
      fxEvent: { type: 'combat_stage', stage: pc.stage },
      summary: null
    };
  }

  if (state.turn !== senderSide || state.actionsLeft <= 0) {
    return { valid: false };
  }

  let fxEvent = null;

  if (cmd.type === 'move') {
    const { from, to } = cmd;
    if (!from || !to) return { valid: false };
    if (!canPieceAct(state.board, senderSide, from.r, from.c, to.r, to.c, 'move')) {
      return { valid: false };
    }
    const piece = state.board[from.r][from.c];
    piece.moved = true;
    state.board[to.r][to.c] = piece;
    state.board[from.r][from.c] = null;

    state.actionsLeft -= 1;
    if (state.actionsLeft <= 0) {
      advanceTurn(state);
    }
    fxEvent = { type: 'move', side: senderSide, from, to, pieceType: piece.type };
  } else if (cmd.type === 'attack') {
    const { from, to } = cmd;
    if (!from || !to) return { valid: false };
    if (!canPieceAct(state.board, senderSide, from.r, from.c, to.r, to.c, 'attack')) {
      return { valid: false };
    }
    const defSide = senderSide === 'white' ? 'black' : 'white';
    state.pendingCombat = {
      attackerSide: senderSide,
      defenderSide: defSide,
      from: { r: from.r, c: from.c },
      to: { r: to.r, c: to.c },
      stage: 'pick_attacker',
      attackerPicked: [],
      defenderPicked: []
    };
    fxEvent = { type: 'combat_start', attackerSide: senderSide, defenderSide: defSide, from, to };
  } else if (cmd.type === 'buy') {
    const player = state.players[senderSide];
    if (player.boughtThisTurn || player.coins < 2 || state.deck.length === 0) {
      return { valid: false };
    }
    player.coins -= 2;
    player.boughtThisTurn = true;
    if (player.hand.length < 6) {
      player.hand.push(state.deck.pop());
    }
    state.actionsLeft -= 1;
    if (state.actionsLeft <= 0) {
      advanceTurn(state);
    }
    fxEvent = { type: 'buy', side: senderSide };
  } else if (cmd.type === 'end_turn') {
    advanceTurn(state);
    fxEvent = { type: 'end_turn', side: senderSide, nextTurn: state.turn };
  } else {
    return { valid: false };
  }

  return {
    valid: true,
    nextState: state,
    publicView: buildViewForSide(state, 'white'),
    whiteView: buildViewForSide(state, 'white'),
    blackView: buildViewForSide(state, 'black'),
    fxEvent,
    summary: null
  };
}

function calculateEloDelta(whiteElo, blackElo, winnerSide, kFactor = 24) {
  const expectedWhite = 1 / (1 + Math.pow(10, (blackElo - whiteElo) / 400));
  const actualWhite = winnerSide === 'white' ? 1 : 0;
  const whiteDelta = Math.round(kFactor * (actualWhite - expectedWhite));
  const blackDelta = -whiteDelta;
  return { whiteDelta, blackDelta };
}

module.exports = {
  PIECE_DATA,
  createDeck,
  createInitialBoard,
  createInitialMatchState,
  applyCommandToState,
  calculateEloDelta
};
