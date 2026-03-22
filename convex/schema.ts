import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  playerStats: defineTable({
    name: v.string(),
    totalScore: v.number(),
    sessionsPlayed: v.number(),
    elM3allem: v.number(), // Games won - lowest score
    bhimEttawla: v.number(), // Games lost - highest score
    mkabbatha: v.number(), // Capots
    wakelRay: v.number(), // King of Hearts taken
    elMrabba3: v.number(), // Total diamonds collected
  }).index("by_name", ["name"]),
});
