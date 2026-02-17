/**
 * Import Indian Food Nutrition Dataset into CockroachDB
 * Source: Kaggle - Indian Food Nutritional Values Dataset (2025)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '..', 'food-data', 'Indian_Food_Nutrition_Processed.csv');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

async function importFood() {
    const client = await pool.connect();

    try {
        console.log("🍽️  Starting Food Import...");

        // Create the foods table
        await client.query(`
            CREATE TABLE IF NOT EXISTS foods (
                id SERIAL PRIMARY KEY,
                name STRING NOT NULL,
                calories FLOAT,
                carbs FLOAT,
                protein FLOAT,
                fats FLOAT,
                free_sugar FLOAT,
                fibre FLOAT,
                sodium FLOAT,
                calcium FLOAT,
                iron FLOAT,
                vitamin_c FLOAT,
                folate FLOAT,
                category STRING DEFAULT 'General',
                diet_type STRING DEFAULT 'Vegetarian'
            );
        `);
        console.log("✅ Foods table created/verified.");

        // Clear existing data
        await client.query('DELETE FROM foods');
        console.log("🗑️  Cleared existing food data.");

        // Read and parse CSV
        const rawData = fs.readFileSync(CSV_FILE, 'utf-8');
        const lines = rawData.split('\n').filter(l => l.trim());

        // Skip header
        const header = lines[0];
        console.log("📋 CSV Header:", header);

        const dataLines = lines.slice(1);
        console.log(`📦 Found ${dataLines.length} food items to import.`);

        // Non-veg keywords for classification
        const nonVegKeywords = [
            'chicken', 'mutton', 'lamb', 'fish', 'prawn', 'shrimp', 'egg', 'anda',
            'ande', 'meat', 'keema', 'bacon', 'salami', 'scotch egg', 'machli',
            'jhinga', 'roast chicken', 'tandoori chicken', 'butter chicken',
            'boti', 'kebab', 'nargisi', 'shammi'
        ];

        // Categorize dishes
        function classifyDietType(name) {
            const lower = name.toLowerCase();
            for (const keyword of nonVegKeywords) {
                if (lower.includes(keyword)) return 'Non-Vegetarian';
            }
            return 'Vegetarian';
        }

        function classifyCategory(name) {
            const lower = name.toLowerCase();
            if (lower.includes('tea') || lower.includes('coffee') || lower.includes('shake') ||
                lower.includes('lassi') || lower.includes('sharbat') || lower.includes('cooler') ||
                lower.includes('drink') || lower.includes('smoothie') || lower.includes('juice') ||
                lower.includes('thandai') || lower.includes('cocoa')) return 'Beverages';
            if (lower.includes('sandwich')) return 'Sandwiches';
            if (lower.includes('soup') || lower.includes('stock') || lower.includes('consomme')) return 'Soups';
            if (lower.includes('rice') || lower.includes('pulao') || lower.includes('biryani') ||
                lower.includes('khitchdi') || lower.includes('khichdi') || lower.includes('khichri')) return 'Rice & Grains';
            if (lower.includes('roti') || lower.includes('chapati') || lower.includes('parantha') ||
                lower.includes('paratha') || lower.includes('naan') || lower.includes('poori') ||
                lower.includes('dosa') || lower.includes('idli') || lower.includes('uttapam') ||
                lower.includes('bhatura') || lower.includes('appam')) return 'Breads & Flatbreads';
            if (lower.includes('dal') || lower.includes('lentil') || lower.includes('sambar') ||
                lower.includes('rasam') || lower.includes('kadhi')) return 'Dals & Lentils';
            if (lower.includes('curry') || lower.includes('sabzi') || lower.includes('sabji') ||
                lower.includes('bhujia') || lower.includes('bhartha') || lower.includes('kofta') ||
                lower.includes('korma') || lower.includes('masala') || lower.includes('paneer') ||
                lower.includes('stew') || lower.includes('jalfrezi') || lower.includes('musallam')) return 'Curries & Main Course';
            if (lower.includes('salad') || lower.includes('raita')) return 'Salads & Raitas';
            if (lower.includes('chutney') || lower.includes('dip') || lower.includes('dressing') ||
                lower.includes('sauce')) return 'Chutneys & Dips';
            if (lower.includes('halwa') || lower.includes('kheer') || lower.includes('ladoo') ||
                lower.includes('burfi') || lower.includes('gulab') || lower.includes('rasgulla') ||
                lower.includes('rasmalai') || lower.includes('phirni') || lower.includes('ice cream') ||
                lower.includes('custard') || lower.includes('pudding') || lower.includes('mousse') ||
                lower.includes('souffle') || lower.includes('kulfi') || lower.includes('chikki') ||
                lower.includes('barfi') || lower.includes('payasam')) return 'Desserts & Sweets';
            if (lower.includes('cake') || lower.includes('biscuit') || lower.includes('cookie') ||
                lower.includes('pastry') || lower.includes('tart') || lower.includes('pie') ||
                lower.includes('roll') || lower.includes('gateau') || lower.includes('flan')) return 'Bakery';
            if (lower.includes('pakora') || lower.includes('pakoda') || lower.includes('samosa') ||
                lower.includes('cutlet') || lower.includes('vada') || lower.includes('bonda') ||
                lower.includes('kachori') || lower.includes('mathri') || lower.includes('spring roll') ||
                lower.includes('dhokla') || lower.includes('kebab') || lower.includes('tikka')) return 'Snacks & Starters';
            if (lower.includes('porridge') || lower.includes('cornflakes') || lower.includes('oatmeal') ||
                lower.includes('upma') || lower.includes('poha') || lower.includes('cheela') ||
                lower.includes('chilla') || lower.includes('daliya') || lower.includes('pancake') ||
                lower.includes('omelette') || lower.includes('omlet')) return 'Breakfast';
            if (lower.includes('pasta') || lower.includes('noodle') || lower.includes('chowmein') ||
                lower.includes('spaghetti') || lower.includes('macroni') || lower.includes('lasagne') ||
                lower.includes('fettuccine') || lower.includes('penne') || lower.includes('pizza') ||
                lower.includes('burger')) return 'Pasta & Continental';
            return 'General';
        }

        let imported = 0;
        for (const line of dataLines) {
            const cols = parseCSVLine(line);
            if (cols.length < 12) continue;

            const name = cols[0].replace(/"/g, '').trim();
            if (!name) continue;

            const calories = parseFloat(cols[1]) || 0;
            const carbs = parseFloat(cols[2]) || 0;
            const protein = parseFloat(cols[3]) || 0;
            const fats = parseFloat(cols[4]) || 0;
            const freeSugar = parseFloat(cols[5]) || 0;
            const fibre = parseFloat(cols[6]) || 0;
            const sodium = parseFloat(cols[7]) || 0;
            const calcium = parseFloat(cols[8]) || 0;
            const iron = parseFloat(cols[9]) || 0;
            const vitaminC = parseFloat(cols[10]) || 0;
            const folate = parseFloat(cols[11]) || 0;

            const category = classifyCategory(name);
            const dietType = classifyDietType(name);

            await client.query(
                `INSERT INTO foods (name, calories, carbs, protein, fats, free_sugar, fibre, sodium, calcium, iron, vitamin_c, folate, category, diet_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [name, calories, carbs, protein, fats, freeSugar, fibre, sodium, calcium, iron, vitaminC, folate, category, dietType]
            );
            imported++;
        }

        console.log(`\n🎉 Successfully imported ${imported} food items!`);

        // Summary stats
        const categoryCount = await client.query('SELECT category, COUNT(*) as cnt FROM foods GROUP BY category ORDER BY cnt DESC');
        console.log("\n📊 Category Breakdown:");
        categoryCount.rows.forEach(r => console.log(`   ${r.category}: ${r.cnt} items`));

        const dietCount = await client.query('SELECT diet_type, COUNT(*) as cnt FROM foods GROUP BY diet_type ORDER BY cnt DESC');
        console.log("\n🥗 Diet Type Breakdown:");
        dietCount.rows.forEach(r => console.log(`   ${r.diet_type}: ${r.cnt} items`));

    } catch (err) {
        console.error("❌ Import Failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

importFood();
