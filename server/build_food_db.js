/**
 * BUILD_FOOD_DB.JS
 * Combines 3 Indian food nutrition datasets into a single unified CSV:
 *   1. IFCT 2017 (Official Government — 542 foods, 423 nutrients via npm)
 *   2. Indian Food Nutrition (Kaggle/INDB — 1014 foods, our existing CSV)
 *   3. ICMR Macro curated list (common Indian gym/diet foods with accurate macros)
 * 
 * Output: food-data/combined_indian_foods.csv
 * Schema: name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group, diet_type, source
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '../food-data/combined_indian_foods.csv');

// ================================================================
// DATASET 1: IFCT 2017 (Official NIN/ICMR Government Data)
// ================================================================
function loadIFCT2017() {
    console.log('\n📦 Loading Dataset 1: IFCT 2017 (NIN/ICMR Official)...');
    const csvPath = path.join(__dirname, '../node_modules/@ifct2017/compositions/index.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    // Column indices from IFCT 2017 structure:
    // 0=code, 1=name, 2=scientific, 3=local, 4=group, 5=regions, 6=tags
    // 7=Energy(kcal), 9=Moisture, 15=TotalFat, 19=DietaryFibre, 21=Starch, 
    // 23=TotalSugars, 25=Protein, 27=Calcium, 29=Phosphorus, 31=Iron
    const COLS = {
        name: 1, group: 4, tags: 6,
        energy: 7,   // kcal
        fat: 15,     // g
        fibre: 19,   // g
        protein: 25, // g
        carbs: 21,   // g (starch, approx)
    };

    const foods = [];
    const dataLines = lines.slice(1); // skip header

    for (const line of dataLines) {
        // Parse CSV properly (values may be quoted)
        const cells = parseCSVLine(line);
        if (cells.length < 30) continue;

        const name = clean(cells[COLS.name]);
        if (!name) continue;

        const energy = parseFloat(cells[COLS.energy]) || 0;
        const protein = parseFloat(cells[COLS.protein]) || 0;
        const fat = parseFloat(cells[COLS.fat]) || 0;
        const fibre = parseFloat(cells[COLS.fibre]) || 0;
        const carbs_approx = parseFloat(cells[COLS.carbs]) || 0;
        const group = clean(cells[COLS.group]);
        const tags = clean(cells[COLS.tags]);

        // Skip if no energy data
        if (energy === 0) continue;

        // Estimate total carbs = energy - (protein*4 + fat*9) / 4
        const carbs = carbs_approx > 0 ? carbs_approx : Math.max(0, Math.round((energy - protein * 4 - fat * 9) / 4));

        // Determine diet_type from tags
        let diet_type = 'vegetarian';
        if (tags.includes('nonveg') || tags.includes('non-veg') || tags.includes('meat') || tags.includes('fish') || tags.includes('chicken')) {
            diet_type = 'non-vegetarian';
        } else if (tags.includes('egg')) {
            diet_type = 'vegetarian'; // eggetarian treated as veg here
        }

        foods.push({
            name,
            calories: Math.round(energy),
            protein_g: Math.round(protein * 10) / 10,
            carbs_g: Math.round(carbs * 10) / 10,
            fat_g: Math.round(fat * 10) / 10,
            fibre_g: Math.round(fibre * 10) / 10,
            food_group: group || 'General',
            diet_type,
            source: 'IFCT2017'
        });
    }

    console.log(`   ✅ Loaded ${foods.length} foods from IFCT 2017`);
    return foods;
}

// ================================================================
// DATASET 2: Indian Food Nutrition (Kaggle/INDB — our existing CSV)
// ================================================================
function loadKaggleINDB() {
    console.log('\n📦 Loading Dataset 2: Kaggle/INDB Indian Nutrition (1014 dishes)...');
    const csvPath = path.join(__dirname, '../food-data/Indian_Food_Nutrition_Processed.csv');

    if (!fs.existsSync(csvPath)) {
        console.log('   ⚠️  File not found, skipping...');
        return [];
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    // Header: Dish Name,Calories (kcal),Carbohydrates (g),Protein (g),Fats (g),Free Sugar (g),Fibre (g),Sodium (mg),...

    const foods = [];
    for (const line of lines.slice(1)) {
        const cells = line.split(',');
        if (cells.length < 5) continue;

        const name = cells[0]?.trim();
        const calories = parseFloat(cells[1]) || 0;
        const carbs = parseFloat(cells[2]) || 0;
        const protein = parseFloat(cells[3]) || 0;
        const fat = parseFloat(cells[4]) || 0;
        const fibre = parseFloat(cells[6]) || 0;

        if (!name || calories === 0) continue;

        foods.push({
            name,
            calories: Math.round(calories),
            protein_g: Math.round(protein * 10) / 10,
            carbs_g: Math.round(carbs * 10) / 10,
            fat_g: Math.round(fat * 10) / 10,
            fibre_g: Math.round(fibre * 10) / 10,
            food_group: inferFoodGroup(name),
            diet_type: inferDietType(name),
            source: 'INDB_Kaggle'
        });
    }

    console.log(`   ✅ Loaded ${foods.length} foods from Kaggle/INDB`);
    return foods;
}

// ================================================================
// DATASET 3: ICMR Curated Macros (Common Indian Fitness Foods)
// Hand-curated from ICMR-NIN tables — focus on foods used in fitness diets
// ================================================================
function loadICMRFitnessFoods() {
    console.log('\n📦 Loading Dataset 3: ICMR Curated Fitness Foods...');

    // These are verified values from ICMR-NIN IFCT 2017 tables
    // Focused on foods commonly used in Indian fitness/gym diets
    const foods = [
        // === PROTEINS ===
        { name: 'Paneer (Cottage Cheese)', calories: 265, protein_g: 18.3, carbs_g: 3.4, fat_g: 20.8, fibre_g: 0, food_group: 'Dairy', diet_type: 'vegetarian' },
        { name: 'Boiled Eggs (2)', calories: 155, protein_g: 13.0, carbs_g: 1.1, fat_g: 11.0, fibre_g: 0, food_group: 'Eggs', diet_type: 'non-vegetarian' },
        { name: 'Egg White (100g)', calories: 52, protein_g: 10.9, carbs_g: 0.7, fat_g: 0.2, fibre_g: 0, food_group: 'Eggs', diet_type: 'non-vegetarian' },
        { name: 'Chicken Breast (100g, grilled)', calories: 165, protein_g: 31.0, carbs_g: 0, fat_g: 3.6, fibre_g: 0, food_group: 'Meat & Poultry', diet_type: 'non-vegetarian' },
        { name: 'Moong Dal (cooked, 1 cup)', calories: 212, protein_g: 14.2, carbs_g: 38.7, fat_g: 0.8, fibre_g: 15.4, food_group: 'Pulses & Legumes', diet_type: 'vegetarian' },
        { name: 'Rajma (cooked, 1 cup)', calories: 225, protein_g: 15.3, carbs_g: 40.4, fat_g: 0.9, fibre_g: 13.1, food_group: 'Pulses & Legumes', diet_type: 'vegetarian' },
        { name: 'Chana Dal (cooked, 1 cup)', calories: 189, protein_g: 10.7, carbs_g: 32.9, fat_g: 1.5, fibre_g: 8.0, food_group: 'Pulses & Legumes', diet_type: 'vegetarian' },
        { name: 'Soya Chunks (100g dry)', calories: 345, protein_g: 52.0, carbs_g: 33.0, fat_g: 0.5, fibre_g: 13.0, food_group: 'Soy Products', diet_type: 'vegetarian' },
        { name: 'Tofu (100g)', calories: 80, protein_g: 8.0, carbs_g: 1.9, fat_g: 4.5, fibre_g: 0.3, food_group: 'Soy Products', diet_type: 'vegetarian' },
        { name: 'Low-fat Curd / Dahi (1 cup)', calories: 98, protein_g: 8.5, carbs_g: 7.0, fat_g: 2.6, fibre_g: 0, food_group: 'Dairy', diet_type: 'vegetarian' },
        { name: 'Skimmed Milk (1 cup)', calories: 83, protein_g: 8.2, carbs_g: 12.2, fat_g: 0.2, fibre_g: 0, food_group: 'Dairy', diet_type: 'vegetarian' },
        { name: 'Fish (Surmai/Kingfish, 100g)', calories: 103, protein_g: 19.5, carbs_g: 0, fat_g: 2.8, fibre_g: 0, food_group: 'Fish & Seafood', diet_type: 'non-vegetarian' },
        { name: 'Chickpeas / Chole (cooked, 1 cup)', calories: 269, protein_g: 14.5, carbs_g: 45.0, fat_g: 4.2, fibre_g: 12.5, food_group: 'Pulses & Legumes', diet_type: 'vegetarian' },
        { name: 'Sprouts (Moong, 1 cup)', calories: 62, protein_g: 5.0, carbs_g: 11.0, fat_g: 0.5, fibre_g: 1.8, food_group: 'Sprouts', diet_type: 'vegetarian' },
        // === CARB SOURCES ===
        { name: 'Brown Rice (cooked, 1 cup)', calories: 216, protein_g: 5.0, carbs_g: 45.0, fat_g: 1.8, fibre_g: 3.5, food_group: 'Cereals & Grains', diet_type: 'vegetarian' },
        { name: 'White Rice (cooked, 1 cup)', calories: 204, protein_g: 4.2, carbs_g: 44.5, fat_g: 0.4, fibre_g: 0.6, food_group: 'Cereals & Grains', diet_type: 'vegetarian' },
        { name: 'Whole Wheat Roti (1 medium)', calories: 104, protein_g: 3.0, carbs_g: 22.0, fat_g: 0.4, fibre_g: 2.5, food_group: 'Bread & Rotis', diet_type: 'vegetarian' },
        { name: 'Oats (dry, 50g)', calories: 189, protein_g: 6.7, carbs_g: 33.0, fat_g: 3.5, fibre_g: 4.5, food_group: 'Cereals & Grains', diet_type: 'vegetarian' },
        { name: 'Banana (medium)', calories: 89, protein_g: 1.1, carbs_g: 23.0, fat_g: 0.3, fibre_g: 2.6, food_group: 'Fruits', diet_type: 'vegetarian' },
        { name: 'Sweet Potato (100g, boiled)', calories: 86, protein_g: 1.6, carbs_g: 20.1, fat_g: 0.1, fibre_g: 3.0, food_group: 'Vegetables', diet_type: 'vegetarian' },
        // === FAT SOURCES / NUTS ===
        { name: 'Almonds / Badam (25g)', calories: 144, protein_g: 5.2, carbs_g: 5.4, fat_g: 12.4, fibre_g: 3.0, food_group: 'Nuts & Seeds', diet_type: 'vegetarian' },
        { name: 'Peanuts (roasted, 30g)', calories: 170, protein_g: 7.8, carbs_g: 5.0, fat_g: 14.5, fibre_g: 2.4, food_group: 'Nuts & Seeds', diet_type: 'vegetarian' },
        { name: 'Makhana (Fox Nuts, 30g)', calories: 106, protein_g: 3.8, carbs_g: 23.5, fat_g: 0.1, fibre_g: 0.4, food_group: 'Nuts & Seeds', diet_type: 'vegetarian' },
        // === COMMON MEALS ===
        { name: 'Besan Chilla (2 medium)', calories: 230, protein_g: 12.0, carbs_g: 28.0, fat_g: 7.0, fibre_g: 4.0, food_group: 'Breakfast', diet_type: 'vegetarian' },
        { name: 'Moong Dal Dosa (2 medium)', calories: 210, protein_g: 11.0, carbs_g: 30.0, fat_g: 5.0, fibre_g: 3.0, food_group: 'Breakfast', diet_type: 'vegetarian' },
        { name: 'Poha with Peanuts (1 plate)', calories: 250, protein_g: 7.0, carbs_g: 42.0, fat_g: 5.5, fibre_g: 2.0, food_group: 'Breakfast', diet_type: 'vegetarian' },
        { name: 'Idli with Sambar (3 idli)', calories: 195, protein_g: 8.5, carbs_g: 38.0, fat_g: 1.5, fibre_g: 3.5, food_group: 'Breakfast', diet_type: 'vegetarian' },
        { name: 'Egg Bhurji with 2 Roti', calories: 340, protein_g: 18.0, carbs_g: 38.0, fat_g: 12.0, fibre_g: 3.0, food_group: 'Breakfast', diet_type: 'non-vegetarian' },
        { name: 'Dal Tadka with Rice (1 bowl)', calories: 380, protein_g: 16.0, carbs_g: 64.0, fat_g: 7.0, fibre_g: 8.0, food_group: 'Lunch/Dinner', diet_type: 'vegetarian' },
        { name: 'Palak Paneer with 2 Roti', calories: 420, protein_g: 20.0, carbs_g: 36.0, fat_g: 18.0, fibre_g: 5.0, food_group: 'Lunch/Dinner', diet_type: 'vegetarian' },
        { name: 'Rajma Chawal (1 plate)', calories: 450, protein_g: 18.0, carbs_g: 78.0, fat_g: 6.0, fibre_g: 12.0, food_group: 'Lunch/Dinner', diet_type: 'vegetarian' },
        { name: 'Chicken Curry with 2 Roti', calories: 490, protein_g: 34.0, carbs_g: 42.0, fat_g: 16.0, fibre_g: 3.0, food_group: 'Lunch/Dinner', diet_type: 'non-vegetarian' },
        { name: 'Vegetable Upma (1 bowl)', calories: 215, protein_g: 5.0, carbs_g: 38.0, fat_g: 5.5, fibre_g: 3.0, food_group: 'Breakfast', diet_type: 'vegetarian' },
        { name: 'Dhokla (4 pieces)', calories: 220, protein_g: 8.0, carbs_g: 38.0, fat_g: 3.0, fibre_g: 2.0, food_group: 'Snacks', diet_type: 'vegetarian' },
        { name: 'Chole Bhature (1 plate)', calories: 580, protein_g: 16.0, carbs_g: 76.0, fat_g: 24.0, fibre_g: 8.0, food_group: 'Lunch/Dinner', diet_type: 'vegetarian' },
        { name: 'Masala Oats (1 bowl)', calories: 260, protein_g: 9.0, carbs_g: 40.0, fat_g: 7.0, fibre_g: 5.0, food_group: 'Breakfast', diet_type: 'vegetarian' },
        { name: 'Paneer Bhurji with 2 Roti', calories: 430, protein_g: 22.0, carbs_g: 38.0, fat_g: 20.0, fibre_g: 3.5, food_group: 'Breakfast', diet_type: 'vegetarian' },
        { name: 'Moong Dal Khichdi (1 bowl)', calories: 290, protein_g: 12.0, carbs_g: 52.0, fat_g: 4.0, fibre_g: 6.0, food_group: 'Lunch/Dinner', diet_type: 'vegetarian' },
        { name: 'Roasted Chana (30g)', calories: 110, protein_g: 7.0, carbs_g: 16.0, fat_g: 2.5, fibre_g: 3.5, food_group: 'Snacks', diet_type: 'vegetarian' },
        { name: 'Fruit Chaat (1 bowl)', calories: 130, protein_g: 2.0, carbs_g: 32.0, fat_g: 0.5, fibre_g: 4.0, food_group: 'Snacks', diet_type: 'vegetarian' },
        { name: 'Buttermilk / Chaas (1 glass)', calories: 40, protein_g: 3.5, carbs_g: 4.5, fat_g: 0.5, fibre_g: 0, food_group: 'Beverages', diet_type: 'vegetarian' },
        { name: 'Coconut Water (1 glass)', calories: 45, protein_g: 1.7, carbs_g: 8.9, fat_g: 0.5, fibre_g: 1.1, food_group: 'Beverages', diet_type: 'vegetarian' },
        { name: 'Protein Lassi (curd + milk)', calories: 178, protein_g: 12.0, carbs_g: 18.0, fat_g: 4.5, fibre_g: 0, food_group: 'Beverages', diet_type: 'vegetarian' },
    ].map(f => ({ ...f, source: 'ICMR_Curated' }));

    console.log(`   ✅ Loaded ${foods.length} curated ICMR fitness foods`);
    return foods;
}

// ================================================================
// HELPERS
// ================================================================
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
        else { current += ch; }
    }
    result.push(current);
    return result;
}

function clean(str) {
    return (str || '').replace(/^"/, '').replace(/"$/, '').trim();
}

function inferDietType(name = '') {
    const lower = name.toLowerCase();
    const nonVeg = ['chicken', 'mutton', 'fish', 'prawn', 'egg', 'beef', 'pork', 'lamb', 'crab', 'shrimp', 'meat', 'biryani'];
    for (const kw of nonVeg) {
        if (lower.includes(kw)) return 'non-vegetarian';
    }
    return 'vegetarian';
}

function inferFoodGroup(name = '') {
    const lower = name.toLowerCase();
    if (lower.match(/chai|coffee|tea|juice|water|milk|lassi|shake/)) return 'Beverages';
    if (lower.match(/rice|roti|partha|naan|bread|poha|upma|idli|dosa|oats|porridge/)) return 'Cereals & Grains';
    if (lower.match(/dal|rajma|chana|chole|lentil|moong|masoor|urad/)) return 'Pulses & Legumes';
    if (lower.match(/paneer|curd|dahi|cheese|milk|yogurt|ghee|butter/)) return 'Dairy';
    if (lower.match(/chicken|mutton|lamb|beef|pork|fish|prawn|egg/)) return 'Meat & Seafood';
    if (lower.match(/banana|apple|mango|orange|papaya|guava|fruit/)) return 'Fruits';
    if (lower.match(/chana|peanut|almond|cashew|walnut|pistachio|makhana|nut/)) return 'Nuts & Seeds';
    if (lower.match(/samosa|pakora|bhajia|vada|biscuit|chips|namkeen/)) return 'Snacks';
    if (lower.match(/sweet|halwa|ladoo|barfi|kheer|gulab|rasgulla/)) return 'Sweets';
    return 'Mixed Dishes';
}

// ================================================================
// MERGE + DEDUPLICATE
// ================================================================
function mergeDeduplicate(datasets) {
    console.log('\n🔄 Merging and deduplicating...');

    const seen = new Map();
    let total = 0, dupes = 0;

    for (const foods of datasets) {
        for (const food of foods) {
            const key = food.name.toLowerCase().trim().replace(/\s+/g, ' ');
            if (!seen.has(key)) {
                seen.set(key, food);
                total++;
            } else {
                // Prefer later datasets (INDB/Curated) over IFCT for common dishes
                const existing = seen.get(key);
                if (existing.source === 'IFCT2017' && food.source !== 'IFCT2017') {
                    seen.set(key, food); // overwrite with more dish-specific data
                }
                dupes++;
            }
        }
    }

    console.log(`   Total unique foods: ${total}`);
    console.log(`   Duplicates removed: ${dupes}`);
    return Array.from(seen.values());
}

// ================================================================
// MAIN
// ================================================================
async function main() {
    console.log('🍛 Building Combined Indian Food Database...\n');

    const dataset1 = loadIFCT2017();
    const dataset2 = loadKaggleINDB();
    const dataset3 = loadICMRFitnessFoods();

    const combined = mergeDeduplicate([dataset1, dataset2, dataset3]);

    // Write output CSV
    const header = 'name,calories,protein_g,carbs_g,fat_g,fibre_g,food_group,diet_type,source';
    const rows = combined.map(f =>
        `"${f.name.replace(/"/g, "'")}",${f.calories},${f.protein_g},${f.carbs_g},${f.fat_g},${f.fibre_g},"${f.food_group}","${f.diet_type}","${f.source}"`
    );

    fs.writeFileSync(OUTPUT, [header, ...rows].join('\n'));

    console.log(`\n✅ Combined database written to: food-data/combined_indian_foods.csv`);
    console.log(`📊 Total foods: ${combined.length}`);

    // Stats
    const bySrc = {};
    combined.forEach(f => { bySrc[f.source] = (bySrc[f.source] || 0) + 1; });
    console.log('\n📈 Breakdown by source:');
    Object.entries(bySrc).forEach(([src, cnt]) => console.log(`   ${src}: ${cnt} foods`));

    const vegCount = combined.filter(f => f.diet_type === 'vegetarian').length;
    const nonvegCount = combined.filter(f => f.diet_type === 'non-vegetarian').length;
    console.log(`\n🥗 Vegetarian: ${vegCount} | 🍗 Non-Veg: ${nonvegCount}`);

    // Sample output
    console.log('\n📋 Sample foods (first 5):');
    combined.slice(0, 5).forEach(f =>
        console.log(`   ${f.name}: ${f.calories}kcal, ${f.protein_g}g protein [${f.source}]`)
    );
}

main().catch(console.error);
