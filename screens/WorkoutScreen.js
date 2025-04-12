import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet, // Ensure StyleSheet is imported
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Dimensions,
  Image,
  FlatList
} from 'react-native';
import { Button, Surface, IconButton, Divider } from 'react-native-paper';
import { getInitialExercises, searchExercises } from '../data/exerciseAPI';
import { saveWorkoutToProfile, saveWorkoutGlobally, getUserTemplates } from '../data/firebaseHelpers';
import { useAuth } from '../context/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import HealthKitService from '../services/HealthKitService';
import { LinearGradient } from 'expo-linear-gradient';

// Add this right after your imports
// Safe alternative to BlurView to prevent errors
const SafeBackdrop = ({ children, style }) => {
  return (
    <View style={[
      StyleSheet.absoluteFill, 
      { backgroundColor: 'rgba(0, 0, 0, 0.8)' },
      style
    ]}>
      {children}
    </View>
  );
};

// Exercise Details Modal - for adding sets to selected exercise
const ExerciseSetModal = ({
  visible,
  onClose,
  exerciseName,
  onSave,
  editingSet,
  editingIndex
}) => {
  const [weight, setWeight] = useState(editingSet ? editingSet.weight.toString() : '');
  const [reps, setReps] = useState(editingSet ? editingSet.reps.toString() : '');
  const insets = useSafeAreaInsets();
  
  // Reset inputs when modal opens with new data
  useEffect(() => {
    if (visible) {
      setWeight(editingSet ? editingSet.weight.toString() : '');
      setReps(editingSet ? editingSet.reps.toString() : '');
    }
  }, [visible, editingSet]);
  
  const handleSave = () => {
    if (!weight.trim() || !reps.trim()) {
      Alert.alert('Missing Information', 'Please enter weight and reps');
      return;
    }
    
    const weightNum = parseFloat(weight);
    const repsNum = parseInt(reps);
    
    if (isNaN(weightNum) || weightNum <= 0 || isNaN(repsNum) || repsNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid positive numbers');
      return;
    }
    
    onSave({
      weight: weightNum,
      reps: repsNum,
      completed: false
    }, editingIndex);
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeBackdrop style={styles.blurContainer}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{flex: 1, justifyContent: 'center'}}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <View style={[styles.setModalContent, { 
            marginBottom: insets.bottom > 0 ? insets.bottom / 2 : 10,
            marginHorizontal: 20
          }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingSet ? 'Edit Set' : 'Add Set'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                color="#FFF"
                onPress={() => {
                  // Ensure any keyboard is dismissed first
                  Keyboard.dismiss();
                  // Then properly close the modal
                  onClose();
                }}
              />
            </View>
            
            <Text style={styles.exerciseNameTitle}>{exerciseName}</Text>
            <Text style={styles.setNumberTitle}>
              {editingSet ? `Set ${editingIndex + 1}` : 'New Set'}
            </Text>
            
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Weight (lbs)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="next"
                clearButtonMode="while-editing"
                autoFocus={true}
              />
            </View>
            
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Reps</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={reps}
                onChangeText={setReps}
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="done"
                clearButtonMode="while-editing"
              />
            </View>
            
            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.modalButton}
                contentStyle={styles.buttonContent}
              >
                {editingSet ? 'Update' : 'Add Set'}
              </Button>
              <Button
                mode="outlined"
                onPress={onClose}
                style={styles.cancelButton}
                labelStyle={{ color: '#3B82F6' }}
              >
                Cancel
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeBackdrop>
    </Modal>
  );
};

