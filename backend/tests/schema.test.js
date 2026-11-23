import { describe, it, expect, afterEach } from 'vitest';
import { eq, like } from 'drizzle-orm';

import { db } from '../src/db/index.js';
import { users, scores, sessions, countries, questions, rounds, roundQuestions } from '../src/db/schema/index.js';

// These tests write to the Neon test branch, so each one removes what it made
const TEST_EMAIL = 'schema-test@example.com';
const OTHER_EMAIL = 'schema-test-2@example.com';
const TEST_COUNTRY = 'Schema Testland';

afterEach(async () => {
    // Deleting a user deletes their score, sessions and rounds too (the cascades the tests prove)
    await db.delete(users).where(like(users.email, 'schema-test%@example.com'));
    // A played question can't be deleted, so this has to wait until the rounds are gone
    await db.delete(questions).where(eq(questions.cloudinaryId, 'schema-test'));
    await db.delete(countries).where(eq(countries.name, TEST_COUNTRY));
});

function addTestUser(values = {}) {
    return db.insert(users)
        .values({ name: 'Schema Test', email: TEST_EMAIL, passwordHash: 'not-a-real-hash', ...values })
        .returning();
}

async function addTestQuestion(values = {}) {
    const [existing] = await db.select().from(countries).where(eq(countries.name, TEST_COUNTRY));
    const country = existing ?? (await db.insert(countries).values({ name: TEST_COUNTRY }).returning())[0];
    const [question] = await db.insert(questions).values({
        countryId: country.countryId,
        imageUrl: 'https://example.com/photo.jpg',
        cloudinaryId: 'schema-test',
        question: 'Which landmark is this?',
        hint: 'A test hint',
        answer1: 'A',
        answer2: 'B',
        answer3: 'C',
        correctAnswer: 1,
        ...values,
    }).returning();
    return question;
}

async function addTestRound(values = {}) {
    const [user] = await addTestUser();
    const [round] = await db.insert(rounds).values({ userId: user.userId, ...values }).returning();
    return { user, round };
}

function addRoundQuestion(roundId, questionId, values = {}) {
    return db.insert(roundQuestions)
        .values({ roundId, questionId, position: 1, answerOrder: [3, 1, 2], ...values })
        .returning();
}

describe('database schema', () => {
    it('gives a new user the user role and a new score 0 tokens, and deletes the score with the user', async () => {
        const [user] = await addTestUser();
        expect(user.role).toBe('user');

        const [score] = await db.insert(scores).values({ userId: user.userId }).returning();
        expect(score.starTokens).toBe(0);
        // The active round is now the saved place
        expect(score).not.toHaveProperty('savedQuestionId');

        await db.delete(users).where(eq(users.userId, user.userId));
        const left = await db.select().from(scores).where(eq(scores.userId, user.userId));
        expect(left).toEqual([]);
    });

    it('refuses a second account with the same email', async () => {
        await addTestUser();
        // 23505 is Postgres's code for a broken UNIQUE rule. Drizzle keeps Postgres's error on `cause`
        await expect(addTestUser()).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('refuses a correct answer outside 1 to 3', async () => {
        // 23514 is Postgres's code for a broken CHECK rule
        await expect(addTestQuestion({ correctAnswer: 4 })).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('refuses a second player whose name differs only in capitals', async () => {
        await addTestUser();
        const clash = addTestUser({ email: OTHER_EMAIL, name: 'SCHEMA TEST' });
        await expect(clash).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('refuses a name shorter than 3 characters', async () => {
        await expect(addTestUser({ name: 'Al' })).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('refuses a name longer than 20 characters', async () => {
        // 22001 is Postgres's code for a value too long for its column
        await expect(addTestUser({ name: 'A'.repeat(21) })).rejects.toMatchObject({ cause: { code: '22001' } });
    });

    it('deletes a user\'s sessions with the user', async () => {
        const [user] = await addTestUser();
        await db.insert(sessions).values({
            sessionId: 'a'.repeat(64),
            userId: user.userId,
            expiresAt: new Date(Date.now() + 60_000),
        });

        await db.delete(users).where(eq(users.userId, user.userId));
        const left = await db.select().from(sessions).where(eq(sessions.userId, user.userId));
        expect(left).toEqual([]);
    });

    it('starts a question visible', async () => {
        const question = await addTestQuestion();
        expect(question.hiddenAt).toBeNull();
    });

    it('refuses a second country whose name differs only in capitals', async () => {
        await addTestQuestion();
        const error = await db.insert(countries).values({ name: TEST_COUNTRY.toUpperCase() }).catch((e) => e);
        expect(error.cause.code).toBe('23505');
    });
});

describe('game tables', () => {
    it('starts a round active, and deletes it and its questions with the player', async () => {
        const question = await addTestQuestion();
        const { user, round } = await addTestRound();
        expect(round.status).toBe('active');
        expect(round.finishedAt).toBeNull();

        const [row] = await addRoundQuestion(round.roundId, question.questionId);
        expect(row.answerOrder).toEqual([3, 1, 2]);
        expect(row.hintUsed).toBe(false);
        expect(row.tokensAwarded).toBe(0);
        expect(row.answeredAt).toBeNull();

        await db.delete(users).where(eq(users.userId, user.userId));
        expect(await db.select().from(rounds).where(eq(rounds.roundId, round.roundId))).toEqual([]);
        expect(await db.select().from(roundQuestions).where(eq(roundQuestions.roundId, round.roundId))).toEqual([]);
    });

    it('allows one active round per player, beside ended ones', async () => {
        const { user } = await addTestRound({ status: 'finished', finishedAt: new Date() });
        await db.insert(rounds).values({ userId: user.userId });
        const second = db.insert(rounds).values({ userId: user.userId });
        await expect(second).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('refuses an ended round with no end time', async () => {
        await expect(addTestRound({ status: 'abandoned' })).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it.each([
        ['a repeated answer', [1, 1, 2]],
        ['two answers', [1, 2]],
        ['an answer outside 1 to 3', [1, 2, 4]],
    ])('refuses an answer order with %s', async (_, answerOrder) => {
        const question = await addTestQuestion();
        const { round } = await addTestRound();
        const insert = addRoundQuestion(round.roundId, question.questionId, { answerOrder });
        await expect(insert).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it.each([
        ['a position above 10', { position: 11 }],
        ['a chosen answer outside 1 to 3', { answeredAt: new Date(), chosenAnswer: 4, correct: false }],
        ['negative tokens', { tokensAwarded: -5 }],
        ['an answer time with no chosen answer', { answeredAt: new Date() }],
    ])('refuses a round question with %s', async (_, values) => {
        const question = await addTestQuestion();
        const { round } = await addTestRound();
        const insert = addRoundQuestion(round.roundId, question.questionId, values);
        await expect(insert).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('refuses the same question twice in a round', async () => {
        const question = await addTestQuestion();
        const { round } = await addTestRound();
        await addRoundQuestion(round.roundId, question.questionId);
        const again = addRoundQuestion(round.roundId, question.questionId, { position: 2 });
        await expect(again).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('refuses to delete a question that has been in a round', async () => {
        const question = await addTestQuestion();
        const { round } = await addTestRound();
        await addRoundQuestion(round.roundId, question.questionId);
        // 23001 is Postgres's code for a delete an ON DELETE RESTRICT rule refused. A foreign key
        // without one (NO ACTION) gives 23503 instead
        const remove = db.delete(questions).where(eq(questions.questionId, question.questionId));
        await expect(remove).rejects.toMatchObject({ cause: { code: '23001' } });
    });
});
