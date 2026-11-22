import crypto from 'node:crypto';

// A random value for a session cookie, and its SHA-256 hash. Only the hash is stored
export function newToken() {
    const token = crypto.randomBytes(32).toString('hex');
    return { token, hash: hashToken(token) };
}

// The SHA-256 hash that is stored instead of the value
export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
