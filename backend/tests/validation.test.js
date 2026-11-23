import { describe, it, expect } from 'vitest';

import { signUpSchema, loginSchema } from '../src/validation/auth.js';
import { answerSchema, roundParamsSchema } from '../src/validation/rounds.js';
import { listQuerySchema, questionSchema } from '../src/validation/admin.js';
import { idParamsSchema } from '../src/validation/common.js';

const valid = { name: 'Maria', email: 'maria@example.com', password: 'correct horse' };
const signUpOk = (changes) => signUpSchema.safeParse({ ...valid, ...changes }).success;

describe('signUpSchema', () => {
    it('trims the name, and trims and lowercases the email', () => {
        const data = signUpSchema.parse({ ...valid, name: '  Maria  ', email: ' Maria@Example.COM ' });
        expect(data.name).toBe('Maria');
        expect(data.email).toBe('maria@example.com');
    });

    it('takes names of 3 to 20 characters', () => {
        expect(signUpOk({ name: 'Al' })).toBe(false);
        expect(signUpOk({ name: 'Ali' })).toBe(true);
        expect(signUpOk({ name: 'A'.repeat(20) })).toBe(true);
        expect(signUpOk({ name: 'A'.repeat(21) })).toBe(false);
        // Spaces round a name don't count towards its length
        expect(signUpOk({ name: '  Al  ' })).toBe(false);
    });

    it('takes passwords of 8 to 72 characters', () => {
        expect(signUpOk({ password: 'a'.repeat(7) })).toBe(false);
        expect(signUpOk({ password: 'a'.repeat(8) })).toBe(true);
        expect(signUpOk({ password: 'a'.repeat(72) })).toBe(true);
        expect(signUpOk({ password: 'a'.repeat(73) })).toBe(false);
    });

    it('refuses an email that is not an address', () => {
        expect(signUpOk({ email: 'maria' })).toBe(false);
    });

    it('drops fields it does not list, such as role', () => {
        expect(signUpSchema.parse({ ...valid, role: 'admin' })).not.toHaveProperty('role');
    });
});

describe('loginSchema', () => {
    it('takes any password that is not empty, since only the hash decides', () => {
        expect(loginSchema.safeParse({ email: valid.email, password: 'short' }).success).toBe(true);
        expect(loginSchema.safeParse({ email: valid.email, password: '' }).success).toBe(false);
    });
});

describe('answerSchema', () => {
    const answerOk = (body) => answerSchema.safeParse(body).success;

    it('takes button 1, 2 or 3 as a whole number', () => {
        expect(answerOk({ choice: 1 })).toBe(true);
        expect(answerOk({ choice: 3 })).toBe(true);
        expect(answerOk({ choice: 0 })).toBe(false);
        expect(answerOk({ choice: 4 })).toBe(false);
        expect(answerOk({ choice: 2.5 })).toBe(false);
        // JSON text is not a number: the frontend sends a number
        expect(answerOk({ choice: '2' })).toBe(false);
        expect(answerOk({})).toBe(false);
    });
});

describe('roundParamsSchema', () => {
    it('turns the id in the address into a positive whole number', () => {
        expect(roundParamsSchema.parse({ id: '12' })).toEqual({ id: 12 });
        expect(roundParamsSchema.safeParse({ id: 'abc' }).success).toBe(false);
        expect(roundParamsSchema.safeParse({ id: '0' }).success).toBe(false);
        expect(roundParamsSchema.safeParse({ id: '1.5' }).success).toBe(false);
        // Above Postgres's integer limit, which would otherwise be a database error and a 500
        expect(roundParamsSchema.safeParse({ id: '2147483648' }).success).toBe(false);
    });
});

describe('idParamsSchema', () => {
    it('is the same rule as a round id', () => {
        expect(roundParamsSchema).toBe(idParamsSchema);
    });
});

describe('listQuerySchema', () => {
    it('defaults to the first page of 20 and turns text into numbers', () => {
        expect(listQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
        expect(listQuerySchema.parse({ page: '3', limit: '50', search: '  paris ' }))
            .toEqual({ page: 3, limit: 50, search: 'paris' });
    });

    it('refuses a page below 1 and a limit above 100', () => {
        expect(listQuerySchema.safeParse({ page: '0' }).success).toBe(false);
        expect(listQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
        expect(listQuerySchema.safeParse({ page: 'two' }).success).toBe(false);
    });
});

describe('questionSchema', () => {
    const form = {
        country: ' France ',
        question: 'Which tower is this?',
        hint: 'Built for a world fair',
        answer1: 'Eiffel Tower',
        answer2: 'Tokyo Tower',
        answer3: 'Blackpool Tower',
        correctAnswer: '1',
    };

    it('trims the text and turns the right answer into a number, as a form sends it', () => {
        expect(questionSchema.parse(form)).toEqual({ ...form, country: 'France', correctAnswer: 1 });
    });

    it('lists every problem under its field', () => {
        const result = questionSchema.safeParse({ ...form, hint: '  ', correctAnswer: '4' });
        expect(result.error.issues.map((issue) => issue.path.join('.')).sort()).toEqual(['correctAnswer', 'hint']);
    });

    it('refuses two answers that differ only in capitals', () => {
        const result = questionSchema.safeParse({ ...form, answer3: 'eiffel tower' });
        expect(result.error.issues).toEqual([expect.objectContaining({ path: ['answers'], message: 'Each answer must be different.' })]);
    });

    it('refuses text longer than its column', () => {
        expect(questionSchema.safeParse({ ...form, question: 'x'.repeat(151) }).success).toBe(false);
        expect(questionSchema.safeParse({ ...form, answer1: 'x'.repeat(101) }).success).toBe(false);
    });
});
