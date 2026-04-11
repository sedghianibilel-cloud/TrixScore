import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ─── Card utilities ──────────────────────────────────────────────────────────
const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"];
const TRICK_RANKS = ["7", "8", "9", "J", "Q", "K", "10", "A"];
const SUITS = ["H", "D", "C", "S"];

const getSuit = (c: string) => c[c.length - 1];
const getRank = (c: string) => c.slice(0, -1);
const rankIdx = (c: string) => RANKS.indexOf(getRank(c));
const trickRankIdx = (c: string) => TRICK_RANKS.indexOf(getRank(c));

function buildDeck(): string[] {
  const deck: string[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return deck;
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cards that are considered "valued" or penalty cards in normal games
function getValuedCards(game: string): string[] {
  const hearts = RANKS.map((r) => r + "H");
  const diamonds = RANKS.map((r) => r + "D");
  const queens = ["QH", "QD", "QC", "QS"];
  switch (game) {
    case "king":        return ["KH"];
    case "queens":      return queens;
    case "diamonds":    return diamonds;
    case "queen-spades":return ["QS", ...hearts];
    case "general":     return [...new Set(["KH", ...queens, ...diamonds, "QS", ...hearts])];
    default:            return [];
  }
}
function trickWinner(trick: { seatIndex: number; card: string }[]): number {
  const leadSuit = getSuit(trick[0].card);
  let best = trick[0];
  for (const t of trick)
    if (getSuit(t.card) === leadSuit && trickRankIdx(t.card) > trickRankIdx(best.card)) best = t;
  return best.seatIndex;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────
function calcRoundScores(
  game: string,
  tricksTaken: string[][],  // index = seatIndex
  lastTrickTaker: number,
  trixOrder: number[],
  doublingSeats: number[],
  seats: { name: string; seatIndex: number; score: number; mkabbatha: number; wakelRay: number; elMrabba3: number; chosenGames: string[] }[]
) {
  const n = 4;
  const base = new Array(n).fill(0);
  let newMkabbatha = new Array(n).fill(0);
  let newWakelRay  = new Array(n).fill(0);
  let newElMrabba3 = new Array(n).fill(0);

  if (game === "trix") {
    const pos = [-150, -100, -50, 0];
    trixOrder.forEach((seat, i) => { base[seat] = pos[i]; });

  } else if (game === "king") {
    for (let i = 0; i < n; i++) {
      if (tricksTaken[i].includes("KH")) { base[i] = 100; newWakelRay[i]++; }
    }

  } else if (game === "last-trick") {
    base[lastTrickTaker] = 80;

  } else if (game === "queens") {
    const qCounts = tricksTaken.map((c) => c.filter((x) => getRank(x) === "Q").length);
    const capot = qCounts.findIndex((c) => c === 4);
    if (capot !== -1) {
      for (let i = 0; i < n; i++) base[i] = i === capot ? 0 : 80;
      newMkabbatha[capot]++;
    } else {
      for (let i = 0; i < n; i++) base[i] = qCounts[i] * 20;
    }

  } else if (game === "diamonds") {
    const dCounts = tricksTaken.map((c) => c.filter((x) => getSuit(x) === "D").length);
    for (let i = 0; i < n; i++) newElMrabba3[i] = dCounts[i];
    const capot = dCounts.findIndex((c) => c === 8);
    if (capot !== -1) {
      for (let i = 0; i < n; i++) base[i] = i === capot ? 0 : 80;
      newMkabbatha[capot]++;
    } else {
      for (let i = 0; i < n; i++) base[i] = dCounts[i] * 10;
    }

  } else if (game === "tricks") {
    const pCounts = tricksTaken.map((_, i) =>
      tricksTaken[i].length > 0 ? Math.ceil(tricksTaken[i].length / 4) : 0
    );
    // pCounts not right — tricksTaken[i] holds ALL cards taken by seat i (4 per trick)
    // # tricks = cards.length / 4
    const tricksWon = tricksTaken.map((c) => c.length / 4);
    const capot = tricksWon.findIndex((c) => c === 8);
    if (capot !== -1) {
      for (let i = 0; i < n; i++) base[i] = i === capot ? 0 : 80;
      newMkabbatha[capot]++;
    } else {
      for (let i = 0; i < n; i++) base[i] = tricksWon[i] * 10;
    }

  } else if (game === "queen-spades") {
    const hCards = RANKS.map((r) => r + "H");
    const getQSScore = (cards: string[]) =>
      (cards.includes("QS") ? 100 : 0) + cards.filter((c) => hCards.includes(c)).length * 10;
    const capotCards = [...hCards, "QS"];
    const allCards = tricksTaken.flat();
    const capot = tricksTaken.findIndex((cards) => capotCards.every((c) => cards.includes(c)));
    if (capot !== -1) {
      for (let i = 0; i < n; i++) base[i] = i === capot ? 0 : 180;
      newMkabbatha[capot]++;
    } else {
      for (let i = 0; i < n; i++) base[i] = getQSScore(tricksTaken[i]);
    }

  } else if (game === "general") {
    const hCards = RANKS.map((r) => r + "H");
    const dCards = RANKS.map((r) => r + "D");
    const queens = ["QH", "QD", "QC", "QS"];
    function generalScore(cards: string[], tricksWon: number): number {
      let s = 0;
      if (cards.includes("KH")) s += 100;
      s += cards.filter((c) => queens.includes(c)).length * 20;
      s += cards.filter((c) => dCards.includes(c)).length * 10;
      if (cards.includes("QS")) s += 100;
      s += cards.filter((c) => hCards.includes(c)).length * 10;
      s += tricksWon * 10;
      return s;
    }
    const tricksWon = tricksTaken.map((c) => c.length / 4);
    // Capot check: one player took everything
    const capot = tricksTaken.findIndex((c, i) => c.length === 32 - (n - 1) * 0);
    // Simpler: check if one seat took ALL 32 cards
    const capotSeat = tricksTaken.findIndex((c) => c.length === 32);
    if (capotSeat !== -1) {
      for (let i = 0; i < n; i++) base[i] = i === capotSeat ? 0 : 600;
      newMkabbatha[capotSeat]++;
    } else {
      for (let i = 0; i < n; i++) base[i] = generalScore(tricksTaken[i], tricksWon[i]);
      // Last trick in General
      base[lastTrickTaker] += 80;
    }
  }

  // Apply doubling + score reset rule
  const summary = seats.map((seat) => {
    const i = seat.seatIndex;
    const isDoubled = doublingSeats.includes(i);
    const roundScore = isDoubled ? base[i] * 2 : base[i];
    let newTotal = seat.score + roundScore;
    if (newTotal !== 0 && newTotal % 1000 === 0) newTotal = 0;
    return {
      name: seat.name,
      roundScore,
      totalScore: newTotal,
      isDoubled,
      mkabbatha: seat.mkabbatha + newMkabbatha[i],
      wakelRay: seat.wakelRay + newWakelRay[i],
      elMrabba3: seat.elMrabba3 + newElMrabba3[i],
    };
  });
  return summary;
}

// ─── Trix pile helpers ────────────────────────────────────────────────────────
type TrixPiles = { H: string[]; D: string[]; C: string[]; S: string[] };

function getValidTrixCards(hand: string[], piles: TrixPiles): string[] {
  const valid = new Set<string>();
  for (const suit of SUITS as ("H" | "D" | "C" | "S")[]) {
    const pile = piles[suit];
    if (pile.length === 0) {
      // Must play Jack to start pile
      const jack = "J" + suit;
      if (hand.includes(jack)) valid.add(jack);
    } else {
      const ranks = pile.map((c) => rankIdx(c));
      const minR = Math.min(...ranks);
      const maxR = Math.max(...ranks);
      if (minR > 0) {
        const down = RANKS[minR - 1] + suit;
        if (hand.includes(down)) valid.add(down);
      }
      if (maxR < 7) {
        const up = RANKS[maxR + 1] + suit;
        if (hand.includes(up)) valid.add(up);
      }
    }
  }
  return [...valid];
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export const getGameState = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) return null;
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    return { lobby, gameState: gs ?? null };
  },
});

