
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';

/**
 * Service to handle all User Data interactions with Firestore.
 * - Profiles
 * - History Logs (Workouts, Diet)
 * - Statistics
 */

// 1. USER PROFILE
export const saveUserProfile = async (uid, data) => {
    try {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, {
            ...data,
            lastUpdated: serverTimestamp()
        }, { merge: true });
        console.log("User Profile Saved:", uid);
        return true;
    } catch (e) {
        console.error("Error saving profile:", e);
        return false;
    }
};

export const getUserProfile = async (uid) => {
    try {
        const userRef = doc(db, 'users', uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (e) {
        console.error("Error fetching profile:", e);
        return null;
    }
};

// 2. ACTIVITY LOGGING (Big Data)

/**
 * Logs a completed workout to the 'activity_logs' sub-collection
 */
/**
 * Logs a completed workout to the 'activity_logs' sub-collection
 */
export const logWorkout = async (uid, workoutData) => {
    try {
        // HYBRID: Save to SQL (CockroachDB) via local server
        const response = await fetch('/api/workouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: uid,
                date: new Date().toISOString(), // Ensure date is always sent
                difficulty: workoutData.difficulty || 'Intermediate', // Fallback
                ...workoutData
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save to SQL DB');
        }

        console.log("Workout Logged to SQL for:", uid);
        return true;
    } catch (e) {
        console.error("Error logging workout (SQL):", e);
        // Fallback to Firestore? Or just fail? For now, let's keep it simple.
        return false;
    }
};

export const logWorkoutFirestore = async (uid, workoutData) => {
    try {
        const logsRef = collection(db, 'users', uid, 'activity_logs');
        await addDoc(logsRef, {
            type: 'WORKOUT_COMPLETE',
            date: new Date(),
            ...workoutData
        });
        console.log("Workout Logged to Firestore for:", uid);
        return true;
    } catch (e) {
        console.error("Error logging workout (Firestore):", e);
        return false;
    }
};

/**
 * Logs daily diet summary
 */
export const logDiet = async (uid, dietData) => {
    try {
        const logsRef = collection(db, 'users', uid, 'diet_logs');
        await addDoc(logsRef, {
            date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            timestamp: new Date(),
            ...dietData
        });
        console.log("Diet Logged for:", uid);
        return true;
    } catch (e) {
        console.error("Error logging diet:", e);
        return false;
    }
};

// 3. READ HISTORY

export const getWorkoutHistory = async (uid) => {
    try {
        const logsRef = collection(db, 'users', uid, 'activity_logs');
        const q = query(logsRef, orderBy('date', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("Error getting history:", e);
        return [];
    }
};
