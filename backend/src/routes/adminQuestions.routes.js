import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listQuerySchema } from '../validation/admin.js';
import { idParamsSchema } from '../validation/common.js';
import { listQuestions, getQuestion, previewQuestion } from '../lib/questions.js';

const adminQuestionsRouter = Router();

// Every route here is for admins only
adminQuestionsRouter.use(requireAuth, requireRole('admin'));

// A page of questions, hidden ones included
adminQuestionsRouter.get('/', validate({ query: listQuerySchema }), async (req, res) => {
    res.json(await listQuestions(req.valid.query));
});

// One question, for the edit form
adminQuestionsRouter.get('/:id', validate({ params: idParamsSchema }), async (req, res) => {
    res.json({ data: await getQuestion(req.valid.params.id) });
});

// The question as a player would see it, with the right answer marked
adminQuestionsRouter.get('/:id/preview', validate({ params: idParamsSchema }), async (req, res) => {
    res.json({ data: await previewQuestion(req.valid.params.id) });
});

export default adminQuestionsRouter;
