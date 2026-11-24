import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { protectSignup, slidingWindow } from '@arcjet/node';

import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { aj } from '../config/arcjet.js';
import { AppError } from '../lib/errors.js';
import { accountFor, createPlayer } from '../lib/accounts.js';
import { checkPassword } from '../lib/passwords.js';
import { SESSION_COOKIE, startSession, endSession } from '../lib/sessions.js';
import { validate } from '../middleware/validate.js';
import { arcjetProtect } from '../middleware/security.js';
import { requireAuth } from '../middleware/auth.js';
import { signUpSchema, loginSchema } from '../validation/auth.js';

const authRouter = Router();

// Stricter Arcjet rules for these routes, made once here (null in tests)
const signUpGuard = aj?.withRule(protectSignup({
    email: { mode: 'LIVE', deny: ['DISPOSABLE', 'INVALID', 'NO_MX_RECORDS'] },
    bots: { mode: 'LIVE', allow: [] },
    rateLimit: { mode: 'LIVE', interval: '1h', max: 5 },
}));
const loginGuard = aj?.withRule(slidingWindow({ mode: 'LIVE', interval: '15m', max: 10 }));

// Creates a player and logs them in straight away
authRouter.post(
    '/sign-up',
    validate({ body: signUpSchema }),
    arcjetProtect(signUpGuard, (req) => ({ email: req.valid.body.email })),
    async (req, res) => {
        const user = await createPlayer(req.valid.body);
        await startSession(res, user.userId);
        res.status(201).json({ data: await accountFor(user) });
    },
);

// Logs in with email and password; a new session every time
authRouter.post('/login', arcjetProtect(loginGuard), validate({ body: loginSchema }), async (req, res) => {
    const { email, password } = req.valid.body;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    // Compared even with no account, so the timing can't tell which emails exist
    const matches = await checkPassword(password, user?.passwordHash);
    // One message for both, so the form can't be used to find out who has an account
    if (!user || !matches) throw new AppError(401, 'Email or password is incorrect');

    await startSession(res, user.userId);
    res.json({ data: await accountFor(user) });
});

// Logs this device out. Answers 204 even with no session, so it's always safe to call
authRouter.post('/logout', async (req, res) => {
    await endSession(res, req.cookies[SESSION_COOKIE]);
    res.status(204).end();
});

// The logged-in account, which the frontend asks for when it loads
authRouter.get('/me', requireAuth, async (req, res) => {
    res.json({ data: await accountFor(req.user) });
});

export default authRouter;
