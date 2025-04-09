// components/HealthStats.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Surface } from 'react-native-paper'; // Add this import
import HealthKitService from '../services/HealthKitService';

export default function HealthStats() {
  const [steps, setSteps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function loadHealthData() {
      // Skip on non-iOS platforms
      if (Platform.OS !== 'ios') {
        setError('Step tracking is only available on iOS devices');
        setLoading(false);
        return;
      }
      
      // Check if HealthKit is available (will be false on simulator)
      if (!HealthKitService.isAvailable) {
        setError('HealthKit is not available on this device');
        console.log('HealthKit not available - using demo data');
        setSteps(5234); // Demo step count for simulator
        setLoading(false);
        return;
      }
      
      try {
        // Try to initialize if not already initialized
        if (!HealthKitService.isInitialized) {
          try {
            await HealthKitService.initialize();
          } catch (initError) {
            console.log('Failed to initialize HealthKit in component:', initError);
            // Continue anyway to see if it works
          }
        }
        
        // Use the current date to get today's steps only
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to beginning of day
        
        const stepData = await HealthKitService.getStepCount(today);
        console.log('Today\'s step data:', stepData);
        setSteps(stepData?.value || 0);
        setError(null);
      } catch (err) {
        console.error('Error loading health data:', err);
        setError('Unable to access step data');
        setSteps(0);
      } finally {
        setLoading(false);
      }
    }
    
    loadHealthData();
    
    // App state change listener could go here to refresh when app is reopened
    // But useEffect will be called when component mounts, which happens when navigating to the screen
  }, []);
  
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.outerCard}>
        <Surface style={styles.surface}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Today's Steps</Text>
            <Text style={styles.statValue}>{steps?.toLocaleString() || '0'}</Text>
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${Math.min((steps / 10000) * 100, 100)}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.statGoal}>Goal: 10,000 steps</Text>
              </>
            )}
            {!HealthKitService.isAvailable && (
              <Text style={styles.simulatorNote}>
                Real data available on physical iOS device
              </Text>
            )}
          </View>
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  outerCard: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  surface: {
    borderRadius: 16,
  },
  statCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
  },
  statTitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  statGoal: {
    fontSize: 14,
    color: '#999',
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  simulatorNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  }
});