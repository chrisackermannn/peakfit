import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { Button, Divider, Card, IconButton, Avatar } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getStats, getUserWorkouts } from '../data/firebaseHelpers';
import { format } from 'date-fns';

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
      console.log("Screen focused, checking for refresh params");
      
      if (route.params?.refresh || route.params?.forceRefresh) {
        console.log("Refresh parameter detected, reloading data");
        
        if (user?.uid) {
          // Force image update by changing key
          setImageKey(Date.now());
          // Load user data from firestore
          loadUserData();
        }
        
        // Clear the parameters to prevent unnecessary refreshes
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
      // Update image key to force re-render of image component
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
        <ActivityIndicator size="large" color="#007AFF" />
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
          colors={['#007AFF']}
        />
      }
    >
      {error && <Text style={styles.errorText}>{error}</Text>}
      
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
            <IconButton icon="pencil" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.userInfo}>
          <Text style={styles.name}>{user?.displayName || user?.username || 'Anonymous'}</Text>
          <Text style={styles.bio} numberOfLines={3}>{user?.bio || 'No bio yet'}</Text>
          <Button
            mode="outlined"
            onPress={handleEditProfile}
            style={styles.editButton}
            labelStyle={{ color: '#007AFF' }}
            color="#007AFF"
          >
            Edit Profile
          </Button>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{workouts.length}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </Card>
        
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>
            {totalWeight.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Total lbs Lifted</Text>
        </Card>
        
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{badges.length}</Text>
          <Text style={styles.statLabel}>Badges Earned</Text>
        </Card>
      </View>

      <Divider style={styles.divider} />

      {/* Measurements Section */}
      {stats && stats.measurements && (
        <View style={styles.measurementsContainer}>
          <Text style={styles.sectionTitle}>Body Measurements</Text>
          <View style={styles.measurementsGrid}>
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
            <View style={styles.measurementBox}>
              <Text style={styles.measurementValue}>
                {stats.measurements.legs || '--'}"
              </Text>
              <Text style={styles.measurementLabel}>Legs</Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent Workouts Section */}
      <Divider style={styles.divider} />
      <View style={styles.workoutsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('WorkoutHistory')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {workouts.length === 0 ? (
          <View style={styles.emptyWorkouts}>
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
              <Card style={styles.workoutCard}>
                <Card.Content>
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
                      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
                      color="#007AFF"
                    />
                  </View>
                  
                  <View style={styles.exercisesList}>
                    {item.exercises.slice(0, 2).map((exercise, index) => (
                      <Text key={index} style={styles.exerciseItem}>
                        • {exercise.name}: {exercise.sets} sets × {exercise.reps} reps @ {exercise.weight} lbs
                      </Text>
                    ))}
                    {item.exercises.length > 2 && (
                      <Text style={styles.moreExercises}>
                        +{item.exercises.length - 2} more exercises
                      </Text>
                    )}
                  </View>
                </Card.Content>
              </Card>
            )}
          />
        )}
      </View>

      <Divider style={styles.divider} />

      {/* Settings Section */}
      <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('AccountSettings')}>
        <Text style={styles.optionText}>Account Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('PrivacySettings')}>
        <Text style={styles.optionText}>Privacy Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('Login')}>
        <Text style={[styles.optionText, { color: 'red' }]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// Add badge calculation helper
const calculateBadges = (totalWeight) => {
  const badges = [];
  
  if (totalWeight >= 1000) badges.push({ id: '1k', name: '1,000 lbs Club' });
  if (totalWeight >= 10000) badges.push({ id: '10k', name: '10,000 lbs Club' });
  if (totalWeight >= 100000) badges.push({ id: '100k', name: '100,000 lbs Club' });
  
  return badges;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e3f2fd',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    })
  },
  editBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bio: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    lineHeight: 22,
  },
  editButton: {
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  editButtonLabel: {
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    })
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  divider: { 
    marginVertical: 15, 
    height: 1, 
    backgroundColor: '#ddd' 
  },
  measurementsContainer: { 
    marginVertical: 10 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 10 
  },
  measurementsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  measurementBox: {
    width: '48%', 
    backgroundColor: '#e3f2fd',
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10, 
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    })
  },
  measurementValue: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  measurementLabel: { 
    fontSize: 14, 
    color: '#777', 
    marginTop: 5 
  },
  option: { 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ddd' 
  },
  optionText: { 
    fontSize: 16 
  },
  errorText: { 
    color: 'red', 
    textAlign: 'center', 
    marginBottom: 10 
  },
  // Workout section styles
  workoutsContainer: {
    marginVertical: 10
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  seeAllText: {
    color: '#007AFF',
    fontSize: 16
  },
  workoutCard: {
    marginBottom: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    elevation: 2,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  workoutDate: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  workoutDuration: {
    fontSize: 14,
    color: '#666',
    marginTop: 3
  },
  exercisesList: {
    marginTop: 10
  },
  exerciseItem: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333'
  },
  moreExercises: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 5
  },
  emptyWorkouts: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 10
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
    marginBottom: 15
  },
  startWorkoutButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProfileScreen;