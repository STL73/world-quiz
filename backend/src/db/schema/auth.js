import { pgTable, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';

import { users } from './users.js';

// One row per logged-in device. Only the token's hash is stored, so a leaked row can't log anyone in
export const sessions = pgTable('sessions', {
    sessionId: varchar('session_id', { length: 64 }).primaryKey(),
    userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
    // 30 days, moved forward when fewer than 15 are left
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    // Finding or deleting every session of one user
    index('sessions_user_id_idx').on(table.userId),
]);
