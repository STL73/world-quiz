import bcrypt from 'bcryptjs';

// bcrypt's work factor: each step up doubles the time one guess takes
const BCRYPT_COST = 12;

// A password's hash, for storing
export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);
