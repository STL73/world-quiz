import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { and, asc, eq, isNull, like } from 'drizzle-orm';

import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { users, scores, countries, questions, rounds, roundQuestions } from '../src/db/schema/index.js';
import { hashPassword } from '../src/lib/passwords.js';

// Everything made here is recognisable, so afterAll can remove it all
const PREFIX = 'rounds-test-';
const COUNTRY = 'Rounds Testland';
const CLOUDINARY_ID = 'rounds-test';
const PASSWORD = 'correct-horse-battery';
// 12, so a second round has 2 unseen questions after a first round of 10
const QUESTION_COUNT = 12;
// A full round makes about 40 requests to the test branch
const LONG = 90_000;

const ROUNDS = '/api/v1/rounds';
const CURRENT = `${ROUNDS}/current`;
const HINT = `${CURRENT}/hint`;
const ANSWER = `${CURRENT}/answer`;
const ABANDON = `${CURRENT}/abandon`;

beforeAll(async () => {
    const [country] = await db.insert(countries).values({ name: COUNTRY }).returning();
    await db.insert(questions).values(Array.from({ length: QUESTION_COUNT }, (_, i) => ({
        countryId: country.countryId,
        imageUrl: `https://example.com/rounds-test-${i}.jpg`,
        cloudinaryId: CLOUDINARY_ID,
        question: `Rounds test question ${i}`,
        hint: `Rounds test hint ${i}`,
        answer1: `Q${i} answer 1`,
        answer2: `Q${i} answer 2`,
        answer3: `Q${i} answer 3`,
        // Spread over 1 to 3, so code that always reads the same answer can't pass
        correctAnswer: (i % 3) + 1,
    })));
});

afterAll(async () => {
    // Rounds go with their players; only then can the played questions be deleted
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
    await db.delete(questions).where(eq(questions.cloudinaryId, CLOUDINARY_ID));
    await db.delete(countries).where(eq(countries.name, COUNTRY));
});

let count = 0;
function newAccount() {
    count += 1;
    const stamp = `${Date.now() % 100000}${count}`;
    return { name: `Rounds${stamp}`, email: `${PREFIX}${stamp}@example.com`, password: PASSWORD };
}

// A signed-up player and an agent that carries their cookie, like a browser
async function newPlayer() {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/sign-up').send(newAccount());
    return { agent, userId: res.body.data.userId };
}

// The player's current question as the database holds it, for checks the API must not answer
async function currentRow(userId) {
    const [row] = await db
        .select({ rq: roundQuestions, correctAnswer: questions.correctAnswer, hint: questions.hint })
        .from(roundQuestions)
        .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
        .innerJoin(questions, eq(questions.questionId, roundQuestions.questionId))
        .where(and(eq(rounds.userId, userId), eq(rounds.status, 'active'), isNull(roundQuestions.answeredAt)))
        .orderBy(asc(roundQuestions.position))
        .limit(1);
    return row;
}

// The button showing the right answer, read from the database: the API never says before the answer
async function rightChoice(userId) {
    const { rq, correctAnswer } = await currentRow(userId);
    return rq.answerOrder.indexOf(correctAnswer) + 1;
}

const wrongOf = (choice) => (choice % 3) + 1;

// Answers right or wrong, then opens the next question as the game page will
async function answer(player, right = true) {
    const choice = await rightChoice(player.userId);
    const res = await player.agent.post(ANSWER).send({ choice: right ? choice : wrongOf(choice) });
    if (res.status === 200 && !res.body.data.summary) await player.agent.get(CURRENT);
    return res;
}

async function starTokens(userId) {
    const [score] = await db.select().from(scores).where(eq(scores.userId, userId));
    return score.starTokens;
}

