import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const seatObject = v.object({
  name: v.string(),
  seatIndex: v.number(),
  isReady: v.boolean(),
  score: v.number(),
  mkabbatha: v.number(),
  wakelRay: v.number(),
  elMrabba3: v.number(),
  chosenGames: v.array(v.string()),
});

export default defineSchema({
  // ── Existing table ──────────────────────────────────────────────────────────
  playerStats: defineTable({
    name: v.string(),
    totalScore: v.number(),
    sessionsPlayed: v.number(),
    elM3allem: v.number(),
    bhimEttawla: v.number(),
    mkabbatha: v.number(),
    wakelRay: v.number(),
    elMrabba3: v.number(),
  }).index("by_name", ["name"]),

  // ── Multiplayer tables ───────────────────────────────────────────────────────
  lobbies: defineTable({
    code: v.string(),
    status: v.union(v.literal("waiting"), v.literal("playing"), v.literal("finished")),
    seats: v.array(seatObject),
    chooserSeatIndex: v.number(),
    currentRound: v.number(),
    vetoUsedBySeats: v.array(v.number()), // seat indices that have spent their lifetime veto
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  gameState: defineTable({
    lobbyId: v.id("lobbies"),
    phase: v.union(
      v.literal("selection"),
      v.literal("veto"),
      v.literal("playing"),
      v.literal("round-over"),
      v.literal("game-over")
    ),
    selectedGame: v.optional(v.string()),
    vetoWindowStart: v.optional(v.number()),
    vetoedBySeat: v.optional(v.number()),  // seat that used veto this round
    vetoSkippedBySeats: v.optional(v.array(v.number())), // seats that clicked 'No Veto'
    doublingSeats: v.array(v.number()),     // seats whose scores are ×2 this round
    currentTrickLeaderSeat: v.number(),
    currentTurnSeat: v.number(),
    currentTrick: v.array(v.object({ seatIndex: v.number(), card: v.string() })),
    tricksTaken: v.array(v.array(v.string())), // index = seatIndex, value = cards won
    lastTrickTakerSeat: v.optional(v.number()),
    completedTricks: v.number(),
    turnSequenceId: v.optional(v.number()),
    // Trix-specific
    trixOrder: v.array(v.number()),    // finish order (seatIndex)
    trixPiles: v.object({
      H: v.array(v.string()),
      D: v.array(v.string()),
      C: v.array(v.string()),
      S: v.array(v.string()),
    }),
    trixCurrentPlayerSeat: v.number(),
    bonusPlay: v.boolean(),            // true after Ace played in Trix
    // End-of-round summary
    roundScoreSummary: v.optional(
      v.array(v.object({
        name: v.string(),
        roundScore: v.number(),
        totalScore: v.number(),
        isDoubled: v.boolean(),
      }))
    ),
  }).index("by_lobby", ["lobbyId"]),

  playerHands: defineTable({
    lobbyId: v.id("lobbies"),
    seatIndex: v.number(),
    playerName: v.string(),
    cards: v.array(v.string()),
  })
    .index("by_lobby_seat", ["lobbyId", "seatIndex"])
    .index("by_lobby_player", ["lobbyId", "playerName"]),
});