export const getMyHand = query({
  args: { code: v.string(), seatIndex: v.number() },
  handler: async (ctx, { code, seatIndex }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) return null;
    const hand = await ctx.db.query("playerHands")
      .withIndex("by_lobby_seat", (q) => q.eq("lobbyId", lobby._id).eq("seatIndex", seatIndex))
      .first();
    return hand?.cards ?? [];
  },
});

// ─── startGame ───────────────────────────────────────────────────────────────
export const startGame = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby || lobby.seats.length !== 4 || !lobby.seats.every((s) => s.isReady)) return;
    // Idempotent
    const existing = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    if (existing) return;

    await ctx.db.patch(lobby._id, { status: "playing" });

    const deck = shuffle(buildDeck());
    for (let i = 0; i < 4; i++) {
      await ctx.db.insert("playerHands", {
        lobbyId: lobby._id, seatIndex: i,
        playerName: lobby.seats[i].name,
        cards: deck.slice(i * 8, (i + 1) * 8),
      });
    }
    await ctx.db.insert("gameState", {
      lobbyId: lobby._id,
      phase: "selection",
      selectedGame: undefined,
      vetoWindowStart: undefined,
      vetoedBySeat: undefined,
      vetoSkippedBySeats: [],
      doublingSeats: [lobby.chooserSeatIndex],
      currentTrickLeaderSeat: (lobby.chooserSeatIndex + 1) % 4,
      currentTurnSeat: (lobby.chooserSeatIndex + 1) % 4,
      currentTrick: [],
      tricksTaken: [[], [], [], []],
      lastTrickTakerSeat: undefined,
      completedTricks: 0,
      trixOrder: [],
      trixPiles: { H: [], D: [], C: [], S: [] },
      trixCurrentPlayerSeat: (lobby.chooserSeatIndex + 1) % 4,
      bonusPlay: false,
      vetoedGameId: undefined,
      roundScoreSummary: undefined,
    });
  },
});

