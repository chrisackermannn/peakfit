import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
TouchableOpacity, 
ScrollView, 
FlatList, 
ActivityIndicator, 
Platform, 
RefreshControl 
} from 'react-native';
import { Button, Divider, Card, IconButton, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getStats, getUserWorkouts } from '../data/firebaseHelpers';
import { format } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const defaultAvatar = require('../assets/default-avatar.png');

const ProfileScreen = ({ navigation, route }) => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({});
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalWeight, setTotalWeight] = useState(0);
  const [badges, setBadges] = useState([]);
  const [imageKey, setImageKey] = useState(Date.now());

  // Load data on initial mount when user exists
  useEffect(() => {
    if (user?.uid) {
      loadUserData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Handle navigation focus events (coming back from EditProfileScreen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.refresh || route.params?.forceRefresh) {
        if (user?.uid) {
          setImageKey(Date.now());
          loadUserData();
        }
        navigation.setParams({ refresh: undefined, forceRefresh: undefined });
      }
    });
    
    return unsubscribe;
  }, [navigation, route.params]);

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
  }, [loadUserData]);

  // Handler function for edit profile button
  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile', { fromProfile: true });
  }, [navigation]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

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
      <Surface style={styles.headerCard}>
        <View style={{ overflow: 'hidden' }}>
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
        <Surface style={styles.statCard}>
          <View style={{ overflow: 'hidden' }}>
            <MaterialCommunityIcons name="dumbbell" size={28} color="#3B82F6" />
            <Text style={styles.statNumber}>{workouts.length}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
        </Surface>
        
        <Surface style={styles.statCard}>
          <View style={{ overflow: 'hidden' }}>
            <MaterialCommunityIcons name="weight-lifter" size={28} color="#3B82F6" />
            <Text style={styles.statNumber}>
              {totalWeight.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total lbs</Text>
          </View>
        </Surface>
        
        <Surface style={styles.statCard}>
          <View style={{ overflow: 'hidden' }}>
            <MaterialCommunityIcons name="trophy" size={28} color="#3B82F6" />
            <Text style={styles.statNumber}>{badges.length}</Text>
            <Text style={styles.statLabel}>Badges</Text>
          </View>
        </Surface>
      </View>

      {/* Measurements Section (if available) */}
      {stats && stats.measurements && (
        <Surface style={styles.sectionCard}>
          <View style={{ overflow: 'hidden' }}>
            <Text style={styles.sectionTitle}>Body Measurements</Text>
            <View style={styles.measurementsGrid}>
              <View style={styles.measurementBox}>
                <Text style={styles.measurementValue}>
                  {stats.measurements.weight || '--'}
                </Text>
                <Text style={styles.measurementLabel}>Weight (lbs)</Text>
              </View>
              <View style={styles.measurementBox}>
                <Text style={styles.measurementValue}>
                  {stats.measurements.chest || '--'}"
                </Text>
                <Text style={styles.measurementLabel}>Chest</Text>
              </View>
              <View style={styles.measurementBox}>
                <Text style={styles.measurementValue}>
                  {stats.measurements.waist || '--'}"
                </Text>
                <Text style={styles.measurementLabel}>Waist</Text>
              </View>
              <View style={styles.measurementBox}>
                <Text style={styles.measurementValue}>
                  {stats.measurements.arms || '--'}"
                </Text>
                <Text style={styles.measurementLabel}>Arms</Text>
              </View>
            </View>
          </View>
        </Surface>
      )}

      {/* Recent Workouts Section */}
      <Surface style={styles.sectionCard}>
        <View style={{ overflow: 'hidden' }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Workout')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {workouts.length === 0 ? (
            <View style={styles.emptyWorkouts}>
              <MaterialCommunityIcons name="dumbbell" size={48} color="#666" />
              <Text style={styles.emptyText}>No workouts yet</Text>
              <Button 
                mode="contained" 
                onPress={() => navigation.navigate('Workout')}
                style={styles.startWorkoutButton}
              >
                Start a Workout
              </Button>
            </View>
          ) : (
            <FlatList
              data={workouts.slice(0, 3)} // Show only the 3 most recent workouts
              keyExtractor={(item) => item.id}
              scrollEnabled={false} // Prevent nested scrolling
              renderItem={({ item }) => (
                <Surface style={styles.workoutCard}>
                  <View style={styles.workoutCardContent}>
                    <View style={styles.workoutHeader}>
                      <View>
                        <Text style={styles.workoutDate}>{formatDate(item.date)}</Text>
                        <Text style={styles.workoutDuration}>
                          {formatDuration(item.duration)} • {item.exercises.length} exercises
                        </Text>
                      </View>
                      <IconButton 
                        icon="chevron-right" 
                        size={24}
                        onPress={() => navigation.navigate('Workout')}
                        color="#3B82F6"
                      />
                    </View>
                    
                    <View style={styles.exercisesList}>
                      {item.exercises.slice(0, 2).map((exercise, index) => (
                        <Text key={index} style={styles.exerciseItem}>
                          • {exercise.name}: {exercise.sets} × {exercise.reps} @ {exercise.weight} lbs
                        </Text>
                      ))}
                      {item.exercises.length > 2 && (
                        <Text style={styles.moreExercises}>
                          +{item.exercises.length - 2} more exercises
                        </Text>
                      )}
                    </View>
                  </View>
                </Surface>
              )}
            />
          )}
        </View>
      </Surface>

      {/* Settings Section */}
      <Surface style={styles.sectionCard}>
        <View style={{ overflow: 'hidden' }}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity 
            style={styles.option}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.optionContent}>
              <MaterialCommunityIcons name="account-edit" size={24} color="#3B82F6" />
              <Text style={styles.optionText}>Edit Profile</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.option}
            onPress={logout}
          >
            <View style={styles.optionContent}>
              <MaterialCommunityIcons name="logout" size={24} color="#FF3B30" />
              <Text style={[styles.optionText, { color: '#FF3B30' }]}>Log Out</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </Surface>
    </ScrollView>
  );
};

// Add badge calculation helper
function calculateBadges(totalWeight) {
  const badges = [];
  
  if (totalWeight >= 1000) badges.push({ id: 'weight-1000', name: '1,000 lbs Club' });
  if (totalWeight >= 10000) badges.push({ id: 'weight-10000', name: '10,000 lbs Club' });
  if (totalWeight >= 100000) badges.push({ id: 'weight-100000', name: '100,000 lbs Club' });
  
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
  // Profile header
  headerCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    borderWidth: 2,
    borderColor: '#141414',
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#3B82F6',
    fontSize: 16,
  },
  
  // Measurements section
  measurementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  measurementBox: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  measurementValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  measurementLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 6,
  },
  
  // Workouts section
  workoutCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  workoutCardContent: {
    padding: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  workoutDuration: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  exercisesList: {
    marginTop: 12,
  },
  exerciseItem: {
    fontSize: 14,
    color: '#CCC',
    marginBottom: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#3B82F6',
  },
  moreExercises: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 6,
  },
  emptyWorkouts: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginVertical: 12,
  },
  startWorkoutButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    marginTop: 8,
  },
  
  // Settings section
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#FFF',
  },
  
  // General
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
});

export default ProfileScreen;