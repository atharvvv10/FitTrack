import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAvI0KPfm8Xi2Nxw8znmFwKlNBUdnWqqr4",
    authDomain: "ai-based-gym-fitness-ass-b0412.firebaseapp.com",
    projectId: "ai-based-gym-fitness-ass-b0412",
    storageBucket: "ai-based-gym-fitness-ass-b0412.firebasestorage.app",
    messagingSenderId: "169687853473",
    appId: "1:169687853473:web:ed161160638ec5f5a0c3e0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Firestore services
export const auth = getAuth(app);
export const db = getFirestore(app);
