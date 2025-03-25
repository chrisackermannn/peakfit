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
  Alert  // Add this import
} from 'react-native';
import { Button, Card, IconButton, Surface } from 'react-native-paper';
import { getInitialExercises, searchExercises } from '../data/exerciseAPI'; // Update imports
import { saveWorkoutToProfile, saveWorkoutGlobally, getUserTemplates } from '../data/firebaseHelpers';
import { useAuth } from '../context/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

// Add this component definition in WorkoutScreen.js before the main WorkoutScreen component

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

// Then update your WorkoutScreen component to use this modal
export default function WorkoutScreen() {
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

  const startWorkout = () => {
    setIsWorkoutStarted(true);
    setIsTiming(true);
  };

  const endWorkout = () => {
    setIsTiming(false);
    setIsWorkoutEnded(true);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    
    // Clear any existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // If search is empty, show initial exercises
    if (!text.trim()) {
      setFilteredExercises(exercises);
      return;
    }
    
    // If search is local and quick
    const localResults = exercises.filter(exercise =>
      exercise.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredExercises(localResults);
    
    // Set timeout for API search
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
    if (!selectedExercise || !weight || !reps || !sets) {
      alert('Please fill in all exercise details.');
      return;
    }

    const exerciseData = {
      id: editingExercise?.id || Date.now().toString(),
      name: selectedExercise.name,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      sets: parseInt(sets),
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

    setModalVisible(false);
    setEditingExercise(null);
    setSelectedExercise('');
    setWeight('');
    setReps('');
    setSets('');
  };

  const deleteWorkout = (index) => {
    const updated = [...workouts];
    updated.splice(index, 1);
    setWorkouts(updated);
    console.log('Deleted exercise at index:', index);
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

      await saveWorkoutToProfile(user.uid, workoutData);
      
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
      
      // Validate workout data
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
      
      // Success animation
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

      // Reset state
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
    // Convert template exercises to workout exercises format
    const templateExercises = template.exercises.map(ex => ({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: '' // Empty weight for user to fill in
    }));
    
    setWorkouts(templateExercises);
    setTemplatesModalVisible(false);
    
    // Auto-start the workout if not started
    if (!isWorkoutStarted) {
      setIsWorkoutStarted(true);
      setIsTiming(true);
    }
    
    // Show success message
    Alert.alert(
      'Template Applied',
      'The workout template has been loaded. Please fill in your desired weights.'
    );
  };

  useEffect(() => {
    console.log('Current User from AuthContext:', user);
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <Button
          mode="contained"
          onPress={() => {/* Add rest timer logic */}}
          style={styles.restTimerButton}
        >
          Rest Timer
        </Button>
      </View>

      {!isWorkoutStarted ? (
        <View style={styles.startWorkoutContainer}>
          <Surface style={styles.workoutInfoCard}>
            <View style={{ overflow: 'hidden' }}>
              <Text style={styles.workoutTitle}>Start New Workout</Text>
              <View style={styles.startButtonsContainer}>
                <TouchableOpacity onPress={startWorkout} style={styles.startButton}>
                  <MaterialCommunityIcons name="dumbbell" size={32} color="#fff" />
                  <Text style={styles.startButtonText}>Begin Workout</Text>
                </TouchableOpacity>
                
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
            </View>
          </Surface>
        </View>
      ) : (
        <View style={styles.workoutContainer}>
          <Surface style={styles.workoutInfoCard}>
            <View style={{ overflow: 'hidden' }}>
              <Text style={styles.workoutTitle}>Current Workout</Text>
              <View style={styles.workoutMetaContainer}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="timer-outline" size={24} color="#007AFF" />
                  <Text style={styles.metaValue}>
                    {Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}
                  </Text>
                  <Text style={styles.metaLabel}>Duration</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="dumbbell" size={24} color="#007AFF" />
                  <Text style={styles.metaValue}>{workouts.length}</Text>
                  <Text style={styles.metaLabel}>Exercises</Text>
                </View>
              </View>
            </View>
          </Surface>

          <FlatList
            data={workouts}
            keyExtractor={item => item.id}
            style={styles.exerciseList}
            renderItem={({item}) => (
              <Surface style={styles.exerciseCard}>
                <View style={{ overflow: 'hidden' }}>
                  <View style={styles.exerciseContent}>
                    <View style={styles.exerciseIconContainer}>
                      <View style={[styles.shape, styles.triangle]} />
                      <View style={[styles.shape, styles.square]} />
                      <View style={[styles.shape, styles.circle]} />
                    </View>
                    <View style={styles.exerciseDetails}>
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      <Text style={styles.exerciseStats}>
                        {item.sets}×{item.reps} | {item.weight} lbs
                      </Text>
                    </View>
                    <View style={styles.exerciseActions}>
                      <IconButton
                        icon="pencil-outline"
                        size={24}
                        color="#007AFF"
                        onPress={() => handleEditExercise(item)}
                      />
                      <IconButton
                        icon="delete-outline"
                        size={24}
                        color="#FF3B30"
                        onPress={() => deleteWorkout(index)}
                      />
                    </View>
                  </View>
                </View>
              </Surface>
            )}
          />

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add Exercise</Text>
          </TouchableOpacity>

          {!isWorkoutEnded && (
            <Button
              mode="contained"
              onPress={endWorkout}
              style={styles.endButton}
            >
              End Workout
            </Button>
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Surface style={styles.modalContent}>
            <View style={{ overflow: 'hidden' }}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                value={searchQuery}
                onChangeText={handleSearch}
                placeholderTextColor="#666"
              />
              
              {loadingExercises ? (
                <ActivityIndicator size="large" color="#007AFF" />
              ) : (
                <FlatList
                  data={filteredExercises}
                  keyExtractor={item => item.name}
                  renderItem={({item}) => (
                    <TouchableOpacity
                      style={[
                        styles.exerciseItem,
                        selectedExercise === item && styles.selectedExercise
                      ]}
                      onPress={() => selectExercise(item)}
                    >
                      <Text style={styles.exerciseItemText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.exerciseList}
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
                  Add Exercise
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCancelButton}
                  color="#007AFF"
                  labelStyle={{ color: '#007AFF' }}
                >
                  Cancel
                </Button>
              </View>
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

// WorkoutScreen.js
const existingStyles = {
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#141414',
    borderBottomColor: '#222',
    borderBottomWidth: 1,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  restTimerButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Start Workout Section
  startWorkoutContainer: {
    flex: 1,
    padding: 16,
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
    marginBottom: 24,
    textAlign: 'center',
  },

  startButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  startButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  startButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },

  templatesButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  templatesButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },

  // Workout Progress
  workoutContainer: {
    flex: 1,
    padding: 16,
  },

  workoutMetaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },

  metaItem: {
    alignItems: 'center',
  },

  metaValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },

  metaLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },

  // Exercise List
  exerciseList: {
    marginTop: 24,
  },

  exerciseCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },

  exerciseContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  exerciseDetails: {
    flex: 1,
    marginLeft: 16,
  },

  exerciseName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },

  exerciseStats: {
    fontSize: 15,
    color: '#999',
  },

  exerciseActions: {
    flexDirection: 'row',
  },

  // Add Exercise Button
  addButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      }
    }),
  },

  addButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 12,
  },

  // End Workout Button
  endButton: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    marginTop: 8,
  },

  // Exercise Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 20,
  },

  searchInput: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 20,
  },

  exerciseItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#222',
  },

  selectedExercise: {
    backgroundColor: '#3B82F6',
  },

  exerciseItemText: {
    color: '#FFF',
    fontSize: 16,
  },

  exerciseInputs: {
    marginTop: 20,
    gap: 12,
  },

  input: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
  },

  modalActions: {
    marginTop: 24,
    gap: 12,
  },

  modalButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },

  modalCancelButton: {
    borderColor: '#3B82F6',
    borderRadius: 12,
  },

  // Completion Modal
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

  // Templates Modal
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },

  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },

  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  templateItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
    color: '#FFF',
  },

  templateMeta: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },

  templateDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
};

const templateStyles = {
  // Template selection button
  startButtonsContainer: {
    width: '100%',
  },
  
  templatesButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  
  templatesButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 12,
  },
  
  // Template modal styles
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  
  emptyText: {
    color: '#CCC',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: '80%',
  },
  
  templateItem: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  
  templateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#202020',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  
  templateInfo: {
    flex: 1,
  },
  
  templateName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  
  templateMeta: {
    color: '#999',
    fontSize: 14,
    marginBottom: 2,
  },
  
  templateDate: {
    color: '#666',
    fontSize: 12,
  },
};

// Add this line to merge with existing styles
const styles = StyleSheet.create({
  ...existingStyles,
  ...templateStyles
});
