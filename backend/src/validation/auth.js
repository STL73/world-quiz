import { z } from 'zod';

// The rules and wording the sign-up and login forms will repeat for quick feedback

export const email = z
    .string({ error: 'Enter your email address.' })
    .trim()
    .toLowerCase()
    .min(1, 'Enter your email address.')
    .pipe(z.email('Enter an email address like name@example.com.').max(255));

// bcrypt only reads the first 72 bytes of a password
export const newPassword = z
    .string({ error: 'Enter a password.' })
    .min(8, 'Use at least 8 characters.')
    .max(72, 'Use 72 characters or fewer.');

// Shown on the leaderboard, so it has to fit there
export const name = z
    .string({ error: 'Enter a player name.' })
    .trim()
    .min(3, 'Use at least 3 characters.')
    .max(20, 'Use 20 characters or fewer.');

// A password typed to prove who you are: checked against the hash, never against the rules
export const currentPassword = z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.');

// No role: every sign-up is a player, and the admin comes from the seed script
export const signUpSchema = z.object({ name, email, password: newPassword });

export const loginSchema = z.object({ email, password: currentPassword });
