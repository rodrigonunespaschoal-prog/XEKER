// Módulo compartilhado de regras e estado do Xeker (100% alinhado com index_2.html)

const MAX_HAND_SIZE = 6;
const TURN_CLOCK_SECONDS = 60;

const RANK_TEXT = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K'
};

const PIECE_DATA = {
  P: {
    name: 'Peão',
    hp: 1,
    reward: 2,
    cardVal: 2,
    cardLabel: 'Coringa (2 a 9)',
    white: '♙',
    black: '♟'
  },
  R: {
    name: 'Torre',
    hp: 3,
    reward: 4,
    cardVal: 10,
    cardLabel: '10',
    white: '♖',
    black: '♜'
  },
  B: {
    name: 'Bispo',
    hp: 3,
    reward: 4,
    cardVal: 11,
    cardLabel: 'J',
    white: '♗',
    black: '♝'
  },
  Q: {
    name: 'Rainha',
    hp: 5,
    reward: 6,
    cardVal: 12,
    cardLabel: 'Q',
    white: '♕',
    black: '♛'
  },
  K: {
    name: 'Rei',
    hp: 7,
    reward: 0,
    cardVal: 13,
    cardLabel: 'K',
    white: '♔',
    black: '♚'
  },
  N: {
    name: 'Cavalo',
    hp: 3,
    reward: 4,
    cardVal: 1,
    cardLabel: 'A',
    white: '♘',
    black: '♞'
  }
};

