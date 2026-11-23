import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { photoUpload } from '../middleware/upload.js';
import { fieldError } from '../lib/errors.js';
import { listQuerySchema, questionSchema } from '../validation/admin.js';
import { idParamsSchema } from '../validation/common.js';
import { listQuestions, getQuestion, previewQuestion, createQuestion, updateQuestion } from '../lib/questions.js';

const adminQuestionsRouter = Router();

// Every route here is for admins only
adminQuestionsRouter.use(requireAuth, requireRole('admin'));

// A page of questions, hidden ones included
adminQuestionsRouter.get('/', validate({ query: listQuerySchema }), async (req, res) => {
    res.json(await listQuestions(req.valid.query));
});

// Adds a question from the form: its fields and a photo
adminQuestionsRouter.post('/', photoUpload, validate({ body: questionSchema }), async (req, res) => {
    if (!req.file) throw fieldError(400, 'photo', 'Choose a photo of the landmark.');
    res.status(201).json({ data: await createQuestion(req.valid.body, req.file) });
});

// One question, for the edit form
adminQuestionsRouter.get('/:id', validate({ params: idParamsSchema }), async (req, res) => {
    res.json({ data: await getQuestion(req.valid.params.id) });
});

// The question as a player would see it, with the right answer marked
adminQuestionsRouter.get('/:id/preview', validate({ params: idParamsSchema }), async (req, res) => {
    res.json({ data: await previewQuestion(req.valid.params.id) });
});

// Changes a question. Sent as a form with a photo to replace it, or as JSON to keep it
adminQuestionsRouter.put('/:id', photoUpload, validate({ params: idParamsSchema, body: questionSchema }), async (req, res) => {
    res.json({ data: await updateQuestion(req.valid.params.id, req.valid.body, req.file) });
});

export default adminQuestionsRouter;
