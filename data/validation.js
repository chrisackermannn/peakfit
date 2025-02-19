export const validateWorkout = (workoutData) => {
    const errors = [];
  
    if (!workoutData.exercises || !Array.isArray(workoutData.exercises)) {
      errors.push('Exercises must be a valid array');
    }
  
    if (typeof workoutData.duration !== 'number') {
      errors.push('Duration must be a number');
    }
  
    if (workoutData.duration <= 0 || workoutData.duration > 600) {
      errors.push('Duration must be between 1 and 600 minutes');
    }
  
    if (workoutData.exercises) {
      if (workoutData.exercises.length === 0) {
        errors.push('At least one exercise is required');
      }
      if (workoutData.exercises.length > 50) {
        errors.push('Maximum 50 exercises allowed');
      }
  
      workoutData.exercises.forEach((exercise, index) => {
        const exerciseErrors = validateExercise(exercise);
        if (exerciseErrors.length > 0) {
          errors.push(`Exercise ${index + 1}: ${exerciseErrors.join(', ')}`);
        }
      });
    }
  
    return errors;
  };
  
  export const validateExercise = (exercise) => {
    const errors = [];
  
    if (!exercise.name) errors.push('Exercise name is required');
    if (typeof exercise.sets !== 'number') errors.push('Sets must be a number');
    if (typeof exercise.reps !== 'number') errors.push('Reps must be a number');
    if (typeof exercise.weight !== 'number') errors.push('Weight must be a number');
  
    if (exercise.sets <= 0 || exercise.sets > 20) {
      errors.push('Sets must be between 1 and 20');
    }
    if (exercise.reps <= 0 || exercise.reps > 100) {
      errors.push('Reps must be between 1 and 100');
    }
    if (exercise.weight < 0 || exercise.weight > 2000) {
      errors.push('Weight must be between 0 and 2000 lbs');
    }
  
    return errors;
  };
  
  export const validateStats = (statsData) => {
    const errors = [];
  
    if (typeof statsData.weight !== 'number') {
      errors.push('Weight must be a number');
    }
    if (typeof statsData.bodyFat !== 'number') {
      errors.push('Body fat percentage must be a number');
    }
    if (!statsData.measurements || typeof statsData.measurements !== 'object') {
      errors.push('Measurements must be a valid object');
    }
  
    if (statsData.weight <= 0 || statsData.weight > 1000) {
      errors.push('Weight must be between 1 and 1000 lbs');
    }
    if (statsData.bodyFat < 0 || statsData.bodyFat > 100) {
      errors.push('Body fat percentage must be between 0 and 100');
    }
  
    if (statsData.measurements) {
      const measurementErrors = validateMeasurements(statsData.measurements);
      errors.push(...measurementErrors);
    }
  
    return errors;
  };
  
  export const validateMeasurements = (measurements) => {
    const errors = [];
    const requiredMeasurements = ['chest', 'waist', 'arms', 'legs'];
  
    requiredMeasurements.forEach(measurement => {
      if (typeof measurements[measurement] !== 'number') {
        errors.push(`${measurement.charAt(0).toUpperCase() + measurement.slice(1)} measurement must be a number`);
      }
    });
  
    if (measurements.chest && (measurements.chest <= 0 || measurements.chest > 100)) {
      errors.push('Chest measurement must be between 1 and 100 inches');
    }
    if (measurements.waist && (measurements.waist <= 0 || measurements.waist > 100)) {
      errors.push('Waist measurement must be between 1 and 100 inches');
    }
    if (measurements.arms && (measurements.arms <= 0 || measurements.arms > 50)) {
      errors.push('Arms measurement must be between 1 and 50 inches');
    }
    if (measurements.legs && (measurements.legs <= 0 || measurements.legs > 100)) {
      errors.push('Legs measurement must be between 1 and 100 inches');
    }
  
    return errors;
  };