import { eq, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { users, scores } from '../db/schema/index.js';
import { fieldError, isUniqueViolation } from './errors.js';
import { hashPassword } from './passwords.js';

// What the frontend may see of an account: everything but the password hash
export function publicUser(user) {
    return {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
    };
}

// Creates a player and their score row together. A taken email or name is a 409 on that field
export async function createPlayer({ name, email, password }) {
    const passwordHash = await hashPassword(password);
    try {
        // One batch, one transaction: there is never a player without a score row
        const [[user]] = await db.batch([
            db.insert(users).values({ name, email, passwordHash }).returning(),
            // The new user's id isn't known until the first insert runs, so a subquery finds it
            db.insert(scores).values({
                userId: sql`(select ${users.userId} from ${users} where ${users.email} = ${email})`,
            }),
        ]);
        return user;
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // The UNIQUE rules decided, so two sign-ups at once can't both get in. Only now ask which
        const [taken] = await db.select({ userId: users.userId }).from(users).where(eq(users.email, email));
        if (taken) throw fieldError(409, 'email', 'An account with this email already exists. Log in instead?');
        throw fieldError(409, 'name', 'This player name is taken. Please choose another.');
    }
}
