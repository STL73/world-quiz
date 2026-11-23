import { asc, count, eq, ilike, or, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { countries, questions, roundQuestions } from '../db/schema/index.js';
import { AppError } from './errors.js';
import { containsPattern, pagination } from './lists.js';
import { shuffleAnswers } from './picking.js';

const NOT_FOUND = 'Question not found';

// What an admin sees of a question: everything but Cloudinary's name for the photo
const adminFields = {
    questionId: questions.questionId,
    country: countries.name,
    imageUrl: questions.imageUrl,
    question: questions.question,
    hint: questions.hint,
    answer1: questions.answer1,
    answer2: questions.answer2,
    answer3: questions.answer3,
    correctAnswer: questions.correctAnswer,
    hiddenAt: questions.hiddenAt,
    // Whether any round has used it, which decides between deleting and hiding
    played: sql`exists (select 1 from ${roundQuestions} where ${roundQuestions.questionId} = ${questions.questionId})`.mapWith(Boolean),
};

const fromQuestions = (fields) => db.select(fields).from(questions).innerJoin(countries, eq(countries.countryId, questions.countryId));

// A page of questions, by country then id, optionally only those whose text or country contains `search`
export async function listQuestions({ page, limit, search }) {
    const where = search
        ? or(ilike(questions.question, containsPattern(search)), ilike(countries.name, containsPattern(search)))
        : undefined;
    const [items, [{ total }]] = await Promise.all([
        fromQuestions(adminFields)
            .where(where)
            .orderBy(asc(countries.name), asc(questions.questionId))
            .limit(limit)
            .offset((page - 1) * limit),
        fromQuestions({ total: count() }).where(where),
    ]);
    return { data: items, pagination: pagination(page, limit, total) };
}

// One question as an admin sees it. 404 if there is none
export async function getQuestion(questionId) {
    const [question] = await fromQuestions(adminFields).where(eq(questions.questionId, questionId));
    if (!question) throw new AppError(404, NOT_FOUND);
    return question;
}

// A question as a player would see it, with the right button marked. Saves nothing
export async function previewQuestion(questionId) {
    const question = await getQuestion(questionId);
    const order = shuffleAnswers();
    return {
        imageUrl: question.imageUrl,
        text: question.question,
        answers: order.map((n) => question[`answer${n}`]),
        hint: question.hint,
        correctChoice: order.indexOf(question.correctAnswer) + 1,
        hidden: question.hiddenAt !== null,
    };
}

// Every country, by name
export function listCountries() {
    return db.select({ countryId: countries.countryId, name: countries.name }).from(countries).orderBy(asc(countries.name));
}