// ─── selectGame ──────────────────────────────────────────────────────────────
export const selectGame = mutation({
  args: { code: v.string(), seatIndex: v.number(), gameId: v.string() },
  handler: async (ctx, { code, seatIndex, gameId }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) throw new Error("Lobby not found");
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    if (!gs || gs.phase !== "selection") throw new Error("Not in selection phase");
    if (seatIndex !== lobby.chooserSeatIndex) throw new Error("Not your turn to choose");

    const chooserSeat = lobby.seats[seatIndex];
    if (chooserSeat.chosenGames.includes(gameId)) throw new Error("Already played this game");
    if (gameId === gs.vetoedGameId) throw new Error("This game was vetoed and cannot be chosen again this turn");

    // Check if it's the last game for this player (8th game)
    const isLastGame = chooserSeat.chosenGames.length === 7;

    // Check if all others have used their vetos or it's the last game → skip veto window
    const otherSeats = [0, 1, 2, 3].filter((i) => i !== seatIndex);
    const allVetosUsed = otherSeats.every((i) => lobby.vetoUsedBySeats.includes(i));
    const hadVetoThisRound = gs.vetoedBySeat !== undefined;

    if (allVetosUsed || hadVetoThisRound || isLastGame) {
      // Start immediately
      const ds = gs.vetoedBySeat !== undefined
        ? [seatIndex, gs.vetoedBySeat]
        : [seatIndex];
      const nextTurnSeq = (gs.turnSequenceId ?? 0) + 1;
      await ctx.db.patch(gs._id, {
        selectedGame: gameId,
        phase: "playing",
        doublingSeats: ds,
        currentTrickLeaderSeat: (seatIndex + 1) % 4,
        currentTurnSeat: (seatIndex + 1) % 4,
        turnSequenceId: nextTurnSeq,
      });
      await ctx.scheduler.runAfter(30000, internal.game.autoPlayTurn, { code, turnSequenceId: nextTurnSeq });
    } else {
      await ctx.db.patch(gs._id, {
        selectedGame: gameId,
        phase: "veto",
        vetoWindowStart: Date.now(),
        vetoSkippedBySeats: [],
        doublingSeats: [seatIndex],
      });
    }
  },
});

// ─── useVeto ─────────────────────────────────────────────────────────────────
export const useVeto = mutation({
  args: { code: v.string(), seatIndex: v.number() },
  handler: async (ctx, { code, seatIndex }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) throw new Error("Lobby not found");
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    if (!gs || gs.phase !== "veto") throw new Error("Not in veto phase");
    if (seatIndex === lobby.chooserSeatIndex) throw new Error("Chooser cannot veto");
    if (lobby.vetoUsedBySeats.includes(seatIndex)) throw new Error("Already used veto");

    await ctx.db.patch(lobby._id, { vetoUsedBySeats: [...lobby.vetoUsedBySeats, seatIndex] });
    await ctx.db.patch(gs._id, {
      vetoedBySeat: seatIndex,
      vetoedGameId: gs.selectedGame,
      selectedGame: undefined,
      vetoWindowStart: undefined,
    });
  },
});