describe('starting a round', () => {
    it('picks 10 different questions, shuffles each, and shows the first without its answer', async () => {
        const player = await newPlayer();
        const res = await player.agent.post(ROUNDS);
        expect(res.status).toBe(201);
        expect(res.body.data).toEqual({
            roundId: expect.any(Number),
            position: 1,
            total: 10,
            question: {
                imageUrl: expect.stringMatching(/^https:\/\/example\.com\/rounds-test-/),
                text: expect.stringMatching(/^Rounds test question/),
                answers: [expect.any(String), expect.any(String), expect.any(String)],
                hint: null,
            },
            tokensEarned: 0,
            streak: 0,
        });
        // Nothing in the body may say which answer is right
        expect(JSON.stringify(res.body)).not.toMatch(/correct|answerOrder/i);

        const rows = await db.select().from(roundQuestions).where(eq(roundQuestions.roundId, res.body.data.roundId));
        expect(rows).toHaveLength(10);
        expect(new Set(rows.map((row) => row.questionId)).size).toBe(10);
        for (const row of rows) expect([...row.answerOrder].sort()).toEqual([1, 2, 3]);
    });

    it('shows the answers in the order the round stored', async () => {
        const player = await newPlayer();
        const res = await player.agent.post(ROUNDS);
        const { rq } = await currentRow(player.userId);
        const [question] = await db.select().from(questions).where(eq(questions.questionId, rq.questionId));
        expect(res.body.data.question.answers).toEqual(rq.answerOrder.map((n) => question[`answer${n}`]));
    });

    it('refuses a second round while one is in play', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const second = await player.agent.post(ROUNDS);
        expect(second.status).toBe(409);
    });

    it('starts only one round from two Play clicks at once', async () => {
        const player = await newPlayer();
        const results = await Promise.all([player.agent.post(ROUNDS), player.agent.post(ROUNDS)]);
        expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
        const active = await db.select().from(rounds).where(and(eq(rounds.userId, player.userId), eq(rounds.status, 'active')));
        expect(active).toHaveLength(1);
    });
});

describe('the current round', () => {
    it('continues where the player left off and records when the question was shown', async () => {
        const player = await newPlayer();
        const started = await player.agent.post(ROUNDS);
        await answer(player);

        // A new agent is a new visit: log in again and carry on
        const again = request.agent(app);
        const [user] = await db.select().from(users).where(eq(users.userId, player.userId));
        await again.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
        const res = await again.get(CURRENT);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ roundId: started.body.data.roundId, position: 2, tokensEarned: 10, streak: 1 });
        expect((await currentRow(player.userId)).rq.shownAt).toBeInstanceOf(Date);
    });

    it('answers 404 when there is no round in play', async () => {
        const player = await newPlayer();
        expect((await player.agent.get(CURRENT)).status).toBe(404);
    });
});

describe('who can play', () => {
    it('needs a logged-in player', async () => {
        expect((await request(app).post(ROUNDS)).status).toBe(401);
    });

    it('turns admins away', async () => {
        const account = newAccount();
        await db.insert(users).values({
            name: account.name,
            email: account.email,
            passwordHash: await hashPassword(PASSWORD),
            role: 'admin',
        });
        const admin = request.agent(app);
        await admin.post('/api/v1/auth/login').send({ email: account.email, password: PASSWORD });
        expect((await admin.post(ROUNDS)).status).toBe(403);
    });
});

describe('the hint', () => {
    it('gives the current question\'s hint, the same again on a second ask, and shows it with the question', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const { hint } = await currentRow(player.userId);

        const first = await player.agent.post(HINT);
        expect(first.status).toBe(200);
        expect(first.body.data).toEqual({ hint });
        expect((await player.agent.post(HINT)).body.data).toEqual({ hint });
        expect((await player.agent.get(CURRENT)).body.data.question.hint).toBe(hint);
        expect((await currentRow(player.userId)).rq.hintUsed).toBe(true);
    });

    it('answers 404 when there is no round in play', async () => {
        const player = await newPlayer();
        expect((await player.agent.post(HINT)).status).toBe(404);
    });
});

describe('giving up', () => {
    it('ends the round, keeps nothing open, and lets a new round start', async () => {
        const player = await newPlayer();
        const started = await player.agent.post(ROUNDS);

        const res = await player.agent.post(ABANDON);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ roundId: started.body.data.roundId, status: 'abandoned', correctCount: 0, total: 10 });
        // Unanswered questions keep their answers secret: they come back in later rounds
        for (const question of res.body.data.questions) {
            expect(question).toMatchObject({ correct: null, chosenAnswer: null, correctAnswer: null });
        }
        expect((await player.agent.get(CURRENT)).status).toBe(404);
        expect((await player.agent.post(ROUNDS)).status).toBe(201);
    });

    it('answers 404 when there is no round in play', async () => {
        const player = await newPlayer();
        expect((await player.agent.post(ABANDON)).status).toBe(404);
    });
});

