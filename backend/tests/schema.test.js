import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from '../src/db/index.js';
import { users, scores, countries, questions } from '../src/db/schema/index.js';

// These tests write to the Neon test branch, so each one removes what it made
const TEST_EMAIL = 'schema-test@example.com';
const TEST_COUNTRY = 'Schema Testland';

afterEach(async () => {
    // Deleting the user deletes their score too (the cascade the first test proves)
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
    await db.delete(countries).where(eq(countries.name, TEST_COUNTRY));
});

function addTestUser() {
    return db.insert(users)
        .values({ name: 'Schema Test', email: TEST_EMAIL, passwordHash: 'not-a-real-hash' })
        .returning();
}

describe('database schema', () => {
    it('gives a new user the user role and a new score 10 tokens, and deletes the score with the user', async () => {
        const [user] = await addTestUser();
        expect(user.role).toBe('user');

        const [score] = await db.insert(scores).values({ userId: user.userId }).returning();
        expect(score.starTokens).toBe(10);
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
});
