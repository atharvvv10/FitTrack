import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

// Test the full pipeline by calling the local server
const SERVER = 'http://localhost:3000';

console.log('\n🍛 Testing Dataset-Driven Indian Diet API...\n');

const profiles = [
    { name: 'Underweight Muscle', goal: 'Muscle Gain', weight: '52', height: '175', age: '22', gender: 'Male' },
    { name: 'Normal Muscle (Lean Muscle)', goal: 'Muscle Gain', weight: '72', height: '175', age: '22', gender: 'Male' },
    { name: 'Overweight Fat Loss', goal: 'Fat Loss', weight: '88', height: '175', age: '30', gender: 'Male' },
    { name: 'Obese Aggressive Cut', goal: 'Fat Loss', weight: '110', height: '175', age: '35', gender: 'Male' },
    { name: 'Severe Underweight Safety', goal: 'General Fitness', weight: '45', height: '175', age: '20', gender: 'Female' }
];

for (const profile of profiles) {
    console.log(`\n🏃 TEST PROFILE: ${profile.name}`);
    console.log(`- Goal: ${profile.goal} | Weight: ${profile.weight}kg | Height: ${profile.height}cm`);

    try {
        const res = await fetch(`${SERVER}/api/generate-ai-diet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });

        if (!res.ok) {
            console.error(`❌ Request failed for ${profile.name}:`, res.status, await res.text());
            continue;
        }

        const diet = await res.json();
        console.log(`✅ Phase: ${diet.phaseLabel} (${Object.keys(diet.meals).length} meals)`);
        console.log(`🎯 Target: ${diet.macroTargets?.cals} kcal | BMI: ${diet.bmi}`);
        if (diet.safetyNote) console.log(`⚠️ SAFETY: ${diet.safetyNote}`);

        const totalCals = Object.values(diet.meals || {}).reduce((a, b) => a + (parseInt(b.cals) || 0), 0);
        console.log(`📊 Total: ${totalCals} kcal [${Math.abs(totalCals - parseInt(diet.macroTargets?.cals)) < 30 ? 'PASS' : 'FAIL'}]`);
        console.log(`💊 Supps: ${diet.supplements?.map(s => s.name).join(', ')}`);
        console.log('-'.repeat(30));

    } catch (err) {
        console.error(`❌ Error for ${profile.name}:`, err.message);
    }
}

