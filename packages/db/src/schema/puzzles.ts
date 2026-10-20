import {
  pgTable,
  uuid,
  integer,
  text,
  varchar,
  date,
  timestamp,
  real,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const puzzles = pgTable(
  'puzzles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionNumber: integer('edition_number').unique().notNull(),
    publishDate: date('publish_date').unique().notNull(),
    rawMarkup: text('raw_markup').notNull(),
    compiledAst: jsonb('compiled_ast').notNull(),
    clientPayload: jsonb('client_payload').notNull(),
    quoteAuthor: varchar('quote_author', { length: 200 }),
    quoteWork: varchar('quote_work', { length: 300 }),
    quoteYear: integer('quote_year'),
    editorialNote: text('editorial_note'),
    difficultyScore: real('difficulty_score'),
    maxDepth: integer('max_depth'),
    totalNodes: integer('total_nodes'),
    initialLeaves: integer('initial_leaves'),
    status: varchar('status', { length: 20 }).default('DRAFT'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_puzzles_publish_date').on(table.publishDate),
  ],
)

export type Puzzle = typeof puzzles.$inferSelect
export type NewPuzzle = typeof puzzles.$inferInsert
