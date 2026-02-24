
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Legacy
// const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// ===== WORKOUT AI (Groq API) ============
const groqWorkout = new Groq({ apiKey: process.env.GROQ_WORKOUT_API_KEY });

// Initialize DB Pool
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export const generateAIWorkout = async (userProfile) => {
    try {
        let equipmentList = userProfile.equipment || [];
        if (equipmentList.length === 0) equipmentList = ['body only'];

        const dbEquipment = equipmentList.map(e => e === 'bodyweight' ? 'body only' : e);
        if (!dbEquipment.includes('body only')) dbEquipment.push('body only');

        const query = `
            SELECT id, name, equipment, primary_muscles, level, mechanic 
            FROM exercises 
            WHERE equipment = ANY($1) 
            OR equipment IS NULL
        `;
        const exerciseResult = await pool.query(query, [dbEquipment]);

        let availableExercises = exerciseResult.rows.map(ex => ({
            id: ex.id,
            name: ex.name,
            eq: ex.equipment,
            mus: ex.primary_muscles,
            lvl: ex.level
        }));

        if (availableExercises.length > 200) {
            availableExercises = availableExercises.sort(() => 0.5 - Math.random()).slice(0, 200);
        }

        console.log(`Sending ${availableExercises.length} exercises to Gemini...`);

        const prompt = `
            ACT AS AN INTELLIGENT SELECTOR. 
            Select exercises from the provided list to build a ${userProfile.time || 45}-min ${userProfile.goal} workout for a ${userProfile.level} user.
            Target Focus: ${userProfile.focus || 'Full Body'}.
            Injuries: ${userProfile.injuries || 'None'}.
            
            AVAILABLE EXERCISES (JSON):
            ${JSON.stringify(availableExercises)}
            
            TASK:
            Return a JSON plan using EXCLUSIVELY the exercises above.
            CRITICAL RULES:
            1. DO NOT INVENT EXERCISES. Use the exact "name" from the list.
            2. VARY THE SELECTION. Do not just pick the first few. 
            3. Ensure the selection fits the Target Focus.
            Format:
            {
                "title": "Creative Workout Name (e.g. 'Spartan Chest', 'Leg Obliterator')",
                "difficulty": "Beginner | Intermediate | Advanced",
                "totalDuration": "45 min",
                "warmup": [{"name": "Exact Name", "sets": "2", "reps": "12", "notes": "..."}],
                "exercises": [{"name": "Exact Name", "sets": "3", "reps": "10", "notes": "..."}],
                "cooldown": [{"name": "Exact Name", "sets": "1", "reps": "30s", "notes": "..."}]
            }
        `;

        try {
            console.log("ðŸ‹ï¸ Sending Workout Request to Groq (Llama3-70b)...");
            const completion = await groqWorkout.chat.completions.create({
                messages: [
                    { role: "system", content: "You are an elite fitness coach. You output ONLY valid JSON." },
                    { role: "user", content: prompt }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.7, // Higher temp for variety
                max_tokens: 4000,
                response_format: { type: "json_object" }
            });

            const jsonString = completion.choices[0]?.message?.content || "{}";
            console.log("ðŸ‹ï¸ Groq Workout Response Received");
            return JSON.parse(jsonString);
        } catch (apiError) {
            console.warn("Groq API Error (Workout):", apiError.message);
            throw apiError;
        }

    } catch (error) {
        console.error("AI Generation Error Details:", error);
        if (error.response) {
            console.error("Gemini Response Error:", await error.response.text());
        }
        throw new Error("Failed to generate workout with AI. Please try again.");
    }
};

// =============================================
// ===== DIET AI (Separate API Key) ============
// =============================================
// ===== DIET AI (Groq API) ============
const groqDiet = new Groq({ apiKey: process.env.GROQ_DIET_API_KEY });
// const dietGenAI = new GoogleGenerativeAI(process.env.GEMINI_DIET_API_KEY); // Legacy


// ═══════════════════════════════════════════════════════════════════
// FULL BODY-COMPOSITION PHASE ENGINE
// BMI classification → Diet Phase → Calorie targets → Meal count
// Supports: Vegetarian / Non-veg / Vegan / Eggetarian
// Training modifier: Strength / Cardio / Mobility
// ═══════════════════════════════════════════════════════════════════

// ── Phase definitions ────────────────────────────────────────────
const PHASES = {
    hypertrophy: {
        label: 'Hypertrophy Nutrition',
        emoji: '💪',
        strategy: 'Lean mass restoration and anabolic support',
        mealCount: 5,
        calMod: +700,   // maintenance + 700
        protPerKg: 2.0,
        supplements: ['Whey Protein', 'Creatine', 'Omega-3', 'Vitamin D', 'Magnesium'],
        carb_pct: 0.50,
        fat_pct: 0.20
    },
    lean_muscle: {
        label: 'Lean Muscle Plan',
        emoji: '🏋️',
        strategy: 'Muscle development with minimal fat gain',
        mealCount: 5,
        calMod: +250,
        protPerKg: 1.9,
        supplements: ['Whey Protein', 'Creatine', 'Omega-3', 'Vitamin D'],
        carb_pct: 0.45,
        fat_pct: 0.25
    },
    maintenance: {
        label: 'Maintenance Nutrition',
        emoji: '⚖️',
        strategy: 'Metabolic stability and energy balance',
        mealCount: 4,
        calMod: 0,
        protPerKg: 1.4,
        supplements: ['Multivitamin'],
        carb_pct: 0.45,
        fat_pct: 0.30
    },
    fat_loss: {
        label: 'Fat Loss Strategy',
        emoji: '🔥',
        strategy: 'Fat reduction with muscle preservation',
        mealCount: 4,
        calMod: -500,
        protPerKg: 2.0,
        supplements: ['Whey Protein', 'Omega-3', 'Vitamin D', 'Fiber Support'],
        carb_pct: 0.35,
        fat_pct: 0.30
    },
    aggressive_cut: {
        label: 'Aggressive Fat Loss',
        emoji: '🔥🔥',
        strategy: 'Metabolic protection during aggressive fat reduction',
        mealCount: 3,
        calMod: -750,
        protPerKg: 2.2,
        supplements: ['Whey Protein', 'Omega-3', 'Vitamin D', 'Fiber Support'],
        carb_pct: 0.30,
        fat_pct: 0.30
    }
};

// ── Diet-type protein source mapping ────────────────────────────
const DIET_TYPE_PROFILE = {
    vegetarian: { dbFilter: "diet_type = 'vegetarian'", label: 'Vegetarian' },
    vegan: { dbFilter: "diet_type = 'vegan' OR diet_type = 'vegetarian'", label: 'Vegan', b12Required: true },
    eggetarian: { dbFilter: "diet_type = 'vegetarian' OR name ILIKE '%egg%'", label: 'Eggetarian' },
    'non-vegetarian': { dbFilter: "(diet_type = 'non-vegetarian' OR diet_type = 'vegetarian')", label: 'Non-Veg' }
};

// ── Training-type macro modifier ────────────────────────────────
const TRAINING_MODIFIERS = {
    strength: { calAdj: +100, protAdj: +0.2, label: 'Strength/Hypertrophy' },
    cardio: { calAdj: +50, protAdj: +0.1, label: 'Conditioning/Cardio' },
    mobility: { calAdj: -50, protAdj: -0.1, label: 'Mobility/Light' }
};

// ── calculateTargets — BMI-aware, phase-driven ───────────────────
function calculateTargets(profile) {
    const weight = parseFloat(profile.weight) || 70;
    const height = parseFloat(profile.height) || 170;
    const age = parseInt(profile.age) || 25;
    const gender = (profile.gender || 'Male').toLowerCase();
    const goal = (profile.goal || 'General Fitness').toLowerCase();
    const level = (profile.level || 'Beginner').toLowerCase();
    const trainingType = (profile.training_type || 'strength').toLowerCase();

    // BMI
    const bmi = weight / Math.pow(height / 100, 2);
    let bmiClass;
    if (bmi < 16) bmiClass = 'severely_underweight';
    else if (bmi < 18.5) bmiClass = 'underweight';
    else if (bmi < 25) bmiClass = 'normal';
    else if (bmi < 30) bmiClass = 'overweight';
    else bmiClass = 'obese';

    // Mifflin-St Jeor BMR
    const bmr = gender === 'female' || gender === 'f'
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age + 5;

    // TDEE activity multiplier
    const actMults = { beginner: 1.40, intermediate: 1.60, advanced: 1.75, athlete: 1.90 };
    const actKey = Object.keys(actMults).find(k => level.includes(k)) || 'beginner';
    const maintenance = Math.round(bmr * actMults[actKey]);

    // Phase selection (BMI + goal)
    let phase;
    const isMustle = goal.includes('muscle') || goal.includes('gain') || goal.includes('bulk') || goal.includes('mass');
    const isFatLoss = goal.includes('fat') || goal.includes('loss') || goal.includes('cut') || goal.includes('lean');
    const isStrengthGoal = goal.includes('strength');

    if (bmiClass === 'obese') phase = 'aggressive_cut';
    else if (bmiClass === 'overweight' || isFatLoss) phase = 'fat_loss';
    else if (bmiClass === 'normal' && (isMustle || isStrengthGoal)) phase = 'lean_muscle';
    else if (bmiClass === 'underweight' || bmiClass === 'severely_underweight' || isMustle) phase = 'hypertrophy';
    else phase = 'maintenance';

    const phaseConf = PHASES[phase];

    // Training modifier
    let trainMod = { calAdj: 0, protAdj: 0 };
    if (trainingType.includes('strength') || trainingType.includes('hypertrophy')) trainMod = TRAINING_MODIFIERS.strength;
    else if (trainingType.includes('cardio') || trainingType.includes('conditioning')) trainMod = TRAINING_MODIFIERS.cardio;
    else if (trainingType.includes('mobility') || trainingType.includes('light')) trainMod = TRAINING_MODIFIERS.mobility;

    // Final targets
    const calories = Math.max(1200, maintenance + phaseConf.calMod + trainMod.calAdj);
    const protPerKg = Math.max(1.2, phaseConf.protPerKg + trainMod.protAdj);
    const protein = Math.round(weight * protPerKg);
    const carbs = Math.round((calories * phaseConf.carb_pct) / 4);
    const fat = Math.round((calories * phaseConf.fat_pct) / 9);
    const mealCount = phaseConf.mealCount;

    // Supplement list (add vegan B12 if needed)
    const rawDietType = (profile.diet_type || 'vegetarian').toLowerCase();
    let supplements = [...phaseConf.supplements];
    if (rawDietType.includes('vegan')) {
        if (!supplements.includes('Vitamin B12')) supplements.push('Vitamin B12');
        supplements = supplements.map(s => s === 'Omega-3' ? 'Omega-3 (Algae-based)' : s);
    }

    // Safety note
    const safetyNote = bmiClass === 'severely_underweight'
        ? 'Medical supervision recommended for severe underweight (BMI < 16).'
        : null;

    console.log(`📊 BMI=${bmi.toFixed(1)} [${bmiClass}] → Phase: ${phase} | ${calories} kcal | ${protein}g protein | ${mealCount} meals`);

    return {
        calories, protein, carbs, fat,
        mealCount, phase, phaseConf,
        bmi: Math.round(bmi * 10) / 10, bmiClass,
        maintenance, supplements, safetyNote,
        logic: `BMI ${bmi.toFixed(1)} (${bmiClass}) → ${phaseConf.label}. Mifflin-St Jeor BMR: ${Math.round(bmr)} kcal × ${actMults[actKey]} activity = ${maintenance} kcal maintenance. ${phaseConf.strategy}. ${mealCount} meals/day, ${protein}g protein (${protPerKg.toFixed(1)}g/kg).`
    };
}

// ─── Meal slot configs for variable meal count ───────────────────
function getMealSlots(mealCount) {
    // 3 meals: breakfast, lunch, dinner (equal split roughly 30/40/30)
    // 4 meals: + snack
    // 5 meals: + mid_morning
    // 6 meals: + mid_morning + bedtime
    const configs = {
        3: [
            { key: 'breakfast', label: 'Breakfast', calPct: 0.30, groups: ['breakfast', 'cereals & grains', 'eggs', 'dairy'] },
            { key: 'lunch', label: 'Lunch', calPct: 0.40, groups: ['lunch/dinner', 'pulses & legumes', 'meat & poultry', 'fish & seafood'] },
            { key: 'dinner', label: 'Dinner', calPct: 0.30, groups: ['lunch/dinner', 'pulses & legumes', 'vegetables', 'soy products', 'meat & poultry'] }
        ],
        4: [
            { key: 'breakfast', label: 'Breakfast', calPct: 0.25, groups: ['breakfast', 'cereals & grains', 'eggs', 'dairy', 'bread & rotis'] },
            { key: 'lunch', label: 'Lunch', calPct: 0.35, groups: ['lunch/dinner', 'pulses & legumes', 'meat & poultry', 'fish & seafood', 'soy products'] },
            { key: 'snack', label: 'Snack', calPct: 0.15, groups: ['snacks', 'fruits', 'nuts & seeds', 'beverages', 'sprouts'] },
            { key: 'dinner', label: 'Dinner', calPct: 0.25, groups: ['lunch/dinner', 'pulses & legumes', 'vegetables', 'soy products', 'meat & poultry'] }
        ],
        5: [
            { key: 'breakfast', label: 'Breakfast', calPct: 0.22, groups: ['breakfast', 'cereals & grains', 'eggs', 'dairy', 'bread & rotis'] },
            { key: 'mid_morning', label: 'Mid-Morning', calPct: 0.12, groups: ['fruits', 'nuts & seeds', 'dairy', 'snacks', 'beverages'] },
            { key: 'lunch', label: 'Lunch', calPct: 0.30, groups: ['lunch/dinner', 'pulses & legumes', 'meat & poultry', 'fish & seafood', 'soy products'] },
            { key: 'snack', label: 'Evening Snack', calPct: 0.12, groups: ['snacks', 'fruits', 'sprouts', 'nuts & seeds'] },
            { key: 'dinner', label: 'Dinner', calPct: 0.24, groups: ['lunch/dinner', 'pulses & legumes', 'vegetables', 'soy products', 'meat & poultry'] }
        ],
        6: [
            { key: 'breakfast', label: 'Breakfast', calPct: 0.20, groups: ['breakfast', 'cereals & grains', 'eggs', 'dairy', 'bread & rotis'] },
            { key: 'mid_morning', label: 'Mid-Morning', calPct: 0.12, groups: ['fruits', 'nuts & seeds', 'dairy', 'snacks'] },
            { key: 'lunch', label: 'Lunch', calPct: 0.28, groups: ['lunch/dinner', 'pulses & legumes', 'meat & poultry', 'fish & seafood', 'soy products'] },
            { key: 'snack', label: 'Evening Snack', calPct: 0.10, groups: ['snacks', 'fruits', 'sprouts'] },
            { key: 'dinner', label: 'Dinner', calPct: 0.20, groups: ['lunch/dinner', 'pulses & legumes', 'vegetables', 'soy products', 'meat & poultry'] },
            { key: 'bedtime', label: 'Bedtime Shake', calPct: 0.10, groups: ['dairy', 'nuts & seeds', 'soy products', 'beverages'] }
        ]
    };
    return configs[mealCount] || configs[4];
}

// ── Goal-score SQL for candidate ranking ────────────────────────
const GOAL_SCORE_SQL = {
    muscle: `(protein_g::FLOAT / NULLIF(calories::FLOAT, 0)) * 100`,
    cut: `(fibre_g::FLOAT * 2.0 + (1.0 / NULLIF(calories::FLOAT, 1.0)) * 500.0)`,
    endur: `(carbs_g::FLOAT / NULLIF(calories::FLOAT, 0)) * 100`,
    balance: `1`
};

// ══════════════════════════════════════════════════════════════════
// GROQ-DRIVEN DIET GENERATOR WITH PHASE ENGINE
// ══════════════════════════════════════════════════════════════════
export const generateAIDiet = async (userProfile) => {
    try {
        console.log("🥗 Generating phase-driven Indian diet plan...");

        // ─── Step 1: BMI-aware phase + targets ─────────────────────
        const targets = calculateTargets(userProfile);
        const { phase, phaseConf, mealCount, bmi, bmiClass, safetyNote } = targets;

        // Diet type filter
        const rawDietType = (userProfile.diet_type || 'vegetarian').toLowerCase();
        const dietKey = Object.keys(DIET_TYPE_PROFILE).find(k => rawDietType.includes(k.replace('-', '').replace(' ', '')))
            || (rawDietType.includes('non') ? 'non-vegetarian' : rawDietType) || 'vegetarian';
        const dietProfile = DIET_TYPE_PROFILE[dietKey] || DIET_TYPE_PROFILE.vegetarian;
        const dietSqlFilter = dietProfile.dbFilter;

        // Goal mode for SQL scoring
        const goal = (userProfile.goal || '').toLowerCase();
        const goalMode =
            phase === 'hypertrophy' || phase === 'lean_muscle' ? 'muscle' :
                phase === 'fat_loss' || phase === 'aggressive_cut' ? 'cut' :
                    goal.includes('endur') || goal.includes('cardio') ? 'endur' : 'balance';
        const scoreExpr = GOAL_SCORE_SQL[goalMode];

        // ─── Step 2: Fetch goal-ranked candidates per slot ─────────
        const slots = getMealSlots(mealCount);
        const candidateSets = {};

        for (const slotCfg of slots) {
            const slotTarget = Math.round(targets.calories * slotCfg.calPct);
            const minCals = Math.round(slotTarget * 0.30);
            const maxCals = Math.round(slotTarget * 2.2);
            const groupList = slotCfg.groups.map(g => `'${g.toLowerCase()}'`).join(',');

            const q = await pool.query(`
                SELECT name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group
                FROM food_items
                WHERE calories BETWEEN $1 AND $2
                  AND (${dietSqlFilter})
                  AND LOWER(food_group) = ANY(ARRAY[${groupList}])
                  AND source IN ('ICMR_Curated', 'INDB_Kaggle')
                  AND name NOT ILIKE '%tagine%'   AND name NOT ILIKE '%shawarma%'
                  AND name NOT ILIKE '%pasta%'    AND name NOT ILIKE '%pizza%'
                  AND name NOT ILIKE '%burger%'   AND name NOT ILIKE '%wrap%'
                  AND name NOT ILIKE '%harissa%'  AND name NOT ILIKE '%portobello%'
                  AND name NOT ILIKE '%fajita%'   AND name NOT ILIKE '%hummus%'
                  AND name NOT ILIKE '%lasagna%'  AND name NOT ILIKE '%risotto%'
                  AND name NOT ILIKE '%tiramisu%' AND name NOT ILIKE '%quiche%'
                  AND name NOT ILIKE '%crepe%'    AND name NOT ILIKE '%baguette%'
                  AND name NOT ILIKE '%burrito%'  AND name NOT ILIKE '%sushi%'
                  AND name NOT ILIKE '%miso%'     AND name NOT ILIKE '%falafel%'
                  AND name NOT ILIKE '% dry%'     AND name NOT ILIKE '%(dry)%'
                  AND name NOT ILIKE '%(raw)%'    AND name NOT ILIKE '%(100g)%'
                ORDER BY (${scoreExpr}) DESC, ABS(calories - $3) ASC
                LIMIT 5
            `, [minCals, maxCals, slotTarget]);

            let rows = q.rows;
            if (rows.length === 0) {
                // Fallback: any ICMR_Curated food
                const fb = await pool.query(
                    "SELECT name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group FROM food_items WHERE source = 'ICMR_Curated' AND name NOT ILIKE '% dry%' AND name NOT ILIKE '%(100g)%' ORDER BY random() LIMIT 5"
                );
                rows = fb.rows;
            }

            candidateSets[slotCfg.key] = rows.map((r, i) => ({
                id: i + 1, name: r.name,
                cals: parseInt(r.calories),
                pro: parseFloat(r.protein_g) || 0,
                carbs: parseFloat(r.carbs_g) || 0,
                fat: parseFloat(r.fat_g) || 0,
                group: r.food_group
            }));
        }

        // ─── Cross-slot deduplication ────────────────────────────
        const usedAcrossSlots = new Set();
        for (const slotCfg of slots) {
            const key = slotCfg.key;
            candidateSets[key] = candidateSets[key].filter(f => !usedAcrossSlots.has(f.name));
            if (candidateSets[key].length === 0) {
                const fb = await pool.query(
                    "SELECT name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group FROM food_items WHERE source = 'ICMR_Curated' AND name NOT ILIKE '% dry%' ORDER BY random() LIMIT 5"
                );
                candidateSets[key] = fb.rows.map((r, i) => ({ id: i + 1, name: r.name, cals: parseInt(r.calories), pro: parseFloat(r.protein_g) || 0, carbs: parseFloat(r.carbs_g) || 0, fat: parseFloat(r.fat_g) || 0, group: r.food_group }));
            }
            candidateSets[key].forEach((f, i) => { f.id = i + 1; usedAcrossSlots.add(f.name); });
        }

        // ─── Step 3: Build prompt — Groq picks foods AND all macros ─
        const buildBlock = (key) =>
            (candidateSets[key] || []).map(f =>
                `  ${f.id}. "${f.name}" | ${f.cals} kcal, ${f.pro}g protein, ${f.carbs}g carbs, ${f.fat}g fat`
            ).join('\n');

        const mealBlocks = slots.map(s =>
            `${s.label.toUpperCase()} OPTIONS (target ~${Math.round(targets.calories * s.calPct)} kcal):\n${buildBlock(s.key)}`
        ).join('\n\n');

        const mealSchemaKeys = slots.map(s =>
            `"${s.key}": { "name": "EXACT NAME from ${s.label} list", "serving_multiplier": 1.0, "cals": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "portion_note": "e.g. 2 bowls" }`
        ).join(',\n    ');

        const supplementInfo = targets.supplements.map(s => `- ${s}`).join('\n');

        const prompt = `You are an expert Indian sports nutritionist. Design a precise personalised ${mealCount}-meal daily diet plan.

PHASE: ${phaseConf.label} | STRATEGY: ${phaseConf.strategy}
BMI: ${bmi} (${bmiClass}) | GOAL MODE: ${goalMode.toUpperCase()}

USER:
- Goal: ${userProfile.goal} | Diet: ${userProfile.diet_type}
- Weight: ${userProfile.weight}kg | Height: ${userProfile.height}cm | Age: ${userProfile.age} | Gender: ${userProfile.gender}
- Level: ${userProfile.level} | Allergies: ${JSON.stringify(userProfile.allergies || ['None'])}

DAILY TARGETS:
- Calories: ${targets.calories} kcal (maintenance: ${targets.maintenance})
- Protein: ${targets.protein}g | Carbs: ${targets.carbs}g | Fat: ${targets.fat}g
- Meals: ${mealCount}/day

${mealBlocks}

PHASE SUPPLEMENTS TO RECOMMEND:
${supplementInfo}

RULES:
1. Pick a DIFFERENT food for each meal — NO REPEATS
2. Choose ONLY from the numbered lists above — exact names
3. Set serving_multiplier so the meal hits its calorie target
4. Calculate cals/protein_g/carbs_g/fat_g = base × multiplier
5. Supplements must match the phase: ${phaseConf.label}

Return ONLY valid JSON:
{
  "meals": {
    ${mealSchemaKeys}
  },
  "totals": { "cals": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
  "summary": "${phaseConf.label} — ${userProfile.diet_type} for ${userProfile.goal}",
  "strategy": {
    "bullets": ["tip 1", "tip 2", "tip 3"],
    "text": "2 sentences on why this ${mealCount}-meal plan suits ${phase} phase."
  },
  "trainingFuel": {
    "pre": "specific Indian food + quantity",
    "post": "specific Indian food + quantity"
  },
  "focusPoints": [
    { "title": "${phaseConf.label}", "icon": "${phaseConf.emoji}", "desc": "phase-specific advice" },
    { "title": "Hydration", "icon": "💧", "desc": "water/electrolyte advice" },
    { "title": "Timing", "icon": "⏰", "desc": "meal timing advice for ${mealCount} meals" }
  ],
  "supplements": [
    { "name": "supplement name", "dosage": "exact dose + timing", "context": "why for ${phase} phase" }
  ],
  "reassurance": "2 sentences with Indian cultural reference"
}`;

        console.log(`🤖 Groq building ${mealCount}-meal ${phase} plan for BMI ${bmi}...`);
        const completion = await groqDiet.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional Indian nutritionist. Output ONLY valid JSON. Pick foods ONLY from the provided numbered lists — copy names exactly. Calculate macros by multiplying base values × serving_multiplier." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.4,
            max_tokens: 3000,
            response_format: { type: "json_object" }
        });

        const aiPlan = JSON.parse(completion.choices[0]?.message?.content || "{}");
        const aiMeals = aiPlan.meals || {};

        // ─── Step 4: Validate AI numbers against DB, build meals ───
        const meals = {};
        let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        const lastSlotKey = slots[slots.length - 1].key;

        for (const slotCfg of slots) {
            const key = slotCfg.key;
            const aiM = aiMeals[key] || {};
            const candidates = candidateSets[key] || [];

            let dbFood = candidates.find(f => f.name.toLowerCase() === (aiM.name || '').toLowerCase());
            if (!dbFood) {
                console.warn(`⚠️  [${key}] "${aiM.name}" not found → using best candidate`);
                dbFood = candidates[0] || { name: 'Dal Tadka', cals: 300, pro: 12, carbs: 45, fat: 6, group: 'Pulses & Legumes' };
            }

            const mult = Math.min(3.0, Math.max(0.5, parseFloat(aiM.serving_multiplier) || 1.0));

            // DB ground truth
            const dbCals = Math.round(dbFood.cals * mult);
            const dbProt = Math.round(dbFood.pro * mult * 10) / 10;
            const dbCarbs = Math.round(dbFood.carbs * mult * 10) / 10;
            const dbFat = Math.round(dbFood.fat * mult * 10) / 10;

            // AI's claimed macros
            const aiCals = parseInt(aiM.cals) || dbCals;
            const aiProt = parseFloat(aiM.protein_g) || dbProt;
            const aiCarbs = parseFloat(aiM.carbs_g) || dbCarbs;
            const aiFat = parseFloat(aiM.fat_g) || dbFat;

            const withinTol = (ai, db) => db === 0 || Math.abs(ai - db) / Math.max(db, 1) <= 0.25;
            const fCals = withinTol(aiCals, dbCals) ? aiCals : dbCals;
            const fProt = withinTol(aiProt, dbProt) ? aiProt : dbProt;
            const fCarbs = withinTol(aiCarbs, dbCarbs) ? aiCarbs : dbCarbs;
            const fFat = withinTol(aiFat, dbFat) ? aiFat : dbFat;

            const portionNote = aiM.portion_note || (mult !== 1.0 ? `×${mult} serving` : '');
            meals[key] = {
                name: dbFood.name + (portionNote ? ` (${portionNote})` : ''),
                label: slotCfg.label,
                cals: fCals,
                protein: fProt + 'g',
                carbs: fCarbs + 'g',
                fat: fFat + 'g',
                purpose: `${dbFood.group} — ${fCals} kcal | ${fProt}g protein | ${fCarbs}g carbs | ${fFat}g fat`
            };

            totalCals += fCals;
            totalProtein += fProt;
            totalCarbs += fCarbs;
            totalFat += fFat;
        }

        // ─── Step 5: Precision normalization ─────────────────────
        const calRemainder = targets.calories - totalCals;
        if (calRemainder !== 0 && Math.abs(calRemainder) <= 300) {
            meals[lastSlotKey].cals += calRemainder;
            totalCals += calRemainder;
        }

        // ─── Step 6: Supplements — phase-specific ────────────────
        let supplements = [];
        if (Array.isArray(aiPlan.supplements) && aiPlan.supplements.length > 0) {
            supplements = aiPlan.supplements.filter(s => s && s.name);
        } else {
            // Fallback: generate from phase config
            supplements = targets.supplements.map(name => ({
                name,
                dosage: name === 'Creatine' ? '3-5g daily' : name === 'Whey Protein' ? '1 scoop (25g) post-workout' : '1 serving daily',
                context: `Recommended for ${phaseConf.label}`
            }));
        }

        // ─── Step 7: Assemble final diet plan ────────────────────
        const diet = {
            summary: aiPlan.summary || `${phaseConf.label} — ${userProfile.diet_type}`,
            phaseLabel: phaseConf.label,
            phaseEmoji: phaseConf.emoji,
            bmi: bmi,
            bmiClass: bmiClass,
            safetyNote: safetyNote,
            mealCount: mealCount,
            strategy: aiPlan.strategy || {
                bullets: ['Eat every 3-4 hours', 'Prioritise protein', 'Stay hydrated'],
                text: `${phaseConf.strategy}. This ${mealCount}-meal plan is calibrated for BMI ${bmi}.`
            },
            macroTargets: {
                cals: String(targets.calories),
                protein: targets.protein + 'g',
                carbs: targets.carbs + 'g',
                fat: targets.fat + 'g',
                logic: targets.logic
            },
            meals,
            trainingFuel: aiPlan.trainingFuel || {
                pre: 'Banana + 5 almonds + 1 tsp honey (30 min before)',
                post: '1 glass chaas + 30g roasted chana (within 30 min)'
            },
            focusPoints: Array.isArray(aiPlan.focusPoints) ? aiPlan.focusPoints : [],
            supplements,
            reassurance: aiPlan.reassurance || 'Consistency over intensity — every meal matters!',
            disclaimer: 'MEDICAL DISCLAIMER: Consult a qualified healthcare professional before starting any new diet or supplement routine.'
        };

        console.log(`✅ ${phaseConf.label}: ${totalCals} kcal (target ${targets.calories}) | ${totalProtein.toFixed(1)}g protein | ${mealCount} meals | BMI ${bmi} [${bmiClass}]`);
        return diet;

    } catch (error) {
        console.error("Diet generation error:", error.message);
        throw new Error("Failed to generate diet plan.");
    }
};
console.log("AI Service Loaded. Workout Key:", !!process.env.GEMINI_API_KEY, "| Diet Key:", !!process.env.GEMINI_DIET_API_KEY);
