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
  serverTimestamp,
  arrayUnion,
  limit
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
    // Make sure we have the required fields to match security rules
    if (!workoutData.exercises) {
      throw new Error('Workout must include exercises array');
    }

    // Calculate totalWeight if not provided, to satisfy security rules
    if (!workoutData.totalWeight || typeof workoutData.totalWeight !== 'number' || workoutData.totalWeight <= 0) {
      let totalWeight = 0;
      // Sum up weights from exercises
      if (Array.isArray(workoutData.exercises)) {
        workoutData.exercises.forEach(exercise => {
          if (exercise.sets && Array.isArray(exercise.sets)) {
            exercise.sets.forEach(set => {
              if (set.weight && typeof set.weight === 'number') {
                totalWeight += set.weight * (set.reps || 1);
              }
            });
          }
        });
      }
      
      // Ensure totalWeight is greater than 0
      workoutData.totalWeight = totalWeight > 0 ? totalWeight : 1;
    }

    // Ensure we store a Firestore timestamp for 'date'
    const docData = {
      ...workoutData,
      exercises: workoutData.exercises || [],
      totalWeight: workoutData.totalWeight,
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
    return newDocRef.id;
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

export async function saveWorkoutGlobally(workoutData) {
  try {
    if (!workoutData.userId || !workoutData.userDisplayName) {
      throw new Error('Missing user information');
    }

    // Ensure required fields are present for security rules
    if (!workoutData.exercises) {
      workoutData.exercises = [];
    }

    // Calculate total weight if not provided
    if (!workoutData.totalWeight || typeof workoutData.totalWeight !== 'number') {
      let totalWeight = 0;
      // Sum up weights from exercises
      if (Array.isArray(workoutData.exercises)) {
        workoutData.exercises.forEach(exercise => {
          if (exercise.sets && Array.isArray(exercise.sets)) {
            exercise.sets.forEach(set => {
              if (set.weight && typeof set.weight === 'number') {
                totalWeight += set.weight * (set.reps || 1);
              }
            });
          }
        });
      }
      workoutData.totalWeight = totalWeight > 0 ? totalWeight : 1;
    }

    // Create document ID without using __name__
    const customDocId = `${workoutData.userId}_${Date.now()}`;
    const globalWorkoutsRef = doc(db, 'globalWorkouts', customDocId);

    const docData = {
      ...workoutData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      likes: [],
      comments: []
    };

    // Use setDoc without merge option
    await setDoc(globalWorkoutsRef, docData);

    // Save to user's profile
    await saveWorkoutToProfile(workoutData.userId, {
      ...workoutData,
      isPublic: true,
      globalWorkoutId: customDocId
    });

    return customDocId;
  } catch (error) {
    console.error('Error saving global workout:', error);
    throw error;
  }
}

// Add functions for likes/comments
export async function toggleLike(workoutId, userId) {
  try {
    const workoutRef = doc(db, 'globalWorkouts', workoutId);
    const workoutDoc = await getDoc(workoutRef);
    const likes = workoutDoc.data().likes || [];

    if (likes.includes(userId)) {
      await updateDoc(workoutRef, {
        likes: likes.filter(id => id !== userId)
      });
    } else {
      await updateDoc(workoutRef, {
        likes: [...likes, userId]
      });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
}

export async function getGlobalWorkouts() {
  try {
    const q = query(
      collection(db, 'globalWorkouts'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() // Convert timestamp to Date
    }));
  } catch (error) {
    console.error('Error fetching global workouts:', error);
    throw error;
  }
}

// data/firebaseHelpers.js

// Remove the old addComment function
export async function addComment(workoutId, commentData) {
  try {
    // Validate inputs
    if (!workoutId || !commentData) {
      throw new Error('Missing required comment data');
    }

    const workoutRef = doc(db, 'globalWorkouts', workoutId);
    const workoutDoc = await getDoc(workoutRef);

    if (!workoutDoc.exists()) {
      throw new Error('Workout not found');
    }

    // Structure comment with required fields
    const comment = {
      id: Date.now().toString(),
      userId: commentData.userId,
      userDisplayName: commentData.userDisplayName,
      userPhotoURL: commentData.userPhotoURL,
      text: commentData.text,
      createdAt: new Date().toISOString()
    };

    // Update document with new comment
    await updateDoc(workoutRef, {
      comments: arrayUnion(comment)
    });

    return comment.id;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}