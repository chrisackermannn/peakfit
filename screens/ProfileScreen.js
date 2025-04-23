import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Platform, 
  RefreshControl,
  Animated,
  Dimensions,
  StatusBar
} from 'react-native';
import { Button, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getStats, getUserWorkouts, getUserFriends } from '../data/firebaseHelpers';
import { format } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Badge as BadgeComponent, getCurrentChallenge } from '../components/Badge';
import { 
  getUserBadges, 
  ensureUserHasFounderBadge, 
  getUserChallengeProgress, 
  countUserLegExercises 
} from '../services/BadgeTracker'; // Import additional BadgeTracker functions

const { width } = Dimensions.get('window');
const defaultAvatar = require('../assets/default-avatar.png');

// Custom BlurComponent
const BlurComponent = ({ intensity, style, children }) => {
  if (Platform.OS === 'ios') {
    try {
      return (
        <View style={[style, { overflow: 'hidden' }]}>
          <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={StyleSheet.absoluteFill}>
            {children}
          </View>
        </View>
      );
    } catch (e) {
      console.log('BlurView error', e);
    }
  }
  
  return (
    <View style={[style, { backgroundColor: 'rgba(10, 10, 10, 0.9)' }]}>
      {children}
    </View>
  );
};

// Workout Item Component
const WorkoutItem = memo(({ workout, onPress }) => {
  // Format date
  const date = workout.date ? 
    (workout.date.toDate ? workout.date.toDate() : new Date(workout.date)) : 
    new Date();
  
  return (
    <TouchableOpacity 
      style={styles.workoutCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#1A1A1A', '#121212']} // Darker theme
        style={styles.workoutGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.workoutDateContainer}>
          <View style={styles.dateCircle}>
            <Text style={styles.dateDay}>{format(date, 'd')}</Text>
            <Text style={styles.dateMonth}>{format(date, 'MMM')}</Text>
          </View>
          <View style={styles.workoutDetails}>
            <Text style={styles.workoutTime}>{workout.name || "Workout"}</Text>
            <Text style={styles.workoutDuration}>
              {workout.duration ? `${Math.floor(workout.duration / 60)}m ${(workout.duration % 60)}s` : '00:00'} • {format(date, 'h:mm a')}
            </Text>
          </View>
        </View>
        
        <View style={styles.workoutMetrics}>
          <View style={styles.workoutMetric}>
            <Text style={styles.metricValue}>{workout.exercises?.length || 0}</Text>
            <Text style={styles.metricLabel}>Exercises</Text>
          </View>
          
          <View style={styles.workoutMetric}>
            <Text style={styles.metricValue}>
              {workout.exercises?.reduce((total, item) => total + (item.sets || 0), 0) || 0}
            </Text>
            <Text style={styles.metricLabel}>Sets</Text>
          </View>
          
          <View style={styles.workoutMetric}>
            <Text style={styles.metricValue}>
              {(workout.exercises?.reduce((total, item) => 
                total + ((item.weight || 0) * (item.sets || 0) * (item.reps || 0)), 0) || 0).toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Volume</Text>
          </View>
        </View>
        
        <View style={styles.workoutExercisesPreview}>
          {workout.exercises?.slice(0, 3).map((exercise, i) => (
            <Text key={i} style={styles.exercisePreview} numberOfLines={1}>
              • {exercise.name}
            </Text>
          ))}
          {workout.exercises?.length > 3 && (
            <Text style={styles.moreExercises}>+{workout.exercises.length - 3} more</Text>
          )}
        </View>
        
        <View style={styles.viewWorkoutButton}>
          <Text style={styles.viewWorkoutText}>View Details</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color="#3B82F6" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

// Friends preview component
const FriendsPreview = memo(({ friends, onPress }) => {
  if (!friends || friends.length === 0) {
    return (
      <TouchableOpacity style={styles.friendsEmptyState} onPress={onPress}>
        <MaterialCommunityIcons name="account-multiple-plus" size={24} color="#3B82F6" />
        <Text style={styles.friendsEmptyText}>Add Friends</Text>
      </TouchableOpacity>
    );
  }
  
  return (
    <TouchableOpacity style={styles.friendsPreviewContainer} onPress={onPress}>
      <View style={styles.friendsAvatars}>
        {friends.slice(0, 3).map((friend, index) => (
          <Image 
            key={friend.id || index}
            source={friend.photoURL ? { uri: friend.photoURL } : defaultAvatar}
            style={[
              styles.friendAvatar,
              { marginLeft: index > 0 ? -10 : 0, zIndex: 3-index }
            ]}
          />
        ))}
        {friends.length > 3 && (
          <View style={styles.extraFriendsCircle}>
            <Text style={styles.extraFriendsText}>+{friends.length - 3}</Text>
          </View>
        )}
      </View>
      <View style={styles.friendsTextContainer}>
        <Text style={styles.friendsCount}>{friends.length}</Text>
        <Text style={styles.friendsLabel}>Friends</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#666" />
    </TouchableOpacity>
  );
});

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [workouts, setWorkouts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalWeight, setTotalWeight] = useState(0);
  const [topExercise, setTopExercise] = useState(null);
  const [badges, setBadges] = useState([]);
  const [imageKey, setImageKey] = useState(Date.now());
  const [isAdmin, setIsAdmin] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 240; // Increased from 220 to give more space
  const headerScaleInterpolate = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.1, 1],
    extrapolate: 'clamp'
  });
  
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, headerHeight/2, headerHeight],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp'
  });
  
  const titleOpacity = scrollY.interpolate({
    inputRange: [headerHeight/2, headerHeight],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });
  
  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setIsAdmin(userDoc.data()?.isAdmin === true);
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
        }
      }
    };
    
    checkAdmin();
  }, [user?.uid]);
  
  // Helper function to find the most common exercise
  const findTopExercise = (workouts) => {
    if (!workouts || workouts.length === 0) {
      return { name: 'None', count: 0 };
    }
    
    const exerciseCounts = {};
    workouts.forEach(workout => {
      workout.exercises?.forEach(exercise => {
        if (!exercise.name) return;
        
        const name = exercise.name;
        exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;
      });
    });
    
    let topName = 'None';
    let topCount = 0;
    
    Object.entries(exerciseCounts).forEach(([name, count]) => {
      if (count > topCount) {
        topName = name;
        topCount = count;
      }
    });
    
    return { name: topName, count: topCount };
  };
  
  // Load user data on mount and on params change
  useEffect(() => {
    // Refresh profile when coming back from edit profile
    const unsubscribe = navigation.addListener('focus', () => {
      // Only refresh if timestamp param exists and is different from last time
      const params = navigation.getState().routes.find(r => r.name === 'Profile')?.params;
      if (params?.forceRefresh) {
        setRefreshing(true);
        loadUserData();
        // Reset params
        navigation.setParams({ forceRefresh: undefined, timestamp: undefined });
      }
    });
    
    loadUserData();
    return unsubscribe;
  }, [navigation]);
  
  // Load user data function
  const loadUserData = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      // Ensure user has founder badge (automatically adds it if not present)
      await ensureUserHasFounderBadge(user.uid);

      // Get user workout data
      const userWorkouts = await getUserWorkouts(user.uid);
      setWorkouts(userWorkouts);
      
      // Get friends
      const userFriends = await getUserFriends(user.uid);
      setFriends(userFriends || []);
      
      // Calculate total weight
      let totalLiftedWeight = 0;
      userWorkouts.forEach(workout => {
        workout.exercises?.forEach(exercise => {
          totalLiftedWeight += (Number(exercise.weight) || 0) * (Number(exercise.sets) || 0) * (Number(exercise.reps) || 0);
        });
      });
      setTotalWeight(totalLiftedWeight);
      
      // Find top exercise
      const topExerciseData = findTopExercise(userWorkouts);
      setTopExercise(topExerciseData);
      
      // Load user badges from Firestore
      const userBadges = await getUserBadges(user.uid);
      setBadges(userBadges || []);
      
      // Check admin status
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().isAdmin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
      
    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserData();
  }, []);
  
  // Navigation handlers
  const navigateToWorkoutHistory = () => {
    navigation.navigate('UserAllWorkout', {
      userId: user.uid,
      userName: user.displayName || user.username || 'User'
    });
  };
  const navigateToSettings = () => navigation.navigate('Settings');
  const navigateToEditProfile = () => navigation.navigate('EditProfile');
  const navigateToAdmin = () => {
    console.log('Admin button pressed - navigating to AdminDashboard');
    navigation.navigate('AdminDashboard'); // Changed from AdminScreen to AdminDashboard
  };
  const navigateToFriends = () => navigation.navigate('Friends');
  
  // Navigation to workout detail with proper parameters
  const navigateToWorkoutDetail = workout => {
    navigation.navigate('EachWorkout', { 
      workout, 
      userId: user.uid,
      userName: user.displayName || 'User'
    });
  };
  
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Animated header with profile info */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: headerOpacity,
            transform: [{ scale: headerScaleInterpolate }],
            paddingTop: insets.top,
          }
        ]}
      >
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']} // Darker theme
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTopRow}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity 
                style={styles.settingsButton}
                onPress={navigateToEditProfile}
              >
                <MaterialCommunityIcons name="cog" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <Image 
                  key={imageKey} // Force refresh when image changes
                  source={user?.photoURL ? { uri: `${user.photoURL}?${imageKey}` } : defaultAvatar}
                  style={styles.profileImage} 
                  defaultSource={defaultAvatar}
                />
                
                {/* Admin badge indicator - make sure this is visible */}
                {isAdmin && (
                  <View style={styles.adminBadgeCircle}>
                    <MaterialCommunityIcons name="shield-check" size={12} color="#FFF" />
                  </View>
                )}
              </View>
              
              <View style={styles.nameSection}>
                <View style={styles.nameRow}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {user?.displayName || 'User'}
                  </Text>
                </View>
                
                <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
                  @{user?.email?.split('@')[0] || 'username'}
                </Text>
                
                <View style={styles.profileButtons}>
                  {/* Admin button - show only for admins */}
                  {isAdmin && (
                    <TouchableOpacity 
                      style={styles.adminButton}
                      onPress={() => {
                        console.log('Admin button pressed - navigating to AdminScreen');
                        console.log('Current admin status:', isAdmin);
                        navigateToAdmin();
                      }}
                    >
                      <Text style={styles.adminButtonText}>Admin</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
      
      {/* Sticky title that appears on scroll */}
      <Animated.View 
        style={[
          styles.stickyHeader, 
          { 
            opacity: titleOpacity,
            paddingTop: insets.top,
          }
        ]}
      >
        <BlurComponent intensity={80} style={styles.blurView}>
          <View style={styles.stickyHeaderContent}>
            <Text style={styles.stickyTitle}>{user?.displayName || 'Profile'}</Text>
            
            {/* Make sure this appears for admins */}
            {isAdmin && (
              <View style={styles.stickyAdminBadge}>
                <Text style={styles.stickyAdminText}>ADMIN</Text>
              </View>
            )}
          </View>
        </BlurComponent>
      </Animated.View>
      
      {/* Main Content */}
      <Animated.ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Spacer for header */}
        <View style={{ height: headerHeight }} />
        
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {/* Workout count card */}
          <View style={styles.statCard}>
            <LinearGradient
              colors={['#111827', '#1F2937']} // Darker theme
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="dumbbell" size={24} color="#60A5FA" />
              <Text style={styles.statNumber}>{workouts.length}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </LinearGradient>
          </View>
          
          {/* Total weight card */}
          <View style={styles.statCard}>
            <LinearGradient
              colors={['#1E3A8A', '#2563EB']} // Darker theme
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="weight" size={24} color="#FACC15" />
              <Text style={styles.statNumber}>{Math.floor(totalWeight).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Weight</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.statCard}>
            <LinearGradient
              colors={['#1E1B4B', '#312E81']} // Darker theme
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="crown" size={24} color="#C4B5FD" />
              <Text 
                style={styles.topExerciseName}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {topExercise?.name === 'None' ? '-' : topExercise?.name}
              </Text>
              <Text style={styles.statLabel}>Top Exercise</Text>
            </LinearGradient>
          </View>
        </View>
        
        {/* Friends & Badges Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Friends & Achievements</Text>
          </View>
          
          {/* Friends Preview Card */}
          <FriendsPreview friends={friends} onPress={navigateToFriends} />
          
          {/* Badges Section */}
          <View style={styles.badgesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Badges Earned</Text>
            </View>
            
            {badges.length > 0 ? (
              <View style={styles.badgesContainer}>
                {badges.map((badge) => (
                  <BadgeComponent key={badge.id} badge={badge} size="medium" />
                ))}
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.noBadgesContainer}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Workout')}
              >
                <MaterialCommunityIcons name="trophy-outline" size={32} color="#475569" />
                <Text style={styles.noBadgesText}>Complete challenges to earn badges</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Workouts Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            
            {workouts.length > 0 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={navigateToWorkoutHistory}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {workouts.length === 0 ? (
            <View style={styles.emptyWorkoutsContainer}>
              <MaterialCommunityIcons name="dumbbell" size={48} color="#374151" />
              <Text style={styles.emptyWorkoutsText}>No workouts yet</Text>
              <TouchableOpacity 
                style={styles.startWorkoutButton}
                onPress={() => navigation.navigate('Workout')}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.startWorkoutText}>Start a Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {workouts.slice(0, 3).map((workout) => (
                <WorkoutItem 
                  key={workout.id} 
                  workout={workout} 
                  onPress={() => navigateToWorkoutDetail(workout)} 
                />
              ))}
              
              {workouts.length > 3 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={navigateToWorkoutHistory}
                >
                  <Text style={styles.showMoreText}>Show More Workouts</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        
        {/* Bottom padding for safe scrolling */}
        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Darker background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Header styles - Fixed overlapping issue
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 240, // Increased to match headerHeight
    zIndex: 10,
    overflow: 'hidden',
  },
  headerGradient: {
    flex: 1,
    padding: 20,
    paddingBottom: 30, // More bottom padding (increased from 24)
  },
  headerContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10, // Reduced from 25 to move profile section up
    marginTop: 10, // Add top margin instead of pushing down
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Better alignment
    marginTop: 0, // Remove top margin to move up
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 80, // Slightly larger
    height: 80, // Slightly larger
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  adminBadgeCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6', // Changed from red to blue
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0A',
    zIndex: 5, // Ensure it appears on top
  },
  nameSection: {
    flex: 1,
    marginLeft: 16,
    paddingTop: 0, // Remove top padding to move everything up
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 20, // Slightly bigger font
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  username: {
    fontSize: 15,
    color: '#94A3B8',
    marginVertical: 4,
    width: '100%', // Ensure it takes full width
    maxWidth: '90%', // But leave some room on the side
    ellipsizeMode: 'tail',
  },
  profileButtons: {
    flexDirection: 'row',
    marginTop: 15, // Increased from 10 to provide more vertical space
    gap: 8, // Gap between buttons
  },
  editProfileButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingVertical: 8, // More padding for larger touch target
    paddingHorizontal: 12,
    marginRight: 8,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminButton: {
    backgroundColor: '#3B82F6', // Blue color for admin button 
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  adminButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Sticky header styles
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  blurView: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  stickyHeaderContent: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  stickyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  stickyAdminBadge: {
    backgroundColor: '#3B82F6', // Changed from red to blue
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  stickyAdminText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Scroll view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  
  // Stats cards
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statGradient: {
    padding: 16,
    borderRadius: 16, // Match card borderRadius
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1.1, // Slightly taller than width
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center', // Center the text
    maxWidth: 100, // Prevent long text from overflowing
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CBD5E0',
  },
  topExerciseName: {
    fontSize: 14, // Smaller font size to fit longer text
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 4,
    flexWrap: 'wrap', // Allow text to wrap to next line if needed
  },
  
  // Section containers
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    marginVertical: 10,
  },
  viewAllButton: {},
  viewAllText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Friends styles
  friendsPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  friendsEmptyState: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  friendsEmptyText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  friendsAvatars: {
    flexDirection: 'row',
    marginRight: 16,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A', // Darker background for empty avatar
    borderWidth: 2,
    borderColor: '#121212',
  },
  extraFriendsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -10,
    zIndex: 0,
    borderWidth: 2,
    borderColor: '#121212',
  },
  extraFriendsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  friendsTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  friendsCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  friendsLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  
  // Badges styles
  badgesSection: {
    marginTop: 10, // Less top margin since it's within another section
    paddingHorizontal: 0, // Remove any extra padding that might cause misalignment
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 12,
    justifyContent: 'flex-start',
  },
  noBadgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  noBadgesText: {
    color: '#94A3B8',
    fontSize: 15,
    marginLeft: 12,
  },
  
  // Workout card styles
  workoutCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  workoutGradient: {
    padding: 16,
  },
  workoutDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateDay: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateMonth: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: -2,
  },
  workoutDetails: {
    flex: 1,
  },
  workoutTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  workoutDuration: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  workoutMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  workoutMetric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  workoutExercisesPreview: {
    marginBottom: 12,
  },
  exercisePreview: {
    fontSize: 14,
    color: '#E2E8F0',
    marginBottom: 4,
  },
  moreExercises: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  viewWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  viewWorkoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginRight: 4,
  },
  
  // Empty workouts state
  emptyWorkoutsContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
  },
  emptyWorkoutsText: {
    color: '#94A3B8',
    fontSize: 16,
    marginVertical: 12,
  },
  startWorkoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  gradientButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
  },
  startWorkoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  showMoreButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  showMoreText: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ProfileScreen;
