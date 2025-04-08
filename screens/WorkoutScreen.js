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
  Alert
} from 'react-native';
import { Button, Surface, IconButton } from 'react-native-paper';
import { getInitialExercises, searchExercises } from '../data/exerciseAPI';
import { saveWorkoutToProfile, saveWorkoutGlobally, getUserTemplates } from '../data/firebaseHelpers';
import { useAuth } from '../context/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Add this component at the top of your WorkoutScreen.js file
const CompletionModal = ({ visible, onDismiss, onSave, onPost, timer, workouts, saveLoading, postLoading }) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="slide"
    onRequestClose={onDismiss}
  >
    <View style={styles.completionModalContainer}>
      <Surface style={styles.completionModalContent}>
        <View style={{ overflow: 'hidden' }}>
          <Text style={styles.completionTitle}>Workout Complete! 🎉</Text>
          
          <View style={styles.workoutSummary}>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="clock-outline" size={24} color="#007AFF" />
              <Text style={styles.summaryValue}>
                {Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}
              </Text>
              <Text style={styles.summaryLabel}>Duration</Text>
            </View>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="dumbbell" size={24} color="#007AFF" />
              <Text style={styles.summaryValue}>{workouts.length}</Text>
              <Text style={styles.summaryLabel}>Exercises</Text>
            </View>
          </View>

          <View style={styles.completionActions}>
            <Button
              mode="contained"
              onPress={onSave}
              style={[styles.completionButton, styles.saveButton]}
              loading={saveLoading}
            >
              Save to Profile
            </Button>
            <Button
              mode="contained"
              onPress={onPost}
              style={[styles.completionButton, styles.postButton]}
              loading={postLoading}
            >
              Share Workout
            </Button>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.dismissButton}
              color="#007AFF"
              labelStyle={{ color: '#007AFF' }}
            >
              Dismiss
            </Button>
          </View>
        </View>
      </Surface>
    </View>
  </Modal>
);

const TemplatesModal = ({ visible, onClose, templates, loading, onApplyTemplate }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Surface style={styles.modalContent}>
          <View style={{ overflow: 'hidden' }}>
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
                      <View style={styles.templateIcon}>
                        <MaterialCommunityIcons name="dumbbell" size={24} color="#3B82F6" />
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
              />
            )}
          </View>
        </Surface>
      </View>
    </Modal>
  );
};

const WorkoutHeader = ({ timer, onClose }) => (
  <View style={styles.headerContainer}>
    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
      <MaterialCommunityIcons name="close" size={28} color="#FF3B30" />
    </TouchableOpacity>
    <Text style={styles.timerDisplay}>
      {Math.floor(timer/60).toString().padStart(2, '0')}:
      {(timer%60).toString().padStart(2, '0')}
    </Text>
    <TouchableOpacity style={styles.settingsButton}>
      <MaterialCommunityIcons name="cog" size={24} color="#666" />
    </TouchableOpacity>
  </View>
);

