import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, integer, smallint, boolean, timestamp, check, index, unique, uniqueIndex } from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { questions } from './quiz.js';

export const roundStatusEnum = pgEnum('round_status', ['active', 'finished', 'abandoned']);

// One game of up to 10 questions. Its position, streak and total are worked out from its questions
export const rounds = pgTable('rounds', {
    roundId: integer('round_id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
    status: roundStatusEnum('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (table) => [
    // Only over active rows, so a player has any number of ended rounds but one in play
    uniqueIndex('rounds_one_active_per_user').on(table.userId).where(sql`${table.status} = 'active'`),
    index('rounds_user_id_idx').on(table.userId),
    check('rounds_finished_at_matches_status', sql`(${table.status} = 'active') = (${table.finishedAt} IS NULL)`),
]);

// One question in a round, how its answers are shown, and how the player answered it
export const roundQuestions = pgTable('round_questions', {
    roundQuestionId: integer('round_question_id').primaryKey().generatedAlwaysAsIdentity(),
    roundId: integer('round_id').notNull().references(() => rounds.roundId, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    // A played question can't be deleted; admin tools will hide it instead
    questionId: integer('question_id').notNull().references(() => questions.questionId, { onDelete: 'restrict' }),
    // Button n shows stored answer answerOrder[n - 1]
    answerOrder: integer('answer_order').array().notNull(),
    shownAt: timestamp('shown_at', { withTimezone: true }),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    // The stored answer number the player picked, whatever button it was on
    chosenAnswer: smallint('chosen_answer'),
    hintUsed: boolean('hint_used').notNull().default(false),
    correct: boolean('correct'),
    tokensAwarded: integer('tokens_awarded').notNull().default(0),
}, (table) => [
    unique('round_questions_round_position_unique').on(table.roundId, table.position),
    unique('round_questions_round_question_unique').on(table.roundId, table.questionId),
    index('round_questions_question_id_idx').on(table.questionId),
    check('round_questions_position_range', sql`${table.position} BETWEEN 1 AND 10`),
    check('round_questions_chosen_answer_range', sql`${table.chosenAnswer} BETWEEN 1 AND 3`),
    check('round_questions_tokens_not_negative', sql`${table.tokensAwarded} >= 0`),
    // Three items that include 1, 2 and 3 can only be those three, each once
    check('round_questions_answer_order_shuffle', sql`cardinality(${table.answerOrder}) = 3 AND ${table.answerOrder} @> ARRAY[1, 2, 3]`),
    check('round_questions_answer_complete', sql`(${table.answeredAt} IS NULL) = (${table.chosenAnswer} IS NULL) AND (${table.answeredAt} IS NULL) = (${table.correct} IS NULL)`),
]);
