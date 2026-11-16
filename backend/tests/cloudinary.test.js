import { describe, it, expect } from 'vitest';

import { questionImageFolder, questionImageUrl } from '../src/config/cloudinary.js';

describe('question photos in Cloudinary', () => {
    it('keeps each environment in its own folder', () => {
        // tests/setup.js sets NODE_ENV to test before this file loads
        expect(questionImageFolder).toBe('world-quiz/test/questions');
    });

    it('builds the address the frontend shows, letting Cloudinary pick the format and quality', () => {
        const url = questionImageUrl({ public_id: 'world-quiz/test/questions/brazil-q1', version: 1700000000 });
        expect(url).toMatch(
            /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/f_auto,q_auto\/v1700000000\/world-quiz\/test\/questions\/brazil-q1$/,
        );
    });
});
