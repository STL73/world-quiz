import 'dotenv/config';

import { db } from './index.js';
import { users } from './schema/index.js';
import { hashPassword } from '../lib/passwords.js';

// Creates the admin account from .env. Safe to run again: an existing email is left as it is

const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;

if (!SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    throw new Error('SEED_ADMIN_NAME, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env');
}

const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
const created = await db.insert(users)
    .values({ name: SEED_ADMIN_NAME, email, passwordHash: await hashPassword(SEED_ADMIN_PASSWORD), role: 'admin' })
    .onConflictDoNothing({ target: users.email })
    .returning({ userId: users.userId });

console.log(created.length > 0 ? `Admin created: ${email}` : `Admin already exists: ${email}, left unchanged`);
