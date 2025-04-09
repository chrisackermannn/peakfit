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
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Dimensions
} from 'react-native';
import { Button, Surface, IconButton, Divider } from 'react-native-paper';
import { getInitialExercises, searchExercises } from '../data/exerciseAPI';
import { saveWorkoutToProfile, saveWorkoutGlobally, getUserTemplates } from '../data/firebaseHelpers';
import { useAuth } from '../context/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import HealthKitService from '../services/HealthKitService';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// CompletionModal - shown when workout is finished
const CompletionModal = ({ visible, onDismiss, onSave, onPost, timer, workouts, saveLoading, postLoading }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.completionModalContent, { 
            marginBottom: insets.bottom > 0 ? insets.bottom : 20 
          }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.completionTitle}>Workout Complete!</Text>
              <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
            </View>
            
            <View style={styles.workoutSummary}>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="clock-outline" size={24} color="#3B82F6" />
                <Text style={styles.summaryValue}>
                  {Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}
                </Text>
                <Text style={styles.summaryLabel}>Duration</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="dumbbell" size={24} color="#3B82F6" />
                <Text style={styles.summaryValue}>
                  {workouts.reduce((total, workout) => total + workout.sets.length, 0)}
                </Text>
                <Text style={styles.summaryLabel}>Sets</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="weight-lifter" size={24} color="#3B82F6" />
                <Text style={styles.summaryValue}>
                  {workouts.reduce((total, workout) => {
                    return total + workout.sets.reduce((setTotal, set) => {
                      return setTotal + (set.weight * set.reps);
                    }, 0);
                  }, 0)} lbs
                </Text>
                <Text style={styles.summaryLabel}>Volume</Text>
              </View>
            </View>

            <View style={styles.completionDivider} />

            <View style={styles.completionActions}>
              <Button
                mode="contained"
                onPress={onSave}
                style={[styles.completionButton, styles.saveButton]}
                loading={saveLoading}
                disabled={saveLoading || postLoading}
                labelStyle={styles.buttonLabel}
                contentStyle={styles.buttonContent}
              >
                Save to Profile
              </Button>
              <Button
                mode="contained"
                onPress={onPost}
                style={[styles.completionButton, styles.postButton]}
                loading={postLoading}
                disabled={saveLoading || postLoading}
                labelStyle={styles.buttonLabel}
                contentStyle={styles.buttonContent}
              >
                Share Workout
              </Button>
              <Button
                mode="outlined"
                onPress={onDismiss}
                style={styles.dismissButton}
                labelStyle={{ color: '#3B82F6' }}
              >
                Close
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// Templates Modal - for selecting workout templates
const TemplatesModal = ({ visible, onClose, templates, loading, onApplyTemplate }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
        <View style={[styles.templatesModalContent, { 
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20 
        }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Workout Templates</Text>
            <IconButton
              icon="close"
              size={24}
              color="#FFF"
              onPress={onClose}
            />
          </View>
          
          <View style={styles.templatesList}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            ) : templates.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="file-document-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>No saved templates</Text>
                <Text style={styles.emptySubtext}>
                  Save workout templates from the Community tab
                </Text>
              </View>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={item => item.id}
                renderItem={({item}) => (
                  <TouchableOpacity 
                    style={styles.templateItem}
                    onPress={() => onApplyTemplate(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.templateContent}>
                      <View style={styles.templateIconContainer}>
                        <LinearGradient
                          colors={['#3B82F6', '#2563EB']}
                          style={styles.templateIconGradient}
                        >
                          <MaterialCommunityIcons name="dumbbell" size={20} color="#FFFFFF" />
                        </LinearGradient>
                      </View>
                      <View style={styles.templateInfo}>
                        <Text style={styles.templateName}>{item.name}</Text>
                        <Text style={styles.templateMeta}>
                          {item.exercises.length} exercises • From {item.sourceWorkout?.userDisplayName || 'You'}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{paddingBottom: 20}}
              />
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

// Exercise Search Modal - more intuitive exercise selection
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
      <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
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
              keyExtractor={item => item.name}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.exerciseItem}
                  onPress={() => onSelectExercise(item)}
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
          
          <View style={{height: 40}} />
        </View>
      </BlurView>
    </Modal>
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
  
  useEffect(() => {
    if (editingSet) {
      setWeight(editingSet.weight.toString());
      setReps(editingSet.reps.toString());
    } else {
      setWeight('');
      setReps('');
    }
  }, [editingSet]);
  
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
    
    setWeight('');
    setReps('');
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
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
                onPress={onClose}
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
      </BlurView>
    </Modal>
  );
};

// Main WorkoutScreen Component
export default function WorkoutScreen({ navigation }) {
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
    setIsTiming(false);
    setIsWorkoutEnded(true);
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
    setSelectedExercise(exercise);
    
    // Generate unique ID for this exercise
    const newExerciseId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setCurrentExerciseId(newExerciseId);
    
    // Close search modal and open set modal
    setSearchModalVisible(false);
    setSetModalVisible(true);
  };
  
  // Add or update set to an exercise
  const handleSaveSet = (setData, editingIndex = null) => {
    // If this is a new exercise
    if (!workouts.some(workout => workout.id === currentExerciseId)) {
      setWorkouts([
        ...workouts,
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
  
  // Save workout to profile - updated to handle new data structure
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
      
      // Save to HealthKit if available (iOS only)
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
      
      // Animation feedback
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.delay(800),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();
      
      // Reset workout state
      setIsWorkoutEnded(false);
      setWorkouts([]);
      setIsWorkoutStarted(false);
      setTimer(0);
      setWorkoutTitle("My Workout");
      setWorkoutNote("");
      
      // Show success message
      Alert.alert('Success', 'Your workout has been saved to your profile!');
      
    } catch (error) {
      Alert.alert('Error', 'Could not save workout: ' + error.message);
    } finally {
      setSaveLoading(false);
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
      
      // Reset workout state
      setIsWorkoutEnded(false);
      setWorkouts([]);
      setIsWorkoutStarted(false);
      setTimer(0);
      setWorkoutTitle("My Workout");
      setWorkoutNote("");
      
      // Show success message
      Alert.alert('Success', 'Your workout has been shared with the community!');
      
    } catch (error) {
      Alert.alert('Error', 'Could not share workout: ' + error.message);
    } finally {
      setPostLoading(false);
    }
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
        // Start Workout Screen
        <View style={styles.startWorkoutContainer}>
          <Text style={styles.welcomeTitle}>Ready to work out?</Text>
          
          <View style={styles.startWorkoutCard}>
            <LinearGradient
              colors={['#1A1A1A', '#121212']}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Text style={styles.startWorkoutTitle}>Start New Workout</Text>
              
              <TouchableOpacity 
                style={styles.startButton}
                onPress={startWorkout}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.startButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialCommunityIcons name="dumbbell" size={28} color="#fff" />
                  <Text style={styles.startButtonText}>Begin Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.templatesButton}
                onPress={() => {
                  loadTemplates();
                  setTemplatesModalVisible(true);
                }}
              >
                <Text style={styles.templatesButtonText}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} color="#3B82F6" />
                  {" "}Use Template
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      ) : (
        // Active Workout Screen
        <View style={styles.workoutContainer}>
          {/* Header with timer and finish button */}
          <View style={styles.activeWorkoutHeader}>
            <TouchableOpacity onPress={() => {
              if (isTiming) {
                setIsTiming(false);
              }
              Alert.alert(
                "Exit Workout",
                "Do you want to end this workout?",
                [
                  { text: "Cancel", style: "cancel", onPress: () => {
                    if (!isTiming) setIsTiming(true);
                  }},
                  { text: "End", style: "destructive", onPress: endWorkout }
                ]
              );
            }}>
              <MaterialCommunityIcons name="chevron-down" size={28} color="#999" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => {
              Alert.alert(
                "Timer",
                "Workout in progress: " + 
                Math.floor(timer/60).toString().padStart(2, '0') + ":" + 
                (timer%60).toString().padStart(2, '0')
              );
            }}>
              <MaterialCommunityIcons name="clock-outline" size={24} color="#3B82F6" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.finishButton}
              onPress={endWorkout}
            >
              <Text style={styles.finishButtonText}>FINISH</Text>
            </TouchableOpacity>
          </View>
          
          {/* Workout Title and Timer */}
          <View style={styles.workoutTitleSection}>
            <TextInput
              style={styles.workoutTitleInput}
              value={workoutTitle}
              onChangeText={setWorkoutTitle}
              placeholder="Workout Title"
              placeholderTextColor="#999"
            />
            
            <View style={styles.timerDisplay}>
              <Text style={styles.timerText}>
                {Math.floor(timer/60).toString().padStart(2, '0')}:{(timer%60).toString().padStart(2, '0')}
              </Text>
              <MaterialCommunityIcons 
                name={isTiming ? "pause-circle" : "play-circle"} 
                size={24} 
                color="#3B82F6" 
                style={styles.timerIcon}
                onPress={() => setIsTiming(!isTiming)}
              />
            </View>
            
            {/* Workout Note */}
            <TouchableOpacity
              style={styles.workoutNoteContainer}
              onPress={() => setShowNoteInput(true)}
              activeOpacity={0.7}
            >
              {showNoteInput ? (
                <TextInput
                  style={styles.workoutNoteInput}
                  value={workoutNote}
                  onChangeText={setWorkoutNote}
                  placeholder="Add workout notes..."
                  placeholderTextColor="#999"
                  multiline
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onBlur={() => setShowNoteInput(false)}
                  autoFocus
                />
              ) : (
                <Text style={[
                  styles.workoutNoteText,
                  !workoutNote && styles.workoutNotePlaceholder
                ]}>
                  {workoutNote || "Add workout notes..."}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Exercise List */}
          <ScrollView 
            style={styles.exercisesContainer} 
            contentContainerStyle={styles.exercisesContent}
            showsVerticalScrollIndicator={false}
          >
            {workouts.length === 0 ? (
              <View style={styles.emptyExercises}>
                <MaterialCommunityIcons name="dumbbell" size={48} color="#333" />
                <Text style={styles.emptyExercisesText}>
                  No exercises added yet
                </Text>
                <TouchableOpacity 
                  style={styles.addFirstExerciseButton}
                  onPress={() => {
                    setSearchQuery('');
                    setFilteredExercises(exercises);
                    setSearchModalVisible(true);
                  }}
                >
                  <Text style={styles.addFirstExerciseText}>Add Exercise</Text>
                </TouchableOpacity>
              </View>
            ) : (
              workouts.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>
                      {exercise.name}
                    </Text>
                    <View style={styles.exerciseActions}>
                      <TouchableOpacity 
                        style={styles.exerciseAction}
                        onPress={() => handleDeleteExercise(exercise.id)}
                      >
                        <MaterialCommunityIcons name="delete" size={22} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Exercise Sets Table */}
                  <View style={styles.setsTable}>
                    <View style={styles.setsTableHeader}>
                      <Text style={styles.setsTableHeaderCell}>SET</Text>
                      <Text style={styles.setsTableHeaderCell}>KG</Text>
                      <Text style={styles.setsTableHeaderCell}>REPS</Text>
                      <Text style={[styles.setsTableHeaderCell, {flex: 0.5}]}></Text>
                    </View>
                    
                    {/* Sets for this exercise */}
                    {exercise.sets.map((set, setIndex) => (
                      <TouchableOpacity 
                        key={setIndex} 
                        style={styles.setRow}
                        onPress={() => toggleSetCompletion(exercise.id, setIndex)}
                        onLongPress={() => handleEditSet(exercise.id, setIndex)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.setCell}>{setIndex + 1}</Text>
                        <Text style={styles.setCell}>{set.weight}</Text>
                        <Text style={styles.setCell}>{set.reps}</Text>
                        <View style={[styles.setCell, {flex: 0.5, alignItems: 'center'}]}>
                          <MaterialCommunityIcons 
                            name={set.completed ? "check-circle" : "circle-outline"} 
                            size={22} 
                            color={set.completed ? "#22C55E" : "#666"} 
                          />
                        </View>
                        
                        {/* Delete set button - visible on long press */}
                        <TouchableOpacity
                          style={styles.deleteSetButton}
                          onPress={() => handleDeleteSet(exercise.id, setIndex)}
                        >
                          <MaterialCommunityIcons name="delete" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                    
                    {/* Add new set button */}
                    <TouchableOpacity
                      style={styles.addSetButton}
                      onPress={() => handleAddSet(exercise.id)}
                    >
                      <MaterialCommunityIcons name="plus" size={18} color="#3B82F6" />
                      <Text style={styles.addSetText}>Add Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            
            {/* Add exercise button - shown if there are already exercises */}
            {workouts.length > 0 && (
              <TouchableOpacity
                style={styles.addExerciseCardButton}
                onPress={() => {
                  setSearchQuery('');
                  setFilteredExercises(exercises);
                  setSearchModalVisible(true);
                }}
              >
                <MaterialCommunityIcons name="plus" size={24} color="#3B82F6" />
                <Text style={styles.addExerciseCardText}>Add Exercise</Text>
              </TouchableOpacity>
            )}
            
            {/* Bottom padding for scrolling */}
            <View style={{ height: 100 }} />
          </ScrollView>
          
          {/* Bottom action buttons */}
          <View style={styles.bottomActions}>
            <TouchableOpacity 
              style={styles.addExerciseButton}
              onPress={() => {
                setSearchQuery('');
                setFilteredExercises(exercises);
                setSearchModalVisible(true);
              }}
            >
              <Text style={styles.addExerciseButtonText}>ADD EXERCISE</Text>
            </TouchableOpacity>
            
            {workouts.length > 0 && (
              <TouchableOpacity 
                style={styles.cancelWorkoutButton}
                onPress={() => {
                  Alert.alert(
                    "Cancel Workout",
                    "Are you sure you want to cancel this workout? All progress will be lost.",
                    [
                      { text: "No", style: "cancel" },
                      { text: "Yes", style: "destructive", onPress: () => {
                        setWorkouts([]);
                        setIsWorkoutStarted(false);
                        setTimer(0);
                        setIsTiming(false);
                        setWorkoutTitle("My Workout");
                        setWorkoutNote("");
                      }}
                    ]
                  );
                }}
              >
                <Text style={styles.cancelWorkoutButtonText}>CANCEL WORKOUT</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      {/* Exercise Search Modal */}
      <ExerciseSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        exercises={filteredExercises}
        onSelectExercise={selectExercise}
        searchQuery={searchQuery}
        onSearchChange={handleSearch}
        loadingExercises={loadingExercises}
      />
      
      {/* Exercise Set Modal */}
      <ExerciseSetModal
        visible={setModalVisible}
        onClose={() => {
          setSetModalVisible(false);
          setEditingSet(null);
          setEditingSetIndex(null);
        }}
        exerciseName={selectedExercise?.name}
        onSave={handleSaveSet}
        editingSet={editingSet}
        editingIndex={editingSetIndex}
      />
      
      {/* Completion Modal */}
      <CompletionModal
        visible={isWorkoutEnded}
        onDismiss={() => setIsWorkoutEnded(false)}
        onSave={saveToProfile}
        onPost={postWorkout}
        timer={timer}
        workouts={workouts}
        saveLoading={saveLoading}
        postLoading={postLoading}
      />
      
      {/* Templates Modal */}
      <TemplatesModal
        visible={templatesModalVisible}
        onClose={() => setTemplatesModalVisible(false)}
        templates={templates}
        loading={loadingTemplates}
        onApplyTemplate={applyTemplate}
      />
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
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 24,
  },
  startWorkoutCard: {
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  cardGradient: {
    borderRadius: 24,
    padding: 24,
  },
  startWorkoutTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  startButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  templatesButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  templatesButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '500',
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  completionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
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
});
