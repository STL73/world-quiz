import { describe, it, expect } from 'vitest';

import { ROUND_SIZE, shuffle, pickQuestions, shuffleAnswers } from '../src/lib/picking.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Random tests run many times, so a rule that holds only by luck is caught
const RUNS = 200;

describe('pickQuestions', () => {
    it('picks every unseen question before any repeat', () => {
        // 15 questions, 1 to 8 already answered correctly: 9 to 15 must all be in, plus 3 repeats
        for (let run = 0; run < RUNS; run += 1) {
            const picked = pickQuestions(range(1, 15), range(1, 8));
            expect(picked).toHaveLength(ROUND_SIZE);
            expect(picked).toEqual(expect.arrayContaining(range(9, 15)));
            expect(new Set(picked).size).toBe(ROUND_SIZE);
        }
    });

    it('mixes the repeats in among the unseen questions', () => {
        // If repeats always came last, position 1 would never hold one
        const firsts = new Set();
        for (let run = 0; run < RUNS; run += 1) firsts.add(pickQuestions(range(1, 15), range(1, 8))[0]);
        expect([...firsts].some((id) => id <= 8)).toBe(true);
    });

    it('never picks more questions than exist', () => {
        const picked = pickQuestions([4, 7, 9], []);
        expect([...picked].sort()).toEqual([4, 7, 9]);
    });

    it('fills a round with repeats once everything has been answered', () => {
        const picked = pickQuestions(range(1, 46), range(1, 46));
        expect(picked).toHaveLength(ROUND_SIZE);
        expect(new Set(picked).size).toBe(ROUND_SIZE);
    });
});

describe('shuffling', () => {
    it('always gives the answers 1, 2 and 3, each once, and in time every order', () => {
        const orders = new Set();
        for (let run = 0; run < RUNS * 3; run += 1) {
            const order = shuffleAnswers();
            expect([...order].sort()).toEqual([1, 2, 3]);
            orders.add(order.join(''));
        }
        expect(orders.size).toBe(6);
    });

    it('leaves the list it was given as it was', () => {
        const items = [1, 2, 3, 4];
        shuffle(items);
        expect(items).toEqual([1, 2, 3, 4]);
    });

    it('uses the random source it is given', () => {
        // Math.random() always just below 1 means every swap is with itself: no change
        expect(shuffle([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
    });
});
