
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;

dotenv.config();

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const EXERCISES_FILE = path.join(__dirname, '../exercise-data/dist/exercises.json');

const createTableQuery = `
DROP TABLE IF EXISTS exercises;
CREATE TABLE exercises (
    id STRING PRIMARY KEY,
    name STRING NOT NULL,
    force STRING,
    level STRING,
    mechanic STRING,
    equipment STRING,
    primary_muscles JSONB,
    secondary_muscles JSONB,
    instructions JSONB,
    category STRING,
    images JSONB,
    created_at TIMESTAMP DEFAULT current_timestamp()
);
`;

async function importExercises() {
    const client = await pool.connect();
    try {
        console.log("Creating table...");
        await client.query(createTableQuery);

        console.log("Reading exercises.json...");
        const rawData = fs.readFileSync(EXERCISES_FILE, 'utf-8');
        const exercises = JSON.parse(rawData);

        console.log(`Found ${exercises.length} exercises. Starting import...`);

        // Begin transaction
        await client.query('BEGIN');

        // Counter for progress
        let count = 0;
        const total = exercises.length;

        for (const ex of exercises) {
            const query = `
                UPSERT INTO exercises (
                    id, name, force, level, mechanic, equipment, 
                    primary_muscles, secondary_muscles, instructions, category, images
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `;

            const values = [
                ex.id,
                ex.name,
                ex.force,
                ex.level,
                ex.mechanic,
                ex.equipment,
                JSON.stringify(ex.primaryMuscles),
                JSON.stringify(ex.secondaryMuscles),
                JSON.stringify(ex.instructions),
                ex.category,
                JSON.stringify(ex.images)
            ];

            await client.query(query, values);
            count++;
            if (count % 100 === 0) {
                process.stdout.write(`\rImported ${count}/${total} exercises...`);
            }
        }

        process.stdout.write('\n'); // Newline after progress

        await client.query('COMMIT');
        console.log("Import completed successfully!");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error importing exercises:", err);
    } finally {
        client.release();
        pool.end();
    }
}

importExercises();
