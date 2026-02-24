// Quick check: list ICMR_Curated foods in DB
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const result = await pool.query(`
    SELECT name, calories, food_group, diet_type 
    FROM food_items 
    WHERE source = 'ICMR_Curated' 
    ORDER BY food_group, calories
`);

console.log(`\nTotal ICMR_Curated foods: ${result.rows.length}\n`);
result.rows.forEach(f => {
    console.log(`[${f.food_group}] ${f.name} — ${f.calories} kcal (${f.diet_type})`);
});

await pool.end();
