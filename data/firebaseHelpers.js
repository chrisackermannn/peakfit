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
    
    // Ensure required fields are present
    if (!workoutData.exercises || !Array.isArray(workoutData.exercises)) {
      workoutData.exercises = [];
    }
    
    // Calculate total weight if not provided
    if (!workoutData.totalWeight || typeof workoutData.totalWeight !== 'number') {
      let totalWeight = 0;
      
      if (Array.isArray(workoutData.exercises)) {
        workoutData.exercises.forEach(exercise => {
          // Use the simplified exercise format from WorkoutScreen
          const weight = Number(exercise.weight) || 0;
          const sets = Number(exercise.sets) || 0;
          const reps = Number(exercise.reps) || 0;
          totalWeight += weight * sets * reps;
        });
      }
      
      workoutData.totalWeight = totalWeight > 0 ? totalWeight : 1;
    }
    
    // Create a unique ID for the workout
    const customDocId = `${workoutData.userId}_${Date.now()}`;
    
    // Prepare data for Firestore
    const docData = {
      ...workoutData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      likes: [],
      comments: []
    };
    
    // Save to global workouts collection
    const globalWorkoutsRef = doc(db, 'globalWorkouts', customDocId);
    await setDoc(globalWorkoutsRef, docData);
    
    // Also save a copy to the user's personal workouts
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
    // Log the operation for debugging
    console.log(`Toggling like for workout ${workoutId} by user ${userId}`);
    
    const workoutRef = doc(db, 'globalWorkouts', workoutId);
    
    // First get the current document
    const workoutDoc = await getDoc(workoutRef);
    
    if (!workoutDoc.exists()) {
      throw new Error('Workout not found');
    }
    
    const data = workoutDoc.data();
    const likes = data.likes || [];
    
    // Log current likes for debugging
    console.log('Current likes:', likes);
    
    if (likes.includes(userId)) {
      // Remove user from likes array
      console.log(`Removing like: ${userId} from ${workoutId}`);
      await updateDoc(workoutRef, {
        likes: likes.filter(id => id !== userId),
        updatedAt: serverTimestamp() // Critical for security rules
      });
    } else {
      // Add user to likes array
      console.log(`Adding like: ${userId} to ${workoutId}`);
      await updateDoc(workoutRef, {
        likes: [...likes, userId],
        updatedAt: serverTimestamp() // Critical for security rules
      });
    }
    
    return true;
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

    // Update document with new comment and set updatedAt timestamp
    await updateDoc(workoutRef, {
      comments: arrayUnion(comment),
      updatedAt: serverTimestamp() // This is critical for security rules
    });

    return comment.id;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

/**
 * ========================================
 * =          TEMPLATES LOGIC            =
 * ========================================
 */

/**
 * Save a workout template
 */
export async function saveTemplate(userId, templateData) {
  try {
    if (!userId) throw new Error('User ID is required');
    if (!templateData.exercises || !templateData.name) {
      throw new Error('Template must include exercises array and name');
    }
    
    const templatesRef = collection(db, 'users', userId, 'templates');
    const docData = {
      ...templateData,
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(templatesRef, docData);
    console.log(`Template saved: users/${userId}/templates/${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
}

/**
 * Get user's saved templates
 */
export async function getUserTemplates(userId) {
  try {
    if (!userId) throw new Error('User ID is required');
    
    const templatesRef = collection(db, 'users', userId, 'templates');
    const q = query(templatesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }));
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(userId, templateId) {
  try {
    if (!userId || !templateId) throw new Error('User ID and Template ID are required');
    
    const templateRef = doc(db, 'users', userId, 'templates', templateId);
    await deleteDoc(templateRef);
    console.log(`Template deleted: users/${userId}/templates/${templateId}`);
    return true;
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

/**
 * ========================================
 * =           FRIENDS LOGIC            =
 * ========================================
 */

/**
 * Get user's friends with their data
 */
export async function getUserFriends(userId) {
  try {
    if (!userId) throw new Error('User ID is required');
    
    // First, get the user document with friends array
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) throw new Error('User not found');
    
    const userData = userDoc.data();
    const friendIds = userData.friends || [];
    
    // If no friends, return empty array
    if (friendIds.length === 0) return [];
    
    // Get each friend's data
    const friendsPromises = friendIds.map(friendId => 
      getDoc(doc(db, 'users', friendId))
    );
    
    const friendDocs = await Promise.all(friendsPromises);
    
    // Map to array of friend data objects
    const friendsData = friendDocs
      .filter(doc => doc.exists()) // Only include existing docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Sanitize data (don't include sensitive fields)
        email: undefined
      }));
    
    return friendsData;
  } catch (error) {
    console.error('Error getting user friends:', error);
    throw error;
  }
}

/**
 * Enhanced search users function that includes username similarity
 * Only returns users that exist in the database
 */
export async function searchUsers(searchQuery) {
  try {
    if (!searchQuery || searchQuery.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }
    
    // Search case insensitive
    const queryText = searchQuery.toLowerCase();
    
    // Search by username prefix - this only returns existing users in Firebase
    const exactRef = query(
      collection(db, 'users'),
      where('username', '>=', queryText),
      where('username', '<=', queryText + '\uf8ff'), // Unicode range trick for prefix search
      limit(10)
    );
    
    const snapshot = await getDocs(exactRef);
    
    // This will only include users that actually exist in the database
    // because Firestore's query only returns documents that match the criteria
    const results = snapshot.docs
      .filter(doc => doc.exists()) // Extra safety check to ensure document exists
      .map(doc => {
        const data = doc.data();
        
        // Only return if they have required fields
        if (!data.username) {
          return null;
        }
        
        return {
          id: doc.id,
          username: data.username,
          displayName: data.displayName || data.username,
          photoURL: data.photoURL || null,
          bio: data.bio || null,
          // Explicitly exclude sensitive fields
          email: undefined,
          phoneNumber: undefined,
          password: undefined
        };
      })
      .filter(Boolean); // Remove any null entries
    
    return results;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}