function insideBoard(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function createDeck() {
  const arr = [];
  for (let val = 1; val <= 13; val++) {
    for (let copy = 0; copy < 3; copy++) {
      arr.push(val);
    }
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

function drawCardFromState(state) {
  if (!state) return null;
  if ((!state.deck || state.deck.length === 0) && state.discard && state.discard.length > 0) {
    state.deck = state.discard.splice(0, state.discard.length);
    for (let i = state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = state.deck[i];
      state.deck[i] = state.deck[j];
      state.deck[j] = temp;
    }
  }
  return state.deck && state.deck.length > 0 ? state.deck.pop() : null;
}

function dealFlopInState(state) {
  if (!state) return;
  if (!Array.isArray(state.discard)) state.discard = [];
  if (Array.isArray(state.flop) && state.flop.length > 0) {
    state.discard.push(...state.flop);
  }
  state.flop = [];
  for (let i = 0; i < 3; i++) {
    const c = drawCardFromState(state);
    if (c !== null) state.flop.push(c);
  }
}

function maybeDrawEveryTwoOwnTurns(state, side) {
  if (!state || !side) return null;
  if (!state.ownTurns) state.ownTurns = { white: 1, black: 0 };
  state.ownTurns[side] = (state.ownTurns[side] || 0) + 1;
  if (state.ownTurns[side] % 2 !== 0) return null;

  const hand = state.players[side].hand;
  if (hand.length >= MAX_HAND_SIZE) return null;
  const c = drawCardFromState(state);
  if (c !== null) {
    hand.push(c);
    return c;
  }
  return null;
}

function buildInitialBoard() {
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

  for (let col = 0; col < 8; col++) {
    const bType = backRank[col];
    grid[0][col] = {
      id: `b_${bType}_${col}`,
      color: 'black',
      type: bType,
      hp: PIECE_DATA[bType].hp,
      maxHp: PIECE_DATA[bType].hp,
      cardVal: PIECE_DATA[bType].cardVal,
      acted: false
    };
    grid[1][col] = {
      id: `b_P_${col}`,
      color: 'black',
      type: 'P',
      hp: PIECE_DATA.P.hp,
      maxHp: PIECE_DATA.P.hp,
      cardVal: PIECE_DATA.P.cardVal,
      acted: false
    };

    const wType = backRank[col];
    grid[7][col] = {
      id: `w_${wType}_${col}`,
      color: 'white',
      type: wType,
      hp: PIECE_DATA[wType].hp,
      maxHp: PIECE_DATA[wType].hp,
      cardVal: PIECE_DATA[wType].cardVal,
      acted: false
    };
    grid[6][col] = {
      id: `w_P_${col}`,
      color: 'white',
      type: 'P',
      hp: PIECE_DATA.P.hp,
      maxHp: PIECE_DATA.P.hp,
      cardVal: PIECE_DATA.P.cardVal,
      acted: false
    };
  }
  return grid;
}

function pokerRank(val) {
  return val === 1 ? 14 : val;
}

function evaluateFixedRanks5(ranks) {
  const counts = new Map();
  for (const r of ranks) {
    counts.set(r, (counts.get(r) || 0) + 1);
  }

  const sortedGroups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const uniqueDesc = Array.from(counts.keys()).sort((a, b) => b - a);
  let straight = false;
  let straightTop = 0;

  if (uniqueDesc.length === 5) {
    if (uniqueDesc[0] - uniqueDesc[4] === 4) {
      straight = true;
      straightTop = uniqueDesc[0];
    } else if (
      uniqueDesc[0] === 14 &&
      uniqueDesc[1] === 5 &&
      uniqueDesc[2] === 4 &&
      uniqueDesc[3] === 3 &&
      uniqueDesc[4] === 2
    ) {
      straight = true;
      straightTop = 5;
    }
  }

  const fmt = (pr) => RANK_TEXT[pr === 14 ? 1 : pr];

  if (sortedGroups[0][1] >= 4) {
    const k = sortedGroups[1] ? fmt(sortedGroups[1][0]) : '';
    return {
      cat: 6,
      name: `Quadra de ${fmt(sortedGroups[0][0])}${k ? ` (${k})` : ''}`,
      tie: [sortedGroups[0][0], sortedGroups[1] ? sortedGroups[1][0] : 0]
    };
  }
  if (sortedGroups[0][1] === 3 && sortedGroups[1] && sortedGroups[1][1] === 2) {
    return {
      cat: 5,
      name: `Full House (${fmt(sortedGroups[0][0])} e ${fmt(sortedGroups[1][0])})`,
      tie: [sortedGroups[0][0], sortedGroups[1][0]]
    };
  }
  if (straight) {
    return {
      cat: 4,
      name: `Sequência (maior ${fmt(straightTop)})`,
      tie: [straightTop]
    };
  }
  if (sortedGroups[0][1] === 3) {
    const kickers = sortedGroups.slice(1).map((x) => x[0]).sort((a, b) => b - a);
    return {
      cat: 3,
      name: `Trinca de ${fmt(sortedGroups[0][0])}`,
      tie: [sortedGroups[0][0], ...kickers]
    };
  }
  if (sortedGroups[0][1] === 2 && sortedGroups[1] && sortedGroups[1][1] === 2) {
    const hi = Math.max(sortedGroups[0][0], sortedGroups[1][0]);
    const lo = Math.min(sortedGroups[0][0], sortedGroups[1][0]);
    const k = sortedGroups[2] ? sortedGroups[2][0] : 0;
    return {
      cat: 2,
      name: `2 Pares (${fmt(hi)} e ${fmt(lo)})`,
      tie: [hi, lo, k]
    };
  }
  if (sortedGroups[0][1] === 2) {
    const kickers = sortedGroups.slice(1).map((x) => x[0]).sort((a, b) => b - a);
    return {
      cat: 1,
      name: `1 Par de ${fmt(sortedGroups[0][0])}`,
      tie: [sortedGroups[0][0], ...kickers]
    };
  }
  return {
    cat: 0,
    name: `Carta Alta (${fmt(uniqueDesc[0])})`,
    tie: uniqueDesc
  };
}

function comparePokerHands(h1, h2) {
  if (h1.cat !== h2.cat) return h1.cat - h2.cat;
  const len = Math.max(h1.tie.length, h2.tie.length);
  for (let i = 0; i < len; i++) {
    const v1 = h1.tie[i] || 0;
    const v2 = h2.tie[i] || 0;
    if (v1 !== v2) return v1 - v2;
  }
  return 0;
}

function evaluateCombatHand(cards4, piece) {
  if (piece && piece.type === 'P') {
    let best = null;
    for (let wildVal = 2; wildVal <= 9; wildVal++) {
      const ranks = [...cards4.map(pokerRank), wildVal];
      const ev = evaluateFixedRanks5(ranks);
      if (!best || comparePokerHands(ev, best) > 0) {
        best = ev;
      }
    }
    return best;
  }
  const ranks = [...cards4.map(pokerRank), pokerRank(piece ? piece.cardVal : 1)];
  return evaluateFixedRanks5(ranks);
}

function getReachInfo(board, r, c) {
  const piece = board[r][c];
  const moves = [];
  const attacks = [];
  const allies = [];
  const enemies = [];
  const allPieces = [];

  if (!piece) {
    return { moves, attacks, allies, enemies, allPieces };
  }

  if (piece.type === 'N') {
    const lOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of lOffsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (!insideBoard(nr, nc)) continue;
      const occ = board[nr][nc];
      if (!occ) {
        moves.push({ r: nr, c: nc });
      } else {
        allPieces.push({ r: nr, c: nc, piece: occ });
        if (occ.color === piece.color) {
          allies.push({ r: nr, c: nc, piece: occ });
        } else {
          attacks.push({ r: nr, c: nc });
          enemies.push({ r: nr, c: nc, piece: occ });
        }
      }
    }
    return { moves, attacks, allies, enemies, allPieces };
  }

  let dirs = [];
  let steps = 1;

  if (piece.type === 'P') {
    dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    steps = 1;
  } else if (piece.type === 'R') {
    dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    steps = 3;
  } else if (piece.type === 'B') {
    dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    steps = 3;
  } else if (piece.type === 'Q') {
    dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    steps = 3;
  } else if (piece.type === 'K') {
    dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    steps = 2;
  }

  for (const [dr, dc] of dirs) {
    for (let s = 1; s <= steps; s++) {
      const nr = r + dr * s;
      const nc = c + dc * s;
      if (!insideBoard(nr, nc)) break;
      const occ = board[nr][nc];
      if (!occ) {
        moves.push({ r: nr, c: nc });
      } else {
        allPieces.push({ r: nr, c: nc, piece: occ });
        if (occ.color === piece.color) {
          allies.push({ r: nr, c: nc, piece: occ });
        } else {
          attacks.push({ r: nr, c: nc });
          enemies.push({ r: nr, c: nc, piece: occ });
        }
        break;
      }
    }
  }

  return { moves, attacks, allies, enemies, allPieces };
}

function getKnightSkillDestinations(board, tr, tc) {
  const dests = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = tr + dr;
      const nc = tc + dc;
      if (insideBoard(nr, nc) && !board[nr][nc]) {
        dests.push({ r: nr, c: nc });
      }
    }
  }
  return dests;
}

