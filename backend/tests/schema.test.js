import { describe, it, expect, afterEach } from 'vitest';
import { eq, like } from 'drizzle-orm';

import { db } from '../src/db/index.js';
import { users, scores, sessions, countries, questions } from '../src/db/schema/index.js';

// These tests write to the Neon test branch, so each one removes what it made
const TEST_EMAIL = 'schema-test@example.com';
const OTHER_EMAIL = 'schema-test-2@example.com';
const TEST_COUNTRY = 'Schema Testland';

afterEach(async () => {
    // Deleting a user deletes their score and sessions too (the cascades the tests prove)
    await db.delete(users).where(like(users.email, 'schema-test%@example.com'));
    await db.delete(countries).where(eq(countries.name, TEST_COUNTRY));
});

function addTestUser(values = {}) {
    return db.insert(users)
        .values({ name: 'Schema Test', email: TEST_EMAIL, passwordHash: 'not-a-real-hash', ...values })
        .returning();
}

describe('database schema', () => {
    it('gives a new user the user role and a new score 0 tokens, and deletes the score with the user', async () => {
        const [user] = await addTestUser();
        expect(user.role).toBe('user');

        const [score] = await db.insert(scores).values({ userId: user.userId }).returning();
        expect(score.starTokens).toBe(0);
        expect(score.savedQuestionId).toBeNull();

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
        const [country] = await db.insert(countries).values({ name: TEST_COUNTRY }).returning();
        const insert = db.insert(questions).values({
            countryId: country.countryId,
            imageUrl: 'https://example.com/photo.jpg',
            cloudinaryId: 'schema-test',
            question: 'Which landmark is this?',
            hint: 'A test hint',
            answer1: 'A',
            answer2: 'B',
            answer3: 'C',
            correctAnswer: 4,
        });
        // 23514 is Postgres's code for a broken CHECK rule
        await expect(insert).rejects.toMatchObject({ cause: { code: '23514' } });
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
});
