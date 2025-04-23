// services/BadgeTracker.js
import { db } from '../Firebase/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getCurrentChallenge } from '../components/Badge';

export const getUserChallengeProgress = async (userId) => {
  try {
    if (!userId) return { progress: 0, earned: false };
    
    const userDoc = await getDoc(doc(db, 'users', userId, 'challenges', getCurrentChallenge().id));
    
    if (!userDoc.exists()) {
      // Initialize challenge if it doesn't exist
      await setDoc(doc(db, 'users', userId, 'challenges', getCurrentChallenge().id), {
        progress: 0,
        earned: false,
        target: getCurrentChallenge().target,
        startedAt: new Date().toISOString()
      });
      return { progress: 0, earned: false };
    }
    
    return userDoc.data();
  } catch (error) {
    console.error("Error getting challenge progress:", error);
    return { progress: 0, earned: false };
  }
};

export const getUserBadges = async (userId) => {
  try {
    if (!userId) return [];
    
    const badgesRef = collection(db, 'users', userId, 'badges');
    const badgesSnap = await getDocs(badgesRef);
    
    if (badgesSnap.empty) {
      return [];
    }
    
    const badges = badgesSnap.docs.map(doc => {
      const data = doc.data();
      
      // Map badge IDs to their local images
      const badgeImageMap = {
        'april-2025': require('../assets/badges/leg-master.png'),
        'may-2025': require('../assets/badges/arm-champion.png'),
        'founder': require('../assets/badges/founders.png'),
        'first-workout': null,
        '5-workouts': null,
        '10-workouts': null,
        '1000-lb': null,
      };
      
      return {
        id: doc.id,
        ...data,
        // Use the local image if available, otherwise keep whatever is in the data
        image: badgeImageMap[doc.id] || data.image,
        // Make sure we have an icon if no image is available
        icon: !badgeImageMap[doc.id] && !data.image ? (data.icon || 'trophy') : data.icon,
        // Ensure there's a color
        color: data.color || '#FFD700',
        earnedAt: data.earnedAt || new Date().toISOString()
      };
    });
    
    // Sort by earned date, most recent first
    badges.sort((a, b) => {
      return new Date(b.earnedAt) - new Date(a.earnedAt);
    });
    
    return badges;
  } catch (error) {
    console.error("Error getting user badges:", error);
    return [];
  }
};

export const countUserLegExercises = async (userId) => {
  try {
    if (!userId) return 0;
    
    // Get current month's start/end dates
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    
    // Query user workouts from the current month
    const workoutsRef = collection(db, 'users', userId, 'workouts');
    const workoutsSnap = await getDocs(workoutsRef);
    
    // Count all leg exercises
    let legExerciseCount = 0;
    
    // List of leg exercise keywords (case-insensitive)
    const legExerciseKeywords = [
      'squat', 'lunge', 'deadlift', 'leg', 'calf', 'hamstring', 'quad', 
      'glute', 'hip thrust', 'leg press', 'leg extension', 'leg curl'
    ];
    
    workoutsSnap.docs.forEach(doc => {
      const workout = doc.data();
      
      // Skip if workout is not from this month
      const workoutDate = workout.date?.toDate ? workout.date.toDate() : new Date(workout.date);
      if (workoutDate < startOfMonth || workoutDate > endOfMonth) return;
      
      // Check each exercise to see if it's a leg exercise
      workout.exercises?.forEach(exercise => {
        const exerciseName = exercise.name?.toLowerCase() || '';
        if (legExerciseKeywords.some(keyword => exerciseName.includes(keyword))) {
          // Count each exercise as 1
          legExerciseCount++;
        }
      });
    });
    
    return legExerciseCount;
  } catch (error) {
    console.error("Error counting leg exercises:", error);
    return 0;
  }
};

// Ensure user has founder badge
export const ensureUserHasFounderBadge = async (userId) => {
  if (!userId) return;
  
  try {
    // Check if user already has the founder badge
    const badgeRef = doc(db, 'users', userId, 'badges', 'founder');
    const badgeDoc = await getDoc(badgeRef);
    
    // If badge doesn't exist, add it
    if (!badgeDoc.exists()) {
      // Import the badge definition
      const { SPECIAL_BADGES, saveBadgeToFirebase } = require('../components/Badge');
      
      // Save the badge
      await saveBadgeToFirebase(userId, SPECIAL_BADGES.founder);
      console.log(`Founder badge awarded to user: ${userId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error ensuring founder badge:', error);
    return false;
  }
};