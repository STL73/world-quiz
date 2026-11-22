import { AppError } from '../lib/errors.js';
import { SESSION_COOKIE, findSession, renewSessionIfDue, clearSessionCookie } from '../lib/sessions.js';

// Loads the logged-in user from the session cookie onto req.user, or answers 401
export async function requireAuth(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    const found = await findSession(token);
    if (!found) {
        // An expired or unknown cookie is removed, so the browser stops sending it
        if (token) clearSessionCookie(res);
        throw new AppError(401, 'Please log in to continue');
    }
    await renewSessionIfDue(res, token, found.session);
    req.user = found.user;
    next();
}

// Lets through only the given roles; runs after requireAuth. Checked on the server for every
// request: hiding a link in the frontend protects nothing
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) throw new AppError(403, "You don't have access to this");
        next();
    };
}