// ─── confirmVetoWindow (timer expired client-side) ──────────────────────────
export const confirmVetoWindow = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) return;
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    if (!gs || gs.phase !== "veto") return;

    const ds = gs.vetoedBySeat !== undefined
      ? [lobby.chooserSeatIndex, gs.vetoedBySeat]
      : [lobby.chooserSeatIndex];

    await ctx.db.patch(gs._id, {
      phase: "playing",
      doublingSeats: ds,
      currentTrickLeaderSeat: (lobby.chooserSeatIndex + 1) % 4,
      currentTurnSeat: (lobby.chooserSeatIndex + 1) % 4,
      currentTrick: [],
      tricksTaken: [[], [], [], []],
      completedTricks: 0,
      trixOrder: [],
      trixPiles: { H: [], D: [], C: [], S: [] },
      trixCurrentPlayerSeat: (lobby.chooserSeatIndex + 1) % 4,
      bonusPlay: false,
    });
  },
});

// ─── skipVeto ────────────────────────────────────────────────────────────────
export const skipVeto = mutation({
  args: { code: v.string(), seatIndex: v.number() },
  handler: async (ctx, { code, seatIndex }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) throw new Error("Lobby not found");
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    if (!gs || gs.phase !== "veto") throw new Error("Not in veto phase");

    const skipped = gs.vetoSkippedBySeats ?? [];
    if (!skipped.includes(seatIndex)) {
      skipped.push(seatIndex);
      await ctx.db.patch(gs._id, { vetoSkippedBySeats: skipped });
    }

    // Check if we can skip immediately
    const otherSeats = [0, 1, 2, 3].filter((i) => i !== lobby.chooserSeatIndex);
    const everyoneDecided = otherSeats.every((i) => 
      lobby.vetoUsedBySeats.includes(i) || skipped.includes(i)
    );

    if (everyoneDecided) {
      // Transition immediately
      const ds = gs.vetoedBySeat !== undefined
        ? [lobby.chooserSeatIndex, gs.vetoedBySeat]
        : [lobby.chooserSeatIndex];

      const nextTurnSeq = (gs.turnSequenceId ?? 0) + 1;
      await ctx.db.patch(gs._id, {
        phase: "playing",
        doublingSeats: ds,
        currentTrickLeaderSeat: (lobby.chooserSeatIndex + 1) % 4,
        currentTurnSeat: (lobby.chooserSeatIndex + 1) % 4,
        currentTrick: [],
        tricksTaken: [[], [], [], []],
        completedTricks: 0,
        trixOrder: [],
        trixPiles: { H: [], D: [], C: [], S: [] },
        trixCurrentPlayerSeat: (lobby.chooserSeatIndex + 1) % 4,
        bonusPlay: false,
        turnSequenceId: nextTurnSeq,
      });
      await ctx.scheduler.runAfter(30000, internal.game.autoPlayTurn, { code, turnSequenceId: nextTurnSeq });
    }
  },
});

// ─── playCard ────────────────────────────────────────────────────────────────
export const playCard = mutation({
  args: { code: v.string(), seatIndex: v.number(), card: v.string() },
  handler: async (ctx, { code, seatIndex, card }) => {
    await performPlayCard(ctx, code, seatIndex, card);
  },
});

