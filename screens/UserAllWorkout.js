import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Image,
  StatusBar,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { getUserWorkouts } from '../data/firebaseHelpers';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const defaultAvatar = require('../assets/default-avatar.png');

export default function UserAllWorkout({ route, navigation }) {
  const { userId, userName } = route.params;
  const insets = useSafeAreaInsets();
  
  const [workouts, setWorkouts] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Hide the default header
    navigation.setOptions({
      headerShown: false
    });
    
    loadData();
  }, [userId]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get user details
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
      
      // Get all workouts
      const userWorkouts = await getUserWorkouts(userId);
      setWorkouts(userWorkouts);
    } catch (err) {
      console.error('Error loading workouts:', err);
      setError('Failed to load workout data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };
  
  const handleWorkoutPress = (workout) => {
    navigation.navigate('EachWorkout', { 
      workout, 
      userId,
      userName: userProfile?.displayName || userProfile?.username || userName
    });
  };
  
  const renderWorkoutCard = ({ item }) => {
    // Format timestamp
    const date = item.date ? (item.date.toDate ? item.date.toDate() : new Date(item.date)) : new Date();
    
    return (
      <TouchableOpacity 
        style={styles.workoutCard}
        onPress={() => handleWorkoutPress(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#1A1A1A', '#121212']}
          style={styles.workoutGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.workoutHeader}>
            <View style={styles.workoutDate}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.dateCircle}
              >
                <Text style={styles.dateDay}>{format(date, 'd')}</Text>
                <Text style={styles.dateMonth}>{format(date, 'MMM')}</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.workoutInfo}>
              <Text style={styles.workoutTitle}>{item.title || "Workout"}</Text>
              <Text style={styles.workoutDuration}>
                {item.duration ? `${Math.floor(item.duration / 60)} min ${item.duration % 60}s` : 'No duration'}
              </Text>
            </View>
          </View>
          
          <View style={styles.workoutStats}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="dumbbell" size={16} color="#60A5FA" />
              <Text style={styles.statValue}>
                {item.exercises?.length || 0}
              </Text>
              <Text style={styles.statLabel}>Exercises</Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="repeat" size={16} color="#34D399" />
              <Text style={styles.statValue}>
                {item.exercises?.reduce((acc, ex) => acc + (ex.sets || 0), 0) || 0}
              </Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="weight" size={16} color="#FACC15" />
              <Text style={styles.statValue}>
                {item.totalWeight 
                  ? `${Math.floor(item.totalWeight).toLocaleString()}`
                  : item.exercises?.reduce(
                      (acc, ex) => acc + ((ex.weight || 0) * (ex.sets || 0) * (ex.reps || 0)), 
                      0
                    ).toLocaleString() || '0'
                }
              </Text>
              <Text style={styles.statLabel}>Volume</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };
  
  return (
    <LinearGradient
      colors={['#0A0A0A', '#121212']}
      style={[styles.container, { paddingTop: insets.top }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {userProfile?.displayName || userProfile?.username || userName || 'User'}'s Workouts
          </Text>
          <Text style={styles.workoutCount}>
            {workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'}
          </Text>
        </View>
        
        <View style={styles.placeholder} />
      </View>
      
      {/* Workouts List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          renderItem={renderWorkoutCard}
          contentContainerStyle={styles.workoutsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
              colors={["#3B82F6"]}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="dumbbell" size={60} color="#374151" />
              <Text style={styles.emptyText}>No workouts found</Text>
            </View>
          }
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  workoutCount: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  
  // Workouts list
  workoutsList: {
    padding: 16,
    paddingBottom: 40,
  },
  workoutCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  workoutGradient: {
    padding: 16,
    borderRadius: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  workoutDate: {
    marginRight: 16,
  },
  dateCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateMonth: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  workoutDuration: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  workoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  
  // State components
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F87171',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
});