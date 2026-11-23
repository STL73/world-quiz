import { describe, it, expect } from 'vitest';

import { levelFor, nextStreak, streakOf, tokensFor } from '../src/lib/scoring.js';

// Plays a list of answers the way the answer route does, and adds up the tokens
function playRound(answers) {
    let streak = 0;
    return answers.reduce((total, answer) => {
        streak = nextStreak(streak, answer.correct);
        return total + tokensFor({ ...answer, streak });
    }, 0);
}

const right = { correct: true, firstTime: true, hintUsed: false };
const wrong = { correct: false, firstTime: true, hintUsed: false };

describe('scoring', () => {
    it('gives 10 for a first-time correct answer and 5 with the hint', () => {
        expect(tokensFor({ ...right, streak: 1 })).toBe(10);
        expect(tokensFor({ ...right, hintUsed: true, streak: 1 })).toBe(5);
    });

    it('gives nothing for a wrong answer or a repeat, streak bonus included', () => {
        expect(tokensFor({ ...wrong, streak: 0 })).toBe(0);
        expect(tokensFor({ ...right, firstTime: false, streak: 5 })).toBe(0);
    });

    it('adds 5 from the 3rd correct answer in a row, with or without the hint', () => {
        expect(tokensFor({ ...right, streak: 2 })).toBe(10);
        expect(tokensFor({ ...right, streak: 3 })).toBe(15);
        expect(tokensFor({ ...right, hintUsed: true, streak: 3 })).toBe(10);
    });

    it('resets the streak on a wrong answer and counts repeats in it', () => {
        expect(nextStreak(4, false)).toBe(0);
        expect(nextStreak(2, true)).toBe(3);
        expect(streakOf([{ correct: true }, { correct: false }, { correct: true }, { correct: true }])).toBe(2);
        expect(streakOf([])).toBe(0);
    });

    it('scores the spec\'s worked example at 110', () => {
        const hinted = { ...right, hintUsed: true };
        expect(playRound([right, right, right, right, wrong, right, hinted, right, right, right])).toBe(110);
    });

    it('scores the best round at 140', () => {
        expect(playRound(Array(10).fill(right))).toBe(140);
    });
});

describe('levelFor', () => {
    it('starts at level 1 and goes up one level every 100 tokens', () => {
        expect(levelFor(0)).toBe(1);
        expect(levelFor(99)).toBe(1);
        expect(levelFor(100)).toBe(2);
        expect(levelFor(650)).toBe(7);
    });
});