export async function performPlayCard(ctx: any, code: string, seatIndex: number, card: string) {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q: any) => q.eq("code", code)).first();
    if (!lobby) throw new Error("Lobby not found");
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q: any) => q.eq("lobbyId", lobby._id)).first();
    if (!gs || gs.phase !== "playing") throw new Error("Not in playing phase");

    const handDoc = await ctx.db.query("playerHands")
      .withIndex("by_lobby_seat", (q: any) => q.eq("lobbyId", lobby._id).eq("seatIndex", seatIndex))
      .first();
    if (!handDoc) throw new Error("Hand not found");
    if (!handDoc.cards.includes(card)) throw new Error("Card not in hand");

    const isTrix = gs.selectedGame === "trix";

    // ── TRIX mode ────────────────────────────────────────────────────────────
    if (isTrix) {
      const expected = gs.bonusPlay ? gs.trixCurrentPlayerSeat : gs.trixCurrentPlayerSeat;
      if (seatIndex !== expected) throw new Error("Not your turn");

      const valid = getValidTrixCards(handDoc.cards, gs.trixPiles);
      if (!valid.includes(card)) throw new Error("Invalid Trix play");

      // Update pile
      const suit = getSuit(card) as "H" | "D" | "C" | "S";
      const newPiles = { ...gs.trixPiles, [suit]: [...gs.trixPiles[suit], card] };
      const newCards = handDoc.cards.filter((c: string) => c !== card);
      await ctx.db.patch(handDoc._id, { cards: newCards });

      const isAce = getRank(card) === "A";
      const newTrixOrder = [...gs.trixOrder];
      if (newCards.length === 0 && !newTrixOrder.includes(seatIndex)) {
        newTrixOrder.push(seatIndex);
      }

      if (newTrixOrder.length === 4) {
        // All finished — score and end round
        const summary = calcRoundScores(
          "trix", [[], [], [], []], 0, newTrixOrder,
          gs.doublingSeats, lobby.seats
        );
        const newSeats = lobby.seats.map((s: any, i: number) => ({
          ...s,
          score: summary[i].totalScore,
          mkabbatha: summary[i].mkabbatha,
          wakelRay: summary[i].wakelRay,
          elMrabba3: summary[i].elMrabba3,
          chosenGames: s.seatIndex === lobby.chooserSeatIndex
            ? [...s.chosenGames, "trix"] : s.chosenGames,
        }));
        const isGameOver = newSeats.every((s: any) => s.chosenGames.length === 8);
        await ctx.db.patch(lobby._id, { seats: newSeats });
        await ctx.db.patch(gs._id, {
          trixPiles: newPiles, trixOrder: newTrixOrder,
          phase: isGameOver ? "game-over" : "round-over",
          roundScoreSummary: summary.map((s: any) => ({ name: s.name, roundScore: s.roundScore, totalScore: s.totalScore, isDoubled: s.isDoubled })),
        });
        return;
      }

      // Advance turn (with auto-skip for no valid moves or already finished)
      if (isAce && newCards.length > 0) {
        // bonus play: only if the player has valid moves left
        const bonusValid = getValidTrixCards(newCards, newPiles);
        if (bonusValid.length > 0) {
          const nextTurnSeq = (gs.turnSequenceId ?? 0) + 1;
          await ctx.db.patch(gs._id, { 
            trixPiles: newPiles, 
            trixOrder: newTrixOrder, 
            bonusPlay: true, 
            trixCurrentPlayerSeat: seatIndex, 
            turnSequenceId: nextTurnSeq 
          });
          await ctx.scheduler.runAfter(30000, internal.game.autoPlayTurn, { code, turnSequenceId: nextTurnSeq });
          return;
        }
        // If no bonus moves possible, bonusPlay becomes false naturally and we find next player below
      }

      // Find next player with valid moves
      const allHands: string[][] = [];
      for (let i = 0; i < 4; i++) {
        const h = await ctx.db.query("playerHands").withIndex("by_lobby_seat", (q: any) => q.eq("lobbyId", lobby._id).eq("seatIndex", i)).first();
        allHands[i] = h?.cards ?? [];
      }
      let tries = 0;
      let nextSeat = (seatIndex + 1) % 4;
      while (tries < 4) {
        if (!newTrixOrder.includes(nextSeat) && getValidTrixCards(allHands[nextSeat], newPiles).length > 0) break;
        nextSeat = (nextSeat + 1) % 4;
        tries++;
      }
      const nextTurnSeq = (gs.turnSequenceId ?? 0) + 1;
      await ctx.db.patch(gs._id, {
        trixPiles: newPiles, trixOrder: newTrixOrder, bonusPlay: false, trixCurrentPlayerSeat: nextSeat, turnSequenceId: nextTurnSeq,
      });
      await ctx.scheduler.runAfter(30000, internal.game.autoPlayTurn, { code, turnSequenceId: nextTurnSeq });
      return;
    }

    // ── NORMAL game mode ─────────────────────────────────────────────────────
    if (seatIndex !== gs.currentTurnSeat) throw new Error("Not your turn");

    const trick = gs.currentTrick;
    const isLeading = trick.length === 0;

    // 1. Follow suit rules
    let playable = handDoc.cards;
    if (!isLeading) {
      const leadSuit = getSuit(trick[0].card);
      const hasSuit = handDoc.cards.some((c: string) => getSuit(c) === leadSuit);
      if (hasSuit) playable = handDoc.cards.filter((c: string) => getSuit(c) === leadSuit);
    }

    if (!playable.includes(card)) {
      throw new Error("Must follow suit");
    }

    // 2. First trick rule: NO valued cards allowed unless player has no other choice
    if (gs.completedTricks === 0) {
      const valued = getValuedCards(gs.selectedGame!);
      const safeCards = playable.filter((c: string) => !valued.includes(c));
      if (safeCards.length > 0 && valued.includes(card)) {
        throw new Error("Cannot play valued cards in the first trick unless forced");
      }
    }

    // 3. Broken rule for leading in trick 2+
    if (isLeading && gs.completedTricks > 0) {
      const allPlayed = gs.tricksTaken.flat();
      const game = gs.selectedGame!;
      const brokenSuits: string[] = [];

      if ((game === "queen-spades" || game === "general") && allPlayed.some((c: string) => getSuit(c) === "H")) brokenSuits.push("H");
      if ((game === "diamonds" || game === "general") && allPlayed.some((c: string) => getSuit(c) === "D")) brokenSuits.push("D");

      const isRestricted = (
        (game === "queen-spades" && getSuit(card) === "H" && !brokenSuits.includes("H")) ||
        (game === "diamonds" && getSuit(card) === "D" && !brokenSuits.includes("D")) ||
        (game === "general" && getSuit(card) === "H" && !brokenSuits.includes("H")) ||
        (game === "general" && getSuit(card) === "D" && !brokenSuits.includes("D"))
      );

      if (isRestricted) {
        const safeLeadCards = playable.filter((c: string) => {
          if (game === "queen-spades" && getSuit(c) === "H" && !brokenSuits.includes("H")) return false;
          if (game === "diamonds" && getSuit(c) === "D" && !brokenSuits.includes("D")) return false;
          if (game === "general" && getSuit(c) === "H" && !brokenSuits.includes("H")) return false;
          if (game === "general" && getSuit(c) === "D" && !brokenSuits.includes("D")) return false;
          return true;
        });

        if (safeLeadCards.length > 0) {
          throw new Error("Cannot lead this suit until it has been broken");
        }
      }
    }

    const newTrick = [...trick, { seatIndex, card }];
    const newHand = handDoc.cards.filter((c: string) => c !== card);
    await ctx.db.patch(handDoc._id, { cards: newHand });

    if (newTrick.length < 4) {
      // Next player in trick
      const nextTurnSeq = (gs.turnSequenceId ?? 0) + 1;
      await ctx.db.patch(gs._id, {
        currentTrick: newTrick,
        currentTurnSeat: (seatIndex + 1) % 4,
        turnSequenceId: nextTurnSeq,
      });
      // Important: even if not finished, we update turnSequenceId to reset 30s timer
      await ctx.scheduler.runAfter(30000, internal.game.autoPlayTurn, { code, turnSequenceId: nextTurnSeq });
      return;
    }

    // Resolve trick
    const winner = trickWinner(newTrick);
    const allTrickCards = newTrick.map((t) => t.card);
    const newTricksTaken = gs.tricksTaken.map((cards: string[], i: number) =>
      i === winner ? [...cards, ...allTrickCards] : cards
    );
    const newCompleted = gs.completedTricks + 1;

    // Find if the game ends early
    let terminateEarly = false;
    const allPlayed = newTricksTaken.flat();
    if (gs.selectedGame === "king" && allPlayed.includes("KH")) terminateEarly = true;
    if (gs.selectedGame === "queens" && ["QH", "QD", "QC", "QS"].every(q => allPlayed.includes(q))) terminateEarly = true;
    if (gs.selectedGame === "diamonds" && allPlayed.filter((c: string) => c.endsWith("D")).length === 8) terminateEarly = true;
    if (gs.selectedGame === "queen-spades" && allPlayed.includes("QS") && allPlayed.filter((c: string) => c.endsWith("H")).length === 8) terminateEarly = true;

    if (newCompleted < 8 && !terminateEarly) {
      const nextTurnSeq = (gs.turnSequenceId ?? 0) + 1;
      await ctx.db.patch(gs._id, {
        currentTrick: [],
        currentTrickLeaderSeat: winner,
        currentTurnSeat: winner,
        tricksTaken: newTricksTaken,
        lastTrickTakerSeat: winner,
        completedTricks: newCompleted,
        turnSequenceId: nextTurnSeq,
      });
      await ctx.scheduler.runAfter(30000, internal.game.autoPlayTurn, { code, turnSequenceId: nextTurnSeq });
      return;
    }

    // All tricks done OR terminated early — score the round
    const summary = calcRoundScores(
      gs.selectedGame!,
      newTricksTaken,
      winner,
      [],
      gs.doublingSeats,
      lobby.seats
    );
    const gameId = gs.selectedGame!;
    const newSeats = lobby.seats.map((s: any, i: number) => ({
      ...s,
      score: summary[i].totalScore,
      mkabbatha: summary[i].mkabbatha,
      wakelRay: summary[i].wakelRay,
      elMrabba3: summary[i].elMrabba3,
      chosenGames: s.seatIndex === lobby.chooserSeatIndex
        ? [...s.chosenGames, gameId] : s.chosenGames,
    }));
    const isGameOver = newSeats.every((s: any) => s.chosenGames.length === 8);
    await ctx.db.patch(lobby._id, { seats: newSeats });
    await ctx.db.patch(gs._id, {
      currentTrick: newTrick,
      tricksTaken: newTricksTaken,
      lastTrickTakerSeat: winner,
      completedTricks: newCompleted,
      phase: isGameOver ? "game-over" : "round-over",
      roundScoreSummary: summary.map((s) => ({ name: s.name, roundScore: s.roundScore, totalScore: s.totalScore, isDoubled: s.isDoubled })),
    });
}