describe('answering', () => {
    it('plays a full round of right answers to 140 tokens, then finishes it', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);

        const earned = [];
        let last;
        for (let i = 0; i < 10; i += 1) {
            last = await answer(player);
            expect(last.status).toBe(200);
            expect(last.body.data).toMatchObject({ correct: true, streak: i + 1 });
            earned.push(last.body.data.tokensEarned);
        }
        expect(earned).toEqual([10, 10, 15, 15, 15, 15, 15, 15, 15, 15]);
        expect(last.body.data.starTokens).toBe(140);
        expect(last.body.data.summary).toMatchObject({ status: 'finished', correctCount: 10, total: 10, tokensEarned: 140 });
        expect(await starTokens(player.userId)).toBe(140);
        expect((await player.agent.get(CURRENT)).status).toBe(404);
    }, LONG);

    it('says which button was right after a wrong answer, and resets the streak', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        await answer(player);
        const right = await rightChoice(player.userId);

        const res = await player.agent.post(ANSWER).send({ choice: wrongOf(right) });
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ correct: false, correctChoice: right, tokensEarned: 0, streak: 0, starTokens: 10 });
    });

    it('gives 5 for a right answer with the hint', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        await player.agent.post(HINT);
        const res = await answer(player);
        expect(res.body.data).toMatchObject({ correct: true, tokensEarned: 5, streak: 1 });
    });

    it('puts unseen questions in the next round and pays nothing for repeats', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        for (let i = 0; i < 10; i += 1) await answer(player);
        const firstRound = await db
            .select({ questionId: roundQuestions.questionId })
            .from(roundQuestions)
            .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
            .where(eq(rounds.userId, player.userId));
        const seen = new Set(firstRound.map((row) => row.questionId));

        await player.agent.post(ROUNDS);
        const secondRound = [];
        for (let i = 0; i < 10; i += 1) {
            const { rq } = await currentRow(player.userId);
            secondRound.push(rq.questionId);
            const res = await answer(player);
            // Unseen questions pay; repeats pay nothing, streak bonus included
            expect(res.body.data.tokensEarned > 0).toBe(!seen.has(rq.questionId));
        }
        // 12 questions, 10 seen: the 2 unseen must be in the second round
        expect(secondRound.filter((id) => !seen.has(id))).toHaveLength(QUESTION_COUNT - 10);
    }, LONG * 2);

    it('scores a double click once: the second click gets 409', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const choice = await rightChoice(player.userId);
        await player.agent.post(ANSWER).send({ choice });

        // The next question hasn't been opened, so this can't land on it
        const again = await player.agent.post(ANSWER).send({ choice });
        expect(again.status).toBe(409);
        expect(await starTokens(player.userId)).toBe(10);
    });

    it('scores two answers sent at the same moment once', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        const choice = await rightChoice(player.userId);

        const results = await Promise.all([
            player.agent.post(ANSWER).send({ choice }),
            player.agent.post(ANSWER).send({ choice }),
        ]);
        expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
        expect(await starTokens(player.userId)).toBe(10);
        const answered = await db
            .select()
            .from(roundQuestions)
            .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
            .where(and(eq(rounds.userId, player.userId), eq(roundQuestions.correct, true)));
        expect(answered).toHaveLength(1);
    });

    it('keeps the tokens of a round given up', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        await answer(player);
        const res = await player.agent.post(ABANDON);
        expect(res.body.data).toMatchObject({ status: 'abandoned', correctCount: 1, tokensEarned: 10 });
        expect(res.body.data.questions[0].correctAnswer).toEqual(expect.any(String));
        expect(await starTokens(player.userId)).toBe(10);
    });

    it('refuses a choice outside 1 to 3, and answers 404 with no round', async () => {
        const player = await newPlayer();
        expect((await player.agent.post(ANSWER).send({ choice: 1 })).status).toBe(404);
        await player.agent.post(ROUNDS);
        const res = await player.agent.post(ANSWER).send({ choice: 4 });
        expect(res.status).toBe(400);
        expect(res.body.error.details[0].path).toBe('body.choice');
    });
});

describe('a round\'s results', () => {
    it('shows an ended round to its player only, and never a round in play', async () => {
        const player = await newPlayer();
        await player.agent.post(ROUNDS);
        await answer(player);
        const ended = (await player.agent.post(ABANDON)).body.data.roundId;

        const own = await player.agent.get(`${ROUNDS}/${ended}`);
        expect(own.status).toBe(200);
        expect(own.body.data).toMatchObject({ roundId: ended, status: 'abandoned', correctCount: 1, tokensEarned: 10 });
        expect(own.body.data.questions[0]).toMatchObject({ position: 1, correct: true, country: COUNTRY });

        const other = await newPlayer();
        expect((await other.agent.get(`${ROUNDS}/${ended}`)).status).toBe(404);

        const inPlay = (await player.agent.post(ROUNDS)).body.data.roundId;
        expect((await player.agent.get(`${ROUNDS}/${inPlay}`)).status).toBe(404);
    });

    it('refuses an id that isn\'t a number', async () => {
        const player = await newPlayer();
        expect((await player.agent.get(`${ROUNDS}/abc`)).status).toBe(400);
    });
});
