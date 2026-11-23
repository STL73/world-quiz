import { and, asc, eq, ne, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { countries, questions, rounds, roundQuestions } from '../db/schema/index.js';
import { AppError, isUniqueViolation } from './errors.js';
import { pickQuestions, shuffleAnswers } from './picking.js';
import { streakOf } from './scoring.js';

const NO_ROUND = 'You have no round in play. Press Play to start one';

// Starts a round: picks its questions and shuffles each one's answers. 409 if one is in play
export async function startRound(userId) {
    const all = await db.select({ questionId: questions.questionId }).from(questions);
    if (all.length === 0) throw new AppError(409, 'There are no questions to play yet');

    const correct = await db
        .selectDistinct({ questionId: roundQuestions.questionId })
        .from(roundQuestions)
        .innerJoin(rounds, eq(rounds.roundId, roundQuestions.roundId))
        .where(and(eq(rounds.userId, userId), eq(roundQuestions.correct, true)));
    const picked = pickQuestions(all.map((row) => row.questionId), correct.map((row) => row.questionId));

    // The round's id isn't known until it's inserted. It is the player's one active round
    const roundId = sql`(select ${rounds.roundId} from ${rounds} where ${rounds.userId} = ${userId} and ${rounds.status} = 'active')`;
    try {
        await db.batch([
            db.insert(rounds).values({ userId }),
            db.insert(roundQuestions).values(picked.map((questionId, index) => ({
                roundId,
                position: index + 1,
                questionId,
                answerOrder: shuffleAnswers(),
            }))),
        ]);
    } catch (error) {
        // The one-active-round rule decided, so two Play clicks at once can't both start one
        if (isUniqueViolation(error)) throw new AppError(409, 'You already have a round in play');
        throw error;
    }
}

// The player's active round and its questions in order. 404 if there is none
async function activeRound(userId) {
    const [round] = await db.select().from(rounds).where(and(eq(rounds.userId, userId), eq(rounds.status, 'active')));
    if (!round) throw new AppError(404, NO_ROUND);
    const rows = await db
        .select({ rq: roundQuestions, question: questions })
        .from(roundQuestions)
        .innerJoin(questions, eq(questions.questionId, roundQuestions.questionId))
        .where(eq(roundQuestions.roundId, round.roundId))
        .orderBy(asc(roundQuestions.position));
    return { round, rows };
}

// The first question not yet answered. The answer route finishes a round with its last answer,
// so an active round always has one
const nextRow = (rows) => rows.find((row) => !row.rq.answeredAt);

// The question on the player's screen. One not yet opened with GET /current can't be used, so a
// second click after an answer can't land on the next question unseen
function openRow(rows) {
    const row = nextRow(rows);
    if (!row.rq.shownAt) throw new AppError(409, 'That question has already been answered');
    return row;
}

// The tokens and streak so far in a round
function progress(rows) {
    const answered = rows.filter((row) => row.rq.answeredAt).map((row) => row.rq);
    return {
        tokensEarned: answered.reduce((sum, rq) => sum + rq.tokensAwarded, 0),
        streak: streakOf(answered),
    };
}

// What the player sees of their round, never the right answer. Records when a question is first shown
export async function currentRound(userId) {
    const { round, rows } = await activeRound(userId);
    const { rq, question } = nextRow(rows);
    if (!rq.shownAt) {
        await db.update(roundQuestions).set({ shownAt: new Date() }).where(eq(roundQuestions.roundQuestionId, rq.roundQuestionId));
    }
    return {
        roundId: round.roundId,
        position: rq.position,
        total: rows.length,
        question: {
            imageUrl: question.imageUrl,
            text: question.question,
            answers: rq.answerOrder.map((n) => question[`answer${n}`]),
            hint: rq.hintUsed ? question.hint : null,
        },
        ...progress(rows),
    };
}

// The current question's hint, recorded as used. Asking again gives the same hint
export async function useHint(userId) {
    const { rq, question } = openRow((await activeRound(userId)).rows);
    if (!rq.hintUsed) {
        await db.update(roundQuestions).set({ hintUsed: true }).where(eq(roundQuestions.roundQuestionId, rq.roundQuestionId));
    }
    return { hint: question.hint };
}

// Gives up the round in play. The tokens it earned stay
export async function abandonRound(userId) {
    const [round] = await db
        .update(rounds)
        .set({ status: 'abandoned', finishedAt: new Date() })
        .where(and(eq(rounds.userId, userId), eq(rounds.status, 'active')))
        .returning();
    if (!round) throw new AppError(404, NO_ROUND);
    return roundSummary(userId, round.roundId);
}

// An ended round's results. A round still in play, or another player's, is a 404, so the address
// can't give away answers
export async function roundSummary(userId, roundId) {
    const [round] = await db
        .select()
        .from(rounds)
        .where(and(eq(rounds.roundId, roundId), eq(rounds.userId, userId), ne(rounds.status, 'active')));
    if (!round) throw new AppError(404, 'Round not found');

    const rows = await db
        .select({ rq: roundQuestions, question: questions, country: countries.name })
        .from(roundQuestions)
        .innerJoin(questions, eq(questions.questionId, roundQuestions.questionId))
        .innerJoin(countries, eq(countries.countryId, questions.countryId))
        .where(eq(roundQuestions.roundId, roundId))
        .orderBy(asc(roundQuestions.position));

    return {
        roundId: round.roundId,
        status: round.status,
        startedAt: round.startedAt,
        finishedAt: round.finishedAt,
        correctCount: rows.filter((row) => row.rq.correct).length,
        total: rows.length,
        tokensEarned: rows.reduce((sum, row) => sum + row.rq.tokensAwarded, 0),
        questions: rows.map(({ rq, question, country }) => ({
            position: rq.position,
            imageUrl: question.imageUrl,
            text: question.question,
            country,
            // Only for answered questions: the others come back as unseen in later rounds
            correctAnswer: rq.answeredAt ? question[`answer${question.correctAnswer}`] : null,
            chosenAnswer: rq.chosenAnswer ? question[`answer${rq.chosenAnswer}`] : null,
            correct: rq.correct,
            hintUsed: rq.hintUsed,
            tokensEarned: rq.tokensAwarded,
        })),
    };
}
