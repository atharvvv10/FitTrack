// Native fetch is available in Node 18+

const BASE_URL = 'http://localhost:3000';
const USER_ID = 'test_user_persistence_' + Date.now();
const DATE = '2025-01-01';

async function testPersistence() {
    console.log("🧪 Testing Diet Persistence API...");

    // 0. Check Health
    console.log("\n0️⃣ Checking API Health...");
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthText = await healthRes.text();
    console.log("Health Response:", healthText);
    try {
        JSON.parse(healthText);
        console.log("✅ Health Check JSON OK");
    } catch (e) {
        throw new Error("Health Check returned non-JSON: " + healthText.substring(0, 100));
    }

    console.log("\n1️⃣ Marking Breakfast as Eaten...");
    const res1 = await fetch(`${BASE_URL}/api/diet/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: USER_ID,
            date: DATE,
            mealType: 'breakfast',
            foodName: 'Test Oats',
            calories: 400,
            protein: 20,
            completed: true
        })
    });
    const json1 = await res1.json();
    console.log("Response:", json1);

    if (json1.status !== 'success') throw new Error("Failed to save log");

    // 2. Fetch Logs
    console.log("\n2️⃣ Fetching Logs...");
    const res2 = await fetch(`${BASE_URL}/api/diet/logs?userId=${USER_ID}&date=${DATE}`);
    const logs2 = await res2.json();
    console.log("Logs:", logs2);

    const breakfast = logs2.find(l => l.meal_type === 'breakfast');
    if (!breakfast || !breakfast.completed) throw new Error("Breakfast not found or not completed");
    console.log("✅ Breakfast confirmed saved.");

    // 3. Mark Ungiven (Toggle Off)
    console.log("\n3️⃣ Unmarking Breakfast (Toggle Off)...");
    const res3 = await fetch(`${BASE_URL}/api/diet/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: USER_ID,
            date: DATE,
            mealType: 'breakfast',
            foodName: 'Test Oats',
            calories: 400,
            protein: 20,
            completed: false
        })
    });
    const json3 = await res3.json();
    console.log("Response:", json3);

    // 4. Verify Toggle
    console.log("\n4️⃣ Verifying Toggle...");
    const res4 = await fetch(`${BASE_URL}/api/diet/logs?userId=${USER_ID}&date=${DATE}`);
    const logs4 = await res4.json();
    console.log("Logs:", logs4);

    // In SQL, we updated completed to false.
    const breakfast2 = logs4.find(l => l.meal_type === 'breakfast');
    if (breakfast2.completed) throw new Error("Breakfast should be uncompleted");
    console.log("✅ Breakfast confirmed uncompleted.");

    console.log("\n🎉 Persistence Test Passed!");
}

testPersistence().catch(err => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
});