function applyQueenAbatePassive(state, side) {
  if (!state || state.gameOver) return 0;
  let healed = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.color === side && p.type === 'Q' && p.hp > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + 1);
        healed += 1;
      }
    }
  }
  return healed;
}

function promotePawnIfCrossed(piece, r) {
  if (!piece || piece.type !== 'P') return false;
  const crossed = (piece.color === 'white' && r === 0) || (piece.color === 'black' && r === 7);
  if (!crossed) return false;
  piece.type = 'Q';
  piece.cardVal = PIECE_DATA.Q.cardVal;
  piece.maxHp = PIECE_DATA.Q.hp;
  piece.hp = Math.max(piece.hp, PIECE_DATA.Q.hp);
  return true;
}

function createInitialMatchState({ whiteUid, blackUid, whiteName, blackName, unrated = false } = {}) {
  const state = {
    mode: 'ranked',
    turn: 'white',
    round: 1,
    ownTurns: { white: 1, black: 0 },
    actions: 2,
    clocks: {
      white: TURN_CLOCK_SECONDS,
      black: TURN_CLOCK_SECONDS,
      lastTickAt: Date.now()
    },
    board: buildInitialBoard(),
    deck: createDeck(),
    discard: [],
    flop: [],
    players: {
      white: {
        uid: whiteUid || 'white',
        name: whiteName || 'Brancas',
        gold: 0,
        hand: []
      },
      black: {
        uid: blackUid || 'black',
        name: blackName || 'Pretas',
        gold: 0,
        hand: []
      }
    },
    pendingCombat: null,
    lastSummary: null,
    gameOver: false,
    gameOverData: null,
    unrated: Boolean(unrated)
  };

  for (let i = 0; i < 3; i++) {
    const wc = drawCardFromState(state);
    const bc = drawCardFromState(state);
    if (wc !== null) state.players.white.hand.push(wc);
    if (bc !== null) state.players.black.hand.push(bc);
  }

  dealFlopInState(state);
  return state;
}

