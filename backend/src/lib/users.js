import { and, count, desc, eq, ilike, or } from 'drizzle-orm';

import { db } from '../db/index.js';
import { users, scores } from '../db/schema/index.js';
import { publicUser } from './accounts.js';
import { AppError } from './errors.js';
import { containsPattern, pagination } from './lists.js';
import { levelFor } from './scoring.js';

// A page of accounts, newest first, optionally only those whose name or email contains `search`.
// Admins have no score row, so their tokens and level are null
export async function listUsers({ page, limit, search }) {
    const where = search
        ? or(ilike(users.name, containsPattern(search)), ilike(users.email, containsPattern(search)))
        : undefined;
    const [rows, [{ total }]] = await Promise.all([
        db.select({ user: users, starTokens: scores.starTokens })
            .from(users)
            .leftJoin(scores, eq(scores.userId, users.userId))
            .where(where)
            .orderBy(desc(users.createdAt), desc(users.userId))
            .limit(limit)
            .offset((page - 1) * limit),
        db.select({ total: count() }).from(users).where(where),
    ]);
    return {
        data: rows.map(({ user, starTokens }) => ({
            ...publicUser(user),
            starTokens,
            level: starTokens === null ? null : levelFor(starTokens),
        })),
        pagination: pagination(page, limit, total),
    };
}

// Deletes a player; their score, sessions and rounds go with them. Admin accounts are a 403
export async function deleteUser(userId) {
    // The role is part of the delete itself, so nothing can make the account an admin in between
    const [deleted] = await db
        .delete(users)
        .where(and(eq(users.userId, userId), eq(users.role, 'user')))
        .returning({ userId: users.userId });
    if (deleted) return;

    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.userId, userId));
    if (!user) throw new AppError(404, 'User not found');
    throw new AppError(403, "Admin accounts can't be deleted here");
}
