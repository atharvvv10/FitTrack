import fs from 'fs';

// --- INGREDIENT DICTIONARIES (Base per 100g or 1 serving) ---
// { name: '', cals, pro, carbs, fat, fib, isVegan, isDairy, isEgg, isMeat, tags }

const bases = [
    { name: '1 Roti', c: 104, p: 3, cb: 22, f: 1, fb: 3, v: true, d: false, e: false, m: false },
    { name: '2 Rotis', c: 208, p: 6, cb: 44, f: 2, fb: 6, v: true, d: false, e: false, m: false },
    { name: '3 Rotis', c: 312, p: 9, cb: 66, f: 3, fb: 9, v: true, d: false, e: false, m: false },
    { name: '1 Bowl Rice', c: 130, p: 2, cb: 28, f: 0, fb: 1, v: true, d: false, e: false, m: false },
    { name: '1.5 Bowls Rice', c: 195, p: 3, cb: 42, f: 0, fb: 1.5, v: true, d: false, e: false, m: false },
    { name: '2 Bowls Rice', c: 260, p: 4, cb: 56, f: 0, fb: 2, v: true, d: false, e: false, m: false },
    { name: 'Jeera Rice', c: 150, p: 2.5, cb: 28, f: 3, fb: 1.2, v: true, d: false, e: false, m: false },
    { name: 'Brown Rice (1 Bowl)', c: 110, p: 3, cb: 22, f: 1, fb: 3.5, v: true, d: false, e: false, m: false },
    { name: 'Quinoa (1 Bowl)', c: 120, p: 4.4, cb: 21, f: 2, fb: 2.8, v: true, d: false, e: false, m: false },
    { name: 'Millet Roti', c: 115, p: 3.5, cb: 20, f: 1.5, fb: 4, v: true, d: false, e: false, m: false },
    { name: '2 Millet Rotis', c: 230, p: 7, cb: 40, f: 3, fb: 8, v: true, d: false, e: false, m: false },
    { name: 'Naan', c: 260, p: 8, cb: 42, f: 6, fb: 2, v: false, d: true, e: false, m: false }, // dairy in naan dough
    { name: 'Garlic Naan', c: 290, p: 8, cb: 43, f: 9, fb: 2, v: false, d: true, e: false, m: false },
];

