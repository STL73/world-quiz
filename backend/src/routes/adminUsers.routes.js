import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listQuerySchema } from '../validation/admin.js';
import { idParamsSchema } from '../validation/common.js';
import { listUsers, deleteUser } from '../lib/users.js';

const adminUsersRouter = Router();

// Every route here is for admins only
adminUsersRouter.use(requireAuth, requireRole('admin'));

// A page of accounts with their tokens and level
adminUsersRouter.get('/', validate({ query: listQuerySchema }), async (req, res) => {
    res.json(await listUsers(req.valid.query));
});

// Deletes a player and everything that is theirs
adminUsersRouter.delete('/:id', validate({ params: idParamsSchema }), async (req, res) => {
    await deleteUser(req.valid.params.id);
    res.status(204).end();
});

export default adminUsersRouter;
