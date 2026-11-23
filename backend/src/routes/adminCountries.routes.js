import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { listCountries } from '../lib/questions.js';

const adminCountriesRouter = Router();

adminCountriesRouter.use(requireAuth, requireRole('admin'));

// Every country, for the question form's suggestions
adminCountriesRouter.get('/', async (req, res) => {
    res.json({ data: await listCountries() });
});

export default adminCountriesRouter;
