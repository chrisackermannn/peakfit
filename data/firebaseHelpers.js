import { db } from '../firebaseConfig';
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
  orderBy 
} from 'firebase/firestore';
import { validateWorkout, validateStats } from './validation';

// ... (other functions remain unchanged)

// Stats Functions
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
    // Removed the inequality filter to avoid Firestore query issues.
    const q = query(
      statsRef,
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting stats:', error);
    return []; // Return an empty array on error so that ProfileScreen can render.
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
      updatedAt: new Date().toISOString(),
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

// (Additional functions for workouts and progress tracking follow here)
