import path from 'node:path';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

import { db } from '../src/db/index.js';
import { countries, questions } from '../src/db/schema/index.js';
import { cloudinary, questionImageFolder, questionImageUrl } from '../src/config/cloudinary.js';
import { correctAnswerOf, imagePublicId, toQuestion } from './transform.js';

// One-off copy of the countries and questions in MySQL wq_db into Neon. XAMPP's MySQL must be running.
// `npm run db:import` refuses a database that already has questions; `npm run db:import -- --reset` empties them first

// `||`, not `??`: an empty MYSQL_URL= line in .env counts as not set
const MYSQL_URL = process.env.MYSQL_URL || 'mysql://root@localhost:3306/wq_db';
// Every img_path in wq_db starts from the repo's src/ folder
const PHOTOS_DIR = path.resolve(import.meta.dirname, '../../src');
const RESET = process.argv.includes('--reset');

async function readQuestions() {
    const connection = await mysql.createConnection(MYSQL_URL);
    try {
        // wq_db's `countries` table holds the questions, one row each
        const [rows] = await connection.query('SELECT * FROM countries ORDER BY id');
        return rows;
    } finally {
        await connection.end();
    }
}

async function prepareNeon() {
    const hasData = (await db.$count(questions)) > 0 || (await db.$count(countries)) > 0;
    if (hasData && !RESET) {
        throw new Error('Neon already has questions. Run `npm run db:import -- --reset` to empty them first');
    }
    if (RESET) {
        // Row by row, not TRUNCATE: TRUNCATE would refuse because scores points at questions, and its
        // CASCADE would empty scores too. Deleting a question only clears a saved_question_id
        await db.delete(questions);
        await db.delete(countries);
        // Number the new rows from 1 again
        await db.execute(sql`ALTER TABLE questions ALTER COLUMN question_id RESTART`);
        await db.execute(sql`ALTER TABLE countries ALTER COLUMN country_id RESTART`);
        console.log('Emptied countries and questions');
    }
}

async function uploadPhoto(row) {
    const result = await cloudinary.uploader.upload(path.join(PHOTOS_DIR, row.img_path), {
        // Passed apart from the name, so the Media Library shows the photo in its folder; the name
        // Cloudinary returns still starts with the folder
        folder: questionImageFolder,
        public_id: imagePublicId(row.country, row.img_path),
        // Running the import again replaces each photo instead of adding a copy
        overwrite: true,
        resource_type: 'image',
        transformation: [{ width: 1600, crop: 'limit' }],
    });
    return { url: questionImageUrl(result), publicId: result.public_id };
}

async function check(questionCount, countryCount) {
    const counts = [
        ['countries', countryCount, await db.$count(countries)],
        ['questions', questionCount, await db.$count(questions)],
    ];
    let passed = true;
    for (const [table, expected, found] of counts) {
        console.log(`${table}: expected ${expected}, found ${found}`);
        if (expected !== found) passed = false;
    }

    // Uploaded isn't enough: each photo must load from the address saved in Neon
    const saved = await db.select({ questionId: questions.questionId, imageUrl: questions.imageUrl }).from(questions);
    for (const { questionId, imageUrl } of saved) {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (!response.ok) {
            console.log(`Question ${questionId}: photo answered ${response.status}`);
            passed = false;
        }
    }
    console.log(`Photos checked: ${saved.length}`);
    return passed;
}

async function main() {
    console.log(`Neon: ${new URL(process.env.DB_URL).host}`);
    const questionRows = await readQuestions();
    console.log(`MySQL: ${questionRows.length} questions`);

    // A broken question stops the import here, before anything is uploaded or written
    questionRows.forEach(correctAnswerOf);
    await prepareNeon();

    // Photos first: the slowest step and the likeliest to fail, so Neon is only written once they're all up
    const photos = [];
    for (const row of questionRows) {
        photos.push(await uploadPhoto(row));
        console.log(`Uploaded ${photos.length}/${questionRows.length}: ${photos.at(-1).publicId}`);
    }

    const countryNames = [...new Set(questionRows.map((row) => row.country))];
    const countryRows = await db.insert(countries).values(countryNames.map((name) => ({ name }))).returning();
    const countryIds = new Map(countryRows.map((country) => [country.name, country.countryId]));
    await db.insert(questions).values(questionRows.map((row, i) => toQuestion(row, countryIds.get(row.country), photos[i])));

    const passed = await check(questionRows.length, countryNames.length);
    console.log(passed ? 'Import complete: every count matches and every photo loads' : 'Import FAILED the checks above');
    process.exitCode = passed ? 0 : 1;
}

main().catch((error) => {
    console.error(`Import stopped: ${error.message}`);
    process.exitCode = 1;
});
