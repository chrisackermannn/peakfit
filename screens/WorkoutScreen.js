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
  Animated
} from 'react-native';
import { Button, Card, IconButton } from 'react-native-paper';
import { exercisesAPI, getExercises } from '../data/exerciseAPI';
import { saveWorkoutToProfile, saveWorkoutGlobally } from '../data/firebaseHelpers';
import { useAuth } from '../context/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

  useEffect(() => {
    let isMounted = true;
    const loadExercises = async () => {
      setLoadingExercises(true);
      try {
        const exerciseList = await getExercises();
        if (isMounted) {
          setExercises(exerciseList);
          setFilteredExercises(exerciseList);
        }
      } catch (error) {
        console.error('Error fetching exercises:', error);
      } finally {
        if (isMounted) {
          setLoadingExercises(false);
        }
      }
    };
    loadExercises();
    return () => { isMounted = false; }
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
    const filtered = exercises.filter(exercise =>
      exercise.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredExercises(filtered);
  };

  const selectExercise = (exercise) => {
    setSelectedExercise(exercise);
  };

  const addWorkout = () => {
    if (!selectedExercise || !weight || !reps || !sets) {
      alert('Please fill in all exercise details.');
      return;
    }
    const newWorkout = {
      id: Date.now().toString(),
      name: selectedExercise.name,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      sets: parseInt(sets),
    };
    setWorkouts([...workouts, newWorkout]);
    setModalVisible(false);
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
    <View style={styles.container}>
      {!isWorkoutStarted ? (
        <View style={styles.startWorkoutContainer}>
          <TouchableOpacity 
            style={styles.bigAddButton}
            onPress={startWorkout}
          >
            <MaterialCommunityIcons name="dumbbell" size={48} color="white" />
          </TouchableOpacity>
          <Text style={styles.startWorkoutText}>Start Workout</Text>
        </View>
      ) : (
        <View style={styles.innerContainer}>
          <Card style={styles.timerCard}>
            <Card.Content>
              <Text style={styles.timerText}>{Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}</Text>
            </Card.Content>
          </Card>

          {!isWorkoutEnded ? (
            <>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setModalVisible(true)}
              >
                <MaterialCommunityIcons name="plus" size={24} color="white" />
                <Text style={styles.addButtonText}>Add Exercise</Text>
              </TouchableOpacity>

              <FlatList
                data={workouts}
                keyExtractor={item => item.id}
                renderItem={({item, index}) => (
                  <Card style={styles.exerciseCard}>
                    <Card.Content style={styles.exerciseContent}>
                      <View>
                        <Text style={styles.exerciseName}>{item.name}</Text>
                        <Text style={styles.exerciseDetails}>
                          {item.sets} sets × {item.reps} reps @ {item.weight} lbs
                        </Text>
                      </View>
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => deleteWorkout(index)}
                      />
                    </Card.Content>
                  </Card>
                )}
              />

              <Button
                mode="contained"
                onPress={endWorkout}
                style={styles.endButton}
                labelStyle={styles.buttonLabel}
              >
                End Workout
              </Button>
            </>
          ) : (
            <View style={styles.endWorkoutContainer}>
              <Card style={styles.summaryCard}>
                <Card.Content>
                  <Text style={styles.summaryTitle}>Workout Summary</Text>
                  <Text style={styles.summaryText}>
                    Duration: {Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}
                  </Text>
                  <Text style={styles.summaryText}>
                    Exercises: {workouts.length}
                  </Text>
                </Card.Content>
              </Card>

              <View style={styles.actionButtons}>
                <Button
                  mode="contained"
                  onPress={saveToProfile}
                  loading={saveLoading}
                  style={[styles.actionButton, styles.saveButton]}
                  labelStyle={styles.buttonLabel}
                >
                  Save to Profile
                </Button>
                
                <Button
                  mode="contained"
                  onPress={postWorkout}
                  loading={postLoading}
                  style={[styles.actionButton, styles.postButton]}
                  labelStyle={styles.buttonLabel}
                >
                  Share Workout
                </Button>
              </View>

              <Animated.View 
                style={[
                  styles.successMessage,
                  {opacity: fadeAnim}
                ]}
              >
                <Text style={styles.successText}>
                  Workout saved successfully!
                </Text>
              </Animated.View>
            </View>
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
          <Card style={styles.modalCard}>
            <Card.Title title="Add Exercise" />
            <Card.Content>
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                value={searchQuery}
                onChangeText={handleSearch}
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
                />
                <TextInput 
                  style={styles.input}
                  placeholder="Reps"
                  keyboardType="numeric"
                  value={reps}
                  onChangeText={setReps}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Sets"
                  keyboardType="numeric"
                  value={sets}
                  onChangeText={setSets}
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  mode="contained"
                  onPress={addWorkout}
                  style={styles.modalButton}
                >
                  Add Exercise
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setModalVisible(false)}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  startWorkoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigAddButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  startWorkoutText: {
    fontSize: 20,
    color: '#666',
    fontWeight: '500',
  },
  timerCard: {
    marginBottom: 16,
    elevation: 2,
  },
  timerText: {
    fontSize: 48,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#007AFF',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 2,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  exerciseCard: {
    marginBottom: 8,
    elevation: 1,
  },
  exerciseContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
  },
  exerciseDetails: {
    color: '#666',
    marginTop: 4,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  postButton: {
    backgroundColor: '#2196F3',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  modalCard: {
    elevation: 5,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  exerciseList: {
    maxHeight: 200,
  },
  exerciseItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedExercise: {
    backgroundColor: '#e3f2fd',
  },
  exerciseItemText: {
    fontSize: 16,
  },
  exerciseInputs: {
    marginVertical: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  successMessage: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    margin: 16,
  },
  successText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
