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
  ActivityIndicator
} from 'react-native';
import { Button } from 'react-native-paper';
// If you have a function getExercises in your exerciseAPI file:
import { exercisesAPI, getExercises } from '../data/exerciseAPI';
import { saveWorkoutToProfile } from '../data/firebaseHelpers';
import { useAuth } from '../context/AuthContext';
// If you only rely on the subcollection approach, you need serverTimestamp if your rules require a timestamp
import { serverTimestamp } from 'firebase/firestore';

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
  const [exercises, setExercises] = useState([]); // if you want to store the fetched exercises
  const timerRef = useRef(null);

  useEffect(() => {
    fetchExercisesFromAPI();
  }, []);

  // If you only rely on the static exercisesAPI, remove this function or call it differently
  const fetchExercisesFromAPI = async () => {
    try {
      setLoadingExercises(true);
      // Attempt to call your function that fetches exercises
      const result = await getExercises();
      setExercises(result);
      setFilteredExercises([]);
    } catch (error) {
      console.error('Failed to fetch exercises:', error);
    } finally {
      setLoadingExercises(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text === '') {
      setFilteredExercises([]);
    } else {
      // Filter your local 'exercisesAPI' array
      const filtered = exercisesAPI.filter((ex) =>
        ex.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredExercises(filtered);
    }
  };

  const startWorkout = () => {
    console.log('Workout started');
    setIsWorkoutStarted(true);
    setIsWorkoutEnded(false);
    setTimer(0);
    setIsTiming(true);
    timerRef.current = setInterval(() => {
      setTimer((prevTime) => prevTime + 1);
    }, 1000);
  };

  const stopWorkout = () => {
    console.log('Workout stopped');
    setIsTiming(false);
    setIsWorkoutEnded(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const addExerciseToWorkout = () => {
    if (selectedExercise && weight && reps && sets) {
      const newItem = {
        name: selectedExercise,
        weight: parseFloat(weight),
        reps: parseInt(reps),
        sets: parseInt(sets)
      };
      setWorkouts((prev) => [...prev, newItem]);
      console.log('Added exercise to local array:', newItem);
      // Reset fields
      setModalVisible(false);
      setSearchQuery('');
      setSelectedExercise('');
      setWeight('');
      setReps('');
      setSets('');
    }
  };

  const deleteWorkoutItem = (index) => {
    const updated = workouts.filter((_, i) => i !== index);
    setWorkouts(updated);
    console.log('Deleted exercise at index:', index);
  };

  const saveWorkout = async () => {
    // Check if user is truly logged in
    if (!user || !user.uid) {
      console.log('No user is logged in; cannot save workout.');
      return;
    }
    
    // Make sure there's something to save
    if (workouts.length === 0) {
      console.log('No exercises to save. Aborting saveWorkout.');
      return;
    }
    
    try {
      // Log the actual user ID we're using
      console.log('Saving workout using actual authenticated user ID:', user.uid);
      
      // Build the object to pass to Firestore
      const workoutData = {
        date: serverTimestamp(),
        duration: timer,
        exercises: workouts,
        notes: '',
      };
  
      console.log('Attempting to save workout for user:', user.uid, workoutData);
      // Calls the subcollection approach in firebaseHelpers.js
      await saveWorkoutToProfile(user.uid, workoutData);
  
      console.log('Workout saved successfully!');
      // Reset local state
      setWorkouts([]);
      setIsWorkoutStarted(false);
      setIsWorkoutEnded(false);
      setTimer(0);
    } catch (error) {
      console.error('Error saving workout:', error);
    }
  };

  // Debug: see if we have a valid user
  useEffect(() => {
    console.log('Current User from AuthContext:', user);
  }, [user]);

  return (
    <View style={styles.container}>
      {!isWorkoutStarted ? (
        <View style={styles.startWorkoutContainer}>
          <TouchableOpacity style={styles.bigAddButton} onPress={startWorkout}>
            <Text style={styles.bigAddButtonText}>+</Text>
          </TouchableOpacity>
          <Text style={styles.startWorkoutText}>Press to Start Workout</Text>
        </View>
      ) : (
        <View style={styles.innerContainer}>
          <Text style={styles.header}>Workout Timer: {timer}s</Text>

          {!isWorkoutEnded ? (
            <>
              <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.addButtonText}>Add Exercise</Text>
              </TouchableOpacity>

              <FlatList
                data={workouts}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
                renderItem={({ item, index }) => (
                  <View style={styles.workoutItem}>
                    <Text style={styles.workoutText}>
                      {item.name} - {item.weight} lbs | {item.reps} reps | {item.sets} sets
                    </Text>
                    <View style={styles.buttonRow}>
                      <Button onPress={() => deleteWorkoutItem(index)} color="red">
                        Delete
                      </Button>
                    </View>
                  </View>
                )}
              />

              <Button
                mode="contained"
                onPress={stopWorkout}
                style={styles.endWorkoutButton}
                color="red"
              >
                End Workout
              </Button>
            </>
          ) : (
            <View style={styles.savePostContainer}>
              <Button
                mode="contained"
                onPress={saveWorkout}
                style={styles.saveButton}
              >
                Save Workout to Profile
              </Button>
            </View>
          )}
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Search for an Exercise</Text>

            <TextInput
              placeholder="Search exercises..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {loadingExercises ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : (
              <ScrollView style={styles.exerciseList}>
                {filteredExercises.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.exerciseOption}
                    onPress={() => setSelectedExercise(item.name)}
                  >
                    <Text style={styles.exerciseText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TextInput
              placeholder="Weight (lbs)"
              keyboardType="numeric"
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
            />
            <TextInput
              placeholder="Reps"
              keyboardType="numeric"
              style={styles.input}
              value={reps}
              onChangeText={setReps}
            />
            <TextInput
              placeholder="Sets"
              keyboardType="numeric"
              style={styles.input}
              value={sets}
              onChangeText={setSets}
            />

            <Button
              mode="contained"
              onPress={addExerciseToWorkout}
              style={styles.saveButton}
            >
              Save
            </Button>
            <Button onPress={() => setModalVisible(false)}>Cancel</Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ~380 lines total
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center'
  },
  startWorkoutContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  bigAddButton: {
    backgroundColor: '#007AFF',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bigAddButtonText: {
    color: 'white',
    fontSize: 50,
    fontWeight: 'bold'
  },
  startWorkoutText: {
    fontSize: 18,
    color: '#555',
    marginTop: 10
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
    width: '90%'
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  },
  workoutItem: {
    padding: 15,
    backgroundColor: '#fff',
    marginVertical: 5,
    borderRadius: 10,
    width: '100%'
  },
  workoutText: {
    fontSize: 16
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5
  },
  endWorkoutButton: {
    marginTop: 20,
    backgroundColor: 'red',
    width: '90%'
  },
  savePostContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20
  },
  saveButton: {
    backgroundColor: '#28A745',
    width: '90%'
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10
  },
  searchInput: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 10
  },
  exerciseList: {
    maxHeight: 200,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 10
  },
  exerciseOption: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
  },
  exerciseText: {
    fontSize: 16
  },
  input: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 10
  }
});
