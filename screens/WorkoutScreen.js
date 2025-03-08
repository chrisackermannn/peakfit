import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  Alert  // Add this import
} from 'react-native';
import { Button, Card, IconButton, Surface } from 'react-native-paper';
import { getInitialExercises, searchExercises } from '../data/exerciseAPI'; // Update imports
import { saveWorkoutToProfile, saveWorkoutGlobally } from '../data/firebaseHelpers';
import { useAuth } from '../context/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CompletionModal = ({ visible, onDismiss, onSave, onPost, timer, workouts, saveLoading, postLoading }) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="slide"
    onRequestClose={onDismiss}
  >
    <View style={styles.completionModalContainer}>
      <Surface style={styles.completionModalContent}>
        <Text style={styles.completionTitle}>Workout Complete! 🎉</Text>
        
        <View style={styles.workoutSummary}>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="clock-outline" size={24} color="#007AFF" />
            <Text style={styles.summaryValue}>
              {Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}
            </Text>
            <Text style={styles.summaryLabel}>Duration</Text>
          </View>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="dumbbell" size={24} color="#007AFF" />
            <Text style={styles.summaryValue}>{workouts.length}</Text>
            <Text style={styles.summaryLabel}>Exercises</Text>
          </View>
        </View>

        <View style={styles.completionActions}>
          <Button
            mode="contained"
            onPress={onSave}
            style={[styles.completionButton, styles.saveButton]}
            loading={saveLoading}
          >
            Save to Profile
          </Button>
          <Button
            mode="contained"
            onPress={onPost}
            style={[styles.completionButton, styles.postButton]}
            loading={postLoading}
          >
            Share Workout
          </Button>
          <Button
            mode="outlined"
            onPress={onDismiss}
            style={styles.dismissButton}
            color="#007AFF"
            labelStyle={{ color: '#007AFF' }}
          >
            Dismiss
          </Button>
        </View>
      </Surface>
    </View>
  </Modal>
);

