import { Router } from 'express';
import { sql } from 'drizzle-orm';

import { db } from '../db/index.js';

const healthRouter = Router();

// Answers whether the API is up and can reach the database
healthRouter.get('/', async (req, res) => {
    await db.execute(sql`SELECT 1`);
    res.json({ data: { status: 'ok', database: 'ok' } });
});

export default healthRouter;
