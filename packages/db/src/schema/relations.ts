import { relations } from 'drizzle-orm'
import { users } from './users'
import { puzzles } from './puzzles'
import { playSessions } from './play-sessions'
import { nodeAnalytics } from './node-analytics'

export const usersRelations = relations(users, ({ many }) => ({
  createdPuzzles: many(puzzles),
  playSessions: many(playSessions),
}))

export const puzzlesRelations = relations(puzzles, ({ one, many }) => ({
  author: one(users, {
    fields: [puzzles.createdBy],
    references: [users.id],
  }),
  playSessions: many(playSessions),
  nodeAnalytics: many(nodeAnalytics),
}))

export const playSessionsRelations = relations(playSessions, ({ one }) => ({
  puzzle: one(puzzles, {
    fields: [playSessions.puzzleId],
    references: [puzzles.id],
  }),
  user: one(users, {
    fields: [playSessions.userId],
    references: [users.id],
  }),
}))

export const nodeAnalyticsRelations = relations(nodeAnalytics, ({ one }) => ({
  puzzle: one(puzzles, {
    fields: [nodeAnalytics.puzzleId],
    references: [puzzles.id],
  }),
}))
