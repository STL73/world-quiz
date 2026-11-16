import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit works on the dev branch, or on the test branch when run with DB_TARGET=test
const url = process.env.DB_TARGET === 'test' ? process.env.TEST_DB_URL : process.env.DB_URL;

if (!url) {
    throw new Error('DB_URL (or TEST_DB_URL with DB_TARGET=test) is not defined in the environment variables');
}

export default defineConfig({
    schema: './src/db/schema/index.js',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url },
});
