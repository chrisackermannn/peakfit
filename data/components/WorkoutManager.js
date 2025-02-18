import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { addWorkout, updateWorkout, deleteWorkout } from '../firebaseHelpers';
import { useAuth } from '../../context/AuthContext';

export const WorkoutManager = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddExercise = () => {
    setExercises([
      ...exercises,
      { name: '', sets: '', reps: '', weight: '' }
    ]);
  };

  const updateExercise = (index, field, value) => {
    const updatedExercises = [...exercises];
    updatedExercises[index] = {
      ...updatedExercises[index],
      [field]: value
    };
    setExercises(updatedExercises);
  };

  const handleSaveWorkout = async () => {
    try {
      const workoutData = {
        date: new Date().toISOString(),
        duration: parseInt(duration),
        exercises: exercises.map(exercise => ({
          ...exercise,
          sets: parseInt(exercise.sets),
          reps: parseInt(exercise.reps),
          weight: parseFloat(exercise.weight)
        })),
        notes
      };

      await addWorkout(user.uid, workoutData);
      // Reset form
      setExercises([]);
      setDuration('');
      setNotes('');
    } catch (error) {
      console.error('Error saving workout:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        label="Duration (minutes)"
        value={duration}
        onChangeText={setDuration}
        keyboardType="numeric"
        style={styles.input}
      />

      {exercises.map((exercise, index) => (
        <View key={index} style={styles.exerciseContainer}>
          <TextInput
            label="Exercise Name"
            value={exercise.name}
            onChangeText={(value) => updateExercise(index, 'name', value)}
            style={styles.input}
          />
          <View style={styles.row}>
            <TextInput
              label="Sets"
              value={exercise.sets}
              onChangeText={(value) => updateExercise(index, 'sets', value)}
              keyboardType="numeric"
              style={[styles.input, styles.smallInput]}
            />
            <TextInput
              label="Reps"
              value={exercise.reps}
              onChangeText={(value) => updateExercise(index, 'reps', value)}
              keyboardType="numeric"
              style={[styles.input, styles.smallInput]}
            />
            <TextInput
              label="Weight"
              value={exercise.weight}
              onChangeText={(value) => updateExercise(index, 'weight', value)}
              keyboardType="numeric"
              style={[styles.input, styles.smallInput]}
            />
          </View>
        </View>
      ))}

      <Button
        mode="outlined"
        onPress={handleAddExercise}
        style={styles.addButton}
      >
        Add Exercise
      </Button>

      <TextInput
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={styles.input}
      />

      <Button
        mode="contained"
        onPress={handleSaveWorkout}
        style={styles.saveButton}
      >
        Save Workout
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  input: {
    marginBottom: 12,
  },
  exerciseContainer: {
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  smallInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  addButton: {
    marginVertical: 12,
  },
  saveButton: {
    marginTop: 16,
  },
});