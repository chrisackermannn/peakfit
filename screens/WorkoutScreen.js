import React, { useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import { exercisesAPI } from '../data/exerciseAPI';

export default function WorkoutScreen() {
  const [workouts, setWorkouts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [isWorkoutStarted, setIsWorkoutStarted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const timerRef = useRef(null);

  // Start Workout Function (Auto-start timer)
  // ✅ Add Exercise Function (Fixing the issue)
const addWorkout = () => {
    if (selectedExercise && weight && reps && sets) {
      setWorkouts((prevWorkouts) => [
        ...prevWorkouts,
        { name: selectedExercise, weight, reps, sets },
      ]);
      setModalVisible(false);
      setSearchQuery('');
      setFilteredExercises([]); // Reset search results
      setSelectedExercise('');
      setWeight('');
      setReps('');
      setSets('');
    }
  };
  
  
  
  const startWorkout = () => {
    setIsWorkoutStarted(true);
    setIsTiming(true);
    setTimer(0);
    timerRef.current = setInterval(() => {
      setTimer((prevTime) => prevTime + 1);
    }, 1000);
  };

  // Stop Timer Function
  const stopWorkout = () => {
    setIsTiming(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Search Function (User searches for exercises)
  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text === '') {
      setFilteredExercises([]);
    } else {
      const filtered = exercisesAPI.filter((exercise) =>
        exercise.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredExercises(filtered);
    }
  };

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

          {/* Add Exercise Button */}
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.addButtonText}>Add Exercise</Text>
          </TouchableOpacity>
                    {/* Workout List */}
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
                  <Button onPress={() => { 
                    setSelectedExercise(item.name); 
                    setWeight(item.weight); 
                    setReps(item.reps); 
                    setSets(item.sets); 
                    setModalVisible(true); 
                  }}>
                    Edit
                  </Button>
                  <Button onPress={() => deleteWorkout(index)} color="red">
                    Delete
                  </Button>
                </View>
              </View>
            )}
          />

          {/* End Workout Button */}
          <Button mode="contained" onPress={stopWorkout} style={styles.endWorkoutButton} color="red">
            End Workout
          </Button>

          {/* Save/Post Workout Options */}
          {!isTiming && isWorkoutStarted && (
            <View style={styles.savePostContainer}>
              <Button mode="contained" onPress={() => console.log("Workout Saved to Profile")} style={styles.saveButton}>
                Save to Profile
              </Button>
              <Button mode="contained" onPress={() => console.log("Workout Posted")} style={styles.postButton}>
                Post Workout
              </Button>
            </View>
          )}
        </View>
      )}

      {/* Add Exercise Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Search for an Exercise</Text>

            {/* Search Input */}
            <TextInput
              placeholder="Search exercises..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearch}
            />

            {/* Exercise Search Results */}
            <ScrollView style={styles.exerciseList}>
              {filteredExercises.map((item) => (
                <TouchableOpacity key={item.id} onPress={() => setSelectedExercise(item.name)} style={styles.exerciseOption}>
                  <Text style={styles.exerciseText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Input Fields for Exercise */}
            <TextInput placeholder="Weight (lbs)" keyboardType="numeric" style={styles.input} value={weight} onChangeText={setWeight} />
            <TextInput placeholder="Reps" keyboardType="numeric" style={styles.input} value={reps} onChangeText={setReps} />
            <TextInput placeholder="Sets" keyboardType="numeric" style={styles.input} value={sets} onChangeText={setSets} />

            <Button mode="contained" onPress={addWorkout} style={styles.saveButton}>
              Save
            </Button>
            <Button onPress={() => setModalVisible(false)}>Cancel</Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4', justifyContent: 'center', alignItems: 'center', padding: 20 },
  innerContainer: { flex: 1, width: '100%', alignItems: 'center' },
  startWorkoutContainer: { justifyContent: 'center', alignItems: 'center' },
  bigAddButton: { backgroundColor: '#007AFF', width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  bigAddButtonText: { color: 'white', fontSize: 50, fontWeight: 'bold' },
  startWorkoutText: { fontSize: 18, color: '#555', marginTop: 10 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  addButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, marginTop: 10, alignItems: 'center', width: '90%' },
  addButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  workoutItem: { padding: 15, backgroundColor: '#fff', marginVertical: 5, borderRadius: 10 },
  workoutText: { fontSize: 16 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  endWorkoutButton: { marginTop: 20, backgroundColor: 'red', width: '90%' },
  savePostContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
  saveButton: { backgroundColor: '#28A745', flex: 1, marginRight: 10 },
  postButton: { backgroundColor: '#007AFF', flex: 1 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '90%', backgroundColor: 'white', padding: 20, borderRadius: 10, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  searchInput: { width: '100%', padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 5, marginBottom: 10 },
  exerciseList: { maxHeight: 200, width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 5, marginBottom: 10 },
  exerciseOption: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  exerciseText: { fontSize: 16 },
  input: { width: '100%', padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 5, marginBottom: 10 },
});