export default function WorkoutScreen({ navigation }) {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [isWorkoutStarted, setIsWorkoutStarted] = useState(false);
  const [isWorkoutEnded, setIsWorkoutEnded] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesModalVisible, setTemplatesModalVisible] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // Fix - Adding startWorkout function
  const startWorkout = () => {
    setIsWorkoutStarted(true);
    setIsTiming(true);
  };
  
  const endWorkout = () => {
    setIsTiming(false);
    setIsWorkoutEnded(true);
  };
  
  useEffect(() => {
    const fetchExercises = async () => {
      setLoadingExercises(true);
      try {
        const data = await getInitialExercises(30);
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
  
  useEffect(() => {
    if (user?.uid) {
      loadTemplates();
    }
  }, [user]);
  
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
  
  const selectExercise = (exercise) => {
    setSelectedExercise(exercise);
  };
  
  const handleEditExercise = (exercise) => {
    setEditingExercise(exercise);
    setSelectedExercise({ name: exercise.name });
    setWeight(exercise.weight.toString());
    setReps(exercise.reps.toString());
    setSets(exercise.sets.toString());
    setModalVisible(true);
  };
  
  const addWorkout = () => {
    if (!selectedExercise) {
      alert('Please select an exercise.');
      return;
    }
    
    if (!weight || !reps || !sets) {
      alert('Please fill in all exercise details.');
      return;
    }
    
    // Validate inputs are positive numbers
    const weightNum = parseFloat(weight);
    const repsNum = parseInt(reps);
    const setsNum = parseInt(sets);
    
    if (isNaN(weightNum) || weightNum <= 0 ||
        isNaN(repsNum) || repsNum <= 0 ||
        isNaN(setsNum) || setsNum <= 0) {
      alert('Please enter valid positive numbers for weight, reps, and sets.');
      return;
    }
    
    const exerciseData = {
      id: editingExercise?.id || Date.now().toString(),
      name: selectedExercise.name,
      weight: weightNum,
      reps: repsNum,
      sets: setsNum,
    };
    
    if (editingExercise) {
      // Update existing exercise
      const updatedWorkouts = workouts.map(w => 
        w.id === editingExercise.id ? exerciseData : w
      );
      setWorkouts(updatedWorkouts);
    } else {
      // Add new exercise
      setWorkouts([...workouts, exerciseData]);
    }
    
    // Clear form and close modal
    setModalVisible(false);
    setEditingExercise(null);
    setSelectedExercise(null);
    setWeight('');
    setReps('');
    setSets('');
  };
  
  const deleteWorkout = (index) => {
    const updated = [...workouts];
    updated.splice(index, 1);
    setWorkouts(updated);
  };
  
  const saveToProfile = async () => {
    if (!user?.uid) {
      alert('Please login to save workouts');
      return;
    }
    
    try {
      setSaveLoading(true);
      const workoutData = {
        date: serverTimestamp(),
        duration: timer,
        exercises: workouts,
        notes: '',
        isPublic: false
      };
      
      // Save to Firebase
      await saveWorkoutToProfile(user.uid, workoutData);
      
      // Save to HealthKit if available
      if (HealthKitService.isAvailable) {
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
      } else {
        console.log('HealthKit not available, skipping workout save');
      }
      
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.delay(1000),
        Animated.timing(fadeAnim, {
          toValue: 0, 
          duration: 500,
          useNativeDriver: true
        })
      ]).start();
      
      setWorkouts([]);
      setIsWorkoutStarted(false);
      setIsWorkoutEnded(false);
      setTimer(0);
    } catch (error) {
      alert('Error saving workout: ' + error.message);
    } finally {
      setSaveLoading(false);
    }
  };
  
  const postWorkout = async () => {
    if (!user?.uid) {
      alert('Please login to post workouts');
      return;
    }
    
    try {
      setPostLoading(true);
      
      if (!workouts.length) {
        throw new Error('Cannot share empty workout');
      }
      
      const workoutData = {
        date: serverTimestamp(),
        duration: timer,
        exercises: workouts,
        notes: '',
        type: 'workout',
        visibility: 'public',
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        likes: 0,
        comments: [],
        metrics: {
          totalExercises: workouts.length,
          totalSets: workouts.reduce((acc, curr) => acc + curr.sets, 0),
          totalReps: workouts.reduce((acc, curr) => acc + (curr.sets * curr.reps), 0)
        }
      };
      
      await saveWorkoutGlobally(workoutData);
      
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.delay(1000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        })
      ]).start();
      
      setWorkouts([]);
      setIsWorkoutStarted(false);
      setIsWorkoutEnded(false); 
      setTimer(0);
    } catch (error) {
      alert('Error sharing workout: ' + error.message);
    } finally {
      setPostLoading(false);
    }
  };
  
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
  
  const applyTemplate = (template) => {
    const templateExercises = template.exercises.map(ex => ({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: '' // Empty weight for user to fill in
    }));
    
    setWorkouts(templateExercises);
    setTemplatesModalVisible(false);
    
    if (!isWorkoutStarted) {
      setIsWorkoutStarted(true);
      setIsTiming(true);
    }
    
    Alert.alert(
      'Template Applied',
      'The workout template has been loaded. Please fill in your desired weights.'
    );
  };

  // Helper function to estimate calories
  const calculateCalories = (exercises) => {
    // Implement a basic calorie calculation based on exercises
    // This is a very simplified example
    const totalWeight = exercises.reduce((acc, exercise) => {
      return acc + (exercise.weight * exercise.sets * exercise.reps);
    }, 0);
    
    // Very rough estimate: 1 calorie per 10 pounds lifted
    return Math.round(totalWeight / 10);
  };

  return (
    <SafeAreaView style={styles.container}>
      {!isWorkoutStarted ? (
        <View style={styles.startWorkoutContainer}>
          <Surface style={styles.workoutInfoCard}>
            <View style={{ overflow: 'hidden' }}>
              <Text style={styles.workoutTitle}>Start New Workout</Text>
              <View style={styles.startButtonRow}>
                <TouchableOpacity onPress={startWorkout} style={styles.startButton}>
                  <MaterialCommunityIcons name="dumbbell" size={32} color="#fff" />
                  <Text style={styles.startButtonText}>Begin Workout</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.templatesButton}
                onPress={() => {
                  loadTemplates();
                  setTemplatesModalVisible(true);
                }}
              >
                <MaterialCommunityIcons name="file-document-outline" size={24} color="#FFF" />
                <Text style={styles.templatesButtonText}>Use Template</Text>
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      ) : (
        <View style={styles.workoutContainer}>
          <WorkoutHeader 
            timer={timer} 
            onClose={() => {
              // Stop timing before closing
              setIsTiming(false);
              clearInterval(timerRef.current);
              // Ask confirmation before closing if workout has sets
              if (workouts.length > 0) {
                Alert.alert(
                  "End Workout",
                  "Are you sure you want to end this workout?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "End", onPress: () => setIsWorkoutStarted(false) }
                  ]
                );
              } else {
                setIsWorkoutStarted(false);
              }
            }}
          />

          {/* Timer Card */}
          <Surface style={styles.timerCard}>
            <Text style={styles.timerValue}>
              {Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}
            </Text>
            <Text style={styles.timerLabel}>Workout Duration</Text>
          </Surface>
          
          {/* Exercise Count Indicator */}
          <View style={styles.statsIndicator}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="dumbbell" size={22} color="#3B82F6" />
              <Text style={styles.statText}>{workouts.length} Exercises</Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="repeat" size={22} color="#3B82F6" />
              <Text style={styles.statText}>
                {workouts.reduce((acc, curr) => acc + curr.sets, 0)} Total Sets
              </Text>
            </View>
          </View>
          
          {/* Exercise List */}
          <View style={styles.exerciseListContainer}>
            <Text style={styles.sectionTitle}>Current Workout</Text>
            
            {workouts.length === 0 ? (
              <View style={styles.emptyExerciseContainer}>
                <MaterialCommunityIcons name="dumbbell" size={48} color="#333" />
                <Text style={styles.emptyExerciseText}>Add your first exercise to begin</Text>
              </View>
            ) : (
              <FlatList
                data={workouts}
                keyExtractor={item => item.id}
                renderItem={({item, index}) => (
                  <View style={styles.exerciseSetItem}>
                    <View style={styles.setNumberContainer}>
                      <Text style={styles.setNumber}>{index + 1}</Text>
                    </View>
                    <View style={styles.setDetails}>
                      <Text style={styles.weightText}>{item.weight} lbs</Text>
                    </View>
                    <Text style={styles.repsText}>{item.reps} reps</Text>
                  </View>
                )}
                ListFooterComponent={
                  <TouchableOpacity 
                    style={styles.addSetButton}
                    onPress={() => setModalVisible(true)}
                  >
                    <Text style={styles.addSetText}>+ Set</Text>
                  </TouchableOpacity>
                }
              />
            )}
          </View>

          {/* Workout Summary Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>
                {(workouts.reduce((total, item) => total + item.weight * item.sets * item.reps, 0) / 2000).toFixed(1)} tons
              </Text>
              <Text style={styles.statLabel}>Total weight</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>
                {workouts.reduce((total, item) => total + item.sets * item.reps, 0)}
              </Text>
              <Text style={styles.statLabel}>Total reps</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>
                {workouts.length > 0 ? 
                  (workouts.reduce((total, item) => total + item.weight, 0) / workouts.length).toFixed(1) : 0} lbs
              </Text>
              <Text style={styles.statLabel}>Average weight</Text>
            </View>
          </View>

          {/* Bottom Action Buttons */}
          <View style={styles.bottomActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#FFF" style={{marginRight: 6}} />
              <Text style={styles.actionButtonText}>Add Exercise</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.specialButton}
              onPress={() => {
                // Show feature coming soon message
                Alert.alert("Coming Soon", "Special set features will be available in a future update");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.specialButtonText}>Special Set</Text>
            </TouchableOpacity>
          </View>

          {/* Timer Bar */}
          <View style={styles.timerBar}>
            <View style={styles.timerIcon}>
              <MaterialCommunityIcons name="dumbbell" size={18} color="#999" />
            </View>
            <TouchableOpacity 
              style={styles.timerContent}
              onLongPress={() => {
                // Add functionality for manual timer edit
                Alert.alert("Timer Control", "Long press detected - timer editing coming soon");
              }}
            >
              <Text style={styles.timerLabel}>Workout Time</Text>
              <Text style={styles.timerValue}>
                {Math.floor(timer/60).toString().padStart(2, '0')}:
                {(timer%60).toString().padStart(2, '0')}
              </Text>
              <Text style={styles.timerNote}>Press and hold to change</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.recordButton}
              onPress={() => setIsTiming(!isTiming)}
            >
              <View style={[styles.recordIndicator, !isTiming && {opacity: 0.5}]} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Add this Modal content */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Surface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingExercise ? 'Edit Exercise' : 'Add Exercise'}
              </Text>
              <IconButton
                icon="close"
                size={22}
                color="#666"
                onPress={() => setModalVisible(false)}
              />
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#666"
            />
            
            {loadingExercises ? (
              <ActivityIndicator size="large" color="#007AFF" style={{marginVertical: 20}} />
            ) : (
              <FlatList
                data={filteredExercises}
                keyExtractor={item => item.name}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={[
                      styles.exerciseItem,
                      selectedExercise?.name === item.name && styles.selectedExercise
                    ]}
                    onPress={() => selectExercise(item)}
                  >
                    <Text style={styles.exerciseItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                style={styles.exerciseList}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                maxToRenderPerBatch={10}
                initialNumToRender={8}
                windowSize={5}
                contentContainerStyle={{paddingBottom: 12}}
                ListEmptyComponent={
                  <Text style={{color: '#999', textAlign: 'center', padding: 20}}>
                    No exercises found. Try a different search.
                  </Text>
                }
              />
            )}
            
            <View style={styles.exerciseInputs}>
              <TextInput
                style={styles.input}
                placeholder="Weight (lbs)"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                placeholderTextColor="#666"
              />
              <TextInput
                style={styles.input}
                placeholder="Reps"
                keyboardType="numeric"
                value={reps}
                onChangeText={setReps}
                placeholderTextColor="#666"
              />
              <TextInput
                style={styles.input}
                placeholder="Sets"
                keyboardType="numeric"
                value={sets}
                onChangeText={setSets}
                placeholderTextColor="#666"
              />
            </View>
            
            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={addWorkout}
                style={styles.modalButton}
                contentStyle={styles.modalButtonContent}
              >
                {editingExercise ? 'Update Exercise' : 'Add Exercise'}
              </Button>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalCancelButton}
                labelStyle={{ color: '#3B82F6' }}
              >
                Cancel
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
      
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

