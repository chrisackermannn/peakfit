import AppleHealthKit from 'react-native-health';
import { Platform, NativeModules } from 'react-native';

// Debug what permissions are available
console.log('AppleHealthKit available:', !!AppleHealthKit);
if (AppleHealthKit && AppleHealthKit.Constants) {
  console.log('Available permissions:', Object.keys(AppleHealthKit.Constants.Permissions || {}));
}

const PERMS = AppleHealthKit.Constants?.Permissions || {};

// Configure the health kit options
const healthKitOptions = {
  permissions: {
    read: [
      PERMS.Steps,
      PERMS.StepCount,
      PERMS.ActiveEnergyBurned,
      PERMS.Workout,
      PERMS.Weight,
      PERMS.HeartRate,
    ].filter(Boolean), // Filter out any undefined values
    write: [
      PERMS.Workout,
      PERMS.Steps,
      PERMS.Weight,
      PERMS.ActiveEnergyBurned,
    ].filter(Boolean), // Filter out any undefined values
  },
};

// Check if running on iOS simulator
const isSimulator = Platform.OS === 'ios' && NativeModules.RNDeviceInfo?.isEmulator;

class HealthKitService {
  // Check if HealthKit is available
  static get isAvailable() {
    return (
      Platform.OS === 'ios' && 
      !isSimulator &&
      typeof AppleHealthKit?.initHealthKit === 'function'
    );
  }
  
  static isInitialized = false;
  
  // Initialize with better error handling
  static async initialize() {
    if (!this.isAvailable) {
      console.log('HealthKit is not available on this device/environment');
      return Promise.reject(new Error('HealthKit is not available'));
    }
    
    return new Promise((resolve, reject) => {
      try {
        AppleHealthKit.initHealthKit(healthKitOptions, (error) => {
          if (error) {
            console.log('Error initializing HealthKit:', error);
            reject(error);
            return;
          }
          
          this.isInitialized = true;
          console.log('HealthKit initialized successfully');
          resolve(true);
        });
      } catch (e) {
        console.log('Exception initializing HealthKit:', e);
        reject(e);
      }
    });
  }
  
  // Get step count for a specific day
  static getStepCount(date = new Date()) {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable) {
        console.log('HealthKit is not available');
        reject(new Error('HealthKit is not available'));
        return;
      }
      
      if (!this.isInitialized) {
        console.log('HealthKit is not initialized, initializing now...');
        this.initialize()
          .then(() => this.getStepCount(date))
          .then(resolve)
          .catch(reject);
        return;
      }
      
      const options = {
        date: date.toISOString(),
      };
      
      console.log('Getting step count with options:', options);
      
      try {
        AppleHealthKit.getStepCount(options, (error, results) => {
          if (error) {
            console.log('Error getting step count:', error);
            reject(error);
            return;
          }
          console.log('Successfully retrieved step count:', results);
          resolve(results);
        });
      } catch (e) {
        console.log('Exception getting step count:', e);
        reject(e);
      }
    });
  }
  
  // Save a workout to HealthKit
  static saveWorkout(workout) {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable || !this.isInitialized) {
        reject(new Error('HealthKit is not available or initialized'));
        return;
      }
      
      // Convert your workout format to HealthKit format
      const healthKitWorkout = {
        type: AppleHealthKit.Constants.Activities.Strength, // Default to strength training
        startDate: workout.startTime || new Date().toISOString(),
        endDate: workout.endTime || new Date().toISOString(),
        energyBurned: workout.caloriesBurned || 0,
        distance: 0, // For strength training
      };
      
      AppleHealthKit.saveWorkout(healthKitWorkout, (error, results) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(results);
      });
    });
  }
  
  // Get recent workouts
  static getWorkouts() {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable || !this.isInitialized) {
        reject(new Error('HealthKit is not available or initialized'));
        return;
      }
      
      const options = {
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
      };
      
      AppleHealthKit.getWorkouts(options, (error, results) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(results);
      });
    });
  }
}

export default HealthKitService;