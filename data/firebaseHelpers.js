import { db } from '../Firebase/firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { validateWorkout, validateStats } from './validation';

/**
 * ========================================
 * =              STATS LOGIC            =
 * ========================================
 * (Unchanged from your original code)
 */
export const addStats = async (userId, statsData) => {
  try {
    const errors = validateStats(statsData);
    if (errors.length > 0) {
      throw new Error(`Invalid stats data: ${errors.join(', ')}`);
    }
    const statsRef = collection(db, 'users', userId, 'stats');
    const newStats = await addDoc(statsRef, {
      ...statsData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return newStats.id;
  } catch (error) {
    console.error('Error adding stats:', error);
    throw error;
  }
};

export const getStats = async (userId) => {
  try {
    const statsRef = collection(db, 'users', userId, 'stats');
    const q = query(statsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting stats:', error);
    return [];
  }
};

export const getLatestStats = async (userId) => {
  try {
    const stats = await getStats(userId);
    return stats.length > 0 ? stats[0] : null;
  } catch (error) {
    console.error('Error getting latest stats:', error);
    throw error;
  }
};

export const updateStats = async (userId, statId, statsData) => {
  try {
    const errors = validateStats(statsData);
    if (errors.length > 0) {
      throw new Error(`Invalid stats data: ${errors.join(', ')}`);
    }
    const statRef = doc(db, 'users', userId, 'stats', statId);
    await updateDoc(statRef, {
      ...statsData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating stats:', error);
    throw error;
  }
};

export const deleteStats = async (userId, statId) => {
  try {
    const statRef = doc(db, 'users', userId, 'stats', statId);
    await deleteDoc(statRef);
  } catch (error) {
    console.error('Error deleting stats:', error);
    throw error;
  }
};

/**
 * ========================================
 * =           WORKOUTS LOGIC            =
 * ========================================
 * Subcollection: users/{userId}/workouts/{docId}
 */

/**
 * Save a single workout doc under users/{userId}/workouts
 * REQUIRES: userId (string) and workoutData (object).
 */
export async function saveWorkoutToProfile(userId, workoutData) {
  try {
    // If needed, do local validation:
    // const errors = validateWorkout(workoutData);
    // if (errors.length > 0) {
    //   throw new Error(`Invalid workout data: ${errors.join(', ')}`);
    // }

    // Ensure we store a Firestore timestamp for 'date'
    // If the caller didn't pass date, we override it:
    const docData = {
      ...workoutData,
      date: serverTimestamp(),
    };

    // Ensure user doc is created if missing
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      // Create a minimal user doc so subcollection can exist
      await setDoc(userDocRef, {
        createdAt: new Date().toISOString(),
        email: null, // or real data if you have it
      });
      console.log('Created a minimal user doc for userId:', userId);
    }

    // Add a new doc to subcollection "workouts"
    const workoutsRef = collection(userDocRef, 'workouts');
    const newDocRef = await addDoc(workoutsRef, docData);
    console.log(`Workout doc created: users/${userId}/workouts/${newDocRef.id}`);
  } catch (error) {
    console.error('Error saving workout:', error);
    throw error;
  }
}

/**
 * Fetch all workouts from users/{userId}/workouts
 */
export async function getUserWorkouts(userId) {
  try {
    const colRef = collection(db, 'users', userId, 'workouts');
    const q = query(colRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching workouts:', error);
    throw error;
  }
}

/**
 * Delete a specific workout by doc ID
 */
export async function deleteWorkout(userId, workoutId) {
  try {
    const docRef = doc(db, 'users', userId, 'workouts', workoutId);
    await deleteDoc(docRef);
    console.log('Workout deleted successfully');
  } catch (error) {
    console.error('Error deleting workout:', error);
    throw error;
  }
}
