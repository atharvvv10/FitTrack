import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

// Test the full pipeline by calling the local server
const SERVER = 'http://localhost:3000';

console.log('\n🍛 Testing Dataset-Driven Indian Diet API...\n');

const userProfile = {
    goal: 'Muscle Gain',
    diet_type: 'Vegetarian',
    weight: '72',
    height: '175',
    age: '22',
    gender: 'Male',
    level: 'Intermediate'
};

const start = Date.now();

try {
    const res = await fetch(`${SERVER}/api/generate-ai-diet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile)
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('❌ Request failed:', res.status, err);
        process.exit(1);
    }

    const diet = await res.json();
    const elapsed = Date.now() - start;

    console.log(`✅ Response in ${elapsed}ms\n`);
    console.log('='.repeat(50));
    console.log(`📋 Summary: ${diet.summary}`);
    console.log(`🎯 Targets: ${diet.macroTargets?.cals} kcal | ${diet.macroTargets?.protein} protein`);
    console.log('');
    console.log(`🌅 Breakfast: ${diet.meals?.breakfast?.name}`);
    console.log(`   ${diet.meals?.breakfast?.cals} kcal | ${diet.meals?.breakfast?.protein}`);
    console.log('');
    console.log(`☀️  Lunch:     ${diet.meals?.lunch?.name}`);
    console.log(`   ${diet.meals?.lunch?.cals} kcal | ${diet.meals?.lunch?.protein}`);
    console.log('');
    console.log(`🍎 Snack:     ${diet.meals?.snack?.name}`);
    console.log(`   ${diet.meals?.snack?.cals} kcal | ${diet.meals?.snack?.protein}`);
    console.log('');
    console.log(`🌙 Dinner:    ${diet.meals?.dinner?.name}`);
    console.log(`   ${diet.meals?.dinner?.cals} kcal | ${diet.meals?.dinner?.protein}`);

    const totalCals = [
        diet.meals?.breakfast?.cals,
        diet.meals?.lunch?.cals,
        diet.meals?.snack?.cals,
        diet.meals?.dinner?.cals
    ].reduce((a, b) => a + (parseInt(b) || 0), 0);

    console.log('');
    console.log(`📊 Total Cals: ${totalCals} | Target: ${diet.macroTargets?.cals} ${Math.abs(totalCals - parseInt(diet.macroTargets?.cals)) < 30 ? '✅' : '⚠️'}`);
    console.log('');
    console.log(`⚡ Pre-workout:  ${diet.trainingFuel?.pre}`);
    console.log(`💪 Post-workout: ${diet.trainingFuel?.post}`);
    console.log('');
    if (diet.supplements?.length > 0) {
        console.log('💊 Supplements:');
        diet.supplements.forEach(s => {
            if (typeof s === 'object' && s.name) {
                console.log(`   ${s.name} — ${s.dosage} (${s.context})`);
            }
        });
    }
    console.log('='.repeat(50));

} catch (err) {
    console.error('❌ Error:', err.message);
}
