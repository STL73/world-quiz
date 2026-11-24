import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { answerSchema, roundParamsSchema } from '../validation/rounds.js';
import { startRound, currentRound, savedRound, useHint, answerQuestion, abandonRound, roundSummary } from '../lib/rounds.js';

const roundsRouter = Router();

// Every play route needs a logged-in player; admins don't play
roundsRouter.use(requireAuth, requireRole('user'));

// Starts a round and shows its first question
roundsRouter.post('/', async (req, res) => {
    await startRound(req.user.userId);
    res.status(201).json({ data: await currentRound(req.user.userId) });
});

// The round in play, where the player left it
roundsRouter.get('/current', async (req, res) => {
    res.json({ data: await currentRound(req.user.userId) });
});

// Whether a round is in play, as counts, for the home screen. null when there is none
roundsRouter.get('/saved', async (req, res) => {
    res.json({ data: await savedRound(req.user.userId) });
});

// Checks the answer to the question on screen. The body says which button, never which question
roundsRouter.post('/current/answer', validate({ body: answerSchema }), async (req, res) => {
    res.json({ data: await answerQuestion(req.user.userId, req.valid.body.choice) });
});

// The current question's hint, which halves what a right answer earns
roundsRouter.post('/current/hint', async (req, res) => {
    res.json({ data: await useHint(req.user.userId) });
});

// Gives up the round in play and shows its results
roundsRouter.post('/current/abandon', async (req, res) => {
    res.json({ data: await abandonRound(req.user.userId) });
});

// An ended round's results. After the /current routes, so "current" is never read as an id
roundsRouter.get('/:id', validate({ params: roundParamsSchema }), async (req, res) => {
    res.json({ data: await roundSummary(req.user.userId, req.valid.params.id) });
});

export default roundsRouter;
