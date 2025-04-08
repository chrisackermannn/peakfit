import React, { useState, useEffect, useCallback } from 'react';
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
  Alert 
} from 'react-native';
import { Button, Divider, Card, IconButton, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getStats, getUserWorkouts } from '../data/firebaseHelpers';
import { format } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { getAuth } from 'firebase/auth';

const defaultAvatar = require('../assets/default-avatar.png');

const ProfileScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalWeight, setTotalWeight] = useState(0);
  const [badges, setBadges] = useState([]);
  const [imageKey, setImageKey] = useState(Date.now());
  const [isAdmin, setIsAdmin] = useState(false);

  // Load data on initial mount when user exists
  useEffect(() => {
    if (user?.uid) {
      loadUserData();
      checkAdminStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Check admin status directly from Firestore
  const checkAdminStatus = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsAdmin(userData.isAdmin === true);
        console.log("Admin status:", userData.isAdmin === true ? "Admin" : "Not admin");
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  }, [user?.uid]);

  // Handle navigation focus events (coming back from EditProfileScreen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.refresh || route.params?.forceRefresh) {
        if (user?.uid) {
          setImageKey(Date.now());
          loadUserData();
          checkAdminStatus();
        }
        navigation.setParams({ refresh: undefined, forceRefresh: undefined });
      }
    });
    
    return unsubscribe;
  }, [navigation, route.params, user]);

  // Define loadUserData as a useCallback to avoid recreation on each render
  const loadUserData = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      
      const [userStats, userWorkouts] = await Promise.all([
        getStats(user.uid),
        getUserWorkouts(user.uid)
      ]);

      if (userWorkouts?.length > 0) {
        setWorkouts(userWorkouts);
        const total = calculateTotalWeight(userWorkouts);
        setTotalWeight(total);

        // Calculate badges based on total weight
        const earnedBadges = calculateBadges(total);
        setBadges(earnedBadges);
      }

      if (userStats?.length > 0) {
        setStats(userStats[0]);
      }
      
      setError(null);
      setImageKey(Date.now());
      
    } catch (err) {
      console.error("Error loading user data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const calculateTotalWeight = (workouts) => {
    return workouts.reduce((total, workout) => {
      const workoutTotal = workout.exercises.reduce((subtotal, exercise) => {
        return subtotal + (exercise.weight * exercise.sets * exercise.reps);
      }, 0);
      return total + workoutTotal;
    }, 0);
  };

  // Format helpers
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : 
                (timestamp instanceof Date ? timestamp : new Date(timestamp));
    return format(date, 'MMM d, yyyy');
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserData();
    checkAdminStatus();
  }, [loadUserData, checkAdminStatus]);

  // Handler function for edit profile button
  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile', { fromProfile: true });
  }, [navigation]);
  
  // Navigate to admin dashboard
  const navigateToAdmin = useCallback(() => {
    navigation.navigate('AdminDashboard');
  }, [navigation]);

  // Navigate to workout history
  const navigateToWorkoutHistory = useCallback(() => {
    navigation.navigate('WorkoutHistory');
  }, [navigation]);

  // Navigate to friends
  const navigateToFriends = useCallback(() => {
    navigation.navigate('Friends');
  }, [navigation]);

  const logout = () => {
    const auth = getAuth();
    
    // Show confirmation dialog
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: async () => {
            try {
              await auth.signOut();
              
              // Navigate to LoginScreen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error("Error signing out: ", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          }
        }
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Render a workout item
  const renderWorkoutItem = (item, index) => (
    <TouchableOpacity 
      style={styles.workoutItem}
      key={item.id || index}
      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
    >
      <View style={styles.workoutHeader}>
        <MaterialCommunityIcons name="calendar" size={16} color="#999" />
        <Text style={styles.workoutDate}>{formatDate(item.date)}</Text>
      </View>
      
      <View style={styles.workoutDetails}>
        <View style={styles.workoutStatsRow}>
          <View style={styles.workoutStat}>
            <MaterialCommunityIcons name="timer-outline" size={16} color="#3B82F6" />
            <Text style={styles.workoutStatText}>
              {formatDuration(item.duration)}
            </Text>
          </View>
          
          <View style={styles.workoutStat}>
            <MaterialCommunityIcons name="dumbbell" size={16} color="#3B82F6" />
            <Text style={styles.workoutStatText}>
              {item.exercises.length} exercises
            </Text>
          </View>
        </View>
        
        {item.exercises.slice(0, 2).map((exercise, exIndex) => (
          <Text key={`${item.id}-ex-${exIndex}`} style={styles.exerciseItem}>
            • {exercise.name}: {exercise.sets}×{exercise.reps} @ {exercise.weight}lbs
          </Text>
        ))}
        
        {item.exercises.length > 2 && (
          <Text style={styles.moreExercises}>
            +{item.exercises.length - 2} more exercises
          </Text>
        )}
      </View>
      
      <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#3B82F6']}
        />
      }
    >
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {/* Profile Header */}
      <Surface style={styles.shadowCard}>
        <View style={styles.headerCard}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handleEditProfile}
            >
              <Image
                source={user?.photoURL ? { uri: user.photoURL + '?t=' + imageKey } : defaultAvatar}
                style={styles.profileImage}
                defaultSource={defaultAvatar}
                key={`profile-image-${imageKey}`} 
              />
              <View style={styles.editBadge}>
                <MaterialCommunityIcons name="pencil" size={14} color="#FFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.userInfo}>
              <Text style={styles.name}>{user?.displayName || user?.username || 'Anonymous'}</Text>
              <Text style={styles.bio} numberOfLines={3}>{user?.bio || 'No bio yet'}</Text>
              <Button
                mode="outlined"
                onPress={handleEditProfile}
                style={styles.editButton}
                labelStyle={{ color: '#3B82F6' }}
                color="#3B82F6"
              >
                Edit Profile
              </Button>
            </View>
          </View>
        </View>
      </Surface>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <Surface style={styles.shadowCard}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="dumbbell" size={28} color="#3B82F6" />
            <Text style={styles.statNumber}>{workouts.length}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
        </Surface>
        
        <Surface style={styles.shadowCard}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="weight" size={28} color="#3B82F6" />
            <Text style={styles.statNumber}>{Math.floor(totalWeight).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Weight</Text>
          </View>
        </Surface>
        
        <Surface style={styles.shadowCard}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="trophy" size={28} color="#3B82F6" />
            <Text style={styles.statNumber}>{badges.length}</Text>
            <Text style={styles.statLabel}>Badges</Text>
          </View>
        </Surface>
      </View>

      {/* Recent Workouts Section */}
      <Surface style={styles.shadowCard}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            <TouchableOpacity onPress={navigateToWorkoutHistory}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {workouts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="dumbbell" size={40} color="#666" />
              <Text style={styles.emptyStateText}>No workouts yet</Text>
              <Button 
                mode="contained" 
                onPress={() => navigation.navigate('Workout')}
                style={styles.actionButton}
              >
                Start a Workout
              </Button>
            </View>
          ) : (
            // Manually render workout items instead of using FlatList
            <View>
              {workouts.slice(0, 3).map((workout, index) => renderWorkoutItem(workout, index))}
            </View>
          )}
        </View>
      </Surface>

      {/* Settings Section */}
      <Surface style={styles.shadowCard}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          {/* Friends Button */}
          <TouchableOpacity 
            style={styles.option}
            onPress={navigateToFriends}
          >
            <View style={styles.optionContent}>
              <MaterialCommunityIcons name="account-group" size={24} color="#3B82F6" />
              <Text style={styles.optionText}>Friends</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.option}
            onPress={handleEditProfile}
          >
            <View style={styles.optionContent}>
              <MaterialCommunityIcons name="account-edit" size={24} color="#3B82F6" />
              <Text style={styles.optionText}>Edit Profile</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
          
          {/* Admin Dashboard Button - Only shown if user is admin */}
          {isAdmin && (
            <TouchableOpacity 
              style={styles.option}
              onPress={navigateToAdmin}
            >
              <View style={styles.optionContent}>
                <MaterialCommunityIcons name="shield-account" size={24} color="#3B82F6" />
                <Text style={styles.optionText}>Admin Dashboard</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.option}
            onPress={logout}
          >
            <View style={styles.optionContent}>
              <MaterialCommunityIcons name="logout" size={24} color="#FF3B30" />
              <Text style={[styles.optionText, { color: '#FF3B30' }]}>Logout</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </Surface>
    </ScrollView>
  );
};