function advanceTurn(state) {
  const currentTurnSide = state.turn;
  state.clocks.white = TURN_CLOCK_SECONDS;
  state.clocks.black = TURN_CLOCK_SECONDS;
  state.clocks.lastTickAt = Date.now();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p) p.acted = false;
    }
  }

  if (currentTurnSide === 'white') {
    state.turn = 'black';
    state.actions = 2;
    maybeDrawEveryTwoOwnTurns(state, 'black');
  } else {
    state.turn = 'white';
    state.round = (state.round || 1) + 1;
    state.actions = 2;
    maybeDrawEveryTwoOwnTurns(state, 'white');
  }
}

function resolveCombatInState(state, combat, atkCard, defCard) {
  const atkPiece = state.board[combat.atkR][combat.atkC];
  const defPiece = state.board[combat.defR][combat.defC];
  if (!atkPiece || !defPiece) {
    state.pendingCombat = null;
    return null;
  }

  const atkSnap = { ...atkPiece };
  const defSnap = { ...defPiece };
  const atkName = PIECE_DATA[atkPiece.type].name;
  const defName = PIECE_DATA[defPiece.type].name;

  const atkHand = evaluateCombatHand([...state.flop, atkCard], atkPiece);
  const defHand = defCard !== null && defCard !== undefined
    ? evaluateCombatHand([...state.flop, defCard], defPiece)
    : { cat: 0, name: 'Sem Cartas', tie: [0] };

  const cmp = defCard !== null && defCard !== undefined ? comparePokerHands(atkHand, defHand) : 1;
  const attackWon = cmp > 0;
  const winSide = attackWon ? 'atk' : 'def';
  const winHand = attackWon ? atkHand : defHand;
  const winColor = attackWon ? atkPiece.color : defPiece.color;
  const winPiece = attackWon ? atkPiece : defPiece;

  let atkDmg = 0;
  let defDmg = 0;
  let extraActions = 0;
  let healedHp = 0;
  const extras = [];

  if (attackWon) {
    defDmg = 2;
    if (winHand.cat === 3 || winHand.cat === 5) defDmg += 1;
  } else {
    atkDmg = 1;
    defDmg = defPiece.type === 'R' ? 0 : 1;
    if (atkPiece.type === 'B') {
      atkDmg = 0;
      extras.push('Passiva do Bispo: sem dano se defenderem seu ataque');
    }
    if (defPiece.type === 'R') {
      extras.push('Passiva da Torre: 0♥ ao defender');
    }
    if (winHand.cat === 3 || winHand.cat === 5) atkDmg += 1;
  }

  if (winHand.cat === 1) {
    const before = winPiece.hp;
    winPiece.hp = Math.min(winPiece.maxHp, winPiece.hp + 2);
    healedHp = winPiece.hp - before;
  } else if (winHand.cat === 2) {
    state.players[winColor].gold += 4;
    extras.push('+♦4 (2 Pares)');
  } else if (winHand.cat === 4) {
    extraActions += 1;
    if (state.players[winColor].hand.length < MAX_HAND_SIZE) {
      const extraC = drawCardFromState(state);
      if (extraC !== null) state.players[winColor].hand.push(extraC);
    }
    extras.push('+1♣ e +1 carta (Sequência)');
  } else if (winHand.cat === 5) {
    const before = winPiece.hp;
    winPiece.hp = Math.min(winPiece.maxHp, winPiece.hp + 2);
    healedHp = winPiece.hp - before;
  } else if (winHand.cat === 6) {
    if (winSide === 'atk') defDmg = defPiece.hp + 99;
    else atkDmg = atkPiece.hp + 99;
    state.players[winColor].gold += 8;
    extras.push('Abate imediato + ♦8 (Quadra)');
  }

  const actualAtkDmg = Math.min(atkPiece.hp, Math.max(0, atkDmg));
  const actualDefDmg = Math.min(defPiece.hp, Math.max(0, defDmg));

  atkPiece.hp -= atkDmg;
  defPiece.hp -= defDmg;

  const atkDead = atkPiece.hp <= 0;
  const defDead = defPiece.hp <= 0;
  let winnerSideEnd = null;

  if (defDead) {
    state.board[combat.defR][combat.defC] = null;
    const qHeal = applyQueenAbatePassive(state, atkPiece.color);
    if (qHeal > 0) extras.push(`Passiva da Rainha: +${qHeal}♥`);
    if (defPiece.type === 'K') {
      winnerSideEnd = atkPiece.color;
    } else {
      const rwd = PIECE_DATA[defPiece.type].reward || 0;
      state.players[atkPiece.color].gold += rwd;
      extras.push(`Abate de ${defName}: +♦${rwd}`);
    }
  }

  if (!winnerSideEnd && atkDead) {
    state.board[combat.atkR][combat.atkC] = null;
    const qHeal = applyQueenAbatePassive(state, defPiece.color);
    if (qHeal > 0) extras.push(`Passiva da Rainha: +${qHeal}♥`);
    if (atkPiece.type === 'K') {
      winnerSideEnd = defPiece.color;
    } else {
      const rwd = PIECE_DATA[atkPiece.type].reward || 0;
      state.players[defPiece.color].gold += rwd;
      extras.push(`Abate de ${atkName}: +♦${rwd}`);
    }
  }

  if (!winnerSideEnd) {
    if (defDead && !atkDead) {
      state.board[combat.defR][combat.defC] = atkPiece;
      state.board[combat.atkR][combat.atkC] = null;
      promotePawnIfCrossed(atkPiece, combat.defR);
    } else if (atkDead && !defDead) {
      state.board[combat.atkR][combat.atkC] = defPiece;
      state.board[combat.defR][combat.defC] = null;
      promotePawnIfCrossed(defPiece, combat.atkR);
    }
  }

  if (atkCard !== null && atkCard !== undefined) state.discard.push(atkCard);
  if (defCard !== null && defCard !== undefined) state.discard.push(defCard);
  dealFlopInState(state);

  if (extraActions > 0 && state.turn === winColor) {
    state.actions += extraActions;
  }

  state.actions = Math.max(0, state.actions - 1);
  atkPiece.acted = true;
  state.pendingCombat = null;

  if (winnerSideEnd) {
    const wLabel = winnerSideEnd === 'white' ? '♔ Brancas' : '♚ Pretas';
    state.gameOver = true;
    state.gameOverData = {
      title: `Vitória das ${wLabel}`,
      desc: 'O Rei adversário foi abatido!',
      winnerSide: winnerSideEnd,
      reason: 'O Rei adversário foi abatido!'
    };
  }

  const summary = {
    atkCard,
    defCard,
    atkPiece: atkSnap,
    defPiece: defSnap,
    atkPos: { r: combat.atkR, c: combat.atkC },
    defPos: { r: combat.defR, c: combat.defC },
    atkHand,
    defHand,
    winHand,
    attackWon,
    atkName,
    defName,
    atkDmg: actualAtkDmg,
    defDmg: actualDefDmg,
    healedHp,
    extraInfo: extras.join(' · '),
    winnerSideEnd
  };

  state.lastSummary = summary;
  return summary;
}

