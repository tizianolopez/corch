import { pgTable, varchar, text, jsonb, integer, timestamp, boolean } from 'drizzle-orm/pg-core'

export const communityPuzzles = pgTable('community_puzzles', {
  id: varchar('id', { length: 8 }).primaryKey(), // NanoID corto: "x8k9p2m1"
  creatorAlias: varchar('creator_alias', { length: 100 }),
  rawMarkup: text('raw_markup').notNull(),
  clientPayload: jsonb('client_payload').notNull(),
  playsCount: integer('plays_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  isFlagged: boolean('is_flagged').default(false),
})

export type CommunityPuzzle = typeof communityPuzzles.$inferSelect
export type NewCommunityPuzzle = typeof communityPuzzles.$inferInsert
