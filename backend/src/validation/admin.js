import { z } from 'zod';

// One page of a list: ?page=2&limit=20&search=paris. Query values always arrive as text
export const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
});

const CORRECT_MESSAGE = 'Choose which answer is right: 1, 2 or 3.';

// Required text that fits its database column
const text = (label, max) => z
    .string({ error: `Enter ${label}.` })
    .trim()
    .min(1, `Enter ${label}.`)
    .max(max, `Use ${max} characters or fewer.`);

// A question as the add and edit forms send it. The photo is checked separately, by multer
export const questionSchema = z.object({
    country: text('the country', 100),
    question: text('the question', 150),
    hint: text('a hint', 150),
    answer1: text('answer 1', 100),
    answer2: text('answer 2', 100),
    answer3: text('answer 3', 100),
    // A form sends "2"; coerce turns it into 2
    correctAnswer: z.coerce.number({ error: CORRECT_MESSAGE }).int(CORRECT_MESSAGE).min(1, CORRECT_MESSAGE).max(3, CORRECT_MESSAGE),
}).refine(
    ({ answer1, answer2, answer3 }) => new Set([answer1, answer2, answer3].map((a) => a.toLowerCase())).size === 3,
    { path: ['answers'], message: 'Each answer must be different.' },
);
