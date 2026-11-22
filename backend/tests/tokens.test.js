import { describe, it, expect } from 'vitest';

import { newToken, hashToken } from '../src/lib/tokens.js';

describe('tokens', () => {
    it('makes a 64-character hex token and returns its hash with it', () => {
        const { token, hash } = newToken();
        expect(token).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).toBe(hashToken(token));
        expect(hash).not.toBe(token);
    });

    it('makes a different token every time', () => {
        expect(newToken().token).not.toBe(newToken().token);
    });

    it('hashes with SHA-256', () => {
        // The published SHA-256 of "abc", so the test doesn't trust the code it checks
        expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
});
