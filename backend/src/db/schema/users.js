import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, integer, varchar, timestamp, check, uniqueIndex } from 'drizzle-orm/pg-core';

import { questions } from './quiz.js';

export const roleEnum = pgEnum('role', ['user', 'admin']);

// A player or an admin. People log in by email; the name is shown on the leaderboard
export const users = pgTable('users', {
    userId: integer('user_id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 20 }).notNull(),
    // Stored lowercase: the app lowercases it on sign-up and login
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: roleEnum('role').notNull().default('user'),
    // timestamptz, so the stored time doesn't depend on the server's time zone
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    check('users_name_min_length', sql`char_length(${table.name}) >= 3`),
    // On lower(name), so "Maria" and "maria" can't both exist
    uniqueIndex('users_name_lower_unique').on(sql`lower(${table.name})`),
]);

// A player's tokens and where they stopped. The level is worked out from the tokens, never stored
export const scores = pgTable('scores', {
    userId: integer('user_id').primaryKey().references(() => users.userId, { onDelete: 'cascade' }),
    starTokens: integer('star_tokens').notNull().default(0),
    // NULL = start from the first question. Deleting the question only clears it
    savedQuestionId: integer('saved_question_id').references(() => questions.questionId, { onDelete: 'set null' }),
}, (table) => [
    check('scores_star_tokens_not_negative', sql`${table.starTokens} >= 0`),
]);
