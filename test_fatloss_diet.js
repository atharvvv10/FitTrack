// Test Fat Loss profile
const SERVER = 'http://localhost:3000';
const profile = {
    goal: 'Fat Loss', diet_type: 'Vegetarian',
    weight: '85', height: '175', age: '30', gender: 'Female', level: 'Beginner'
};
const res = await fetch(`${SERVER}/api/generate-ai-diet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
const d = await res.json();
console.log('\n=== FAT LOSS TEST ===');
console.log(`Summary: ${d.summary}`);
console.log(`Targets: ${d.macroTargets?.cals} kcal | ${d.macroTargets?.protein}`);
for (const [slot, m] of Object.entries(d.meals || {})) {
    console.log(`${slot.padEnd(10)}: ${m.name.padEnd(40)} ${m.cals} kcal | ${m.protein} protein | ${m.carbs} carbs | ${m.fat} fat`);
}
const total = Object.values(d.meals || {}).reduce((s, m) => s + (parseInt(m.cals) || 0), 0);
console.log(`\nTotal: ${total} kcal | Target: ${d.macroTargets?.cals} ${Math.abs(total - parseInt(d.macroTargets?.cals)) < 30 ? '✅' : '⚠️'}`);
console.log(`Pre: ${d.trainingFuel?.pre}`);
console.log(`Post: ${d.trainingFuel?.post}`);