function buildViewForSide(state, viewerSide) {
  return {
    mode: state.mode || 'ranked',
    turn: state.turn,
    round: state.round,
    ownTurns: state.ownTurns,
    actions: state.actions,
    clocks: {
      white: state.clocks.white,
      black: state.clocks.black
    },
    board: state.board,
    flop: state.flop,
    players: {
      white: {
        gold: state.players.white.gold,
        handCount: state.players.white.hand.length,
        ...(viewerSide === 'white' ? { hand: state.players.white.hand.slice() } : {})
      },
      black: {
        gold: state.players.black.gold,
        handCount: state.players.black.hand.length,
        ...(viewerSide === 'black' ? { hand: state.players.black.hand.slice() } : {})
      }
    },
    pendingCombat: state.pendingCombat
      ? {
          atkR: state.pendingCombat.atkR,
          atkC: state.pendingCombat.atkC,
          defR: state.pendingCombat.defR,
          defC: state.pendingCombat.defC,
          atkPiece: state.pendingCombat.atkPiece,
          defPiece: state.pendingCombat.defPiece,
          atkHandCount: state.players[state.pendingCombat.atkPiece.color].hand.length,
          defHandCount: state.players[state.pendingCombat.defPiece.color].hand.length,
          stage: state.pendingCombat.stage
        }
      : null,
    lastSummary: state.lastSummary,
    gameOver: state.gameOver,
    gameOverData: state.gameOverData
  };
}

