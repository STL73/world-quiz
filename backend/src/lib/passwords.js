import bcrypt from 'bcryptjs';

// bcrypt's work factor: each step up doubles the time one guess takes
const BCRYPT_COST = 12;

// Compared against when an email has no account, so a wrong email takes as long as a wrong
// password and the response time can't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('no-account-has-this-password', BCRYPT_COST);

// A password's hash, for storing
export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);

// Whether a password matches a stored hash. With no hash (no such account) it still does the work
export async function checkPassword(password, hash) {
    const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);
    return Boolean(hash) && matches;
}
