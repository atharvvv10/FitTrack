
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAvI0KPfm8Xi2Nxw8znmFwKlNBUdnWqqr4",
    authDomain: "ai-based-gym-fitness-ass-b0412.firebaseapp.com",
    projectId: "ai-based-gym-fitness-ass-b0412",
    storageBucket: "ai-based-gym-fitness-ass-b0412.firebasestorage.app",
    messagingSenderId: "169687853473",
    appId: "1:169687853473:web:ed161160638ec5f5a0c3e0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testConnection() {
    try {
        console.log("Attempting to write to 'test_connection' collection...");
        const docRef = await addDoc(collection(db, "test_connection"), {
            timestamp: new Date(),
            status: "active"
        });
        console.log("SUCCESS: Document written with ID: ", docRef.id);
        process.exit(0);
    } catch (e) {
        console.error("ERROR: Write failed.");
        console.error(e.message);
        process.exit(1);
    }
}

testConnection();
