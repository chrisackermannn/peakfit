export const exercisesAPI = 
[
    { id: 1, name: 'Bench Press', category: 'Chest' },
    { id: 2, name: 'Incline Bench Press', category: 'Chest' },
    { id: 3, name: 'Dumbbell Flys', category: 'Chest' },
    { id: 4, name: 'Push-ups', category: 'Chest' },
    { id: 5, name: 'Squats', category: 'Legs' },
    { id: 6, name: 'Leg Press', category: 'Legs' },
    { id: 7, name: 'Lunges', category: 'Legs' },
    { id: 8, name: 'Deadlift', category: 'Back' },
    { id: 9, name: 'Pull-ups', category: 'Back' },
    { id: 10, name: 'Bent-over Rows', category: 'Back' },
    { id: 11, name: 'Lat Pulldown', category: 'Back' },
    { id: 12, name: 'Overhead Press', category: 'Shoulders' },
    { id: 13, name: 'Dumbbell Shoulder Press', category: 'Shoulders' },
    { id: 14, name: 'Lateral Raises', category: 'Shoulders' },
    { id: 15, name: 'Bicep Curls', category: 'Arms' },
    { id: 16, name: 'Hammer Curls', category: 'Arms' },
    { id: 17, name: 'Tricep Dips', category: 'Arms' },
    { id: 18, name: 'Skull Crushers', category: 'Arms' },
    { id: 19, name: 'Leg Curls', category: 'Legs' },
    { id: 20, name: 'Calf Raises', category: 'Legs' },
  ];
  export async function getExercises() {
    return exercisesAPI;
  }