// src/logic/dietGenerator.js

const MEAL_DB = {
    breakfast: {
        "Vegetarian": [
            { name: "Oats Upma with Peanuts & Veggies", cals: 350, protein: "10g" },
            { name: "Paneer Sandwich on Whole Wheat", cals: 400, protein: "15g" },
            { name: "Poha with Peas, Potatoes & Peanuts", cals: 350, protein: "8g" },
            { name: "Greek Yogurt Parfait with Berries & Granola", cals: 350, protein: "15g" },
            { name: "Masala Omelette (Eggless / Besan Chilla)", cals: 300, protein: "12g" },
            { name: "Avocado Toast with Feta & Chili Flakes", cals: 380, protein: "10g" },
            { name: "Moong Dal Chilla with Mint Chutney", cals: 320, protein: "14g" },
            { name: "Cottage Cheese (Paneer) Bhurji & Toast", cals: 400, protein: "18g" },
            { name: "Smoothie Bowl (Spinach, Banana, Protein Powder)", cals: 350, protein: "25g" },
            { name: "Aloo Paratha (Low Oil) with Curd", cals: 450, protein: "10g" }
        ],
        "Non-Vegetarian": [
            { name: "Scrambled Eggs (3) with Spinach & Toast", cals: 420, protein: "22g" },
            { name: "Chicken Sausage & Mushroom Omelette", cals: 450, protein: "28g" },
            { name: "Egg Bhurji with 1 Multigrain Roti", cals: 380, protein: "18g" },
            { name: "Turkey Bacon & Egg White Wrap", cals: 400, protein: "25g" },
            { name: "Smoked Salmon on Bagel with Cream Cheese", cals: 450, protein: "20g" },
            { name: "Boiled Eggs (3) & Fruit Bowl", cals: 300, protein: "18g" },
            { name: "Chicken Keema with Pav (Whole Wheat)", cals: 500, protein: "30g" }
        ],
        "Vegan": [
            { name: "Tofu Scramble with Spinach & Turmeric", cals: 320, protein: "18g" },
            { name: "Oatmeal with Almond Milk & Chia Seeds", cals: 350, protein: "10g" },
            { name: "Chickpea Flour (Besan) Chilla with Veggies", cals: 300, protein: "12g" },
            { name: "Peanut Butter Banana Toast", cals: 400, protein: "12g" },
            { name: "Smoothie (Soy Milk, Berries, Pea Protein)", cals: 300, protein: "22g" },
            { name: "Quinoa Breakfast Porridge with Almonds", cals: 350, protein: "12g" },
            { name: "Hummus & Avocado Toast", cals: 380, protein: "12g" }
        ]
    },
    lunch: {
        "Vegetarian": [
            { name: "Dal Tadka, Brown Rice, Cucumber Salad", cals: 500, protein: "18g" },
            { name: "Rajma Masala with 2 Rotis", cals: 550, protein: "20g" },
            { name: "Paneer Butter Masala (Light) & 2 Rotis", cals: 600, protein: "22g" },
            { name: "Chickpea & Feta Salad with Olive Oil", cals: 450, protein: "18g" },
            { name: "Palak Paneer with Jeera Rice", cals: 550, protein: "20g" },
            { name: "Vegetable Biryani with Raita & Soya Chunks", cals: 600, protein: "25g" },
            { name: "Lentil Soup & Grilled Cheese Sandwich", cals: 550, protein: "20g" },
            { name: "Buddha Bowl (Quinoa, Roasted Chickpeas, Tahini)", cals: 500, protein: "20g" }
        ],
        "Non-Vegetarian": [
            { name: "Grilled Chicken Breast with Quinoa & Asparagus", cals: 500, protein: "40g" },
            { name: "Chicken Curry (Home Style) with 2 Rotis", cals: 550, protein: "35g" },
            { name: "Fish Curry with Steamed Rice", cals: 500, protein: "30g" },
            { name: "Chicken Burrito Bowl (Beans, Rice, Salsa)", cals: 600, protein: "35g" },
            { name: "Tuna Salad Sandwich on Whole Wheat", cals: 450, protein: "28g" },
            { name: "Lemon Herb Grilled Chicken with Roasted Potatoes", cals: 550, protein: "38g" },
            { name: "Egg Curry with Rice", cals: 500, protein: "22g" }
        ],
        "Vegan": [
            { name: "Lentil Soup with Brown Rice", cals: 450, protein: "18g" },
            { name: "Tofu Stir-fry with Broccoli & Cashews", cals: 450, protein: "22g" },
            { name: "Kidney Bean (Rajma) Salad with Avocado", cals: 400, protein: "15g" },
            { name: "Black Bean Burger (No Bun) with Salad", cals: 500, protein: "20g" },
            { name: "Chana Masala with 2 Rotis", cals: 550, protein: "18g" },
            { name: "Vegan Pesto Pasta with Peas", cals: 500, protein: "18g" },
            { name: "Thai Green Curry with Tofu & Rice", cals: 600, protein: "20g" }
        ]
    },
    snack: {
        "any": [
            { name: "Handful of Almonds & Walnuts", cals: 180, protein: "6g" },
            { name: "Apple with Peanut Butter", cals: 200, protein: "5g" },
            { name: "Protein Shake (Whey/Plant)", cals: 130, protein: "22g" },
            { name: "Roasted Makhana (Fox Nuts)", cals: 100, protein: "3g" },
            { name: "Greek Yogurt with Honey", cals: 150, protein: "12g" },
            { name: "Hummus with Carrot Sticks", cals: 180, protein: "6g" },
            { name: "Boiled Egg (2) with Pepper", cals: 140, protein: "12g" },
            { name: "Sprouted Moong Salad", cals: 150, protein: "8g" },
            { name: "Protein Bar", cals: 220, protein: "20g" },
            { name: "Rice Cake with Avocado", cals: 150, protein: "2g" }
        ]
    },
    dinner: {
        "Vegetarian": [
            { name: "Mixed Vegetable Curry with 1 Roti", cals: 350, protein: "8g" },
            { name: "Yellow Dal (Moong) Soup with Spinach", cals: 300, protein: "15g" },
            { name: "Palak Paneer (Light) with 1 Roti", cals: 400, protein: "18g" },
            { name: "Stuffed Bell Peppers (Paneer/Potato)", cals: 350, protein: "15g" },
            { name: "Khichdi with Ghee & Curd", cals: 400, protein: "12g" },
            { name: "Mushroom Masala with 1 Roti", cals: 320, protein: "10g" },
            { name: "Vegetable Stir-Fry with Tofu", cals: 350, protein: "18g" }
        ],
        "Non-Vegetarian": [
            { name: "Grilled Fish with Steamed Broccoli", cals: 350, protein: "30g" },
            { name: "Chicken Stir-fry (No Rice)", cals: 400, protein: "35g" },
            { name: "Egg Curry with 1 Roti", cals: 400, protein: "18g" },
            { name: "Baked Salmon with Asparagus", cals: 450, protein: "32g" },
            { name: "Chicken Soup with Veggies", cals: 300, protein: "25g" },
            { name: "Minced Chicken (Keema) Salad Bowl", cals: 400, protein: "30g" },
            { name: "Shrimp Stir-Fry with Zucchini", cals: 350, protein: "28g" }
        ],
        "Vegan": [
            { name: "Mushroom Masala with 1 Roti", cals: 320, protein: "10g" },
            { name: "Soya Chunk Curry with Brown Rice", cals: 400, protein: "22g" },
            { name: "Dal Khichdi (No Ghee)", cals: 350, protein: "12g" },
            { name: "Tofu & Vegetable Stir-Fry", cals: 350, protein: "20g" },
            { name: "Lentil Soup with Spinach", cals: 300, protein: "15g" },
            { name: "Cauliflower Rice Burrito Bowl", cals: 350, protein: "12g" },
            { name: "Zucchini Noodles with Marinara & Chickpeas", cals: 320, protein: "10g" }
        ]
    }
};

