import { pgTable, uuid, varchar, timestamp, integer } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  displayName: varchar('display_name', { length: 100 }),
  anonymousId: uuid('anonymous_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  streakCurrent: integer('streak_current').default(0),
  streakMax: integer('streak_max').default(0),
  totalPlays: integer('total_plays').default(0),
  totalWins: integer('total_wins').default(0),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