// Add badge calculation helper function
function calculateBadges(totalWeight) {
  const badges = [];
  
  // Simple badge logic based on total weight lifted
  if (totalWeight >= 1000) badges.push({ id: '1k', name: '1K Club' });
  if (totalWeight >= 10000) badges.push({ id: '10k', name: '10K Club' });
  if (totalWeight >= 50000) badges.push({ id: '50k', name: '50K Club' });
  if (totalWeight >= 100000) badges.push({ id: '100k', name: '100K Club' });
  
  return badges;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  
  // Shadow card for iOS compatibility
  shadowCard: {
    borderRadius: 16,
    marginBottom: 16,
    // Remove overflow here to fix the shadow issue
  },
  
  // Profile header
  headerCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    // Content inside Surface wrapped in View
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  editBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  bio: {
    fontSize: 15,
    color: '#999',
    marginBottom: 12,
    lineHeight: 20,
  },
  editButton: {
    borderColor: '#3B82F6',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  
  // Stats section
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 16,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  
  // Section cards
  sectionCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Workout list
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyStateText: {
    color: '#999',
    fontSize: 16,
    marginVertical: 12,
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    marginTop: 16,
    borderRadius: 8,
  },
  workoutItem: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutDate: {
    fontSize: 14,
    color: '#999',
    marginLeft: 6,
  },
  workoutDetails: {
    flex: 1,
  },
  workoutStatsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  workoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  workoutStatText: {
    color: '#CCC',
    fontSize: 14,
    marginLeft: 4,
  },
  exerciseItem: {
    color: '#DDD',
    fontSize: 14,
    marginBottom: 4,
  },
  moreExercises: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  
  // Options
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
});

export default ProfileScreen;