// ─── nextRound ───────────────────────────────────────────────────────────────
export const nextRound = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) return;
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    if (!gs || gs.phase !== "round-over") return;

    const nextChooser = (lobby.chooserSeatIndex + 1) % 4;
    await ctx.db.patch(lobby._id, {
      chooserSeatIndex: nextChooser,
      currentRound: lobby.currentRound + 1,
    });

    // Delete old hands and deal new ones
    const oldHands = await ctx.db.query("playerHands")
      .withIndex("by_lobby_seat", (q) => q.eq("lobbyId", lobby._id))
      .collect();
    for (const h of oldHands) await ctx.db.delete(h._id);

    const deck = shuffle(buildDeck());
    for (let i = 0; i < 4; i++) {
      await ctx.db.insert("playerHands", {
        lobbyId: lobby._id, seatIndex: i,
        playerName: lobby.seats[i].name,
        cards: deck.slice(i * 8, (i + 1) * 8),
      });
    }

    await ctx.db.patch(gs._id, {
      phase: "selection",
      selectedGame: undefined,
      vetoWindowStart: undefined,
      vetoedBySeat: undefined,
      vetoSkippedBySeats: [],
      doublingSeats: [nextChooser],
      currentTrickLeaderSeat: (nextChooser + 1) % 4,
      currentTurnSeat: (nextChooser + 1) % 4,
      currentTrick: [],
      tricksTaken: [[], [], [], []],
      lastTrickTakerSeat: undefined,
      completedTricks: 0,
      trixOrder: [],
      trixPiles: { H: [], D: [], C: [], S: [] },
      trixCurrentPlayerSeat: (nextChooser + 1) % 4,
      bonusPlay: false,
      vetoedGameId: undefined,
      roundScoreSummary: undefined,
    });
  },
});