export default function WorkoutScreen() {
  const { user } = useAuth();

  const [workouts, setWorkouts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [isWorkoutStarted, setIsWorkoutStarted] = useState(false);
  const [isWorkoutEnded, setIsWorkoutEnded] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    const fetchExercises = async () => {
      setLoadingExercises(true);
      try {
        const data = await getInitialExercises(30);
        setExercises(data);
        setFilteredExercises(data);
      } catch (error) {
        console.error("Error fetching exercises:", error);
        Alert.alert("Error", "Failed to load exercises");
      } finally {
        setLoadingExercises(false);
      }
    };
    fetchExercises();
  }, []);

  useEffect(() => {
    if (isTiming) {
      timerRef.current = setInterval(() => {
        setTimer((timer) => timer + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTiming]);

  const startWorkout = () => {
    setIsWorkoutStarted(true);
    setIsTiming(true);
  };

  const endWorkout = () => {
    setIsTiming(false);
    setIsWorkoutEnded(true);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    
    // Clear any existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // If search is empty, show initial exercises
    if (!text.trim()) {
      setFilteredExercises(exercises);
      return;
    }
    
    // If search is local and quick
    const localResults = exercises.filter(exercise =>
      exercise.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredExercises(localResults);
    
    // Set timeout for API search
    const timeout = setTimeout(async () => {
      if (text.trim().length >= 2) {
        setLoadingExercises(true);
        try {
          const results = await searchExercises(text);
          if (results.length > 0) {
            setFilteredExercises(results);
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setLoadingExercises(false);
        }
      }
    }, 500);
    
    setSearchTimeout(timeout);
  };

  const selectExercise = (exercise) => {
    setSelectedExercise(exercise);
  };

  const handleEditExercise = (exercise) => {
    setEditingExercise(exercise);
    setSelectedExercise({ name: exercise.name });
    setWeight(exercise.weight.toString());
    setReps(exercise.reps.toString());
    setSets(exercise.sets.toString());
    setModalVisible(true);
  };

  const addWorkout = () => {
    if (!selectedExercise || !weight || !reps || !sets) {
      alert('Please fill in all exercise details.');
      return;
    }

    const exerciseData = {
      id: editingExercise?.id || Date.now().toString(),
      name: selectedExercise.name,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      sets: parseInt(sets),
    };

    if (editingExercise) {
      // Update existing exercise
      const updatedWorkouts = workouts.map(w => 
        w.id === editingExercise.id ? exerciseData : w
      );
      setWorkouts(updatedWorkouts);
    } else {
      // Add new exercise
      setWorkouts([...workouts, exerciseData]);
    }

    setModalVisible(false);
    setEditingExercise(null);
    setSelectedExercise('');
    setWeight('');
    setReps('');
    setSets('');
  };

  const deleteWorkout = (index) => {
    const updated = [...workouts];
    updated.splice(index, 1);
    setWorkouts(updated);
    console.log('Deleted exercise at index:', index);
  };

  const saveToProfile = async () => {
    if (!user?.uid) {
      alert('Please login to save workouts');
      return;
    }

    try {
      setSaveLoading(true);
      const workoutData = {
        date: serverTimestamp(),
        duration: timer,
        exercises: workouts,
        notes: '',
        isPublic: false
      };

      await saveWorkoutToProfile(user.uid, workoutData);
      
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.delay(1000),
        Animated.timing(fadeAnim, {
          toValue: 0, 
          duration: 500,
          useNativeDriver: true
        })
      ]).start();

      setWorkouts([]);
      setIsWorkoutStarted(false);
      setIsWorkoutEnded(false);
      setTimer(0);

    } catch (error) {
      alert('Error saving workout: ' + error.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const postWorkout = async () => {
    if (!user?.uid) {
      alert('Please login to post workouts');
      return;
    }

    try {
      setPostLoading(true);
      
      // Validate workout data
      if (!workouts.length) {
        throw new Error('Cannot share empty workout');
      }

      const workoutData = {
        date: serverTimestamp(),
        duration: timer,
        exercises: workouts,
        notes: '',
        type: 'workout',
        visibility: 'public',
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        likes: 0,
        comments: [],
        metrics: {
          totalExercises: workouts.length,
          totalSets: workouts.reduce((acc, curr) => acc + curr.sets, 0),
          totalReps: workouts.reduce((acc, curr) => acc + (curr.sets * curr.reps), 0)
        }
      };

      await saveWorkoutGlobally(workoutData);
      
      // Success animation
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.delay(1000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        })
      ]).start();

      // Reset state
      setWorkouts([]);
      setIsWorkoutStarted(false);
      setIsWorkoutEnded(false); 
      setTimer(0);

    } catch (error) {
      alert('Error sharing workout: ' + error.message);
    } finally {
      setPostLoading(false);
    }
  };

  useEffect(() => {
    console.log('Current User from AuthContext:', user);
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <Button
          mode="contained"
          onPress={() => {/* Add rest timer logic */}}
          style={styles.restTimerButton}
        >
          Rest Timer
        </Button>
      </View>

      {!isWorkoutStarted ? (
        <View style={styles.startWorkoutContainer}>
          <Surface style={styles.workoutInfoCard}>
            <Text style={styles.workoutTitle}>Start New Workout</Text>
            <TouchableOpacity onPress={startWorkout} style={styles.startButton}>
              <MaterialCommunityIcons name="dumbbell" size={32} color="#fff" />
              <Text style={styles.startButtonText}>Begin Workout</Text>
            </TouchableOpacity>
          </Surface>
        </View>
      ) : (
        <View style={styles.workoutContainer}>
          <Surface style={styles.workoutInfoCard}>
            <Text style={styles.workoutTitle}>Current Workout</Text>
            <View style={styles.workoutMetaContainer}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="timer-outline" size={24} color="#007AFF" />
                <Text style={styles.metaValue}>
                  {Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}
                </Text>
                <Text style={styles.metaLabel}>Duration</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="dumbbell" size={24} color="#007AFF" />
                <Text style={styles.metaValue}>{workouts.length}</Text>
                <Text style={styles.metaLabel}>Exercises</Text>
              </View>
            </View>
          </Surface>

          <FlatList
            data={workouts}
            keyExtractor={item => item.id}
            style={styles.exerciseList}
            renderItem={({item}) => (
              <Surface style={styles.exerciseCard}>
                <View style={styles.exerciseContent}>
                  <View style={styles.exerciseIconContainer}>
                    <View style={[styles.shape, styles.triangle]} />
                    <View style={[styles.shape, styles.square]} />
                    <View style={[styles.shape, styles.circle]} />
                  </View>
                  <View style={styles.exerciseDetails}>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <Text style={styles.exerciseStats}>
                      {item.sets}×{item.reps} | {item.weight} lbs
                    </Text>
                  </View>
                  <View style={styles.exerciseActions}>
                    <IconButton
                      icon="pencil-outline"
                      size={24}
                      color="#007AFF"
                      onPress={() => handleEditExercise(item)}
                    />
                    <IconButton
                      icon="delete-outline"
                      size={24}
                      color="#FF3B30"
                      onPress={() => deleteWorkout(index)}
                    />
                  </View>
                </View>
              </Surface>
            )}
          />

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add Exercise</Text>
          </TouchableOpacity>

          {!isWorkoutEnded && (
            <Button
              mode="contained"
              onPress={endWorkout}
              style={styles.endButton}
            >
              End Workout
            </Button>
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Surface style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Exercise</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#666"
            />
            
            {loadingExercises ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : (
              <FlatList
                data={filteredExercises}
                keyExtractor={item => item.name}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={[
                      styles.exerciseItem,
                      selectedExercise === item && styles.selectedExercise
                    ]}
                    onPress={() => selectExercise(item)}
                  >
                    <Text style={styles.exerciseItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                style={styles.exerciseList}
              />
            )}

            <View style={styles.exerciseInputs}>
              <TextInput
                style={styles.input}
                placeholder="Weight (lbs)"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                placeholderTextColor="#666"
              />
              <TextInput
                style={styles.input}
                placeholder="Reps"
                keyboardType="numeric"
                value={reps}
                onChangeText={setReps}
                placeholderTextColor="#666"
              />
              <TextInput
                style={styles.input}
                placeholder="Sets"
                keyboardType="numeric"
                value={sets}
                onChangeText={setSets}
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={addWorkout}
                style={styles.modalButton}
                contentStyle={styles.modalButtonContent}
              >
                Add Exercise
              </Button>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalCancelButton}
                color="#007AFF"
                labelStyle={{ color: '#007AFF' }}
              >
                Cancel
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>

      <CompletionModal
        visible={isWorkoutEnded}
        onDismiss={() => setIsWorkoutEnded(false)}
        onSave={saveToProfile}
        onPost={postWorkout}
        timer={timer}
        workouts={workouts}
        saveLoading={saveLoading}
        postLoading={postLoading}
      />
    </SafeAreaView>
  );
}

// styles section of WorkoutScreen.js
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  restTimerButton: {
    backgroundColor: '#e3f2fd', // Changed from #d3d3d3
    borderRadius: 12,
    paddingHorizontal: 20,
  },
  workoutContainer: {
    flex: 1,
    padding: 16,
  },
  workoutInfoCard: {
    backgroundColor: '#e3f2fd', // Changed from #d3d3d3
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    })
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  workoutMetaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metaItem: {
    alignItems: 'center',
  },
  metaIcon: {
    opacity: 0.6,
    marginBottom: 8,
  },
  metaValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  metaLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  exerciseCard: {
    backgroundColor: '#e3f2fd', // Changed from #d3d3d3
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    })
  },
  exerciseIconContainer: {
    width: 50,
    height: 50,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseIcon: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  shape: {
    width: 16,
    height: 16,
    margin: 2,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#808080',
  },
  square: {
    backgroundColor: '#808080',
  },
  circle: {
    backgroundColor: '#808080',
    borderRadius: 8,
  },
  exerciseDetails: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseStats: {
    fontSize: 15,
    color: '#666',
  },
  addButton: {
    backgroundColor: '#007AFF', // Changed from #6b5b95
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  endButton: {
    backgroundColor: '#007AFF', // Changed from #6b5b95
    borderRadius: 12,
    marginTop: 'auto',
    marginBottom: Platform.OS === 'ios' ? 16 : 0,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  exerciseList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  exerciseItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedExercise: {
    backgroundColor: '#f0f0f0',
  },
  exerciseInputs: {
    gap: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  modalActions: {
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  modalCancelButton: {
    borderColor: '#007AFF',
    borderRadius: 12,
  },
  dismissButton: {
    borderColor: '#007AFF',
  },
  completionModalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  completionModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  workoutSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  completionActions: {
    gap: 12,
  },
  completionButton: {
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  postButton: {
    backgroundColor: '#007AFF',
  },
  dismissButton: {
    borderColor: '#007AFF', // Changed from #6b5b95
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});
