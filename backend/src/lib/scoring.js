// Tokens for a correct answer the first time, and the same with the hint
const FIRST_TIME_TOKENS = 10;
const HINT_TOKENS = 5;
// Extra tokens for each correct answer from the STREAK_FROM-th in a row
const STREAK_BONUS = 5;
const STREAK_FROM = 3;
const TOKENS_PER_LEVEL = 100;

// The streak after an answer: correct answers in a row in this round, repeats included
export const nextStreak = (streakBefore, correct) => (correct ? streakBefore + 1 : 0);

// The streak at the end of a list of answers, oldest first
export const streakOf = (answers) => answers.reduce((streak, answer) => nextStreak(streak, answer.correct), 0);

// The tokens one answer earns, `streak` being the streak including this answer
export function tokensFor({ correct, firstTime, hintUsed, streak }) {
    // A repeat earns nothing, bonus included, so replaying known questions can't farm tokens
    if (!correct || !firstTime) return 0;
    const base = hintUsed ? HINT_TOKENS : FIRST_TIME_TOKENS;
    return base + (streak >= STREAK_FROM ? STREAK_BONUS : 0);
}

// The level a number of tokens reaches: 0 to 99 is level 1, 100 to 199 level 2
export const levelFor = (starTokens) => Math.floor(starTokens / TOKENS_PER_LEVEL) + 1;