// ─── autoPlayTurn ────────────────────────────────────────────────────────────
export const autoPlayTurn = internalMutation({
  args: { code: v.string(), turnSequenceId: v.number() },
  handler: async (ctx, { code, turnSequenceId }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) return;
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    if (!gs || gs.phase !== "playing") return;
    if (gs.turnSequenceId !== turnSequenceId) return;

    const isTrix = gs.selectedGame === "trix";
    const seatIndex = isTrix ? gs.trixCurrentPlayerSeat : gs.currentTurnSeat;

    const handDoc = await ctx.db.query("playerHands")
      .withIndex("by_lobby_seat", (q) => q.eq("lobbyId", lobby._id).eq("seatIndex", seatIndex))
      .first();
    if (!handDoc || handDoc.cards.length === 0) return;

    let playableCards: string[] = [];
    if (isTrix) {
      playableCards = getValidTrixCards(handDoc.cards, gs.trixPiles);
    } else {
      const trick = gs.currentTrick;
      const isLeading = trick.length === 0;

      let playable = handDoc.cards;
      if (!isLeading) {
        const leadSuit = getSuit(trick[0].card);
        const hasSuit = handDoc.cards.some(c => getSuit(c) === leadSuit);
        if (hasSuit) playable = handDoc.cards.filter(c => getSuit(c) === leadSuit);
      }
      
      let trulyValid = playable;
      if (gs.completedTricks === 0) {
        const valued = getValuedCards(gs.selectedGame!);
        const safeCards = playable.filter(c => !valued.includes(c));
        if (safeCards.length > 0) trulyValid = safeCards;
      } else if (isLeading && gs.completedTricks > 0) {
        const allPlayed = gs.tricksTaken.flat();
        const game = gs.selectedGame!;
        const brokenSuits: string[] = [];
        if ((game === "queen-spades" || game === "general") && allPlayed.some(c => getSuit(c) === "H")) brokenSuits.push("H");
        if ((game === "diamonds" || game === "general") && allPlayed.some(c => getSuit(c) === "D")) brokenSuits.push("D");

        const safeLeadCards = playable.filter(c => {
          if (game === "queen-spades" && getSuit(c) === "H" && !brokenSuits.includes("H")) return false;
          if (game === "diamonds" && getSuit(c) === "D" && !brokenSuits.includes("D")) return false;
          if (game === "general" && getSuit(c) === "H" && !brokenSuits.includes("H")) return false;
          if (game === "general" && getSuit(c) === "D" && !brokenSuits.includes("D")) return false;
          return true;
        });

        if (safeLeadCards.length > 0) trulyValid = safeLeadCards;
      }
      playableCards = trulyValid;
    }

    if (playableCards.length === 0) return;
    const randomCard = playableCards[Math.floor(Math.random() * playableCards.length)];
    await performPlayCard(ctx, code, seatIndex, randomCard);
  }
});


