
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


// ===== CALCULATE PROPER CALORIE TARGET FROM USER PROFILE =====
function calculateTargets(profile) {
    const weight = parseFloat(profile.weight) || 70;
    const height = parseFloat(profile.height) || 170;
    const age = parseInt(profile.age) || 25;
    const gender = (profile.gender || 'Male').toLowerCase();
    const goal = (profile.goal || 'General Fitness').toLowerCase();
    const level = (profile.level || 'Beginner').toLowerCase();

    // Mifflin-St Jeor BMR formula
    let bmr;
    if (gender === 'female' || gender === 'f') {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    }

    // Activity multiplier based on training level
    let activityMultiplier = 1.55;
    if (level.includes('beginner')) activityMultiplier = 1.4;
    else if (level.includes('intermediate')) activityMultiplier = 1.6;
    else if (level.includes('advanced') || level.includes('athlete')) activityMultiplier = 1.75;

    let tdee = Math.round(bmr * activityMultiplier);

    // Goal-based calorie adjustment
    if (goal.includes('muscle') || goal.includes('bulk') || goal.includes('gain') || goal.includes('mass')) {
        tdee = Math.round(tdee + 350); // surplus for muscle building
    } else if (goal.includes('weight loss') || goal.includes('cut') || goal.includes('lean') || goal.includes('fat loss')) {
        tdee = Math.round(tdee - 400); // deficit for fat loss
    } else if (goal.includes('strength')) {
        tdee = Math.round(tdee + 200); // slight surplus
    }

    // Protein calculation: 1.6-2.2g per kg based on goal
    let proteinPerKg = 1.6;
    if (goal.includes('muscle') || goal.includes('gain') || goal.includes('bulk')) proteinPerKg = 2.0;
    else if (goal.includes('strength')) proteinPerKg = 1.8;
    else if (goal.includes('weight loss') || goal.includes('cut')) proteinPerKg = 2.2;
    const protein = Math.round(weight * proteinPerKg);

    console.log(`ðŸ“Š Profile Calc: BMR=${Math.round(bmr)}, TDEE=${tdee}, Target=${tdee} kcal, Protein=${protein}g`);
    return { calories: tdee, protein };
}

// ===== POST-PROCESS: Force meal totals to match targets =====
function normalizeMeals(diet, targetCals, targetProtein) {
    const meals = diet.meals;
    if (!meals) return diet;

    const keys = ['breakfast', 'lunch', 'snack', 'dinner'];
    const parseNum = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseInt(val.replace(/[^0-9]/g, '')) || 0;
        return 0;
    };

    // Sum current meal values
    let totalCals = 0, totalProtein = 0;
    keys.forEach(k => {
        if (meals[k]) {
            totalCals += parseNum(meals[k].cals);
            totalProtein += parseNum(meals[k].protein);
        }
    });

    // Scale calories if off by more than 2%
    if (totalCals > 0 && Math.abs(totalCals - targetCals) / targetCals > 0.02) {
        const scale = targetCals / totalCals;
        keys.forEach(k => {
            if (meals[k]) meals[k].cals = Math.round(parseNum(meals[k].cals) * scale);
        });
        // Fix rounding remainder on dinner
        const newTotal = keys.reduce((s, k) => s + (meals[k]?.cals || 0), 0);
        if (meals.dinner) meals.dinner.cals += (targetCals - newTotal);
        console.log(`ðŸ“Š Scaled cals: ${totalCals} â†’ ${targetCals}`);
    }

    // Scale protein if off by more than 2%
    if (totalProtein > 0 && Math.abs(totalProtein - targetProtein) / targetProtein > 0.02) {
        const scale = targetProtein / totalProtein;
        keys.forEach(k => {
            if (meals[k]) {
                meals[k].protein = Math.round(parseNum(meals[k].protein) * scale) + 'g';
            }
        });
        const newTotal = keys.reduce((s, k) => s + parseNum(meals[k]?.protein), 0);
        if (meals.dinner) {
            const dp = parseNum(meals.dinner.protein);
            meals.dinner.protein = (dp + (targetProtein - newTotal)) + 'g';
        }
        console.log(`ðŸ“Š Scaled protein: ${totalProtein}g â†’ ${targetProtein}g`);
    }

    // Force macroTargets to match
    diet.macroTargets = {
        ...diet.macroTargets,
        cals: String(targetCals),
        protein: targetProtein + 'g'
    };

    return diet;
}

