import {
  pgTable,
  uuid,
  timestamp,
  integer,
  jsonb,
  varchar,
  boolean,
  unique,
  index,
} from 'drizzle-orm/pg-core'
import { puzzles } from './puzzles'
import { users } from './users'

export const playSessions = pgTable(
  'play_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    puzzleId: uuid('puzzle_id')
      .references(() => puzzles.id)
      .notNull(),
    userId: uuid('user_id').references(() => users.id),
    anonymousId: uuid('anonymous_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    mistakesCount: integer('mistakes_count').default(0),
    hintsUsed: jsonb('hints_used').default([]),
    score: integer('score'),
    rankAchieved: varchar('rank_achieved', { length: 50 }),
    isComplete: boolean('is_complete').default(false),
  },
  (table) => [
    unique('unique_puzzle_user').on(table.puzzleId, table.userId),
    unique('unique_puzzle_anonymous').on(table.puzzleId, table.anonymousId),
    index('idx_play_sessions_puzzle_user').on(table.puzzleId, table.userId),
  ],
)

export type PlaySession = typeof playSessions.$inferSelect
export type NewPlaySession = typeof playSessions.$inferInsert