const breakfastBases = [
    { name: 'Poha', c: 180, p: 3, cb: 39, f: 1.5, fb: 2, v: true, d: false, e: false, m: false },
    { name: 'Upma', c: 190, p: 4, cb: 35, f: 3, fb: 3, v: true, d: false, e: false, m: false },
    { name: '2 Idlis', c: 116, p: 4, cb: 24, f: 0.4, fb: 1.5, v: true, d: false, e: false, m: false },
    { name: '3 Idlis', c: 174, p: 6, cb: 36, f: 0.6, fb: 2.2, v: true, d: false, e: false, m: false },
    { name: '4 Idlis', c: 232, p: 8, cb: 48, f: 0.8, fb: 3, v: true, d: false, e: false, m: false },
    { name: 'Plain Dosa', c: 133, p: 3, cb: 23, f: 3, fb: 1, v: true, d: false, e: false, m: false },
    { name: 'Masala Dosa', c: 260, p: 5, cb: 42, f: 8, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Besan Chilla', c: 150, p: 7, cb: 18, f: 5, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Moong Dal Chilla', c: 140, p: 8, cb: 17, f: 4, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Oats', c: 154, p: 5, cb: 27, f: 3, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Dalia', c: 160, p: 4, cb: 32, f: 1, fb: 5, v: true, d: false, e: false, m: false },
    { name: 'Aloo Paratha', c: 230, p: 5, cb: 35, f: 8, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Paneer Paratha', c: 280, p: 10, cb: 30, f: 12, fb: 3, v: false, d: true, e: false, m: false },
    { name: 'Gobi Paratha', c: 220, p: 5, cb: 33, f: 7, fb: 5, v: true, d: false, e: false, m: false },
    { name: 'Appam', c: 120, p: 2, cb: 25, f: 1.5, fb: 1, v: true, d: false, e: false, m: false }
];

const vegProteins = [
    { name: 'Yellow Dal Tadka', c: 120, p: 7, cb: 18, f: 3, fb: 5, v: true, d: false, e: false, m: false },
    { name: 'Toor Dal', c: 110, p: 6, cb: 17, f: 2, fb: 5, v: true, d: false, e: false, m: false },
    { name: 'Dal Makhani', c: 280, p: 9, cb: 22, f: 16, fb: 7, v: false, d: true, e: false, m: false },
    { name: 'Vegan Dal Makhani (Coconut Milk)', c: 220, p: 8, cb: 22, f: 10, fb: 7, v: true, d: false, e: false, m: false },
    { name: 'Chana Masala', c: 170, p: 8, cb: 25, f: 5, fb: 7, v: true, d: false, e: false, m: false },
    { name: 'Rajma Curry', c: 180, p: 8, cb: 26, f: 4, fb: 8, v: true, d: false, e: false, m: false },
    { name: 'Lobia Curry', c: 160, p: 7, cb: 24, f: 3, fb: 7, v: true, d: false, e: false, m: false },
    { name: 'Paneer Butter Masala', c: 320, p: 12, cb: 10, f: 26, fb: 2, v: false, d: true, e: false, m: false },
    { name: 'Palak Paneer', c: 240, p: 14, cb: 8, f: 18, fb: 4, v: false, d: true, e: false, m: false },
    { name: 'Kadai Paneer', c: 260, p: 13, cb: 12, f: 18, fb: 3, v: false, d: true, e: false, m: false },
    { name: 'Tofu Curry', c: 180, p: 14, cb: 6, f: 11, fb: 2, v: true, d: false, e: false, m: false },
    { name: 'Soya Chunks Curry', c: 150, p: 18, cb: 12, f: 3, fb: 5, v: true, d: false, e: false, m: false },
    { name: 'Matar Paneer', c: 250, p: 11, cb: 14, f: 16, fb: 4, v: false, d: true, e: false, m: false }
];

const eggProteins = [
    { name: '2 Boiled Eggs', c: 155, p: 12, cb: 1, f: 10, fb: 0, v: false, d: false, e: true, m: false },
    { name: '3 Boiled Eggs', c: 232, p: 18, cb: 1.5, f: 15, fb: 0, v: false, d: false, e: true, m: false },
    { name: '4 Egg Whites', c: 68, p: 14, cb: 1, f: 0, fb: 0, v: false, d: false, e: true, m: false },
    { name: 'Egg Curry (2 Eggs)', c: 220, p: 14, cb: 8, f: 14, fb: 2, v: false, d: false, e: true, m: false },
    { name: 'Egg Bhurji (2 Eggs)', c: 190, p: 13, cb: 4, f: 14, fb: 1, v: false, d: false, e: true, m: false },
    { name: ' मसाला Omelette (2 Eggs)', c: 190, p: 13, cb: 3, f: 14, fb: 1, v: false, d: false, e: true, m: false }
];

const heavyMeatProteins = [
    { name: 'Chicken Curry', c: 240, p: 25, cb: 10, f: 12, fb: 2, v: false, d: false, e: false, m: true },
    { name: 'Butter Chicken', c: 350, p: 22, cb: 12, f: 24, fb: 2, v: false, d: true, e: false, m: true },
    { name: 'Mutton Rogan Josh', c: 320, p: 24, cb: 8, f: 22, fb: 2, v: false, d: false, e: false, m: true },
    { name: 'Chicken Keema', c: 210, p: 26, cb: 6, f: 10, fb: 2, v: false, d: false, e: false, m: true },
    { name: 'Fish Curry', c: 220, p: 22, cb: 8, f: 11, fb: 1, v: false, d: false, e: false, m: true },
    { name: 'Prawn Masala', c: 200, p: 20, cb: 6, f: 10, fb: 2, v: false, d: false, e: false, m: true },
    { name: 'Goan Fish Curry', c: 260, p: 21, cb: 9, f: 15, fb: 2, v: false, d: false, e: false, m: true },
    { name: 'Kadai Chicken', c: 250, p: 24, cb: 10, f: 14, fb: 3, v: false, d: false, e: false, m: true },
    { name: 'Chicken Korma', c: 310, p: 23, cb: 12, f: 18, fb: 2, v: false, d: true, e: false, m: true },
    { name: 'Mutton Curry', c: 290, p: 24, cb: 8, f: 18, fb: 2, v: false, d: false, e: false, m: true }
];

const lightMeatProteins = [
    { name: 'Grilled Chicken Breast', c: 165, p: 31, cb: 0, f: 3, fb: 0, v: false, d: false, e: false, m: true },
    { name: 'Chicken Tikka (6 pieces)', c: 180, p: 25, cb: 4, f: 6, fb: 1, v: false, d: true, e: false, m: true },
    { name: 'Tandoori Chicken (2 pieces)', c: 200, p: 28, cb: 3, f: 8, fb: 1, v: false, d: true, e: false, m: true },
    { name: 'Lemon Herb Fish Roast', c: 150, p: 24, cb: 2, f: 5, fb: 0, v: false, d: false, e: false, m: true },
    { name: 'Chicken Clear Soup', c: 90, p: 12, cb: 4, f: 3, fb: 1, v: false, d: false, e: false, m: true },
    { name: 'Dry Chilli Chicken', c: 220, p: 20, cb: 12, f: 10, fb: 2, v: false, d: false, e: false, m: true },
    { name: 'Chicken Reshmi Kebab', c: 190, p: 22, cb: 3, f: 9, fb: 0, v: false, d: true, e: false, m: true },
    { name: 'Steamed Fish', c: 130, p: 22, cb: 0, f: 4, fb: 0, v: false, d: false, e: false, m: true },
    { name: 'Chicken Meatballs (Baked)', c: 180, p: 24, cb: 4, f: 7, fb: 1, v: false, d: false, e: false, m: true },
    { name: 'Prawn Tikka', c: 160, p: 20, cb: 2, f: 8, fb: 1, v: false, d: true, e: false, m: true }
];

const sides = [
    { name: 'Aloo Gobi', c: 110, p: 3, cb: 18, f: 4, fb: 5, v: true, d: false, e: false, m: false },
    { name: 'Bhindi Masala', c: 120, p: 2, cb: 14, f: 6, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Baingan Bharta', c: 130, p: 2, cb: 16, f: 7, fb: 6, v: true, d: false, e: false, m: false },
    { name: 'Mixed Veg Curry', c: 140, p: 4, cb: 18, f: 6, fb: 5, v: true, d: false, e: false, m: false },
    { name: 'Cabbage Poriyal', c: 90, p: 2, cb: 12, f: 4, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Lauki Sabzi', c: 70, p: 1, cb: 10, f: 3, fb: 3, v: true, d: false, e: false, m: false },
    { name: 'Jeera Aloo', c: 150, p: 2, cb: 24, f: 5, fb: 3, v: true, d: false, e: false, m: false },
    { name: 'Mushroom Do Pyaza', c: 110, p: 4, cb: 10, f: 6, fb: 3, v: true, d: false, e: false, m: false },
    { name: 'Cucumber Raita', c: 60, p: 3, cb: 5, f: 2, fb: 1, v: false, d: true, e: false, m: false },
    { name: 'Boondi Raita', c: 90, p: 3, cb: 8, f: 4, fb: 1, v: false, d: true, e: false, m: false }
];

const snacks = [
    { name: 'Roasted Makhana', c: 110, p: 3, cb: 20, f: 2, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Cucumber Carrot Salad', c: 40, p: 1, cb: 9, f: 0, fb: 3, v: true, d: false, e: false, m: false },
    { name: 'Moong Sprouts Salad', c: 120, p: 10, cb: 18, f: 1, fb: 6, v: true, d: false, e: false, m: false },
    { name: 'Mixed Nuts (30g)', c: 180, p: 6, cb: 6, f: 15, fb: 3, v: true, d: false, e: false, m: false },
    { name: 'Chana Chaat', c: 140, p: 7, cb: 22, f: 2, fb: 6, v: true, d: false, e: false, m: false },
    { name: 'Roasted Chana', c: 120, p: 6, cb: 18, f: 2, fb: 5, v: true, d: false, e: false, m: false },
    { name: 'Fruit Bowl (Apple & Papaya)', c: 90, p: 1, cb: 22, f: 0, fb: 4, v: true, d: false, e: false, m: false },
    { name: 'Greek Yogurt (1 cup)', c: 100, p: 10, cb: 4, f: 0, fb: 0, v: false, d: true, e: false, m: false },
    { name: 'Protein Shake (1 scoop)', c: 120, p: 24, cb: 3, f: 1.5, fb: 0, v: false, d: true, e: false, m: false },
    { name: 'Vegan Protein Shake', c: 115, p: 22, cb: 4, f: 1.5, fb: 1, v: true, d: false, e: false, m: false },
    { name: 'Buttermilk (Chaas)', c: 45, p: 2.5, cb: 4, f: 1.5, fb: 0, v: false, d: true, e: false, m: false },
    { name: 'Masala Oats', c: 140, p: 5, cb: 24, f: 3, fb: 4, v: true, d: false, e: false, m: false }
];

const nonVegSnacks = [
    ...lightMeatProteins,
    { name: 'Boiled Egg Whites (3)', c: 51, p: 11, cb: 1, f: 0, fb: 0, v: false, d: false, e: true, m: false },
    { name: 'Chicken Tikka Salad', c: 160, p: 22, cb: 8, f: 4, fb: 3, v: false, d: false, e: false, m: true }
];


// --- GENERATOR LOGIC ---
const csvRows = ['ID,Category,Meal,Dish,Description,Calories,Protein,Carbs,Fats,Fiber'];
let idCounter = 1;

function r(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function addFood(cat, meal, comps, descTpl) {
    let cals = 0, pro = 0, carbs = 0, fats = 0, fib = 0;
    const names = [];
    comps.forEach(c => {
        cals += c.c; pro += c.p; carbs += c.cb; fats += c.f; fib += c.fb;
        names.push(c.name);
    });

    let dishName = names.join(names.length === 2 ? ' with ' : ' and ');
    if (names.length === 3) dishName = `${names[0]} and ${names[1]} and ${names[2]}`;

    // Fix string representation
    dishName = dishName.replace(/1 /g, '').replace(/1\.5 /g, '').replace(/2 /g, '').trim();

    // Descriptions
    const descriptors = ['A balanced', 'A delicious', 'A home-style', 'A nutrient-rich', 'A high-protein', 'A healthy'];
    const endings = ['providing excellent macronutrients.', 'perfect for your dietary goals.', 'prepared with minimal oil.', 'cooked in traditional Indian style.'];
    const desc = `${r(descriptors)} ${meal.toLowerCase()} meal featuring ${dishName} - ${r(endings)}`;

    const row = `${idCounter++},${cat},${meal},"${dishName}","${desc}",${Math.round(cals)},${pro.toFixed(1)},${carbs.toFixed(1)},${fats.toFixed(1)},${fib.toFixed(1)}`;
    csvRows.push(row);
}

// 1. VEGAN CATEGORY (Target: ~500)
console.log('Generating Vegan...');
const vProts = vegProteins.filter(p => p.v);
const vBases = bases.filter(b => b.v);
const vSides = sides.filter(s => s.v);
const vSnacks = snacks.filter(s => s.v);
const bfastBases = breakfastBases.filter(b => b.v);

for (let i = 0; i < 100; i++) {
    addFood('Vegan', 'Breakfast', [r(bfastBases)]);
    addFood('Vegan', 'Breakfast', [r(bfastBases), r(vSnacks)]); // combo
    addFood('Vegan', 'Mid Morning Snack', [r(vSnacks)]);
    addFood('Vegan', 'Evening Snack', [r(vSnacks)]);
    addFood('Vegan', 'Lunch', [r(vProts), r(vBases)]);
    addFood('Vegan', 'Lunch', [r(vProts), r(vBases), r(vSides)]);
    addFood('Vegan', 'Dinner', [r(vProts), r(vBases)]);
    addFood('Vegan', 'Dinner', [r(vSides), r(vBases)]);
}

// 2. VEGETARIAN CATEGORY (Target: ~700)
console.log('Generating Vegetarian...');
for (let i = 0; i < 150; i++) {
    addFood('Vegetarian', 'Breakfast', [r(breakfastBases)]);
    addFood('Vegetarian', 'Mid Morning Snack', [r(snacks)]);
    addFood('Vegetarian', 'Evening Snack', [r(snacks)]);
    addFood('Vegetarian', 'Lunch', [r(vegProteins), r(bases)]);
    addFood('Vegetarian', 'Lunch', [r(vegProteins), r(bases), r(sides)]);
    addFood('Vegetarian', 'Dinner', [r(vegProteins), r(bases)]);
    addFood('Vegetarian', 'Dinner', [r(sides), r(bases)]);
}

// 3. EGGETARIAN CATEGORY (Target: ~800, 70/30 split)
console.log('Generating Eggetarian...');
for (let i = 0; i < 80; i++) {
    // 30% Egg
    addFood('Eggetarian', 'Breakfast', [r(eggProteins), r(bases)]);
    addFood('Eggetarian', 'Lunch', [r(eggProteins), r(bases), r(sides)]);
    addFood('Eggetarian', 'Dinner', [r(eggProteins), r(bases)]);
    // 70% Veg (x2 loop)
    for (let j = 0; j < 2; j++) {
        addFood('Eggetarian', 'Breakfast', [r(breakfastBases)]);
        addFood('Eggetarian', 'Lunch', [r(vegProteins), r(bases)]);
        addFood('Eggetarian', 'Dinner', [r(vegProteins), r(bases)]);
    }
    addFood('Eggetarian', 'Mid Morning Snack', [r(snacks)]);
    addFood('Eggetarian', 'Evening Snack', [r([...snacks, ...eggProteins])]);
}

// 4. NON-VEGETARIAN CATEGORY (Target: ~1000)
// breakfast -> veg ONLY
// mid morning -> veg ONLY
// lunch -> heavy meat
// dinner -> light meat
// evening snack -> light meat
console.log('Generating Non-Vegetarian...');
for (let i = 0; i < 250; i++) {
    addFood('Non-Vegetarian', 'Breakfast', [r(breakfastBases)]);
    addFood('Non-Vegetarian', 'Mid Morning Snack', [r(snacks)]);
    addFood('Non-Vegetarian', 'Lunch', [r(heavyMeatProteins), r(bases)]);
    addFood('Non-Vegetarian', 'Lunch', [r(heavyMeatProteins), r(bases), r(sides)]); // bigger lunch
    addFood('Non-Vegetarian', 'Dinner', [r(lightMeatProteins), r(bases)]);
    addFood('Non-Vegetarian', 'Dinner', [r(lightMeatProteins), r(sides)]); // low carb dinner
    addFood('Non-Vegetarian', 'Evening Snack', [r(nonVegSnacks)]);
}

const finalCSV = csvRows.join('\n');
fs.writeFileSync('./food-data/Indian_Diet_3000.csv', finalCSV);
console.log(`✅ Generated ${idCounter - 1} records into food-data/Indian_Diet_3000.csv`);