function applyCommandToState(prevState, senderSide, cmd) {
  if (!prevState || prevState.gameOver || !cmd) {
    return { valid: false };
  }

  const kind = cmd.kind || cmd.type;
  if (!kind) return { valid: false };

  const state = JSON.parse(JSON.stringify(prevState));

  if (kind === 'surrender') {
    const winnerSide = senderSide === 'white' ? 'black' : 'white';
    const surrenderingLabel = senderSide === 'white' ? 'Brancas (♔)' : 'Pretas (♚)';
    const winnerLabel = winnerSide === 'white' ? '♔ Brancas' : '♚ Pretas';
    state.gameOver = true;
    state.gameOverData = {
      title: `Vitória das ${winnerLabel}`,
      desc: `${surrenderingLabel} se rendeu.`,
      winnerSide,
      reason: `${surrenderingLabel} se rendeu.`
    };
    return {
      valid: true,
      nextState: state,
      publicView: buildViewForSide(state, 'white'),
      whiteView: buildViewForSide(state, 'white'),
      blackView: buildViewForSide(state, 'black'),
      fxEvent: { type: 'surrender', loserSide: senderSide, winnerSide },
      summary: state.gameOverData
    };
  }

  // Escolha de carta durante combate pendente
  if (state.pendingCombat) {
    const pc = state.pendingCombat;
    if (pc.stage === 'awaiting_attacker' && senderSide === pc.atkPiece.color) {
      const idx = Number(cmd.cardIdx);
      const hand = state.players[senderSide].hand;
      if (!Number.isInteger(idx) || idx < 0 || idx >= hand.length) return { valid: false };
      pc.atkCard = hand.splice(idx, 1)[0];

      const defSide = pc.defPiece.color;
      if (state.players[defSide].hand.length === 0) {
        const summary = resolveCombatInState(state, pc, pc.atkCard, null);
        return {
          valid: true,
          nextState: state,
          publicView: buildViewForSide(state, 'white'),
          whiteView: buildViewForSide(state, 'white'),
          blackView: buildViewForSide(state, 'black'),
          fxEvent: { type: 'combat_resolved', summary },
          summary
        };
      }

      pc.stage = 'awaiting_defender';
      return {
        valid: true,
        nextState: state,
        publicView: buildViewForSide(state, 'white'),
        whiteView: buildViewForSide(state, 'white'),
        blackView: buildViewForSide(state, 'black'),
        fxEvent: { type: 'combat_stage', stage: 'awaiting_defender' },
        summary: null
      };
    }

    if (pc.stage === 'awaiting_defender' && senderSide === pc.defPiece.color) {
      const idx = Number(cmd.cardIdx);
      const hand = state.players[senderSide].hand;
      if (!Number.isInteger(idx) || idx < 0 || idx >= hand.length) return { valid: false };
      const defCard = hand.splice(idx, 1)[0];
      const summary = resolveCombatInState(state, pc, pc.atkCard, defCard);
      return {
        valid: true,
        nextState: state,
        publicView: buildViewForSide(state, 'white'),
        whiteView: buildViewForSide(state, 'white'),
        blackView: buildViewForSide(state, 'black'),
        fxEvent: { type: 'combat_resolved', summary },
        summary
      };
    }

    return { valid: false };
  }

  if (state.turn !== senderSide) {
    return { valid: false };
  }

  let fxEvent = null;

  if (kind === 'move') {
    const fromR = cmd.from ? cmd.from.r : cmd.fromR;
    const fromC = cmd.from ? cmd.from.c : cmd.fromC;
    const toR = cmd.to ? cmd.to.r : cmd.toR;
    const toC = cmd.to ? cmd.to.c : cmd.toC;
    if (!insideBoard(fromR, fromC) || !insideBoard(toR, toC) || state.actions <= 0) {
      return { valid: false };
    }
    const piece = state.board[fromR][fromC];
    if (!piece || piece.color !== senderSide || piece.acted) return { valid: false };
    const reach = getReachInfo(state.board, fromR, fromC);
    if (!reach.moves.some((m) => m.r === toR && m.c === toC)) return { valid: false };

    state.board[toR][toC] = piece;
    state.board[fromR][fromC] = null;
    state.actions = Math.max(0, state.actions - 1);
    piece.acted = true;
    promotePawnIfCrossed(piece, toR);
    fxEvent = { move: { fromR, fromC, toR, toC } };
  } else if (kind === 'attack') {
    const fromR = cmd.from ? cmd.from.r : cmd.fromR;
    const fromC = cmd.from ? cmd.from.c : cmd.fromC;
    const toR = cmd.to ? cmd.to.r : cmd.toR;
    const toC = cmd.to ? cmd.to.c : cmd.toC;
    if (!insideBoard(fromR, fromC) || !insideBoard(toR, toC) || state.actions <= 0) {
      return { valid: false };
    }
    const atkPiece = state.board[fromR][fromC];
    const defPiece = state.board[toR][toC];
    if (!atkPiece || !defPiece || atkPiece.color !== senderSide || atkPiece.acted) {
      return { valid: false };
    }
    if (state.players[senderSide].hand.length === 0) return { valid: false };
    const reach = getReachInfo(state.board, fromR, fromC);
    if (!reach.attacks.some((a) => a.r === toR && a.c === toC)) return { valid: false };

    const defSide = defPiece.color;
    if (state.players[defSide].hand.length === 0) {
      const used = state.players[senderSide].hand.pop();
      const summary = resolveCombatInState(
        state,
        { atkR: fromR, atkC: fromC, defR: toR, defC: toC, atkPiece: { ...atkPiece }, defPiece: { ...defPiece } },
        used,
        null
      );
      return {
        valid: true,
        nextState: state,
        publicView: buildViewForSide(state, 'white'),
        whiteView: buildViewForSide(state, 'white'),
        blackView: buildViewForSide(state, 'black'),
        fxEvent: { type: 'combat_resolved', summary },
        summary
      };
    }

    state.pendingCombat = {
      atkR: fromR,
      atkC: fromC,
      defR: toR,
      defC: toC,
      atkPiece: { ...atkPiece },
      defPiece: { ...defPiece },
      atkCard: null,
      stage: 'awaiting_attacker'
    };
    fxEvent = { type: 'combat_start', fromR, fromC, toR, toC };
  } else if (kind === 'skill') {
    const { fromR, fromC, effType, toR, toC } = cmd;
    if (!insideBoard(fromR, fromC)) return { valid: false };
    const userPiece = state.board[fromR][fromC];
    const player = state.players[senderSide];
    if (!userPiece || userPiece.color !== senderSide || userPiece.acted || player.gold < 1) {
      return { valid: false };
    }
    const skill = effType || userPiece.type;

    if (skill === 'P') {
      const reach = getReachInfo(state.board, fromR, fromC);
      if (reach.enemies.length === 0) return { valid: false };
      player.gold -= 1;
      state.board[fromR][fromC] = null;
      for (const item of reach.enemies) {
        const enemy = state.board[item.r][item.c];
        if (!enemy) continue;
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          state.board[item.r][item.c] = null;
          applyQueenAbatePassive(state, senderSide);
          if (enemy.type === 'K') {
            const wLabel = senderSide === 'white' ? '♔ Brancas' : '♚ Pretas';
            state.gameOver = true;
            state.gameOverData = { title: `Vitória das ${wLabel}`, desc: 'O Rei adversário foi abatido!', winnerSide: senderSide, reason: 'O Rei adversário foi abatido!' };
            break;
          } else {
            player.gold += PIECE_DATA[enemy.type].reward || 0;
          }
        }
      }
      userPiece.acted = true;
      fxEvent = { type: 'skill', skill: 'P', fromR, fromC };
    } else if (skill === 'B') {
      const reach = getReachInfo(state.board, fromR, fromC);
      if (reach.allies.length === 0) return { valid: false };
      player.gold -= 1;
      for (const item of reach.allies) {
        const ally = state.board[item.r][item.c];
        if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + 1);
      }
      userPiece.acted = true;
      fxEvent = { type: 'skill', skill: 'B', fromR, fromC };
    } else if (skill === 'R') {
      if (!insideBoard(toR, toC) || (toR === fromR && toC === fromC)) return { valid: false };
      const targetPiece = state.board[toR][toC];
      if (!targetPiece) return { valid: false };
      player.gold -= 1;
      state.board[toR][toC] = userPiece;
      state.board[fromR][fromC] = targetPiece;
      userPiece.acted = true;
      fxEvent = {
        swapMoves: [
          { fromR, fromC, toR, toC },
          { fromR: toR, fromC: toC, toR: fromR, toC: fromC }
        ]
      };
    } else if (skill === 'N') {
      if (!insideBoard(toR, toC) || !state.board[toR][toC]) return { valid: false };
      const dests = getKnightSkillDestinations(state.board, toR, toC);
      if (dests.length === 0) return { valid: false };
      const dest = dests[0];
      const movedTarget = state.board[toR][toC];
      player.gold -= 1;
      state.board[dest.r][dest.c] = movedTarget;
      state.board[toR][toC] = null;
      promotePawnIfCrossed(movedTarget, dest.r);
      userPiece.acted = true;
      fxEvent = { move: { fromR: toR, fromC: toC, toR: dest.r, toC: dest.c } };
    } else if (skill === 'K') {
      if (!insideBoard(toR, toC)) return { valid: false };
      const enemy = state.board[toR][toC];
      if (!enemy || enemy.color === senderSide) return { valid: false };
      player.gold -= 1;
      enemy.hp = Math.max(1, enemy.hp - 2);
      userPiece.acted = true;
      fxEvent = { type: 'skill', skill: 'K', toR, toC };
    } else {
      return { valid: false };
    }
  } else if (kind === 'buy') {
    const player = state.players[senderSide];
    if (player.gold < 3 || player.hand.length >= MAX_HAND_SIZE) {
      return { valid: false };
    }
    const drawn = drawCardFromState(state);
    if (drawn === null) return { valid: false };
    player.gold -= 3;
    player.hand.push(drawn);
    fxEvent = { type: 'buy', side: senderSide };
  } else if (kind === 'end_turn') {
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
    summary: state.gameOverData
  };
}

function calculateEloDelta(myElo, oppElo, score) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
  return Math.round(K * (score - expected));
}

module.exports = {
  MAX_HAND_SIZE,
  TURN_CLOCK_SECONDS,
  RANK_TEXT,
  PIECE_DATA,
  createDeck,
  buildInitialBoard,
  createInitialMatchState,
  evaluateCombatHand,
  comparePokerHands,
  getReachInfo,
  applyCommandToState,
  calculateEloDelta
};