// ═══════════════════════════════════════════════════════════════════
// GROQ-DRIVEN INDIAN DIET GENERATOR  
// Groq picks foods, sets serving size, sets ALL macros (cals/protein/carbs/fat)
// DB provides the verified Indian food options — Groq is fully in charge of diet
// DB macros are used as the source of truth (Groq's numbers validated against DB)
// ═══════════════════════════════════════════════════════════════════
export const generateAIDiet = async (userProfile) => {
    try {
        console.log("🥗 Generating Groq-driven Indian diet plan...");

        // ─── Step 1: Calculate exact BMR-based targets ───────────────
        const targets = calculateTargets(userProfile);
        const goal = (userProfile.goal || 'General Fitness').toLowerCase();
        const isNonVeg = (userProfile.diet_type || '').toLowerCase().includes('non');
        const dietType = isNonVeg ? 'non-vegetarian' : 'vegetarian';

        const goalMode =
            goal.includes('muscle') || goal.includes('gain') || goal.includes('bulk') ? 'muscle' :
                goal.includes('fat') || goal.includes('loss') || goal.includes('cut') ? 'cut' :
                    goal.includes('endur') || goal.includes('run') || goal.includes('cardio') ? 'endur' : 'balance';

        // ─── Step 2: Fetch goal-ranked candidates per slot ───────────
        const goalScoreSQL = {
            muscle: `(protein_g::FLOAT / NULLIF(calories::FLOAT, 0)) * 100`,
            cut: `(fibre_g::FLOAT * 2.0 + (1.0 / NULLIF(calories::FLOAT, 1.0)) * 500.0)`,
            endur: `(carbs_g::FLOAT / NULLIF(calories::FLOAT, 0)) * 100`,
            balance: `1`
        };
        const scoreExpr = goalScoreSQL[goalMode];

        const slots = {
            breakfast: { calPct: 0.25, groups: ['breakfast', 'cereals & grains', 'eggs', 'dairy', 'bread & rotis'] },
            lunch: { calPct: 0.35, groups: ['lunch/dinner', 'pulses & legumes', 'meat & poultry', 'fish & seafood', 'soy products'] },
            snack: { calPct: 0.15, groups: ['snacks', 'fruits', 'nuts & seeds', 'beverages', 'sprouts'] },
            dinner: { calPct: 0.25, groups: ['lunch/dinner', 'pulses & legumes', 'soy products', 'meat & poultry', 'fish & seafood', 'vegetables'] }
        };

        const candidateSets = {};
        for (const [slot, cfg] of Object.entries(slots)) {
            const slotTarget = Math.round(targets.calories * cfg.calPct);
            const minCals = Math.round(slotTarget * 0.3);
            const maxCals = Math.round(slotTarget * 2.0);
            const groupList = cfg.groups.map(g => `'${g.toLowerCase()}'`).join(',');

            const q = await pool.query(`
                SELECT name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group
                FROM food_items
                WHERE calories BETWEEN $1 AND $2
                  AND (diet_type = $3 OR diet_type = 'vegetarian')
                  AND LOWER(food_group) = ANY(ARRAY[${groupList}])
                  AND source IN ('ICMR_Curated', 'INDB_Kaggle')
                  AND name NOT ILIKE '%tagine%' AND name NOT ILIKE '%shawarma%'
                  AND name NOT ILIKE '%pasta%'  AND name NOT ILIKE '%pizza%'
                  AND name NOT ILIKE '%burger%' AND name NOT ILIKE '%wrap%'
                  AND name NOT ILIKE '%harissa%' AND name NOT ILIKE '%portobello%'
                  AND name NOT ILIKE '%fajita%'  AND name NOT ILIKE '%hummus%'
                  AND name NOT ILIKE '%lasagna%' AND name NOT ILIKE '%risotto%'
                  AND name NOT ILIKE '%tiramisu%' AND name NOT ILIKE '%quiche%'
                  AND name NOT ILIKE '%crepe%'   AND name NOT ILIKE '%baguette%'
                  AND name NOT ILIKE '%burrito%' AND name NOT ILIKE '%sushi%'
                  AND name NOT ILIKE '%miso%'    AND name NOT ILIKE '%falafel%'
                  AND name NOT ILIKE '% dry%'    AND name NOT ILIKE '%(dry)%'
                  AND name NOT ILIKE '%(raw)%'   AND name NOT ILIKE '%(100g)%'
                ORDER BY (${scoreExpr}) DESC,
                         ABS(calories - $4) ASC
                LIMIT 5
            `, [minCals, maxCals, dietType, slotTarget]);

            let rows = q.rows;
            if (rows.length === 0) {
                const fb = await pool.query(`
                    SELECT name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group
                    FROM food_items WHERE source = 'ICMR_Curated'
                      AND name NOT ILIKE '% dry%' AND name NOT ILIKE '%(100g)%'
                      AND (diet_type = $1 OR diet_type = 'vegetarian')
                    ORDER BY random() LIMIT 5
                `, [dietType]);
                rows = fb.rows;
            }

            candidateSets[slot] = rows.map((r, i) => ({
                id: i + 1,
                name: r.name,
                cals: parseInt(r.calories),
                pro: parseFloat(r.protein_g) || 0,
                carbs: parseFloat(r.carbs_g) || 0,
                fat: parseFloat(r.fat_g) || 0,
                fibre: parseFloat(r.fibre_g) || 0,
                group: r.food_group
            }));
        }

        // ─── Cross-slot deduplication: ensure NO food appears in 2+ slots ───
        // This makes it physically impossible for AI to pick the same food twice
        const usedAcrossSlots = new Set();
        for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) {
            // Remove any candidate already claimed by a prior slot
            candidateSets[slot] = candidateSets[slot].filter(f => !usedAcrossSlots.has(f.name));
            // If we wiped out all candidates, fall back to any unused food from DB
            if (candidateSets[slot].length === 0) {
                const fbSql = "SELECT name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group FROM food_items WHERE source = 'ICMR_Curated' AND name NOT ILIKE '% dry%' AND name NOT ILIKE '%(100g)%' AND (diet_type = " + '' + " OR diet_type = 'vegetarian') ORDER BY random() LIMIT 5";
                const fb = await pool.query(fbSql, [dietType]);
                candidateSets[slot] = fb.rows.map((r, i) => ({ id: i+1, name: r.name, cals: parseInt(r.calories), pro: parseFloat(r.protein_g)||0, carbs: parseFloat(r.carbs_g)||0, fat: parseFloat(r.fat_g)||0, fibre: parseFloat(r.fibre_g)||0, group: r.food_group }));
            }
            // Re-number IDs so AI sees 1,2,3... per slot
            candidateSets[slot].forEach((f, i) => { f.id = i + 1; usedAcrossSlots.add(f.name); });
        }

        // ─── Step 3: Groq picks foods AND sets all macros ────────────
        // Give Groq full nutritional data per candidate — it picks AND specifies portion + macros
        const buildCandidateBlock = (slot) =>
            candidateSets[slot].map(f =>
                `  ${f.id}. "${f.name}" | Per std serving: ${f.cals} kcal, ${f.pro}g protein, ${f.carbs}g carbs, ${f.fat}g fat`
            ).join('\n');

        const slotTargets = {
            breakfast: Math.round(targets.calories * 0.25),
            lunch: Math.round(targets.calories * 0.35),
            snack: Math.round(targets.calories * 0.15),
            dinner: Math.round(targets.calories * 0.25)
        };

        const prompt = `You are an expert Indian sports nutritionist designing a precise, personalised daily diet plan.

USER PROFILE:
- Goal: ${userProfile.goal} | Diet: ${userProfile.diet_type}
- Weight: ${userProfile.weight}kg | Height: ${userProfile.height}cm | Age: ${userProfile.age} | Gender: ${userProfile.gender}
- Fitness Level: ${userProfile.level}
- Allergies: ${JSON.stringify(userProfile.allergies || ['None'])}

DAILY TARGETS (Mifflin-St Jeor BMR, ${goalMode} mode):
- Total Calories: ${targets.calories} kcal
- Total Protein: ${targets.protein}g
- Carbs (~45% of cals): ${Math.round(targets.calories * 0.45 / 4)}g
- Fat (~25% of cals): ${Math.round(targets.calories * 0.25 / 9)}g

MEAL TARGETS (you must hit these totals across all 4 meals):
- Breakfast: ~${slotTargets.breakfast} kcal
- Lunch: ~${slotTargets.lunch} kcal
- Snack: ~${slotTargets.snack} kcal
- Dinner: ~${slotTargets.dinner} kcal

────────────────────────────────────────────
BREAKFAST OPTIONS (pick exactly 1):
${buildCandidateBlock('breakfast')}

LUNCH OPTIONS (pick exactly 1):
${buildCandidateBlock('lunch')}

SNACK OPTIONS (pick exactly 1):
${buildCandidateBlock('snack')}

DINNER OPTIONS (pick exactly 1):
${buildCandidateBlock('dinner')}
────────────────────────────────────────────

YOUR TASK:
1. Pick the BEST food for each meal slot from the options above
2. Decide the exact serving_multiplier (e.g. 1.0 = 1 standard serving, 1.5 = 1.5x, etc.)
3. Calculate the EXACT macros for your chosen portion: cals = base_cals × multiplier, protein = base_protein × multiplier, etc.
4. Make the 4 meals ADD UP to the daily targets

Return ONLY valid JSON:
{
  "meals": {
    "breakfast": {
      "name": "EXACT food name from the breakfast list",
      "serving_multiplier": 1.0,
      "cals": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0,
      "portion_note": "e.g. 1.5 servings = 2 rotis + extra paneer bhurji"
    },
    "lunch": { "name": "...", "serving_multiplier": 1.0, "cals": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "portion_note": "..." },
    "snack": { "name": "...", "serving_multiplier": 1.0, "cals": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "portion_note": "..." },
    "dinner": { "name": "...", "serving_multiplier": 1.0, "cals": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "portion_note": "..." }
  },
  "totals": { "cals": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
  "summary": "Indian ${userProfile.diet_type} Plan for ${userProfile.goal}",
  "strategy": {
    "bullets": ["specific timing tip", "specific portion tip", "specific hydration/recovery tip"],
    "text": "2 sentences on why this plan suits ${userProfile.goal}."
  },
  "trainingFuel": {
    "pre": "Specific Indian snack name + quantity (e.g. 1 banana + 5 almonds + 1 tsp honey)",
    "post": "Specific Indian recovery food + quantity (e.g. 1 glass chaas + 30g roasted chana)"
  },
  "focusPoints": [
    { "title": "...", "icon": "🔥", "desc": "specific actionable advice for ${userProfile.goal}" },
    { "title": "...", "icon": "💪", "desc": "specific actionable advice" },
    { "title": "...", "icon": "🥗", "desc": "specific actionable advice" }
  ],
  "supplements": [
    { "name": "...", "dosage": "exact dose + exact timing", "context": "why for ${userProfile.goal}" },
    { "name": "...", "dosage": "exact dose + exact timing", "context": "why for ${userProfile.goal}" },
    { "name": "...", "dosage": "exact dose + exact timing", "context": "why for ${userProfile.goal}" }
  ],
  "reassurance": "2 motivational sentences with an Indian cultural touch."
}`;

        console.log("🤖 Groq is picking meals + setting all macros...");
        const completion = await groqDiet.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional Indian nutritionist. Output ONLY valid JSON. Pick foods ONLY from the provided numbered lists — copy names exactly. Calculate macros by multiplying base values by serving_multiplier." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.4,
            max_tokens: 2500,
            response_format: { type: "json_object" }
        });

        const aiPlan = JSON.parse(completion.choices[0]?.message?.content || "{}");
        const aiMeals = aiPlan.meals || {};

        // ─── Step 4: Validate AI's numbers against DB, build final meals ─
        // If AI's macros are within 20% of DB × multiplier → use AI's numbers
        // Otherwise → use DB × multiplier (real accurate values)
        const meals = {};
        let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

        for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) {
            const aiM = aiMeals[slot] || {};
            const candidates = candidateSets[slot];

            // Find the food AI picked (exact name match)
            let dbFood = candidates.find(f =>
                f.name.toLowerCase() === (aiM.name || '').toLowerCase()
            );
            if (!dbFood) {
                console.warn(`⚠️  [${slot}] AI picked "${aiM.name}" — not found, using top candidate`);
                dbFood = candidates[0];
            }

            const mult = Math.min(3.0, Math.max(0.5, parseFloat(aiM.serving_multiplier) || 1.0));

            // DB-verified macros (ground truth)
            const dbCals = Math.round(dbFood.cals * mult);
            const dbProtein = Math.round(dbFood.pro * mult * 10) / 10;
            const dbCarbs = Math.round(dbFood.carbs * mult * 10) / 10;
            const dbFat = Math.round(dbFood.fat * mult * 10) / 10;

            // AI's claimed macros
            const aiCals = parseInt(aiM.cals) || dbCals;
            const aiProtein = parseFloat(aiM.protein_g) || dbProtein;
            const aiCarbs = parseFloat(aiM.carbs_g) || dbCarbs;
            const aiFat = parseFloat(aiM.fat_g) || dbFat;

            // Use AI's numbers if within 25% of DB (AI may have reasoning for adjustment)
            // Otherwise fall back to DB-computed values
            const withinTolerance = (ai, db) => db === 0 || Math.abs(ai - db) / db <= 0.25;
            const finalCals = withinTolerance(aiCals, dbCals) ? aiCals : dbCals;
            const finalProtein = withinTolerance(aiProtein, dbProtein) ? aiProtein : dbProtein;
            const finalCarbs = withinTolerance(aiCarbs, dbCarbs) ? aiCarbs : dbCarbs;
            const finalFat = withinTolerance(aiFat, dbFat) ? aiFat : dbFat;

            const portionNote = aiM.portion_note || (mult !== 1.0 ? `×${mult} serving` : '');
            meals[slot] = {
                name: dbFood.name + (portionNote ? ` (${portionNote})` : ''),
                cals: finalCals,
                protein: finalProtein + 'g',
                carbs: finalCarbs + 'g',
                fat: finalFat + 'g',
                purpose: `${dbFood.group} — ${finalCals} kcal | ${finalProtein}g protein | ${finalCarbs}g carbs | ${finalFat}g fat`
            };

            totalCals += finalCals;
            totalProtein += finalProtein;
            totalCarbs += finalCarbs;
            totalFat += finalFat;
        }

        // ─── Step 5: Fine-tune totals to hit EXACT calorie target ────
        const remainder = targets.calories - totalCals;
        if (remainder !== 0 && Math.abs(remainder) <= 200) {
            meals.dinner.cals += remainder;
            totalCals += remainder;
            const dinnerMatch = meals.dinner.purpose.match(/(\d+) kcal/);
            if (dinnerMatch) meals.dinner.purpose = meals.dinner.purpose.replace(dinnerMatch[0], `${meals.dinner.cals} kcal`);
        }

        // ─── Step 6: Assemble final plan ─────────────────────────────
        const diet = {
            summary: aiPlan.summary || `Indian ${userProfile.diet_type} Plan for ${userProfile.goal}`,
            strategy: aiPlan.strategy || {
                bullets: ['Eat every 3-4 hours', 'Prioritise protein at every meal', 'Drink 3L water daily'],
                text: `This plan is tailored for ${userProfile.goal} using real Indian foods with verified nutrition data.`
            },
            macroTargets: {
                cals: String(targets.calories),
                protein: targets.protein + 'g',
                carbs: Math.round(targets.calories * 0.45 / 4) + 'g',
                fat: Math.round(targets.calories * 0.25 / 9) + 'g',
                logic: `Mifflin-St Jeor BMR adjusted for ${userProfile.goal}. ${targets.calories} kcal/day — ${targets.protein}g protein | ${Math.round(targets.calories * 0.45 / 4)}g carbs | ${Math.round(targets.calories * 0.25 / 9)}g fat.`
            },
            meals,
            trainingFuel: aiPlan.trainingFuel || {
                pre: 'Banana + 5 soaked almonds + 1 tsp honey (30 min before workout)',
                post: 'Chaas (buttermilk) + 30g roasted chana (within 30 min after workout)'
            },
            focusPoints: Array.isArray(aiPlan.focusPoints) ? aiPlan.focusPoints : [],
            supplements: Array.isArray(aiPlan.supplements) ? aiPlan.supplements.filter(s => s.name) : [],
            reassurance: aiPlan.reassurance || 'Stay consistent — every meal gets you closer to your goal!',
            disclaimer: 'MEDICAL DISCLAIMER: Consult a qualified healthcare professional before starting any new diet or supplement routine.'
        };

        console.log(`✅ Groq-driven diet: ${totalCals} kcal → target ${targets.calories} | ${totalProtein.toFixed(1)}g protein | Meals: ${Object.values(meals).map(m => m.name.split(' (')[0]).join(', ')}`);
        return diet;

    } catch (error) {
        console.error("Diet generation error:", error.message);
        throw new Error("Failed to generate diet plan.");
    }
};
console.log("AI Service Loaded. Workout Key:", !!process.env.GEMINI_API_KEY, "| Diet Key:", !!process.env.GEMINI_DIET_API_KEY);
