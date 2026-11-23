export const ROUND_SIZE = 10;

// A shuffled copy (Fisher–Yates). `random` is Math.random unless a test passes its own
export function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// The question ids for a new round: ones not yet answered correctly first, then random others,
// up to ROUND_SIZE, in a random order
export function pickQuestions(allIds, correctIds, random = Math.random) {
    const done = new Set(correctIds);
    const unseen = shuffle(allIds.filter((id) => !done.has(id)), random);
    const repeats = shuffle(allIds.filter((id) => done.has(id)), random);
    return shuffle([...unseen, ...repeats].slice(0, ROUND_SIZE), random);
}

// The order a question's answers are shown in: button n shows stored answer order[n - 1]
export const shuffleAnswers = (random = Math.random) => shuffle([1, 2, 3], random);
