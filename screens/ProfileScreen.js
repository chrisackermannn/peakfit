import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { Button, Divider, Card, IconButton } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getStats, getUserWorkouts } from '../data/firebaseHelpers';
import { format } from 'date-fns'; // You may need to install this package

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({});
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.uid) {
      loadUserData();
    } else {
      console.log("User not loaded yet.");
      setLoading(false);
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      // Load stats
      const userStats = await getStats(user.uid);
      console.log("Fetched stats:", userStats);
      if (userStats && userStats.length > 0) {
        setStats(userStats[0]);
      }
      
      // Load workouts
      const userWorkouts = await getUserWorkouts(user.uid);
      console.log("Fetched workouts:", userWorkouts);
      setWorkouts(userWorkouts || []);
      
      setError(null);
    } catch (err) {
      console.error("Error loading user data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    // Handle Firestore timestamps which might be in seconds
    const date = timestamp.toDate ? timestamp.toDate() : 
                 // Or handle date objects or timestamp values
                 (timestamp instanceof Date ? timestamp : new Date(timestamp));
    
    return format(date, 'MMM d, yyyy');
  };

  // Format workout duration from seconds to mm:ss
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading profile data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {/* Profile Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: user.photoURL || 'https://pbs.twimg.com/profile_images/1169607372651847688/XVap8w7n_400x400.jpg' }}
          style={styles.profileImage}
        />
        <Text style={styles.name}>{user.displayName || 'User'}</Text>
        <Text style={styles.bio}>Fitness Enthusiast | Strength Training | 175 lbs Goal</Text>
        <Button
          mode="contained"
          style={styles.editProfileButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          Edit Profile
        </Button>
      </View>

      <Divider style={styles.divider} />

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {stats && stats.weight ? stats.weight : '--'}
          </Text>
          <Text style={styles.statLabel}>Weight (lbs)</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{workouts.length}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {stats && stats.bodyFat ? stats.bodyFat : '--'}
          </Text>
          <Text style={styles.statLabel}>Body Fat %</Text>
        </View>
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
      <TouchableOpacity style={styles.option} onPress={logout}>
        <Text style={[styles.optionText, { color: 'red' }]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    padding: 20 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 20 
  },
  profileImage: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    marginBottom: 10 
  },
  name: { 
    fontSize: 22, 
    fontWeight: 'bold' 
  },
  bio: { 
    fontSize: 14, 
    color: '#777', 
    textAlign: 'center', 
    marginVertical: 5 
  },
  editProfileButton: { 
    marginTop: 10, 
    backgroundColor: '#007AFF' 
  },
  divider: { 
    marginVertical: 15, 
    height: 1, 
    backgroundColor: '#ddd' 
  },
  statsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginVertical: 10 
  },
  statBox: { 
    alignItems: 'center' 
  },
  statNumber: { 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  statLabel: { 
    fontSize: 14, 
    color: '#777' 
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
    backgroundColor: '#f5f5f5', 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 10, 
    alignItems: 'center' 
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
  // New styles for workouts section
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
    elevation: 2,
    borderRadius: 10
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
    backgroundColor: '#007AFF'
  }
});