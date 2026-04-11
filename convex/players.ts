import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const PREDEFINED_PLAYERS = [
  "Ghost188",
  "Edda7",
  "El Borr",
  "El Bon",
  "سي رفيق بن يدر",
  "Karkouba",
  "3a9loun",
  "Bilox",
  "Foudel",
  "Majdi",
  "Others",
];

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("playerStats").collect();

    // If table is empty, we need to initialize it
    // Note: queries can't write, so we return empty array and let frontend call init
    if (stats.length === 0) {
      return { initialized: false, players: [] };
    }

    return { initialized: true, players: stats };
  },
});

export const initializePlayers = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already initialized
    const existing = await ctx.db.query("playerStats").first();
    if (existing) {
      return { success: true, message: "Players already initialized" };
    }

    // Create all predefined players with zero stats
    for (const name of PREDEFINED_PLAYERS) {
      await ctx.db.insert("playerStats", {
        name,
        totalScore: 0,
        sessionsPlayed: 0,
        elM3allem: 0,
        bhimEttawla: 0,
        mkabbatha: 0,
        wakelRay: 0,
        elMrabba3: 0,
      });
    }

    return { success: true, message: "Players initialized" };
  },
});

export const recordSession = mutation({
  args: {
    players: v.array(
      v.object({
        name: v.string(),
        score: v.number(),
        mkabbatha: v.number(),
        wakelRay: v.number(),
        elMrabba3: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.players.length !== 4) {
      throw new Error("A TrixScore session requires exactly 4 players");
    }

    // Find lowest and highest scores
    const minScore = Math.min(...args.players.map((p) => p.score));
    const maxScore = Math.max(...args.players.map((p) => p.score));

    // Find all players with lowest score (El M3allem) and highest score (Bhim Ettawla)
    const winners = args.players.filter((p) => p.score === minScore);
    const losers = args.players.filter((p) => p.score === maxScore);

    // Update each player's stats
    for (const player of args.players) {
      // Find existing player record
      const existingPlayer = await ctx.db
        .query("playerStats")
        .withIndex("by_name", (q) => q.eq("name", player.name))
        .first();

      if (!existingPlayer) {
        throw new Error(`Player "${player.name}" not found. Please add them first.`);
      }

      // Calculate if this player won or lost
      const isWinner = winners.some((w) => w.name === player.name);
      const isLoser = losers.some((l) => l.name === player.name);

      // Update the player's stats
      await ctx.db.patch(existingPlayer._id, {
        totalScore: existingPlayer.totalScore + player.score,
        sessionsPlayed: existingPlayer.sessionsPlayed + 1,
        elM3allem: existingPlayer.elM3allem + (isWinner ? 1 : 0),
        bhimEttawla: existingPlayer.bhimEttawla + (isLoser ? 1 : 0),
        mkabbatha: existingPlayer.mkabbatha + player.mkabbatha,
        wakelRay: existingPlayer.wakelRay + player.wakelRay,
        elMrabba3: existingPlayer.elMrabba3 + player.elMrabba3,
      });
    }

    return { success: true };
  },
});