const macroTargets = {
    "Muscle Gain": { cals: "2800", protein: "180g" },
    "Weight Loss": { cals: "1800", protein: "140g" },
    "General Fitness": { cals: "2200", protein: "120g" }
};

// Calculate proper calorie/protein targets from user profile
function calculateTargets(ctx) {
    const weight = parseFloat(ctx.weight) || 70;
    const height = parseFloat(ctx.height) || 170;
    const age = parseInt(ctx.age) || 25;
    const gender = (ctx.gender || 'Male').toLowerCase();
    const goal = (ctx.goal || 'General Fitness').toLowerCase();
    const level = (ctx.level || 'Beginner').toLowerCase();

    // Mifflin-St Jeor BMR
    let bmr;
    if (gender === 'female' || gender === 'f') {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    }

    let mult = 1.55;
    if (level.includes('beginner')) mult = 1.4;
    else if (level.includes('intermediate')) mult = 1.6;
    else if (level.includes('advanced')) mult = 1.75;

    let tdee = Math.round(bmr * mult);
    if (goal.includes('muscle') || goal.includes('bulk') || goal.includes('gain') || goal.includes('mass')) tdee += 350;
    else if (goal.includes('weight loss') || goal.includes('cut') || goal.includes('lean') || goal.includes('fat loss')) tdee -= 400;
    else if (goal.includes('strength')) tdee += 200;

    let ppkg = 1.6;
    if (goal.includes('muscle') || goal.includes('gain') || goal.includes('bulk')) ppkg = 2.0;
    else if (goal.includes('strength')) ppkg = 1.8;
    else if (goal.includes('weight loss') || goal.includes('cut')) ppkg = 2.2;

    return { calories: tdee, protein: Math.round(weight * ppkg) };
}

