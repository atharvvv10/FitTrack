/**
 * IMPORT_FOOD_DB.JS
 * Reads combined_indian_foods.csv and imports into CockroachDB `food_items` table.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log('🍛 Importing food database into CockroachDB...\n');

    // Step 1: Create table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS food_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            calories INT NOT NULL,
            protein_g FLOAT,
            carbs_g FLOAT,
            fat_g FLOAT,
            fibre_g FLOAT,
            food_group TEXT,
            diet_type TEXT,
            source TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('✅ Table food_items created (or already exists)');

    // Step 2: Clear old data
    await pool.query('DELETE FROM food_items WHERE 1=1;');
    console.log('🗑️  Cleared existing food_items data');

    // Step 3: Read CSV
    const csvPath = path.join(__dirname, '../food-data/Indian_Diet_3000.csv');
    const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim());
    const dataLines = lines.slice(1); // skip header

    console.log(`📂 Loading ${dataLines.length} foods from CSV...`);

    // Step 4: Batch insert
    let inserted = 0, failed = 0;
    const BATCH = 50;

    for (let i = 0; i < dataLines.length; i += BATCH) {
        const batch = dataLines.slice(i, i + BATCH);
        const values = [];
        const params = [];
        let pIdx = 1;

        for (const line of batch) {
            const cols = line.split(',');
            if (cols.length < 10) { failed++; continue; }

            const diet_type = cols[1];
            const food_group = cols[2];
            const name = cols[3].replace(/"/g, '').trim();
            const source = cols[4].replace(/"/g, '').trim();
            const calories = parseInt(cols[5]);
            const protein = parseFloat(cols[6]);
            const carbs = parseFloat(cols[7]);
            const fat = parseFloat(cols[8]);
            const fibre = parseFloat(cols[9]);

            params.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
            values.push(name, calories, protein, carbs, fat, fibre, food_group, diet_type, source);
        }

        if (params.length === 0) continue;

        try {
            await pool.query(
                `INSERT INTO food_items (name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group, diet_type, source) VALUES ${params.join(', ')}`,
                values
            );
            inserted += params.length;
        } catch (err) {
            console.error(`Batch error at ${i}:`, err.message.slice(0, 100));
            failed += params.length;
        }

        if ((i / BATCH) % 5 === 0) process.stdout.write(`\r   Progress: ${inserted}/${dataLines.length}...`);
    }

    console.log(`\n\n✅ Import complete!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Failed:   ${failed}`);

    // Verify
    const result = await pool.query('SELECT COUNT(*) FROM food_items');
    console.log(`\n📊 Total in DB: ${result.rows[0].count} food items`);

    // Sample check
    const sample = await pool.query(`SELECT name, calories, protein_g FROM food_items WHERE diet_type = 'vegetarian' AND food_group = 'Breakfast' LIMIT 5`);
    console.log('\n🍽️  Sample Breakfast Items:');
    sample.rows.forEach(r => console.log(`   ${r.name}: ${r.calories}kcal, ${r.protein_g}g protein`));

    await pool.end();
}

main().catch(err => {
    console.error('❌ Import failed:', err);
    process.exit(1);
});
