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
  Dimensions
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
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';

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
    } catch (error) {
      console.log("BlurView error:", error);
      return (
        <View style={[style, { backgroundColor: 'rgba(15, 15, 15, 0.9)' }]}>
          {children}
        </View>
      );
    }
  } else {
    // For Android, use a regular View with semi-transparent background
    return (
      <View style={[style, { backgroundColor: 'rgba(15, 15, 15, 0.9)' }]}>
        {children}
      </View>
    );
  }
};

// Memoized workout item for better performance
const WorkoutItem = memo(({ workout, onPress }) => {
  const date = workout.date ? new Date(workout.date.seconds * 1000) : new Date();
  
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
            <Text style={styles.workoutTime}>{format(date, 'h:mm a')}</Text>
            <Text style={styles.workoutDuration}>
              {workout.duration ? `${Math.floor(workout.duration / 60)}m ${(workout.duration % 60)}s` : '00:00'}
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
              {workout.exercises?.reduce((total, item) => total + item.sets, 0) || 0}
            </Text>
            <Text style={styles.metricLabel}>Sets</Text>
          </View>
          
          <View style={styles.workoutMetric}>
            <Text style={styles.metricValue}>
              {workout.exercises?.reduce((total, item) => total + (item.weight * item.sets * item.reps), 0).toLocaleString() || 0}
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

// Badge component
const Badge = memo(({ badge }) => {
  const colors = {
    gold: ['#FFD700', '#B8860B'],
    silver: ['#C0C0C0', '#A9A9A9'],
    bronze: ['#CD7F32', '#8B4513'],
    blue: ['#3B82F6', '#1D4ED8']
  };
  
  let badgeColors;
  
  switch(badge.id) {
    case 'first-workout':
      badgeColors = colors.bronze;
      break;
    case '5-workouts':
      badgeColors = colors.silver;
      break;
    case '10-workouts':
      badgeColors = colors.gold;
      break;
    case '1000-lb':
      badgeColors = colors.blue;
      break;
    default:
      badgeColors = colors.blue;
  }
  
  return (
    <View style={styles.badgeContainer}>
      <LinearGradient 
        colors={badgeColors} 
        style={styles.badgeCircle}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
      >
        <MaterialCommunityIcons name={badge.icon} size={20} color="#FFF" />
      </LinearGradient>
      <Text style={styles.badgeName}>{badge.name}</Text>
    </View>
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

  // Load data on initial mount when user exists
  useEffect(() => {
    if (user?.uid) {
      loadUserData();
      checkAdminStatus();
    }
  }, [user?.uid]);

  // Check if user is admin
  const checkAdminStatus = async () => {
    try {
      console.log('Checking admin status for user:', user.uid);
      
      // Check in admin collection
      const adminRef = doc(db, 'admin', 'users');
      const adminDoc = await getDoc(adminRef);
      
      // Also check in users collection for isAdmin flag
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      const isAdminInAdminCollection = adminDoc.exists() && 
        adminDoc.data().list?.includes(user.uid);
      
      const isAdminInUserCollection = userDoc.exists() && 
        userDoc.data().isAdmin === true;
      
      // Set admin status if either check passes
      const adminStatus = isAdminInAdminCollection || isAdminInUserCollection;
      
      console.log('Admin status check results:');
      console.log('- In admin collection:', isAdminInAdminCollection);
      console.log('- In user document:', isAdminInUserCollection);
      console.log('- Final admin status:', adminStatus);
      
      setIsAdmin(adminStatus);
      
      // If admin status is true, log additional confirmation
      if (adminStatus) {
        console.log('✅ User is confirmed as an admin');
      } else {
        console.log('❌ User is not an admin');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  // Add this useEffect to check admin status when the screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.uid) {
        console.log('ProfileScreen focused - verifying admin status');
        checkAdminStatus();
      }
    });

    return unsubscribe;
  }, [navigation, user?.uid]);

  // Load user data (stats, workouts)
  const loadUserData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get stats
      const userStats = await getStats(user.uid);
      setStats(userStats);
      
      // Get workouts - limit to 10 for performance
      const userWorkouts = await getUserWorkouts(user.uid, 10);
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
      
      // Calculate badges
      const badgesList = [];
      
      // First workout badge
      if (userWorkouts.length >= 1) {
        badgesList.push({
          id: 'first-workout',
          name: 'First Workout',
          icon: 'trophy',
          color: '#FFD700'
        });
      }
      
      // 5 workouts badge
      if (userWorkouts.length >= 5) {
        badgesList.push({
          id: '5-workouts',
          name: '5 Workouts',
          icon: 'medal',
          color: '#C0C0C0'
        });
      }
      
      // 10 workouts badge
      if (userWorkouts.length >= 10) {
        badgesList.push({
          id: '10-workouts',
          name: '10 Workouts',
          icon: 'medal',
          color: '#CD7F32'
        });
      }
      
      // 1000 lb club
      if (totalLiftedWeight >= 1000) {
        badgesList.push({
          id: '1000-lb',
          name: '1000 lb Club',
          icon: 'weight',
          color: '#FFD700'
        });
      }
      
      setBadges(badgesList);
      
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
  const navigateToWorkoutHistory = () => navigation.navigate('WorkoutHistory');
  const navigateToSettings = () => navigation.navigate('Settings');
  const navigateToEditProfile = () => navigation.navigate('EditProfile');
  const navigateToAdmin = () => {
    console.log('Navigating to Admin Dashboard');
    navigation.navigate('AdminDashboard'); // Change from 'Admin' to 'AdminDashboard'
  };
  const navigateToFriends = () => navigation.navigate('Friends');
  const navigateToWorkoutDetail = workout => navigation.navigate('WorkoutDetail', { workout });
  
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
                        console.log('Admin button pressed - navigating to Admin screen');
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
                <Text style={styles.stickyAdminText}>Admin</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={navigateToSettings}
            >
              <MaterialCommunityIcons name="cog" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </BlurComponent>
      </Animated.View>
      
      {/* Main scroll content */}
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#3B82F6"
            colors={["#3B82F6"]}
            progressViewOffset={headerHeight}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Top padding to account for header */}
        <View style={{ height: headerHeight + 10 }} />
        
        {/* Bio section if available */}
        {stats?.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{stats.bio}</Text>
          </View>
        )}
        
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <LinearGradient
              colors={['#111827', '#1E293B']} // Darker theme
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="dumbbell" size={24} color="#60A5FA" />
              <Text style={styles.statNumber}>{workouts.length}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.statCard}>
            <LinearGradient
              colors={['#1C1917', '#292524']} // Darker theme
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
              <MaterialCommunityIcons name="fire" size={24} color="#C4B5FD" />
              <Text style={styles.statNumber}>{Math.round(totalWeight / 10)}</Text>
              <Text style={styles.statLabel}>Calories</Text>
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
          
          {/* Badges Cards */}
          {badges.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Badges Earned</Text>
              <View style={styles.badgesContainer}>
                {badges.map((badge) => (
                  <Badge key={badge.id} badge={badge} />
                ))}
              </View>
            </>
          )}
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Main content styles
  scrollContainer: {
    flexGrow: 1,
  },
  bioSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  bioText: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  
  // Stats styles
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 12, 
    alignItems: 'center',
    height: 90,
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#CBD5E0',
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderStyle: 'dashed',
    gap: 10,
  },
  friendsEmptyText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  friendsAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#121212',
  },
  extraFriendsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -10,
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
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 6,
  },
  badgeContainer: {
    alignItems: 'center',
    width: (width - 80) / 4,
    marginBottom: 12,
  },
  badgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeName: {
    fontSize: 12,
    color: '#E2E8F0',
    textAlign: 'center',
    paddingHorizontal: 2,
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  workoutDuration: {
    fontSize: 13,
    color: '#94A3B8',
  },
  workoutMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    marginVertical: 12,
  },
  workoutMetric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  workoutExercisesPreview: {
    marginBottom: 12,
  },
  exercisePreview: {
    fontSize: 14,
    color: '#E2E8F0',
    marginBottom: 3,
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