// Post-process: scale meal values to exactly hit targets
function normalizeMeals(mealsObj, targetCals, targetProtein) {
    const keys = ['breakfast', 'lunch', 'snack', 'dinner'];
    const pn = (v) => typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, '')) || 0;

    let totalC = 0, totalP = 0;
    keys.forEach(k => { if (mealsObj[k]) { totalC += pn(mealsObj[k].cals); totalP += pn(mealsObj[k].protein); } });

    if (totalC > 0 && Math.abs(totalC - targetCals) / targetCals > 0.02) {
        const s = targetCals / totalC;
        keys.forEach(k => { if (mealsObj[k]) mealsObj[k].cals = Math.round(pn(mealsObj[k].cals) * s); });
        const nt = keys.reduce((a, k) => a + (mealsObj[k]?.cals || 0), 0);
        if (mealsObj.dinner) mealsObj.dinner.cals += (targetCals - nt);
    }
    if (totalP > 0 && Math.abs(totalP - targetProtein) / targetProtein > 0.02) {
        const s = targetProtein / totalP;
        keys.forEach(k => { if (mealsObj[k]) mealsObj[k].protein = Math.round(pn(mealsObj[k].protein) * s) + 'g'; });
        const nt = keys.reduce((a, k) => a + pn(mealsObj[k]?.protein), 0);
        if (mealsObj.dinner) mealsObj.dinner.protein = (pn(mealsObj.dinner.protein) + (targetProtein - nt)) + 'g';
    }
    return mealsObj;
}