export const passTrixTurn = mutation({
  args: { code: v.string(), seatIndex: v.number() },
  handler: async (ctx, { code, seatIndex }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) return;
    const gs = await ctx.db.query("gameState").withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id)).first();
    if (!gs || gs.phase !== "playing" || gs.selectedGame !== "trix") return;
    if (gs.trixCurrentPlayerSeat !== seatIndex) return;

    const handDoc = await ctx.db.query("playerHands")
      .withIndex("by_lobby_seat", (q) => q.eq("lobbyId", lobby._id).eq("seatIndex", seatIndex)).first();
    if (!handDoc) return;

    const playable = getValidTrixCards(handDoc.cards, gs.trixPiles);
    if (playable.length > 0) return; // Cannot pass if you have playable cards

    let nextSeat = (seatIndex + 1) % 4;
    const allHands = [];
    for (let i = 0; i < 4; i++) {
        const h = await ctx.db.query("playerHands").withIndex("by_lobby_seat", (q) => q.eq("lobbyId", lobby._id).eq("seatIndex", i)).first();
        allHands[i] = h?.cards ?? [];
    }
    
    let tries = 0;
    while (tries < 4) {
        if (!gs.trixOrder.includes(nextSeat) && getValidTrixCards(allHands[nextSeat], gs.trixPiles).length > 0) break;
        nextSeat = (nextSeat + 1) % 4;
        tries++;
    }

    const nextTurnSeq = (gs.turnSequenceId ?? 0) + 1;
    await ctx.db.patch(gs._id, {
        trixCurrentPlayerSeat: nextSeat, turnSequenceId: nextTurnSeq,
    });
    // Schedule next autoPlay
    await ctx.scheduler.runAfter(30000, internal.game.autoPlayTurn, { code, turnSequenceId: nextTurnSeq });
  }
});
