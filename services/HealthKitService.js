import { Platform } from 'react-native';
let AppleHealthKit;

// Only import AppleHealthKit on iOS
if (Platform.OS === 'ios') {
  try {
    AppleHealthKit = require('react-native-health').default;
    console.log('AppleHealthKit imported successfully');
  } catch (error) {
    console.error('Error importing AppleHealthKit:', error);
    AppleHealthKit = null;
  }
}

class HealthKitService {
  static isInitialized = false;
  
  // Check if HealthKit is actually available
  static get isAvailable() {
    const isIOS = Platform.OS === 'ios';
    console.log('Platform is iOS:', isIOS);
    
    // Check if the import was successful
    const hasHealthKit = AppleHealthKit && typeof AppleHealthKit.initHealthKit === 'function';
    console.log('AppleHealthKit functions available:', hasHealthKit);
    
    return isIOS && hasHealthKit;
  }
  
  // Check if we should use simulated data
  static get useSimulatedData() {
    return global.useSimulatedHealthData === true || 
           Platform.OS !== 'ios' || 
           !this.isAvailable;
  }
  
  // Generate simulated step data for testing
  static getSimulatedStepData() {
    // Return random step count between 3000-12000
    return {
      value: Math.floor(Math.random() * 9000) + 3000,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      simulated: true
    };
  }
  
  // Initialize HealthKit with error handling
  static async initialize() {
    if (!this.isAvailable) {
      console.log('HealthKit not available');
      return Promise.reject(new Error('HealthKit is not available'));
    }
    
    return new Promise((resolve, reject) => {
      try {
        console.log('Attempting to initialize HealthKit with permissions...');
        
        // Define permissions object explicitly with string keys
        const options = {
          permissions: {
            read: ["Steps", "StepCount", "Workout", "Weight", "ActiveEnergyBurned", "HeartRate"],
            write: ["Workout", "Steps", "Weight", "ActiveEnergyBurned"]
          }
        };
        
        // Use try-catch to handle potential exception during initialization
        try {
          AppleHealthKit.initHealthKit(options, (error, results) => {
            if (error) {
              console.log('Error initializing HealthKit:', error);
              reject(error);
              return;
            }
            
            this.isInitialized = true;
            console.log('✅ HealthKit initialized successfully!');
            resolve(true);
          });
        } catch (initError) {
          console.log('Exception during AppleHealthKit.initHealthKit call:', initError);
          reject(initError);
        }
      } catch (e) {
        console.log('Exception initializing HealthKit:', e);
        reject(e);
      }
    });
  }
  
  // Get step count for a specific day
  static getStepCount(date = new Date()) {
    // If HealthKit is unavailable or we're using simulated data, return fake data
    if (this.useSimulatedData) {
      console.log('Using simulated step data');
      return Promise.resolve(this.getSimulatedStepData());
    }
    
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        console.log('HealthKit is not initialized, initializing now...');
        this.initialize()
          .then(() => this.getStepCount(date))
          .then(resolve)
          .catch((error) => {
            console.log('Failed to initialize for step count, using simulated data');
            resolve(this.getSimulatedStepData());
          });
        return;
      }
      
      const options = {
        date: date.toISOString(), // Format date properly
        includeManuallyAdded: true
      };
      
      console.log('Getting step count with options:', options);
      
      try {
        AppleHealthKit.getStepCount(options, (error, results) => {
          if (error) {
            console.log('Error getting step count:', error);
            // Return simulated data on error
            resolve(this.getSimulatedStepData());
            return;
          }
          console.log('Successfully retrieved step count:', results);
          resolve(results);
        });
      } catch (e) {
        console.log('Exception getting step count:', e);
        // Return simulated data on exception
        resolve(this.getSimulatedStepData());
      }
    });
  }
  
  // Save a workout to HealthKit
  static saveWorkout(workout) {
    // If HealthKit is unavailable or we're using simulated data, return fake success
    if (this.useSimulatedData) {
      console.log('Using simulated workout save');
      return Promise.resolve({
        simulated: true,
        saved: true,
        workout: workout
      });
    }
    
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        console.log('HealthKit is not initialized for saving workout, initializing now...');
        this.initialize()
          .then(() => this.saveWorkout(workout))
          .then(resolve)
          .catch((error) => {
            console.log('Failed to initialize for workout save, using simulated save');
            resolve({ simulated: true, saved: true, workout: workout });
          });
        return;
      }
      
      try {
        console.log('Saving workout to HealthKit:', workout);
        
        // Use simpler workout object with string types
        const simpleWorkout = {
          type: 'Strength', // Use string directly instead of enum
          startDate: workout.startTime,
          endDate: workout.endTime,
          energyBurned: workout.caloriesBurned || 0,
          distance: 0
        };
        
        AppleHealthKit.saveWorkout(simpleWorkout, (error, results) => {
          if (error) {
            console.log('Error saving workout to HealthKit:', error);
            // Return simulated success on error
            resolve({ simulated: true, saved: true, workout: workout });
            return;
          }
          
          console.log('Successfully saved workout to HealthKit:', results);
          resolve(results);
        });
      } catch (e) {
        console.log('Exception saving workout:', e);
        // Return simulated success on exception
        resolve({ simulated: true, saved: true, workout: workout });
      }
    });
  }
}

export default HealthKitService;