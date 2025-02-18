import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { addStats } from '../firebaseHelpers';
import { useAuth } from '../../context/AuthContext';

export const StatsManager = () => {
  const { user } = useAuth();
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [measurements, setMeasurements] = useState({
    chest: '',
    waist: '',
    arms: '',
    legs: ''
  });

  const handleSaveStats = async () => {
    try {
      const statsData = {
        date: new Date().toISOString(),
        weight: parseFloat(weight),
        bodyFat: parseFloat(bodyFat),
        measurements: {
          chest: parseFloat(measurements.chest),
          waist: parseFloat(measurements.waist),
          arms: parseFloat(measurements.arms),
          legs: parseFloat(measurements.legs)
        }
      };

      await addStats(user.uid, statsData);
      // Reset form
      setWeight('');
      setBodyFat('');
      setMeasurements({
        chest: '',
        waist: '',
        arms: '',
        legs: ''
      });
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  };

  const updateMeasurement = (field, value) => {
    setMeasurements(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <View style={styles.container}>
      <TextInput
        label="Weight (lbs)"
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
        style={styles.input}
      />

      <TextInput
        label="Body Fat %"
        value={bodyFat}
        onChangeText={setBodyFat}
        keyboardType="numeric"
        style={styles.input}
      />

      <View style={styles.measurementsContainer}>
        <TextInput
          label="Chest (inches)"
          value={measurements.chest}
          onChangeText={(value) => updateMeasurement('chest', value)}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          label="Waist (inches)"
          value={measurements.waist}
          onChangeText={(value) => updateMeasurement('waist', value)}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          label="Arms (inches)"
          value={measurements.arms}
          onChangeText={(value) => updateMeasurement('arms', value)}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          label="Legs (inches)"
          value={measurements.legs}
          onChangeText={(value) => updateMeasurement('legs', value)}
          keyboardType="numeric"
          style={styles.input}
        />
      </View>

      <Button
        mode="contained"
        onPress={handleSaveStats}
        style={styles.saveButton}
      >
        Save Stats
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
  measurementsContainer: {
    marginTop: 8,
  },
  saveButton: {
    marginTop: 16,
  },
});