// Updated styles for modern workout UI
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Dark background to match app theme
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  
  // Start Workout Section
  startWorkoutContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  
  workoutInfoCard: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  
  workoutTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 32,
    textAlign: 'center',
  },
  
  startButtonRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  
  startButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    padding: 20,
    paddingHorizontal: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  startButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  
  templatesButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  
  templatesButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  
  // Active Workout Section
  workoutContainer: {
    flex: 1,
    padding: 20,
  },
  
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  
  closeButton: {
    padding: 8,
  },
  
  timerDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // White text for dark theme
  },
  
  settingsButton: {
    padding: 8,
  },
  
  timerCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  
  timerValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#3B82F6',
  },
  
  timerLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  
  statsIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  statText: {
    color: '#BBB',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  
  exerciseListContainer: {
    flex: 1,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  
  emptyExerciseContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  
  emptyExerciseText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  
  exerciseList: {
    maxHeight: 200, // Limit list height
    marginVertical: 10,
    flexGrow: 0,
  },
  
  exerciseCard: {
    backgroundColor: '#141414', // Dark card background
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  addWarmupText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  
  exerciseDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  
  detailSeparator: {
    width: 1,
    height: 30,
    backgroundColor: '#333',
  },
  
  detailLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  
  detailValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  
  detailUnit: {
    fontSize: 14,
    color: '#999',
  },
  
  exerciseStatsBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  
  statsBarFill: {
    height: 4,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  
  actionsContainer: {
    marginTop: 20,
  },
  
  addButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  
  addButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  specialButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  
  specialButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  
  endButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    marginBottom: 12,
  },
  
  endButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    padding: 4,
  },

  // Completion Modal Styles
  completionModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  completionModalContent: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: 24,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  workoutSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  summaryItem: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  completionActions: {
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  postButton: {
    backgroundColor: '#10B981',
  },
  completionButton: {
    marginBottom: 12,
  },
  dismissButton: {
    borderColor: '#007AFF',
  },

  // Templates Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF', // Match the light theme
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222', // Match dark text theme
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40, // Reduced padding
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#999',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  templateItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  templateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  templateIcon: {
    marginRight: 16,
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

  // Modal Styles for Add/Edit Exercise
  searchInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
  },
  exerciseItem: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedExercise: {
    backgroundColor: '#1E3A8A', // Darker blue background
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  exerciseItemText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  exerciseInputs: {
    marginTop: 20,
    gap: 12,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalActions: {
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
  },
  modalCancelButton: {
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  modalButtonContent: {
    paddingVertical: 2,
  },

  // Exercise set item styling
  exerciseSetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222', // Darker border for separation
    marginBottom: 2,
  },
  setNumberContainer: {
    width: 24,
    alignItems: 'center',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999', // Gray text for numbers
  },
  setDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingLeft: 16,
  },
  weightText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  repsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  addSetButton: {
    marginTop: 12,
    marginBottom: 4,
  },
  addSetText: {
    color: '#3B82F6', // Blue accent color
    fontSize: 15,
    fontWeight: '600',
  },

  // Stats summary grid
  statsGrid: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#222', // Darker border
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },

  // Bottom action buttons
  bottomActions: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#E6E8EC',
  },
  secondaryButtonText: {
    color: '#333',
  },

  // Bottom timer bar
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  timerIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerContent: {
    flex: 1,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 12,
    color: '#999',
  },
  timerNote: {
    fontSize: 11,
    color: '#999',
  },
  recordButton: {
    width: 36,
    height: 36,
    backgroundColor: '#331111',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIndicator: {
    width: 12,
    height: 12,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
  },

  // Modal style updates
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },

  modalContent: {
    backgroundColor: '#141414', // Match dark theme
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingBottom: 12,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Exercise item styling
  exerciseItem: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  selectedExercise: {
    backgroundColor: '#1E3A8A', // Darker blue background
    borderColor: '#3B82F6',
    borderWidth: 1,
  },

  exerciseItemText: {
    color: '#FFFFFF',
    fontSize: 15,
  },

  // Exercise inputs
  exerciseInputs: {
    marginTop: 20,
    gap: 12,
  },

  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },

  // Search input
  searchInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
  },

  // Modal buttons
  modalActions: {
    marginTop: 24,
    gap: 12,
  },

  modalButton: {
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
  },

  modalButtonContent: {
    paddingVertical: 2,
  },

  modalCancelButton: {
    borderColor: '#3B82F6',
    borderWidth: 1,
  }
});
