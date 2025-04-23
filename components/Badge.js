// components/Badge.js
import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, setDoc, getDoc, collection } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';

// Helper function to darken color for gradient
const shadeColor = (color, percent) => {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);

  R = (R < 255) ? R : 255;
  G = (G < 255) ? G : 255;
  B = (B < 255) ? B : 255;

  const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
  const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
  const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

  return "#" + RR + GG + BB;
};

// Badge definitions - each month has its own challenge
export const MONTHLY_CHALLENGES = {
  4: { // April (month index is 0-based, so April is 3+1)
    id: 'april-2025',
    name: 'April Leg Master',
    description: 'Complete 32 leg exercises in April',
    icon: 'leg-muscle',
    color: '#10B981', // Green
    target: 32,
    type: 'legExercises',
    image: require('../assets/badges/leg-master.png'),
  },
  5: { // May
    id: 'may-2025',
    name: 'May Arm Champion', 
    description: 'Complete 40 arm exercises in May',
    icon: 'arm-flex',
    color: '#3B82F6', // Blue
    target: 40,
    type: 'armExercises',
    image: require('../assets/badges/arm-champion.png'),
  },
  // Add more months as needed
};

// Special badges - not tied to monthly challenges
export const SPECIAL_BADGES = {
  founder: {
    id: 'founder',
    name: 'Founder',
    description: 'Early adopter of PeakFit',
    icon: 'crown',
    color: '#FFFFFF', // white
    image: require('../assets/badges/founders.png'),
  }
};

// Get current month's challenge
export const getCurrentChallenge = () => {
  const currentMonth = new Date().getMonth() + 1; // 1-12
  return MONTHLY_CHALLENGES[currentMonth] || MONTHLY_CHALLENGES[4]; // Default to April if no challenge for current month
};

// Save earned badge to Firebase
export const saveBadgeToFirebase = async (userId, badge) => {
  if (!userId || !badge) return false;
  
  try {
    // Create reference to the specific badge document
    const badgeRef = doc(db, 'users', userId, 'badges', badge.id);
    
    // Check if badge already exists to avoid duplicates
    const badgeDoc = await getDoc(badgeRef);
    
    if (!badgeDoc.exists()) {
      // Save badge data with earned timestamp
      await setDoc(badgeRef, {
        ...badge,
        earnedAt: new Date().toISOString()
      });
      console.log(`Badge ${badge.id} saved for user ${userId}`);
      return true;
    } else {
      // Badge already exists
      console.log(`Badge ${badge.id} already earned by user ${userId}`);
      return false;
    }
  } catch (error) {
    console.error('Error saving badge:', error);
    return false;
  }
};

// Award founder badge to user
export const awardFounderBadge = async (userId) => {
  if (!userId) return false;

  try {
    const badge = SPECIAL_BADGES.founder;
    return await saveBadgeToFirebase(userId, badge);
  } catch (error) {
    console.error('Error awarding founder badge:', error);
    return false;
  }
};

// Check and award challenge badge if user meets requirements
export const checkAndAwardBadge = async (userId, progress, challengeTarget) => {
  // If user has met or exceeded the target
  if (progress >= challengeTarget) {
    const currentChallenge = getCurrentChallenge();
    
    // Prepare badge data to save
    const badge = {
      id: currentChallenge.id,
      name: currentChallenge.name,
      description: currentChallenge.description,
      icon: currentChallenge.icon,
      color: currentChallenge.color,
      type: currentChallenge.type,
      // Include image path if available
      imagePath: currentChallenge.image ? `badges/${currentChallenge.id}` : null
    };
    
    // Save badge to user's collection in Firebase
    const saved = await saveBadgeToFirebase(userId, badge);
    return saved;
  }
  
  return false;
};

// Badge component for displaying earned badges
export const Badge = ({ badge, size = 'medium' }) => {
  const sizeStyles = {
    small: { container: 44, icon: 20, fontSize: 10 },
    medium: { container: 70, icon: 32, fontSize: 12 },
    large: { container: 100, icon: 44, fontSize: 14 },
  };
  
  const dimensions = sizeStyles[size] || sizeStyles.medium;
  
  return (
    <View style={styles.badgeContainer}>
      <LinearGradient 
        colors={[badge.color, shadeColor(badge.color, -20)]} 
        style={[
          styles.badgeCircle,
          { 
            width: dimensions.container, 
            height: dimensions.container,
            borderRadius: dimensions.container / 2
          }
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {badge.image ? (
          <Image 
            source={badge.image} 
            style={{ 
              width: dimensions.icon * 1.5, 
              height: dimensions.icon * 1.5 
            }}
            resizeMode="contain"
          />
        ) : (
          <MaterialCommunityIcons 
            name={badge.icon || 'trophy'} 
            size={dimensions.icon} 
            color="#FFFFFF" 
          />
        )}
      </LinearGradient>
      
      <Text style={[
        styles.badgeName, 
        { fontSize: dimensions.fontSize }
      ]} numberOfLines={2}>
        {badge.name}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  badgeCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  badgeName: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 100,
  }
});