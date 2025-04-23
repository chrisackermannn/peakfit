import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  FlatList,
  RefreshControl
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
import { useFocusEffect } from '@react-navigation/native';

// First, create a Safe ScrollView that properly handles all layout properties
const SafeScrollView = forwardRef(({ 
  children, 
  style, 
  contentContainerStyle,
  refreshControl,
  ...props 
}, ref) => {
  return (
    <ScrollView
      ref={ref}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={contentContainerStyle}
      refreshControl={refreshControl}
      {...props}
    >
      {children}
    </ScrollView>
  );
});

// SafeBackdrop component with proper styling
const SafeBackdrop = ({ children, style }) => {
  return (
    <View style={[
      StyleSheet.absoluteFill, 
      { backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
      style
    ]}>
      {children}
    </View>
  );
};

// Exercise Details Modal - for adding sets to selected exercise
const SetModal = ({ 
  visible, 
  onClose, 
  onSave, 
  exerciseName,
  editingSet = null,
  editingIndex = null,
  insets
}) => {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (visible) {
      if (editingSet) {
        setWeight(editingSet.weight.toString());
        setReps(editingSet.reps.toString());
      } else {
        setWeight('');
        setReps('');
      }
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
      completed: editingSet ? editingSet.completed : false
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

// Search modal for exercises
const ExerciseSearchModal = ({ 
  visible, 
  onClose, 
  exercises, 
  onSelectExercise, 
  searchQuery, 
  onSearchChange,
  loadingExercises 
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeBackdrop>
        <View style={styles.exerciseModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Find Exercise</Text>
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
              keyExtractor={(item, index) => item.id?.toString() || item.name?.toString() || index.toString()}
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
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No exercises found. Try a different search.
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
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
  const insets = useSafeAreaInsets();
  
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

// Exercise Demo Modal component
const ExerciseDemoModal = ({ visible, onClose, exercise }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeBackdrop style={styles.blurContainer}>
        <View style={[styles.demoModalContent, { 
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
          marginHorizontal: 20
        }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{exercise?.name || 'Exercise Demo'}</Text>
            <IconButton
              icon="close"
              size={24}
              color="#FFF"
              onPress={onClose}
            />
          </View>
          
          <View style={styles.gifContainer}>
            {exercise?.gifUrl ? (
              <>
                <ActivityIndicator 
                  style={loading ? styles.loadingOverlay : {display: 'none'}} 
                  size="large" 
                  color="#3B82F6" 
                />
                <Image 
                  source={{ uri: exercise.gifUrl }} 
                  style={styles.exerciseGif}
                  onLoadStart={() => setLoading(true)}
                  onLoad={() => setLoading(false)}
                  resizeMode="contain"
                />
              </>
            ) : (
              <View style={styles.noGifContainer}>
                <MaterialCommunityIcons name="image-off" size={60} color="#666" />
                <Text style={styles.noGifText}>No demonstration available</Text>
              </View>
            )}
          </View>
          
          {exercise?.instructions && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Instructions:</Text>
              <Text style={styles.instructionsText}>{exercise.instructions}</Text>
            </View>
          )}
          
          {exercise?.equipment && (
            <View style={styles.metaInfoRow}>
              <MaterialCommunityIcons name="dumbbell" size={20} color="#3B82F6" />
              <Text style={styles.metaInfoText}>{exercise.equipment}</Text>
            </View>
          )}
          
          {exercise?.muscle && (
            <View style={styles.metaInfoRow}>
              <MaterialCommunityIcons name="arm-flex" size={20} color="#3B82F6" />
              <Text style={styles.metaInfoText}>{exercise.muscle}</Text>
            </View>
          )}
        </View>
      </SafeBackdrop>
    </Modal>
  );
};

// Template selection modal with improved LinearGradient and centered content
const TemplatesModal = ({ visible, onClose, templates, onApply, loading }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeBackdrop>
        <View style={[
          styles.templateModalContainer,
          { paddingBottom: Math.max(insets.bottom, 20) }
        ]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Workout Templates</Text>
            <IconButton
              icon="close"
              size={24}
              color="#FFF"
              onPress={onClose}
            />
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : templates.length === 0 ? (
            <View style={styles.emptyTemplatesContainer}>
              <MaterialCommunityIcons name="file-document-outline" size={48} color="#444" />
              <Text style={styles.emptyTemplatesText}>
                You don't have any saved templates
              </Text>
              <Text style={styles.emptyTemplatesSubtext}>
                Create templates by saving workouts
              </Text>
            </View>
          ) : (
            <FlatList
              data={templates}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.templateItem}
                  onPress={() => onApply(item)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#1F2937', '#111827']}
                    style={styles.templateItemGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{item.name || 'Unnamed Template'}</Text>
                      <Text style={styles.templateMeta}>
                        {item.exercises?.length || 0} exercises
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.templatesList}
            />
          )}
        </View>
      </SafeBackdrop>
    </Modal>
  );
};

// Add a Template button to the WorkoutScreen
const renderTemplateButton = () => (
  <TouchableOpacity
    style={styles.templateButton}
    onPress={async () => {
      await refreshTemplates(); // Refresh templates when button is pressed
      setTemplatesModalVisible(true);
    }}
  >
    <LinearGradient
      colors={['#1F2937', '#111827']}
      style={styles.templateButtonGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <MaterialCommunityIcons name="file-document-outline" size={20} color="#FFFFFF" />
      <Text style={styles.templateButtonText}>Templates</Text>
    </LinearGradient>
  </TouchableOpacity>
);

// Add this function to fetch the latest templates from Firebase
const refreshTemplates = async () => {
  try {
    if (!user?.uid) return;
    
    console.log("Refreshing user templates from Firebase...");
    const latestTemplates = await getUserTemplates(user.uid);
    setTemplates(latestTemplates);
    console.log(`Fetched ${latestTemplates.length} templates from Firebase`);
    
    return latestTemplates;
  } catch (error) {
    console.error("Error refreshing templates:", error);
    return null;
  }
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
  const [demoModalVisible, setDemoModalVisible] = useState(false);
  const [selectedDemoExercise, setSelectedDemoExercise] = useState(null);
  
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
  
  // State for refreshing
  const [refreshing, setRefreshing] = useState(false);
  
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
  
  // Select exercise from search and ensure it has a GIF
  const selectExercise = async (exercise) => {
    console.log("Exercise selected:", exercise.name);
    
    // If no GIF URL exists, try to fetch it
    if (!exercise.gifUrl && exercise.name) {
      try {
        const searchResults = await searchExercises(exercise.name);
        if (searchResults && searchResults.length > 0) {
          // Find the best match
          const match = searchResults.find(result => 
            result.name.toLowerCase() === exercise.name.toLowerCase()
          ) || searchResults[0];
          
          exercise = {
            ...exercise,
            gifUrl: match.gifUrl,
            equipment: exercise.equipment || match.equipment,
            muscle: exercise.muscle || match.target || match.muscle,
            instructions: exercise.instructions || match.instructions
          };
        }
      } catch (error) {
        console.log(`Could not fetch additional details for ${exercise.name}:`, error);
      }
    }
    
    setSelectedExercise({
      name: exercise.name,
      id: exercise.id,
      gifUrl: exercise.gifUrl,
      equipment: exercise.equipment,
      muscle: exercise.muscle || exercise.target,
      instructions: exercise.instructions
    });
    
    // Generate unique ID for this exercise
    const newExerciseId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setCurrentExerciseId(newExerciseId);
    
    // Close search modal and open set modal
    setSearchModalVisible(false);
    
    setTimeout(() => {
      setSetModalVisible(true);
    }, 100);
  };
  
  // Add or update set to an exercise
  const handleSaveSet = (setData, editingIndex = null) => {
    // If this is a new exercise
    if (!workouts.some(workout => workout.id === currentExerciseId)) {
      setWorkouts(prevWorkouts => [
        ...prevWorkouts,
        {
          id: currentExerciseId,
          name: selectedExercise.name,
          sets: [setData],
          // Save exercise details
          apiId: selectedExercise.id,
          gifUrl: selectedExercise.gifUrl,
          equipment: selectedExercise.equipment,
          muscle: selectedExercise.muscle,
          instructions: selectedExercise.instructions
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

  // Show exercise demo
  const handleShowDemo = async (exercise) => {
    setSelectedDemoExercise({
      ...exercise,
      gifUrl: exercise.gifUrl || null
    });
    setDemoModalVisible(true);
    
    // If no GIF URL exists, try to fetch it
    if (!exercise.gifUrl && exercise.name) {
      try {
        console.log("Fetching GIF for exercise:", exercise.name);
        const searchResults = await searchExercises(exercise.name);
        
        if (searchResults && searchResults.length > 0) {
          // Find the match that's most similar to our exercise name
          const match = searchResults.find(result => 
            result.name.toLowerCase() === exercise.name.toLowerCase()
          ) || searchResults[0];
          
          if (match && match.gifUrl) {
            console.log("Found match:", match.name);
            
            // Update the exercise with GIF and additional info
            setSelectedDemoExercise(prev => ({
              ...prev,
              gifUrl: match.gifUrl,
              equipment: prev.equipment || match.equipment,
              muscle: prev.muscle || match.target || match.muscle,
              instructions: prev.instructions || match.instructions
            }));
            
            // Also update the exercise in our workouts array for future reference
            setWorkouts(prevWorkouts => prevWorkouts.map(workout => {
              if (workout.id === exercise.id) {
                return {
                  ...workout,
                  gifUrl: match.gifUrl,
                  equipment: workout.equipment || match.equipment,
                  muscle: workout.muscle || match.target || match.muscle,
                  instructions: workout.instructions || match.instructions
                };
              }
              return workout;
            }));
          }
        }
      } catch (error) {
        console.log(`Could not fetch GIF for ${exercise.name}:`, error);
      }
    }
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
    if (!user?.uid) return Promise.resolve();
    
    try {
      setLoadingTemplates(true);
      const userTemplates = await getUserTemplates(user.uid);
      setTemplates(userTemplates);
      return userTemplates; // Return templates for promise chaining
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', 'Failed to load your workout templates');
      throw error; // Propagate error for promise chaining
    } finally {
      setLoadingTemplates(false);
    }
  };
  
  // Update the applyTemplate function
  const onApply = async (template) => {
    if (!template?.exercises || !Array.isArray(template.exercises)) {
      Alert.alert('Invalid Template', 'This template has no exercises.');
      return;
    }
    
    try {
      // Refresh templates first to get the most current data
      await refreshTemplates();
      
      // Now proceed with applying the template
      const exercises = template.exercises;
      console.log(`Applying template with ${exercises.length} exercises`);
      
      // Create workout entries for each exercise in the template
      const newWorkouts = exercises.map(exercise => {
        const exerciseId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        
        // Map each set but remove the weight value
        let sets = [];
        if (exercise.setDetails && Array.isArray(exercise.setDetails)) {
          sets = exercise.setDetails.map(set => ({
            reps: set.reps, // Keep reps from template
            weight: 0, // Set weight to 0 instead of using template value
            completed: false // Reset completion status
          }));
        }
        
        return {
          id: exerciseId,
          name: exercise.name,
          apiId: exercise.apiId,
          gifUrl: exercise.gifUrl,
          equipment: exercise.equipment,
          muscle: exercise.muscle,
          instructions: exercise.instructions,
          sets: sets
        };
      });
      
      // Set the workouts state
      setWorkouts(prevWorkouts => [...prevWorkouts, ...newWorkouts]);
      
      // Close the template modal and start the workout
      setTemplatesModalVisible(false);
      
      if (!isWorkoutStarted) {
        setIsWorkoutStarted(true);
        setIsTiming(true);
      }
      
      // Show success message
      Alert.alert('Template Applied', `Added ${newWorkouts.length} exercises to your workout. Please set your weights.`);
    } catch (error) {
      console.error("Error applying template:", error);
      Alert.alert('Error', 'Failed to apply template. Please try again.');
    }
  };

  // Improved fetchMissingGifs function with better API integration
  const fetchMissingGifs = async (exercises) => {
    // Create a new array for exercises that need to be updated
    const updatedExercises = [...exercises];
    let hasChanges = false;
    
    // Process each exercise that doesn't have a GIF
    for (let i = 0; updatedExercises.length; i++) {
      const exercise = updatedExercises[i];
      
      if (!exercise.gifUrl && exercise.name) {
        try {
          console.log(`Fetching GIF for ${exercise.name}`);
          const searchResults = await searchExercises(exercise.name);
          
          if (searchResults && searchResults.length > 0) {
            // Find best match or use first result
            const match = searchResults.find(result => 
              result.name.toLowerCase() === exercise.name.toLowerCase()
            ) || searchResults[0];
            
            if (match && match.gifUrl) {
              // Update exercise with API data
              updatedExercises[i] = {
                ...exercise,
                gifUrl: match.gifUrl,
                equipment: exercise.equipment || match.equipment,
                muscle: exercise.muscle || match.target || match.muscle,
                instructions: exercise.instructions || match.instructions
              };
              
              hasChanges = true;
              console.log(`GIF found for ${exercise.name}`);
            }
          }
        } catch (error) {
          console.log(`Could not fetch GIF for ${exercise.name}:`, error);
        }
      }
    }
    
    // Only update state if we actually made changes
    if (hasChanges) {
      setWorkouts(updatedExercises);
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

  // Add refresh handler function
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    
    // Reload templates
    if (user?.uid) {
      loadTemplates()
        .then(() => {
          // Refresh exercise list
          return getInitialExercises(50);
        })
        .then((data) => {
          setExercises(data);
          setFilteredExercises(data);
        })
        .catch((error) => {
          console.error('Error refreshing data:', error);
        })
        .finally(() => {
          setRefreshing(false);
        });
    } else {
      setRefreshing(false);
    }
  }, [user?.uid]);

  // Use this focus effect to refresh templates whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // This will run when the screen is focused (navigated to)
      console.log("WorkoutScreen focused - refreshing templates");
      
      if (user?.uid) {
        // Load latest templates every time screen is focused
        loadTemplates()
          .then(templates => {
            console.log(`Refreshed templates: ${templates?.length || 0} templates loaded`);
          })
          .catch(error => {
            console.error("Error refreshing templates on focus:", error);
          });
      }
      
      // Return cleanup function (optional)
      return () => {
        // Anything to clean up when screen loses focus
      };
    }, [user?.uid])
  );
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {!isWorkoutStarted ? (
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
            
            <TouchableOpacity
              style={styles.templatesButton}
              onPress={() => setTemplatesModalVisible(true)}
            >
              <LinearGradient
                colors={['#1F2937', '#111827']}
                style={styles.templatesButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="file-document-outline" size={24} color="#FFFFFF" />
                <Text style={styles.templatesButtonText}>Use Template</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.activeWorkoutHeader}>
            <TouchableOpacity 
              onPress={() => {
                Alert.alert(
                  "Cancel Workout",
                  "Are you sure you want to cancel your workout? All progress will be lost.",
                  [
                    { text: "No", style: "cancel" },
                    { 
                      text: "Yes", 
                      style: "destructive",
                      onPress: () => {
                        clearInterval(timerRef.current);
                        setIsTiming(false);
                        setIsWorkoutStarted(false);
                        setWorkouts([]);
                        setTimer(0);
                      }
                    }
                  ]
                );
              }}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FF3B30" />
            </TouchableOpacity>
            
            <TextInput
              style={styles.workoutTitleInput}
              value={workoutTitle}
              onChangeText={setWorkoutTitle}
              placeholder="Workout Title"
              placeholderTextColor="#999"
            />
            
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                {Math.floor(timer/60).toString().padStart(2, '0')}:{(timer%60).toString().padStart(2, '0')}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.finishButton}
              onPress={endWorkout}
            >
              <Text style={styles.finishButtonText}>Finish</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{flex: 1}}>
            {workouts.length === 0 ? (
              <View style={styles.emptyExercisesContainer}>
                <MaterialCommunityIcons name="dumbbell" size={48} color="#333" />
                <Text style={styles.emptyExercisesText}>No exercises added yet</Text>
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
              <>
                {workouts.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <View style={styles.exerciseActions}>
                        <TouchableOpacity 
                          style={styles.exerciseAction}
                          onPress={() => handleShowDemo(exercise)}
                        >
                          <MaterialCommunityIcons name="information" size={22} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.exerciseAction}
                          onPress={() => handleDeleteExercise(exercise.id)}
                        >
                          <MaterialCommunityIcons name="delete" size={22} color="#666" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={styles.setsTable}>
                      <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderText}>SET</Text>
                        <Text style={styles.tableHeaderText}>LB</Text>
                        <Text style={styles.tableHeaderText}>REPS</Text>
                        <Text style={styles.tableHeaderText}></Text>
                      </View>
                      
                      {exercise.sets.map((set, setIndex) => (
                        <View key={setIndex} style={styles.setRow}>
                          <Text style={styles.setCell}>{setIndex + 1}</Text>
                          <Text style={styles.setCell}>{set.weight || '-'}</Text>
                          <Text style={styles.setCell}>{set.reps || '-'}</Text>
                          <View style={styles.setCellActions}>
                            <TouchableOpacity 
                              style={styles.editSetButton}
                              onPress={() => handleEditSet(exercise.id, setIndex)}
                            >
                              <MaterialCommunityIcons name="pencil" size={20} color="#3B82F6" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => toggleSetCompletion(exercise.id, setIndex)}
                            >
                              <MaterialCommunityIcons 
                                name={set.completed ? "check-circle" : "circle-outline"} 
                                size={22} 
                                color={set.completed ? "#22C55E" : "#666"} 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                    
                    <TouchableOpacity
                      style={styles.addSetButton}
                      onPress={() => handleAddSet(exercise.id)}
                    >
                      <MaterialCommunityIcons name="plus" size={18} color="#3B82F6" />
                      <Text style={styles.addSetText}>Add Set</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                
                <TouchableOpacity
                  style={styles.addExerciseCardButton}
                  onPress={() => {
                    setSearchQuery('');
                    setFilteredExercises(exercises);
                    setSearchModalVisible(true);
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#3B82F6" />
                  <Text style={styles.addExerciseCardText}>Add Exercise</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Modals */}
      <ExerciseSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        exercises={filteredExercises}
        onSelectExercise={selectExercise}
        searchQuery={searchQuery}
        onSearchChange={handleSearch}
        loadingExercises={loadingExercises}
      />
      
      <SetModal
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
        insets={insets}
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
      
      <ExerciseDemoModal
        visible={demoModalVisible}
        onClose={() => setDemoModalVisible(false)}
        exercise={selectedDemoExercise}
      />
      
      <TemplatesModal
        visible={templatesModalVisible}
        onClose={() => setTemplatesModalVisible(false)}
        templates={templates}
        onApply={onApply}
        loading={loadingTemplates}
      />
    </SafeAreaView>
  );
}

// Fix for the styles error in WorkoutScreen.js
// Replace your current styles definition with this complete StyleSheet

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  // Empty states
  emptyExercisesContainer: {
    padding: 40,
  },
  emptyExercisesContent: {
    alignItems: 'center', 
    justifyContent: 'center',
  },
  emptyExercisesText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButtonsRow: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal backgrounds
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0, // Keep top position the same
    paddingBottom: 20, // Add extra space at bottom
  },
  // Button styles
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
  templateButton: {
    overflow: 'hidden',
    borderRadius: 12,
    marginLeft: 12,
  },
  templateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  templateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Start screen styles
  startWorkoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  startWorkoutContent: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoBackground: {
    width: 100,
    height: 100,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  startButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  templatesButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
  },
  templatesButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  templatesButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  // Exercise card styles
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
    color: '#FFFFFF',
    flex: 1,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseAction: {
    padding: 8,
    marginLeft: 8,
  },
  // Sets table styles
  setsTable: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#222',
    padding: 10,
  },
  tableHeaderText: {
    flex: 1,
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  setCell: {
    flex: 1,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  setCellActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  editSetButton: {
    padding: 6,
    marginRight: 8,
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
  // Workout header styles
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
    color: '#FFFFFF',
    padding: 0,
  },
  workoutNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  workoutNoteButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    marginLeft: 4,
  },
  workoutNoteContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginRight: 8,
  },
  timerIcon: {
    marginTop: 2,
  },
  // Modal styles for exercise demo
  demoModalContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    margin: 16,
    maxHeight: '80%',
    width: '90%',
    maxWidth: 600,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  demoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  demoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  gifContainer: {
    height: 250,
    backgroundColor: '#121212',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  exerciseGif: {
    width: '100%',
    height: '100%',
    backgroundColor: '#121212',
  },
  loadingOverlay: {
    position: 'absolute',
    zIndex: 2,
    alignItems: 'center', 
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  noGifContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noGifText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  metaInfoText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
  },
  instructionsContainer: {
    marginTop: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
  },
  // Set modal styles
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
  // Search modal styles
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Template modal styles
  templateModalContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    margin: 16,
    maxHeight: '80%',
    maxWidth: 600,
    width: '90%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  templatesList: {
    padding: 16,
  },
  templateItem: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  templateItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  templateMeta: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyTemplatesContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTemplatesText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyTemplatesSubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  // Search exercise styles
  exerciseModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    margin: 16,
    maxHeight: '80%',
    maxWidth: 600,
    width: '90%',
    alignSelf: 'center',
    flex: 1,
  },
  searchSection: {
    position: 'relative',
    marginBottom: 16,
    marginHorizontal: 16,
  },
  searchInput: {
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 44,
    borderRadius: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  exerciseItemText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  // Loading and empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  // Workout completion styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  completionModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center', // Center the content
    width: '100%',
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
    width: '100%',
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
    width: '100%',
  },
  completionActions: {
    width: '100%',
    gap: 12,
  },
  completionButton: {
    borderRadius: 12,
    paddingVertical: 2,
    width: '100%', // Make buttons full width
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
});

export default WorkoutScreen;
