import { describe, it, expect } from 'vitest';

import { signUpSchema, loginSchema } from '../src/validation/auth.js';

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
