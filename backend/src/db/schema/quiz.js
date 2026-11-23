import { sql } from 'drizzle-orm';
import { pgTable, integer, varchar, smallint, timestamp, index, check, uniqueIndex } from 'drizzle-orm/pg-core';

// A country the landmarks belong to
export const countries = pgTable('countries', {
    countryId: integer('country_id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 100 }).notNull(),
}, (table) => [
    // On lower(name), so an admin typing "france" finds France instead of making a second one
    uniqueIndex('countries_name_lower_unique').on(sql`lower(${table.name})`),
]);

// One landmark photo and its three possible answers
export const questions = pgTable('questions', {
    questionId: integer('question_id').primaryKey().generatedAlwaysAsIdentity(),
    // A country can't be deleted while it still has questions
    countryId: integer('country_id').notNull().references(() => countries.countryId, { onDelete: 'restrict' }),
    imageUrl: varchar('image_url', { length: 500 }).notNull(),
    // Cloudinary's name for the photo, so a replaced one can be deleted
    cloudinaryId: varchar('cloudinary_id', { length: 255 }).notNull(),
    question: varchar('question', { length: 150 }).notNull(),
    hint: varchar('hint', { length: 150 }).notNull(),
    answer1: varchar('answer1', { length: 100 }).notNull(),
    answer2: varchar('answer2', { length: 100 }).notNull(),
    answer3: varchar('answer3', { length: 100 }).notNull(),
    // One number instead of three true/false flags, so exactly one answer is always right
    correctAnswer: smallint('correct_answer').notNull(),
    // Set while new rounds leave the question out. A played question can't be deleted, so it's hidden
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
}, (table) => [
    check('questions_correct_answer_range', sql`${table.correctAnswer} BETWEEN 1 AND 3`),
    // Postgres doesn't index a foreign key by itself; finding a country's questions needs one
    index('questions_country_id_idx').on(table.countryId),
]);
