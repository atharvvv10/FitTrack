
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
// PERFECT 2-STAGE DATASET-DRIVEN INDIAN DIET GENERATOR
// Stage 1: Server pre-selects 5 goal-aware candidates per meal slot
//           from full 1580-food DB
// Stage 2: Groq AI picks the single best option from those 5 per slot
//           (short list = AI actually respects it)
// Stage 3: Server verifies AI's pick against DB, applies REAL macros
//           (AI never sets a single calorie number)
// ═══════════════════════════════════════════════════════════════════
export const generateAIDiet = async (userProfile) => {
    try {
        console.log("🥗 Generating perfect dataset-driven Indian diet...");

        // ─── Step 1: Calculate exact targets ─────────────────────────
        const targets = calculateTargets(userProfile);
        const goal = (userProfile.goal || 'General Fitness').toLowerCase();
        const isNonVeg = (userProfile.diet_type || '').toLowerCase().includes('non');
        const dietType = isNonVeg ? 'non-vegetarian' : 'vegetarian';

        // Goal-based protein ratio preference for candidate ranking
        //   Muscle Gain → maximise protein/cal ratio
        //   Fat Loss    → maximise fibre, minimise cals
        //   Endurance   → maximise carbs
        //   Default     → balanced
        const goalMode =
            goal.includes('muscle') || goal.includes('gain') || goal.includes('bulk') ? 'muscle' :
                goal.includes('fat') || goal.includes('loss') || goal.includes('cut') ? 'cut' :
                    goal.includes('endur') || goal.includes('run') || goal.includes('cardio') ? 'endur' :
                        'balance';

        // ─── Step 2: Define per-slot configs ─────────────────────────
        // Each slot has: calorie %, allowed food groups, calorie window for candidates
        const slots = {
            breakfast: {
                calPct: 0.25,
                groups: ['breakfast', 'cereals & grains', 'eggs', 'dairy', 'bread & rotis'],
                label: 'Breakfast'
            },
            lunch: {
                calPct: 0.35,
                groups: ['lunch/dinner', 'pulses & legumes', 'meat & poultry', 'fish & seafood', 'soy products', 'cereals & grains'],
                label: 'Lunch'
            },
            snack: {
                calPct: 0.15,
                groups: ['snacks', 'fruits', 'nuts & seeds', 'beverages', 'sprouts'],
                label: 'Snack'
            },
            dinner: {
                calPct: 0.25,
                groups: ['lunch/dinner', 'pulses & legumes', 'soy products', 'meat & poultry', 'fish & seafood', 'vegetables'],
                label: 'Dinner'
            }
        };

        // ─── Step 3: For each slot, fetch goal-ranked candidates ─────
        // SQL scores foods by how well they match the user's goal:
        //   Muscle: protein/calorie ratio (high protein per kcal)
        //   Cut:    fibre + low calorie density
        //   Endur:  carb/calorie ratio
        //   Balance: even all macros
        const goalScoreSQL = {
            muscle: `(protein_g::FLOAT / NULLIF(calories::FLOAT, 0)) * 100`,
            cut: `(fibre_g::FLOAT * 2.0 + (1.0 / NULLIF(calories::FLOAT, 1.0)) * 500.0)`,
            endur: `(carbs_g::FLOAT / NULLIF(calories::FLOAT, 0)) * 100`,
            balance: `1` // equal weight → pure calorie proximity sort
        };
        const scoreExpr = goalScoreSQL[goalMode];

        const candidateSets = {};

        for (const [slot, cfg] of Object.entries(slots)) {
            const slotTarget = Math.round(targets.calories * cfg.calPct);
            // Accept foods within ±60% of slot target (multiplier will fine-tune)
            const minCals = Math.round(slotTarget * 0.35);
            const maxCals = Math.round(slotTarget * 1.8);

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
                  AND name NOT ILIKE '%(dry)%' AND name NOT ILIKE '% dry%'
                  AND name NOT ILIKE '%(raw)%' AND name NOT ILIKE '% raw%'
                  AND name NOT ILIKE '%(100g)%'
                ORDER BY (${scoreExpr}) DESC,
                         ABS(calories - $4) ASC
                LIMIT 5
            `, [minCals, maxCals, dietType, slotTarget]);

            // Fallback: ICMR_Curated only if INDB gave nothing
            if (q.rows.length === 0) {
                const fb = await pool.query(`
                    SELECT name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group
                    FROM food_items
                    WHERE source = 'ICMR_Curated'
                      AND (diet_type = $1 OR diet_type = 'vegetarian')
                    ORDER BY random() LIMIT 5
                `, [dietType]);
                q.rows = fb.rows;
            }

            candidateSets[slot] = q.rows.map(r => ({
                name: r.name,
                cals: parseInt(r.calories),
                pro: parseFloat(r.protein_g) || 0,
                carbs: parseFloat(r.carbs_g) || 0,
                fat: parseFloat(r.fat_g) || 0,
                fibre: parseFloat(r.fibre_g) || 0,
                group: r.food_group
            }));

            console.log(`  ${cfg.label}: ${candidateSets[slot].length} candidates (target ${slotTarget} kcal, mode=${goalMode})`);
        }

        // ─── Step 4: Send SHORT candidate lists to Groq ──────────────
        // Each slot has ≤5 options — AI CAN actually pick from this!
        const candidateSummary = {};
        for (const [slot, items] of Object.entries(candidateSets)) {
            candidateSummary[slot] = items.map((f, i) =>
                `${i + 1}. "${f.name}" — ${f.cals} kcal, ${f.pro}g protein, ${f.carbs}g carbs, ${f.fat}g fat`
            ).join('\n');
        }

        const selectionPrompt = `You are an expert Indian sports nutritionist. Pick the BEST meal for each slot from the numbered options below.

USER PROFILE:
- Goal: ${userProfile.goal} | Diet: ${userProfile.diet_type}
- Weight: ${userProfile.weight}kg | Age: ${userProfile.age} | Gender: ${userProfile.gender}
- Fitness Level: ${userProfile.level}
- Allergies: ${JSON.stringify(userProfile.allergies || ['None'])}

DAILY TARGETS (Mifflin-St Jeor BMR, goal-adjusted):
- Calories: ${targets.calories} kcal
- Protein: ${targets.protein}g

BREAKFAST OPTIONS (pick 1):
${candidateSummary.breakfast}

LUNCH OPTIONS (pick 1):
${candidateSummary.lunch}

SNACK OPTIONS (pick 1):
${candidateSummary.snack}

DINNER OPTIONS (pick 1):
${candidateSummary.dinner}

Pick the best option for the user's ${userProfile.goal} goal. For each slot also suggest a serving_multiplier (0.5–2.5) to help hit the calorie targets.

Return ONLY this JSON — use the EXACT food name from the numbered options:
{
    "selections": {
        "breakfast": { "name": "EXACT name from breakfast list", "serving_multiplier": 1.0 },
        "lunch":     { "name": "EXACT name from lunch list",      "serving_multiplier": 1.0 },
        "snack":     { "name": "EXACT name from snack list",      "serving_multiplier": 1.0 },
        "dinner":    { "name": "EXACT name from dinner list",     "serving_multiplier": 1.0 }
    },
    "summary": "Indian ${userProfile.diet_type} Plan for ${userProfile.goal}",
    "strategy": {
        "bullets": ["Specific timing tip", "Specific portion tip", "Specific hydration/recovery tip"],
        "text": "2 sentences explaining why these meals are perfect for the user's ${userProfile.goal} goal."
    },
    "trainingFuel": {
        "pre":  "Specific Indian pre-workout food (name it, e.g. 'Banana + 5 soaked almonds + 1 tsp honey')",
        "post": "Specific Indian post-workout recovery (name it, e.g. 'Chaas + 30g roasted chana + 2 boiled eggs')"
    },
    "focusPoints": [
        { "title": "string", "icon": "emoji", "desc": "specific actionable advice" },
        { "title": "string", "icon": "emoji", "desc": "specific actionable advice" },
        { "title": "string", "icon": "emoji", "desc": "specific actionable advice" }
    ],
    "supplements": [
        { "name": "supplement name", "dosage": "exact dose + timing", "context": "why for this goal" },
        { "name": "supplement name", "dosage": "exact dose + timing", "context": "why for this goal" },
        { "name": "supplement name", "dosage": "exact dose + timing", "context": "why for this goal" }
    ],
    "reassurance": "2 motivational sentences with Indian cultural flavour (mention a famous Indian food/practice)"
}`;

        console.log("🤖 Sending candidate selections to Groq...");
        const completion = await groqDiet.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional Indian nutritionist. Output ONLY valid JSON. Pick foods ONLY from the provided numbered lists — copy the name exactly." },
                { role: "user", content: selectionPrompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
            max_tokens: 2000,
            response_format: { type: "json_object" }
        });

        const aiResponse = JSON.parse(completion.choices[0]?.message?.content || "{}");
        const aiSelections = aiResponse.selections || {};

        // ─── Step 5: Verify AI picks & look up REAL macros from DB ───
        const meals = {};
        const slotTargets = {
            breakfast: Math.round(targets.calories * 0.25),
            lunch: Math.round(targets.calories * 0.35),
            snack: Math.round(targets.calories * 0.15),
            dinner: Math.round(targets.calories * 0.25)
        };

        for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) {
            const aiPick = aiSelections[slot] || {};
            const rawMult = parseFloat(aiPick.serving_multiplier) || 1.0;
            const mult = Math.min(2.5, Math.max(0.5, rawMult));

            // Find AI's pick in the candidate set (exact or close match)
            const candidates = candidateSets[slot];
            let food = candidates.find(f =>
                f.name.toLowerCase() === (aiPick.name || '').toLowerCase()
            );

            // If AI hallucinated a name, fall back to the best candidate
            if (!food) {
                console.warn(`⚠️  [${slot}] AI picked "${aiPick.name}" (not in list) → using best candidate`);
                food = candidates[0] || { name: 'Dal Tadka with Rice', cals: 300, pro: 12, carbs: 50, fat: 5, group: 'Lunch/Dinner' };
            }

            // Calculate final serving multiplier to hit EXACT slot target
            const optimalMult = Math.round((slotTargets[slot] / food.cals) * 4) / 4;
            // Use AI's mult if it's reasonable; otherwise use optimal
            const finalMult = (Math.abs(mult - optimalMult) < 0.75) ? mult : optimalMult;
            const clampedMult = Math.min(2.5, Math.max(0.5, finalMult));

            const finalCals = Math.round(food.cals * clampedMult);
            const finalProtein = Math.round(food.pro * clampedMult * 10) / 10;
            const finalCarbs = Math.round(food.carbs * clampedMult * 10) / 10;
            const finalFat = Math.round(food.fat * clampedMult * 10) / 10;

            const portionNote = clampedMult !== 1.0 ? ` (×${clampedMult} serving)` : '';
            meals[slot] = {
                name: food.name + portionNote,
                cals: finalCals,
                protein: finalProtein + 'g',
                carbs: finalCarbs + 'g',
                fat: finalFat + 'g',
                purpose: `${food.group} — ${finalCals} kcal | ${finalProtein}g protein | ${finalCarbs}g carbs | ${finalFat}g fat`,
                _food: food,
                _mult: clampedMult
            };
        }

        // ─── Step 6: Precision normalization ─────────────────────────
        // Make total cals equal targets.calories EXACTLY
        let totalCals = Object.values(meals).reduce((s, m) => s + m.cals, 0);
        let remainder = targets.calories - totalCals;

        // Distribute remainder across meals proportionally (largest adjustment to dinner)
        if (remainder !== 0) {
            meals.dinner.cals += remainder;
            // Recompute dinner protein/carbs/fat based on new cals
            const dMult = meals.dinner._mult * (meals.dinner.cals / (meals.dinner._food.cals * meals.dinner._mult));
            meals.dinner.protein = (Math.round(meals.dinner._food.pro * dMult * 10) / 10) + 'g';
            meals.dinner.carbs = (Math.round(meals.dinner._food.carbs * dMult * 10) / 10) + 'g';
            meals.dinner.fat = (Math.round(meals.dinner._food.fat * dMult * 10) / 10) + 'g';
            meals.dinner.purpose = `${meals.dinner._food.group} — ${meals.dinner.cals} kcal | ${meals.dinner.protein} protein`;
        }

        // ─── Step 7: Assemble final perfect diet plan ─────────────────
        const totalProtein = Object.values(meals).reduce((s, m) => s + parseFloat(m.protein), 0);
        const finalTotal = Object.values(meals).reduce((s, m) => s + (m.cals || 0), 0);

        const cleanMeals = {};
        for (const [slot, m] of Object.entries(meals)) {
            cleanMeals[slot] = {
                name: m.name,
                cals: m.cals,
                protein: m.protein,
                carbs: m.carbs,
                fat: m.fat,
                purpose: m.purpose
            };
        }

        const diet = {
            summary: aiResponse.summary || `Indian ${userProfile.diet_type} Plan for ${userProfile.goal}`,
            strategy: aiResponse.strategy || {
                bullets: ['Eat meals at fixed times', 'Hydrate with 3L water', 'Prioritise protein at every meal'],
                text: `This plan is optimised for ${userProfile.goal} using real Indian foods from ICMR-NIN nutritional data.`
            },
            macroTargets: {
                cals: String(targets.calories),
                protein: targets.protein + 'g',
                carbs: Math.round(targets.calories * 0.45 / 4) + 'g',
                fat: Math.round(targets.calories * 0.25 / 9) + 'g',
                logic: `Mifflin-St Jeor BMR × TDEE activity multiplier, adjusted for ${userProfile.goal}. Protein set at ${targets.protein}g (2.0g/kg lean mass) for ${goalMode} goal. Macros: 30% protein / 45% carbs / 25% fat.`
            },
            meals: cleanMeals,
            trainingFuel: aiResponse.trainingFuel || {
                pre: 'Banana + 5 soaked almonds + 1 tsp honey (30 min before)',
                post: 'Chaas (buttermilk) + 30g roasted chana within 30 min of training'
            },
            focusPoints: Array.isArray(aiResponse.focusPoints) ? aiResponse.focusPoints : [],
            supplements: Array.isArray(aiResponse.supplements)
                ? aiResponse.supplements.filter(s => typeof s === 'object' && s.name)
                : [],
            reassurance: aiResponse.reassurance || 'Stay consistent — every roti counts! Your goal is achievable.',
            disclaimer: 'MEDICAL DISCLAIMER: Consult a qualified healthcare professional before starting any new diet or supplement routine.'
        };

        console.log(`✅ Perfect diet: ${finalTotal} kcal (target ${targets.calories}) | ${totalProtein.toFixed(1)}g protein | ${Object.keys(cleanMeals).map(s => cleanMeals[s].name.split(' (')[0]).join(', ')}`);
        return diet;

    } catch (error) {
        console.error("Diet generation error:", error.message);
        throw new Error("Failed to generate diet plan.");
    }
};
console.log("AI Service Loaded. Workout Key:", !!process.env.GEMINI_API_KEY, "| Diet Key:", !!process.env.GEMINI_DIET_API_KEY);