export const generateDiet = (userContext, previousMeals = []) => {
    const { diet_type, goal } = userContext;

    // Normalize Diet
    let normalizedDiet = "Vegetarian";
    if (diet_type && diet_type.toLowerCase().includes("non")) normalizedDiet = "Non-Vegetarian";
    else if (diet_type && diet_type.toLowerCase().includes("vegan")) normalizedDiet = "Vegan";

    // Helper to pick random meal avoiding repeats
    const pickMeal = (category, type) => {
        let options = MEAL_DB[category][type] || MEAL_DB[category]["any"];
        // Fallback if specific type unavailable
        if (!options) options = MEAL_DB[category]["Vegetarian"];

        const available = options.filter(m => !previousMeals.includes(m.name));
        // If all used, reset (just pick random)
        const pool = available.length > 0 ? available : options;
        return pool[Math.floor(Math.random() * pool.length)];
    };

    // --- RICH CONTENT DATABASES ---

    // --- RICH CONTENT DATABASES ---

    // 1. Strategies (Deep, Clinical, Coach-Level)
    const strategyDb = {
        "Muscle Gain": [
            {
                bullets: [
                    "Maximizes Muscle Signals",
                    "Optimizes Meal Frequency",
                    "Training-Focused Carbs"
                ],
                text: "This protocol focuses on High-Flux Hypertrophy. By placing you in a calculated caloric surplus of ~250-300kcal above maintenance, we provide just enough energy to support new contractile tissue without 'spilling over' into storage. We drive amino acids directly into muscle cells when they are most receptive."
            }
        ],
        "Weight Loss": [
            {
                bullets: [
                    "Defends Lean Muscle",
                    "Manipulates Satiety Hormones",
                    "Prioritizes Fat Burning"
                ],
                text: "This strategy utilizes Aggressive Metabolic Preservation. We use a high-protein, high-volume approach to trigger physical stretch receptors in the stomach, sending fullness signals to the brain. Nutrient timing is set to provide energy for training but tapers off to tap into fat stores overnight."
            }
        ],
        "General Fitness": [
            {
                bullets: [
                    "Efficient Fuel Switching",
                    "Stable Energy & Hormones",
                    "Reduces Crashes & Fatigue"
                ],
                text: "We aim for a 'Euhydrated, Eunutrient' state where your body has effortless access to glucose for high-intensity work and free fatty acids for low-intensity recovery. This balance eliminates the afternoon energy crash and promotes long-term metabolic health."
            }
        ]
    };

    // 2. Meal Purposes (Detailed & Physiological)
    const getPurpose = (slot, goal) => {
        const purposes = {
            breakfast: [
                "Breaks the overnight fast by replenishing liver glycogen to signal abundance to the thyroid. Provides sustained release energy.",
                "High-protein initiation to jumpstart muscle protein synthesis immediately upon waking. Sets a stable blood sugar tone for the day."
            ],
            lunch: [
                "Mid-day metabolic recharge. Focuses on complex carbohydrates to sustain cognitive focus and prevent the late-afternoon cortisol spike.",
                "Balanced macronutrient profile to ensure steady insulin release, preventing lethargy while keeping amino acid pools topped up."
            ],
            snack: [
                "Pre-training functional fuel. Designed to be easily digestible, providing immediate glucose availability for high-intensity muscular contractions.",
                "A perfectly timed bridge between meals to maintain satiety and prevent overeating at dinner. Keeps metabolic rate slightly elevated."
            ],
            dinner: [
                "Recovery-focused meal rich in slow-digesting casein proteins (if dairy) or fibers to drip-feed amino acids during sleep.",
                "Lower glycemic load to allow insulin levels to baseline before sleep, optimizing growth hormone output during deep REM cycles."
            ]
        };
        const list = purposes[slot];
        return list[Math.floor(Math.random() * list.length)];
    };

    // 3. Daily Targets Logic (The "Why")
    const targetsLogicDb = {
        "Muscle Gain": "These macro targets maximize nitrogen retention. The high carbohydrate ceiling supports heavy volume training, while the protein target is set above the RDA to account for increased oxidative breakdown during intense hypertrophy work.",
        "Weight Loss": "We prioritize protein here to leverage the Thermic Effect of Food (TEF)—burning more calories just to digest. The calorie deficit is aggressive but safe, ensuring fat loss comes from stores, not muscle tissue.",
        "General Fitness": "A moderate isocaloric approach. These targets maintain your current lean mass while providing ample fuel for daily life. This approach prioritizes consistency and hormonal stability over aggressive restriction or surplus."
    };

    // 4. System Logic Pillars (Consistent & Detailed)
    const systemLogicDb = {
        "Muscle Gain": [
            { title: "Macronutrient Balance", icon: "⚖️", desc: "Heavily skewed towards anabolic recovery. We maintain a positive nitrogen balance via high protein frequencies. This ensures your body is always in a state of repair rather than breakdown." },
            { title: "Micronutrient Diversity", icon: "🌈", desc: "Focuses on Magnesium and Zinc support to aid in testosterone production and neural recovery, which are heavily taxed during strength training." },
            { title: "Hydration Strategy", icon: "💧", desc: "Super-hydration protocol (1ml per kcal) to support cellular volumization. Hydrated muscle cells trigger anabolic signaling pathways more effectively than dehydrated ones." },
            { title: "Cortisol Management", icon: "🛡️", desc: "Strategically lowering training stress post-session with rapid-acting carbohydrates to blunt cortisol (stress hormone), preserving muscle tissue." }
        ],
        "Weight Loss": [
            { title: "Macronutrient Balance", icon: "⚖️", desc: "Protein-forward to spare muscle tissue. Carbohydrates are used essentially as 'training fuel' assignments rather than ample energy, and fats are kept at essential levels for hormone function." },
            { title: "Micronutrient Diversity", icon: "🌈", desc: "High emphasis on B-Vitamins and Iron to support energy metabolism during a deficit. This prevents the lethargy often associated with dieting." },
            { title: "Hydration Strategy", icon: "💧", desc: "Strategic fluid intake before meals to engage stomach stretch receptors (satiety). This supports lipolysis (fat breakdown), which is water-dependent." },
            { title: "Insulin Sensitivity", icon: "🩸", desc: "Timing carbohydrate intake exclusively around activity windows to ensure glucose is disposed of into muscle glycogen rather than stored as adipose tissue." }
        ],
        "General Fitness": [
            { title: "Macronutrient Balance", icon: "⚖️", desc: "The 'Golden Ratio' for health. Equalizing energy substrates prevents metabolic downregulation. You will never feel deprived, nor sluggishly full." },
            { title: "Micronutrient Diversity", icon: "🌈", desc: "Broad-spectrum coverage. By rotating color groups in vegetables, we reduce systemic oxidative stress. This supports long-term energy, skin health, immunity, and recovery resilience." },
            { title: "Hydration Strategy", icon: "💧", desc: "Base-level maintenance of 3-4 Liters. Supports optimal cognitive function and joint lubrication. This reduces perceived fatigue and joint stiffness across the day." },
            { title: "Circadian Rhythm", icon: "🌙", desc: "Front-loading calories earlier in the day to align with natural cortisol curves. You’ll feel more alert in the morning and naturally wind down at night." }
        ]
    };

    // 5. Supplements (Contextual)
    // 5. Supplements (Contextual)
    const supplementsDb = {
        "Muscle Gain": [
            { name: "Whey Protein", context: "Post-workout to spike amino acid levels instantly when muscle sensitivity is highest." },
            { name: "Creatine Monohydrate", context: "5g daily to saturate muscle creatine stores, directly improving power output and volume tolerance." },
            { name: "Beta-Alanine", context: "Buffers lactic acid accumulation, allowing for higher volume training sessions before fatigue sets in." }
        ],
        "Weight Loss": [
            { name: "Multivitamin", context: "Insurance policy against micronutrient gaps that naturally occur when reducing total food volume." },
            { name: "Whey Isolate", context: "A pure protein tool to hit daily targets without the extra fats/carbs found in whole food sources." },
            { name: "Green Tea Extract", context: "Provides mild thermogenic support and potent antioxidants for metabolic health." }
        ],
        "General Fitness": [
            { name: "Omega-3 Fish Oil", context: "Essential for combating systemic inflammation and supporting cognitive/heart health." },
            { name: "Vitamin D3", context: "Supports immune function and bone density, especially if sun exposure is limited." },
            { name: "Magnesium Glycinate", context: "Promotes nervous system relaxation and quality sleep, crucial for long-term health." }
        ]
    };

    // 6. Reassurance
    const reassuranceDb = [
        "Trust the consistency over the intensity. One perfect day means less than thirty 'good enough' days. You are building a lifestyle.",
        "Your body is an adaptive machine. Give it these quality inputs, and the output—your physique and energy—will inevitably follow.",
        "This plan is a blueprint, not a prison. Listen to your bio-feedback; if you are truly exhausted, rest and nourish. Correct execution takes time."
    ];

    // Select Data
    const chosenStrategy = strategyDb[goal] ? strategyDb[goal][Math.floor(Math.random() * strategyDb[goal].length)] : strategyDb["General Fitness"][0];
    const chosenTargetsLogic = targetsLogicDb[goal] || targetsLogicDb["General Fitness"];
    const chosenReassurance = reassuranceDb[Math.floor(Math.random() * reassuranceDb.length)];
    const chosenSystemLogic = systemLogicDb[goal] || systemLogicDb["General Fitness"];
    const chosenSupplements = supplementsDb[goal] || supplementsDb["General Fitness"];

    // Calculate proper targets from user profile
    const targets = calculateTargets(userContext);

    const mealsObj = {
        breakfast: { ...pickMeal("breakfast", normalizedDiet), purpose: getPurpose("breakfast", goal) },
        lunch: { ...pickMeal("lunch", normalizedDiet), purpose: getPurpose("lunch", goal) },
        snack: { ...pickMeal("snack", "any"), purpose: getPurpose("snack", goal) },
        dinner: { ...pickMeal("dinner", normalizedDiet), purpose: getPurpose("dinner", goal) }
    };

    // Normalize meals to match calculated targets
    const normalizedMealsObj = normalizeMeals(mealsObj, targets.calories, targets.protein);

    return {
        summary: `${normalizedDiet} Plan for ${goal}`,
        strategy: chosenStrategy,
        macroTargets: {
            cals: String(targets.calories),
            protein: targets.protein + 'g',
            logic: chosenTargetsLogic
        },
        meals: normalizedMealsObj,
        trainingFuel: {
            pre: "Banana or Toast with small coffee",
            post: "Protein Shake or 3 Egg Whites"
        },
        focusPoints: chosenSystemLogic,
        supplements: chosenSupplements,
        reassurance: chosenReassurance,
        disclaimer: "MEDICAL DISCLAIMER: Consult a qualified healthcare professional before starting any new diet or supplement routine. This guidance is for educational purposes only."
    };
};
