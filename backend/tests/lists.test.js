import { describe, it, expect } from 'vitest';

import { containsPattern, pagination } from '../src/lib/lists.js';

describe('containsPattern', () => {
    it('matches the text anywhere, taking LIKE wildcards literally', () => {
        expect(containsPattern('paris')).toBe('%paris%');
        expect(containsPattern('100%_sure\\')).toBe('%100\\%\\_sure\\\\%');
    });
});

describe('pagination', () => {
    it('works out the number of pages', () => {
        expect(pagination(2, 20, 46)).toEqual({ page: 2, limit: 20, total: 46, totalPages: 3 });
        expect(pagination(1, 20, 0)).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    });
});
