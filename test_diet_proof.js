import { generateAIDiet } from './server/ai.js';

const profile = {
    goal: 'Muscle Gain',
    diet_type: 'Vegan',
    allergies: ['Nuts'],
    weight: '75',
    height: '178',
    age: '20',
    gender: 'Male',
    level: 'Beginner'
};

console.log("=== DIET API PROOF TEST ===");
console.log("Profile:", JSON.stringify(profile, null, 2));
console.log("\nCalling AI Diet API...\n");

try {
    const diet = await generateAIDiet(profile);

    console.log("========================================");
    console.log("        AI DIET RESPONSE PROOF");
    console.log("========================================\n");

    // Show macro targets
    console.log("📊 MACRO TARGETS (from response):");
    console.log(`   Calories: ${diet.macroTargets?.cals}`);
    console.log(`   Protein:  ${diet.macroTargets?.protein}`);
    console.log(`   Logic:    ${diet.macroTargets?.logic}\n`);

    // Show each meal
    const parseNum = (v) => typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, '')) || 0;
    let totalCals = 0, totalProtein = 0;

    console.log("🍽️  MEALS BREAKDOWN:");
    console.log("─".repeat(60));

    ['breakfast', 'lunch', 'snack', 'dinner'].forEach(key => {
        const m = diet.meals?.[key];
        if (m) {
            const cals = parseNum(m.cals);
            const prot = parseNum(m.protein);
            totalCals += cals;
            totalProtein += prot;
            console.log(`   ${key.toUpperCase().padEnd(12)} ${m.name}`);
            console.log(`                Cals: ${cals}  |  Protein: ${prot}g`);
            console.log(`                Purpose: ${m.purpose}`);
            console.log("");
        }
    });

    console.log("─".repeat(60));
    console.log(`\n✅ TOTAL MEAL CALORIES:  ${totalCals} kcal`);
    console.log(`✅ TOTAL MEAL PROTEIN:   ${totalProtein}g`);
    console.log(`📊 DECLARED TARGET:      ${diet.macroTargets?.cals} kcal / ${diet.macroTargets?.protein}`);
    console.log(`\n🎯 CALORIES MATCH?   ${totalCals === parseNum(diet.macroTargets?.cals) ? '✅ YES — PERFECT MATCH' : '❌ NO — MISMATCH: ' + totalCals + ' vs ' + diet.macroTargets?.cals}`);
    console.log(`🎯 PROTEIN MATCH?    ${totalProtein === parseNum(diet.macroTargets?.protein) ? '✅ YES — PERFECT MATCH' : '❌ NO — MISMATCH: ' + totalProtein + 'g vs ' + diet.macroTargets?.protein}`);

    console.log("\n📋 SUPPLEMENTS:");
    diet.supplements?.forEach(s => console.log(`   • ${s.name}: ${s.context}`));

    console.log("\n💬 SUMMARY:", diet.summary);
    console.log("========================================");

} catch (err) {
    console.error("❌ API FAILED:", err.message);
}
