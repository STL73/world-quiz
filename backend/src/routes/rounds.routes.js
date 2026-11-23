import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { startRound, currentRound, useHint, abandonRound } from '../lib/rounds.js';

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

// The current question's hint, which halves what a right answer earns
roundsRouter.post('/current/hint', async (req, res) => {
    res.json({ data: await useHint(req.user.userId) });
});

// Gives up the round in play and shows its results
roundsRouter.post('/current/abandon', async (req, res) => {
    res.json({ data: await abandonRound(req.user.userId) });
});

export default roundsRouter;
