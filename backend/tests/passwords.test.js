import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

import { hashPassword, checkPassword } from '../src/lib/passwords.js';

describe('hashPassword', () => {
    it('makes a cost-12 bcrypt hash that the right password matches', async () => {
        const hash = await hashPassword('correct horse');
        expect(hash).toMatch(/^\$2[ab]\$12\$.{53}$/);
        expect(await bcrypt.compare('correct horse', hash)).toBe(true);
    });

    it('makes a hash that a wrong password does not match', async () => {
        const hash = await hashPassword('correct horse');
        expect(await bcrypt.compare('Correct horse', hash)).toBe(false);
    });
});

describe('checkPassword', () => {
    it('is true for the right password', async () => {
        const hash = await hashPassword('correct horse');
        expect(await checkPassword('correct horse', hash)).toBe(true);
    });

    it('is false for a wrong password', async () => {
        const hash = await hashPassword('correct horse');
        expect(await checkPassword('correct house', hash)).toBe(false);
    });

    it('is false when there is no account, without throwing', async () => {
        expect(await checkPassword('correct horse', undefined)).toBe(false);
    });
});
