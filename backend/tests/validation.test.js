import { describe, it, expect } from 'vitest';

import { signUpSchema, loginSchema } from '../src/validation/auth.js';
import { answerSchema, roundParamsSchema } from '../src/validation/rounds.js';

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
