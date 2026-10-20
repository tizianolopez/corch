import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core'
import { puzzles } from './puzzles'

export const nodeAnalytics = pgTable(
  'node_analytics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    puzzleId: uuid('puzzle_id')
      .references(() => puzzles.id)
      .notNull(),
    nodeId: varchar('node_id', { length: 20 }).notNull(),
    totalAttempts: integer('total_attempts').default(0),
    totalFails: integer('total_fails').default(0),
    hintsRequested: integer('hints_requested').default(0),
    revealsUsed: integer('reveals_used').default(0),
    avgTimeToSolveMs: integer('avg_time_to_solve_ms'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('unique_puzzle_node').on(table.puzzleId, table.nodeId),
    index('idx_node_analytics_puzzle').on(table.puzzleId),
  ],
)

export type NodeAnalytics = typeof nodeAnalytics.$inferSelect
export type NewNodeAnalytics = typeof nodeAnalytics.$inferInsert