// Exercise Search Modal component
const ExerciseSearchModal = ({ 
  visible, 
  onClose, 
  exercises, 
  onSelectExercise, 
  searchQuery, 
  onSearchChange,
  loadingExercises
}) => {
  const insets = useSafeAreaInsets();
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeBackdrop style={styles.blurContainer}>
        <View style={[styles.exerciseModalContent, { 
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20 
        }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Exercises</Text>
            <IconButton
              icon="close"
              size={24}
              color="#FFF"
              onPress={onClose}
            />
          </View>
          
          <View style={styles.searchSection}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholderTextColor="#999"
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus={true}
            />
            <MaterialCommunityIcons name="magnify" size={22} color="#999" style={styles.searchIcon} />
          </View>
          
          {loadingExercises ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <FlatList
              data={exercises}
              keyExtractor={item => item.name || Math.random().toString()}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.exerciseItem}
                  onPress={() => {
                    Keyboard.dismiss();
                    onSelectExercise(item);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.exerciseItemText}>{item.name}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
                </TouchableOpacity>
              )}
              style={styles.exerciseList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingBottom: 12}}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No exercises found. Try a different search.
                </Text>
              }
            />
          )}
        </View>
      </SafeBackdrop>
    </Modal>
  );
};

// Completion Modal component
const CompletionModal = ({ 
  visible, 
  onSave, 
  onPost, 
  onContinue, 
  timer, 
  workouts, 
  saveLoading,
  postLoading
}) => {
  // Calculate total volume, sets, and exercises
  const totalVolume = workouts.reduce((acc, workout) => {
    return acc + workout.sets.reduce((setAcc, set) => {
      return setAcc + (set.weight * set.reps);
    }, 0);
  }, 0);
  
  const totalSets = workouts.reduce((acc, workout) => acc + workout.sets.length, 0);
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      // Prevent dismissing by tapping outside
      onRequestClose={() => onContinue()}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.completionModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.completionTitle}>Workout Complete</Text>
              <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
            </View>
            
            <View style={styles.workoutSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {Math.floor(timer/60).toString().padStart(2, '0')}:{(timer%60).toString().padStart(2, '0')}
                </Text>
                <Text style={styles.summaryLabel}>Duration</Text>
              </View>
              
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalVolume}lb</Text>
                <Text style={styles.summaryLabel}>Volume</Text>
              </View>
              
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalSets}</Text>
                <Text style={styles.summaryLabel}>Sets</Text>
              </View>
            </View>
            
            <View style={styles.completionDivider} />
            
            <View style={styles.completionActions}>
              <Button
                mode="contained"
                onPress={onSave}
                loading={saveLoading}
                disabled={saveLoading || postLoading}
                style={[styles.completionButton, styles.saveButton]}
                contentStyle={styles.buttonContent}
              >
                Save to Profile
              </Button>
              
              <Button
                mode="contained"
                onPress={onPost}
                loading={postLoading}
                disabled={saveLoading || postLoading}
                style={[styles.completionButton, styles.postButton]}
                contentStyle={styles.buttonContent}
              >
                Share to Community
              </Button>
              
              <Button
                mode="outlined"
                onPress={onContinue}
                disabled={saveLoading || postLoading}
                style={[styles.completionButton, styles.dismissButton]}
                contentStyle={styles.buttonContent}
              >
                Continue Workout
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// Main WorkoutScreen Component
export function WorkoutScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // State for workout data - updated to handle sets better
  const [workouts, setWorkouts] = useState([]);
  const [workoutTitle, setWorkoutTitle] = useState("My Workout");
  const [workoutNote, setWorkoutNote] = useState("");
  
  // State for modals
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [setModalVisible, setSetModalVisible] = useState(false);
  const [templatesModalVisible, setTemplatesModalVisible] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  
  // State for exercise selection
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  
  // State for workout session
  const [isWorkoutStarted, setIsWorkoutStarted] = useState(false);
  const [isWorkoutEnded, setIsWorkoutEnded] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  
  // State for set editing
  const [currentExerciseId, setCurrentExerciseId] = useState(null);
  const [editingSet, setEditingSet] = useState(null);
  const [editingSetIndex, setEditingSetIndex] = useState(null);
  
  // State for data loading
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  
  // Refs and animations
  const timerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  
  // Start workout session
  const startWorkout = () => {
    setIsWorkoutStarted(true);
    setIsTiming(true);
    setWorkoutTitle(`${format(new Date(), "EEEE")} Workout`);
  };
  
  // End workout session
  const endWorkout = () => {
    console.log("Ending workout session");
    // Stop timer but don't reset workout state yet
    setIsTiming(false);
    // Show completion modal
    setCompletionModalVisible(true);
  };

  // Continue workout session
  const continueWorkout = () => {
    // Close modal
    setCompletionModalVisible(false);
    // Resume timer
    setIsTiming(true);
    console.log("Resuming workout");
  };
  
  // Toggle set completion
  const toggleSetCompletion = (exerciseId, setIndex) => {
    setWorkouts(currentWorkouts => {
      return currentWorkouts.map(workout => {
        if (workout.id === exerciseId) {
          const updatedSets = [...workout.sets];
          updatedSets[setIndex] = {
            ...updatedSets[setIndex],
            completed: !updatedSets[setIndex].completed
          };
          return {
            ...workout,
            sets: updatedSets
          };
        }
        return workout;
      });
    });
  };
  
  // Load initial exercise data
  useEffect(() => {
    const fetchExercises = async () => {
      setLoadingExercises(true);
      try {
        const data = await getInitialExercises(50);
        setExercises(data);
        setFilteredExercises(data);
      } catch (error) {
        console.error("Error fetching exercises:", error);
        Alert.alert("Error", "Failed to load exercises");
      } finally {
        setLoadingExercises(false);
      }
    };
    fetchExercises();
  }, []);
  
  // Handle timer
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
  
  // Load templates
  useEffect(() => {
    if (user?.uid) {
      loadTemplates();
    }
  }, [user]);
  
  // Handle search query
  const handleSearch = (text) => {
    setSearchQuery(text);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (!text.trim()) {
      setFilteredExercises(exercises);
      return;
    }
    
    const localResults = exercises.filter(exercise =>
      exercise.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredExercises(localResults);
    
    const timeout = setTimeout(async () => {
      if (text.trim().length >= 2) {
        setLoadingExercises(true);
        try {
          const results = await searchExercises(text);
          if (results.length > 0) {
            setFilteredExercises(results);
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setLoadingExercises(false);
        }
      }
    }, 500);
    
    setSearchTimeout(timeout);
  };
  
  // Select exercise from search
  const selectExercise = (exercise) => {
    console.log("Exercise selected:", exercise.name);
    setSelectedExercise(exercise);
    
    // Generate unique ID for this exercise
    const newExerciseId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setCurrentExerciseId(newExerciseId);
    
    // Close search modal and open set modal with a small delay to prevent UI flicker
    setSearchModalVisible(false);
    
    // Add a small delay before showing the set modal to ensure search modal is fully closed
    setTimeout(() => {
      console.log("Opening set modal for", exercise.name);
      setSetModalVisible(true);
    }, 100);
  };
  
  // Add or update set to an exercise
  const handleSaveSet = (setData, editingIndex = null) => {
    console.log("Saving set", setData, "for exercise ID", currentExerciseId);
    console.log("Is this a new exercise?", !workouts.some(w => w.id === currentExerciseId));
    
    // If this is a new exercise
    if (!workouts.some(workout => workout.id === currentExerciseId)) {
      console.log("Adding new exercise with set");
      setWorkouts(prevWorkouts => [
        ...prevWorkouts,
        {
          id: currentExerciseId,
          name: selectedExercise.name,
          sets: [setData]
        }
      ]);
      
      // If this is first exercise, ensure timer is running
      if (!isWorkoutStarted) {
        setIsWorkoutStarted(true);
        setIsTiming(true);
      }
    } 
    // If editing existing set
    else if (editingIndex !== null) {
      console.log("Updating existing set at index:", editingIndex);
      setWorkouts(currentWorkouts => {
        return currentWorkouts.map(workout => {
          if (workout.id === currentExerciseId) {
            const updatedSets = [...workout.sets];
            updatedSets[editingIndex] = setData;
            return {
              ...workout,
              sets: updatedSets
            };
          }
          return workout;
        });
      });
    } 
    // If adding a new set to existing exercise
    else {
      console.log("Adding new set to existing exercise");
      setWorkouts(currentWorkouts => {
        return currentWorkouts.map(workout => {
          if (workout.id === currentExerciseId) {
            return {
              ...workout,
              sets: [...workout.sets, setData]
            };
          }
          return workout;
        });
      });
    }
    
    // Reset editing state
    setEditingSet(null);
    setEditingSetIndex(null);
    
    // Close the modal
    setSetModalVisible(false);
  };
  
  // Open set editing modal
  const handleEditSet = (exerciseId, setIndex) => {
    const exercise = workouts.find(workout => workout.id === exerciseId);
    if (exercise) {
      setCurrentExerciseId(exerciseId);
      setSelectedExercise({ name: exercise.name });
      setEditingSet(exercise.sets[setIndex]);
      setEditingSetIndex(setIndex);
      setSetModalVisible(true);
    }
  };
  
  // Delete set
  const handleDeleteSet = (exerciseId, setIndex) => {
    Alert.alert(
      "Delete Set",
      "Are you sure you want to remove this set?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            setWorkouts(currentWorkouts => {
              return currentWorkouts.map(workout => {
                if (workout.id === exerciseId) {
                  const updatedSets = [...workout.sets];
                  updatedSets.splice(setIndex, 1);
                  
                  // If no sets left, remove the exercise
                  if (updatedSets.length === 0) {
                    return null;
                  }
                  
                  return {
                    ...workout,
                    sets: updatedSets
                  };
                }
                return workout;
              }).filter(Boolean); // Remove null entries (deleted exercises)
            });
          }
        }
      ]
    );
  };
  
  // Add a new set to existing exercise
  const handleAddSet = (exerciseId) => {
    const exercise = workouts.find(workout => workout.id === exerciseId);
    if (exercise) {
      setCurrentExerciseId(exerciseId);
      setSelectedExercise({ name: exercise.name });
      setEditingSet(null);
      setEditingSetIndex(null);
      setSetModalVisible(true);
    }
  };
  
  // Delete exercise
  const handleDeleteExercise = (exerciseId) => {
    Alert.alert(
      "Delete Exercise",
      "Are you sure you want to remove this exercise and all sets?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            setWorkouts(workouts.filter(workout => workout.id !== exerciseId));
          }
        }
      ]
    );
  };
  
  // Save workout to profile
  const saveToProfile = async () => {
    if (!user?.uid) {
      Alert.alert('Authentication Required', 'Please login to save workouts');
      return;
    }
    
    if (workouts.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise before saving.');
      return;
    }
    
    try {
      setSaveLoading(true);
      
      // Transform workouts to the format expected by Firebase
      const exercisesForFirebase = workouts.map(workout => ({
        id: workout.id,
        name: workout.name,
        sets: workout.sets.length,
        reps: workout.sets.length > 0 ? workout.sets[0].reps : 0,
        weight: workout.sets.length > 0 ? workout.sets[0].weight : 0,
        setDetails: workout.sets.map(set => ({
          weight: set.weight,
          reps: set.reps,
          completed: set.completed || false
        }))
      }));
      
      const workoutData = {
        name: workoutTitle,
        date: serverTimestamp(),
        duration: timer,
        exercises: exercisesForFirebase,
        notes: workoutNote,
        isPublic: false
      };
      
      // Save to Firebase
      await saveWorkoutToProfile(user.uid, workoutData);
      
      // Handle HealthKit if available
      if (Platform.OS === 'ios' && HealthKitService.isAvailable) {
        try {
          if (!HealthKitService.isInitialized) {
            await HealthKitService.initialize();
          }
          
          const healthKitWorkout = {
            startTime: new Date(Date.now() - timer * 1000).toISOString(),
            endTime: new Date().toISOString(),
            caloriesBurned: calculateCalories(workouts),
          };
          
          await HealthKitService.saveWorkout(healthKitWorkout);
          console.log('Workout saved to HealthKit');
        } catch (healthKitError) {
          console.error('Error saving to HealthKit:', healthKitError);
          // Continue with normal flow even if HealthKit save fails
        }
      }
      
      // Reset workout after success
      resetWorkoutAfterCompletion();
      
      // Show success message
      Alert.alert('Success', 'Your workout has been saved to your profile!');
      
    } catch (error) {
      Alert.alert('Error', 'Could not save workout: ' + error.message);
    } finally {
      setSaveLoading(false);
      setCompletionModalVisible(false);
    }
  };
  
  // Share workout to community - updated to handle new data structure
  const postWorkout = async () => {
    if (!user?.uid) {
      Alert.alert('Authentication Required', 'Please login to share workouts');
      return;
    }
    
    if (workouts.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise before sharing.');
      return;
    }
    
    try {
      setPostLoading(true);
      
      // Transform workouts to the format expected by Firebase
      const exercisesForFirebase = workouts.map(workout => ({
        id: workout.id,
        name: workout.name,
        sets: workout.sets.length,
        reps: workout.sets.length > 0 ? workout.sets[0].reps : 0,
        weight: workout.sets.length > 0 ? workout.sets[0].weight : 0,
        setDetails: workout.sets.map(set => ({
          weight: set.weight,
          reps: set.reps,
          completed: set.completed || false
        }))
      }));
      
      // Calculate total weight for metrics
      const totalWeight = workouts.reduce((acc, workout) => {
        return acc + workout.sets.reduce((setAcc, set) => {
          return setAcc + (set.weight * set.reps);
        }, 0);
      }, 0);
      
      // Create workout data object with required fields
      const workoutData = {
        name: workoutTitle,
        date: new Date(),
        duration: timer,
        exercises: exercisesForFirebase,
        notes: workoutNote,
        isPublic: true,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        totalWeight: totalWeight,
        caloriesBurned: calculateCalories(workouts),
        metrics: {
          totalExercises: workouts.length,
          totalSets: workouts.reduce((acc, workout) => acc + workout.sets.length, 0),
          totalReps: workouts.reduce((acc, workout) => (
            acc + workout.sets.reduce((setAcc, set) => setAcc + set.reps, 0)
          ), 0)
        }
      };
      
      // Save workout globally
      await saveWorkoutGlobally(workoutData);
      
      // Only reset workout after successful post
      resetWorkoutAfterCompletion();
      
      // Show success message
      Alert.alert('Success', 'Your workout has been shared with the community!');
      
    } catch (error) {
      Alert.alert('Error', 'Could not share workout: ' + error.message);
    } finally {
      setPostLoading(false);
      setCompletionModalVisible(false);
    }
  };
  
  // Create a new helper function to reset workout state
  const resetWorkoutAfterCompletion = () => {
    setIsWorkoutEnded(false);
    setWorkouts([]);
    setIsWorkoutStarted(false);
    setTimer(0);
    setWorkoutTitle("My Workout");
    setWorkoutNote("");
  };
  
  // Load templates
  const loadTemplates = async () => {
    if (!user?.uid) return;
    
    try {
      setLoadingTemplates(true);
      const userTemplates = await getUserTemplates(user.uid);
      setTemplates(userTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', 'Failed to load your workout templates');
    } finally {
      setLoadingTemplates(false);
    }
  };
  
  // Apply template - updated for new data structure
  const applyTemplate = (template) => {
    const templateExercises = template.exercises.map(ex => {
      // Generate unique ID for this exercise
      const newExerciseId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      
      // Create default set data
      const sets = [{
        weight: ex.weight || 45,
        reps: ex.reps || 10,
        completed: false
      }];
      
      // If multiple sets in template
      if (ex.sets > 1) {
        for (let i = 1; i < ex.sets; i++) {
          sets.push({
            weight: ex.weight || 45,
            reps: ex.reps || 10,
            completed: false
          });
        }
      }
      
      return {
        id: newExerciseId,
        name: ex.name,
        sets
      };
    });
    
    setWorkouts(templateExercises);
    setTemplatesModalVisible(false);
    
    if (!isWorkoutStarted) {
      setIsWorkoutStarted(true);
      setIsTiming(true);
      setWorkoutTitle(template.name || "Template Workout");
    }
  };
  
  // Calculate calories - updated for new data structure
  const calculateCalories = (exercises) => {
    const totalWeight = exercises.reduce((acc, exercise) => {
      return acc + exercise.sets.reduce((setAcc, set) => {
        return setAcc + (set.weight * set.reps);
      }, 0);
    }, 0);
    
    return Math.round(totalWeight / 10);
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {!isWorkoutStarted ? (
        // Start Workout Screen - Your existing code for the start screen
        <View style={styles.startWorkoutContainer}>
          <View style={styles.startWorkoutContent}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.logoBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="dumbbell" size={40} color="#FFFFFF" />
              </LinearGradient>
            </View>
            
            <Text style={styles.welcomeTitle}>Ready to work out?</Text>
            <Text style={styles.welcomeSubtitle}>Track your progress and reach your fitness goals</Text>
            
            <View style={styles.startButtonsContainer}>
              <TouchableOpacity 
                style={styles.startButton}
                onPress={startWorkout}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.startButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <MaterialCommunityIcons name="dumbbell" size={24} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>Start New Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Rest of your start screen */}
            </View>
          </View>
        </View>
      ) : (
        // Active Workout Screen - Simple version to fix the black screen
        <View style={{flex: 1, backgroundColor: '#0A0A0A'}}>
          {/* Header with timer and finish button */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#222'
          }}>
            <TouchableOpacity 
              onPress={() => {
                // Show confirmation before cancelling
                Alert.alert(
                  "Cancel Workout",
                  "Are you sure you want to cancel your workout? All progress will be lost.",
                  [
                    { text: "No", style: "cancel" },
                    { 
                      text: "Yes", 
                      style: "destructive",
                      onPress: () => {
                        // Clear interval and reset workout state
                        clearInterval(timerRef.current);
                        setIsTiming(false);
                        setIsWorkoutStarted(false);
                        setWorkouts([]);
                        setTimer(0);
                        setWorkoutTitle("My Workout");
                        setWorkoutNote("");
                      }
                    }
                  ]
                );
              }}
              style={{padding: 8}}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <MaterialCommunityIcons name="clock-outline" size={24} color="#3B82F6" />
              <Text style={{color: '#FFF', marginLeft: 8, fontSize: 16}}>
                {Math.floor(timer/60).toString().padStart(2, '0')}:{(timer%60).toString().padStart(2, '0')}
              </Text>
            </View>
            
            {/* Workout title */}
            <TextInput
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#FFF',
                textAlign: 'center',
                width: 150
              }}
              value={workoutTitle}
              onChangeText={setWorkoutTitle}
              placeholder="Workout Title"
              placeholderTextColor="#999"
            />
            
            {/* Finish button */}
            <TouchableOpacity 
              style={{
                backgroundColor: '#3B82F6',
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 6
              }}
              onPress={endWorkout}
            >
              <Text style={{color: '#FFF', fontWeight: '600'}}>FINISH</Text>
            </TouchableOpacity>
          </View>
          
          {/* Exercises List */}
          <ScrollView style={{flex: 1}}>
            {workouts.length === 0 ? (
              <View style={{alignItems: 'center', padding: 40}}>
                <MaterialCommunityIcons name="dumbbell" size={48} color="#333" />
                <Text style={{color: '#FFF', marginTop: 16, marginBottom: 24}}>
                  No exercises added yet
                </Text>
                <TouchableOpacity 
                  style={{
                    backgroundColor: '#3B82F6',
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 12
                  }}
                  onPress={() => {
                    setSearchQuery('');
                    setFilteredExercises(exercises);
                    setSearchModalVisible(true);
                  }}
                >
                  <Text style={{color: '#FFF', fontWeight: '600'}}>Add Exercise</Text>
                </TouchableOpacity>
              </View>
            ) : (
              workouts.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>
                      {exercise.name}
                    </Text>
                    <TouchableOpacity 
                      style={styles.exerciseAction}
                      onPress={() => handleDeleteExercise(exercise.id)}
                    >
                      <MaterialCommunityIcons name="delete" size={22} color="#666" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Sets Table */}
                  <View style={{borderRadius: 8, overflow: 'hidden'}}>
                    <View style={{
                      flexDirection: 'row',
                      backgroundColor: '#222',
                      padding: 10
                    }}>
                      <Text style={{flex: 1, color: '#999', fontSize: 12, fontWeight: '600'}}>SET</Text>
                      <Text style={{flex: 1, color: '#999', fontSize: 12, fontWeight: '600'}}>LB</Text>
                      <Text style={{flex: 1, color: '#999', fontSize: 12, fontWeight: '600'}}>REPS</Text>
                      <Text style={{flex: 0.5, color: '#999', fontSize: 12, fontWeight: '600'}}></Text>
                    </View>
                    
                    {exercise.sets.map((set, setIndex) => (
                      <TouchableOpacity 
                        key={setIndex} 
                        style={{
                          flexDirection: 'row',
                          padding: 12,
                          backgroundColor: set.completed ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                          borderBottomWidth: 1,
                          borderBottomColor: '#333',
                          alignItems: 'center'
                        }}
                        onPress={() => toggleSetCompletion(exercise.id, setIndex)}
                      >
                        <Text style={{flex: 1, color: '#FFF'}}>{setIndex + 1}</Text>
                        <Text style={{flex: 1, color: '#FFF'}}>{set.weight}</Text>
                        <Text style={{flex: 1, color: '#FFF'}}>{set.reps}</Text>
                        <View style={{flex: 0.5, alignItems: 'center'}}>
                          <MaterialCommunityIcons 
                            name={set.completed ? "check-circle" : "circle-outline"} 
                            size={22} 
                            color={set.completed ? "#22C55E" : "#666"} 
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {/* Add Set Button */}
                  <TouchableOpacity
                    style={{
                      marginTop: 12,
                      padding: 10,
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: 8,
                      alignItems: 'center'
                    }}
                    onPress={() => handleAddSet(exercise.id)}
                  >
                    <Text style={{color: '#3B82F6'}}>+ Add Set</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            
            {/* Add Exercise Button (if there are exercises) */}
            {workouts.length > 0 && (
              <TouchableOpacity
                style={{
                  margin: 16,
                  padding: 16,
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center'
                }}
                onPress={() => {
                  setSearchQuery('');
                  setFilteredExercises(exercises);
                  setSearchModalVisible(true);
                }}
              >
                <MaterialCommunityIcons name="plus" size={24} color="#3B82F6" />
                <Text style={{color: '#3B82F6', marginLeft: 8}}>Add Exercise</Text>
              </TouchableOpacity>
            )}
            
            {/* Bottom padding */}
            <View style={{height: 80}} />
          </ScrollView>
        </View>
      )}
      
      {/* Your existing modals */}
      <ExerciseSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        exercises={filteredExercises}
        onSelectExercise={selectExercise}
        searchQuery={searchQuery}
        onSearchChange={handleSearch}
        loadingExercises={loadingExercises}
      />
      
      <ExerciseSetModal
        visible={setModalVisible}
        onClose={() => {
          console.log("Closing set modal");
          setSetModalVisible(false);
          setEditingSet(null);
          setEditingSetIndex(null);
        }}
        exerciseName={selectedExercise?.name}
        onSave={handleSaveSet}
        editingSet={editingSet}
        editingIndex={editingSetIndex}
      />
      
      <CompletionModal
        visible={completionModalVisible}
        onSave={saveToProfile}
        onPost={postWorkout}
        onContinue={continueWorkout}
        timer={timer}
        workouts={workouts}
        saveLoading={saveLoading}
        postLoading={postLoading}
      />

      <CompletionModal
        visible={isWorkoutEnded}
        onSave={saveToProfile}
        onPost={postWorkout}
        onContinue={() => {
          // Reset workout state
          setIsWorkoutEnded(false);
          setWorkouts([]);
          setIsWorkoutStarted(false);
          setTimer(0);
          setWorkoutTitle("My Workout");
          setWorkoutNote("");
        }}
        timer={timer}
        workouts={workouts}
        saveLoading={saveLoading}
        postLoading={postLoading}
      />
      
      {/* Other modals */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  
  // START WORKOUT SCREEN
  startWorkoutContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  startWorkoutContent: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoBackground: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: '80%',
  },
  startButtonsContainer: {
    width: '100%',
    marginBottom: 48,
  },
  startButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  templatesButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  templatesButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  templatesButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
  },
  featuresContainer: {
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  
  // ACTIVE WORKOUT SCREEN
  workoutContainer: {
    flex: 1,
  },
  activeWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  finishButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3B82F6',
    borderRadius: 6,
  },
  finishButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  workoutTitleSection: {
    padding: 20,
  },
  workoutTitleInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    paddingVertical: 4,
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginRight: 8,
  },
  timerIcon: {
    marginTop: 2,
  },
  workoutNoteContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    minHeight: 44,
  },
  workoutNoteInput: {
    color: '#FFF',
    fontSize: 15,
  },
  workoutNoteText: {
    color: '#FFF',
    fontSize: 15,
  },
  workoutNotePlaceholder: {
    color: '#999',
  },
  exercisesContainer: {
    flex: 1,
  },
  exercisesContent: {
    padding: 20,
    paddingTop: 0,
  },
  emptyExercises: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyExercisesText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  addFirstExerciseButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addFirstExerciseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
  },
  exerciseActions: {
    flexDirection: 'row',
  },
  exerciseAction: {
    marginLeft: 16,
  },
  setsTable: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  setsTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#222',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  setsTableHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    position: 'relative',
  },
  setCell: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
  },
  deleteSetButton: {
    position: 'absolute',
    right: -10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 20,
    opacity: 0.1, // Hidden by default
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    marginTop: 10,
  },
  addSetText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  addExerciseCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  addExerciseCardText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#0A0A0A',
  },
  addExerciseButton: {
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  addExerciseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelWorkoutButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelWorkoutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // MODAL STYLES
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
  },
  completionModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center', // Center the logo
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center', // Center the title
    alignItems: 'center',
    marginBottom: 20,
    width: '100%', // Full width to ensure proper centering
  },
  completionTitle: {
    fontSize: 24, // Slightly larger
    fontWeight: '700',
    color: '#FFF',
    marginRight: 10,
  },
  workoutSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryItem: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  completionDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  completionActions: {
    gap: 12,
  },
  completionButton: {
    borderRadius: 12,
    paddingVertical: 2,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  postButton: {
    backgroundColor: '#10B981',
  },
  dismissButton: {
    backgroundColor: 'transparent',
    borderColor: '#3B82F6',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // TEMPLATES MODAL
  templatesModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    margin: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  templatesList: {
    flex: 1,
  },
  templateItem: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  templateContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIconContainer: {
    marginRight: 16,
  },
  templateIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  templateMeta: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  
  // EXERCISE SEARCH MODAL
  exerciseModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    margin: 16,
    padding: 20,
    height: '80%',
  },
  searchSection: {
    position: 'relative',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
  },
  exerciseList: {
    flex: 1,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  exerciseItemText: {
    color: '#FFF',
    fontSize: 16,
  },
  
  // SET MODAL
  setModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
  },
  exerciseNameTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 8,
  },
  setNumberTitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  inputRow: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
  },
  modalActions: {
    gap: 12,
    marginTop: 10,
  },
  modalButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },
  cancelButton: {
    borderColor: '#3B82F6',
  },
  
  // UTILITY STYLES
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  logoHeaderContainer: {
    alignItems: 'center',
    marginBottom: 16, // Space between logo and title
  },
  logoBackground: {
    width: 80,
    height: 80,
    borderRadius: 20, // Slightly smaller corner radius
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Keep logo inside rounded corners
    ...Platform.select({
      ios: {
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      }
    })
  },
  completionLogo: {
    width: '100%',
    height: '100%',
  },
});

export default WorkoutScreen;
