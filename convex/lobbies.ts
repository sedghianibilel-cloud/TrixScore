import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const getLobbies = query({
  args: {},
  handler: async (ctx) =>
    ctx.db.query("lobbies").withIndex("by_status", (q) => q.eq("status", "waiting")).collect(),
});

export const getLobby = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) =>
    ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first(),
});

export const createLobby = mutation({
  args: { playerName: v.string() },
  handler: async (ctx, { playerName }) => {
    let code = generateCode();
    while (await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first()) {
      code = generateCode();
    }
    const lobbyId = await ctx.db.insert("lobbies", {
      code,
      status: "waiting",
      seats: [{
        name: playerName, seatIndex: 0, isReady: false,
        score: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0, chosenGames: [],
      }],
      chooserSeatIndex: 0,
      currentRound: 0,
      vetoUsedBySeats: [],
    });
    return { lobbyId, code };
  },
});

export const joinLobby = mutation({
  args: { code: v.string(), playerName: v.string() },
  handler: async (ctx, { code, playerName }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) throw new Error("Lobby not found");
    if (lobby.status !== "waiting") throw new Error("Lobby not open");
    if (lobby.seats.length >= 4) throw new Error("Lobby is full");
    if (lobby.seats.some((s) => s.name === playerName)) throw new Error("Name already in lobby");

    const seatIndex = lobby.seats.length;
    await ctx.db.patch(lobby._id, {
      seats: [...lobby.seats, {
        name: playerName, seatIndex, isReady: false,
        score: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0, chosenGames: [],
      }],
    });
    return { seatIndex, code };
  },
});

export const toggleReady = mutation({
  args: { code: v.string(), seatIndex: v.number() },
  handler: async (ctx, { code, seatIndex }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby) throw new Error("Lobby not found");
    if (lobby.seats.length < 4) throw new Error("Need 4 players to ready up");

    const newSeats = lobby.seats.map((s) =>
      s.seatIndex === seatIndex ? { ...s, isReady: !s.isReady } : s
    );
    await ctx.db.patch(lobby._id, { seats: newSeats });
    return { allReady: newSeats.every((s) => s.isReady) };
  },
});

export const leaveLobby = mutation({
  args: { code: v.string(), seatIndex: v.number() },
  handler: async (ctx, { code, seatIndex }) => {
    const lobby = await ctx.db.query("lobbies").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!lobby || lobby.status !== "waiting") return;
    const newSeats = lobby.seats
      .filter((s) => s.seatIndex !== seatIndex)
      .map((s, i) => ({ ...s, seatIndex: i }));
    if (newSeats.length === 0) {
      await ctx.db.delete(lobby._id);
    } else {
      await ctx.db.patch(lobby._id, { seats: newSeats, chooserSeatIndex: 0 });
    }
  },
});
