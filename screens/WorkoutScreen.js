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
                style={styles.exerciseList}
                renderItem={({item, index}) => (
                  <Surface style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      <View style={styles.exerciseActions}>
                        <IconButton
                          icon="pencil"
                          size={20}
                          color="#3B82F6"
                          onPress={() => handleEditExercise(item)}
                          style={styles.actionIcon}
                        />
                        <IconButton
                          icon="delete"
                          size={20}
                          color="#FF3B30"
                          onPress={() => deleteWorkout(index)}
                          style={styles.actionIcon}
                        />
                      </View>
                    </View>
                    
                    <View style={styles.exerciseDetailsRow}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>WEIGHT</Text>
                        <Text style={styles.detailValue}>{item.weight}<Text style={styles.detailUnit}> lbs</Text></Text>
                      </View>
                      
                      <View style={styles.detailSeparator} />
                      
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>SETS</Text>
                        <Text style={styles.detailValue}>{item.sets}</Text>
                      </View>
                      
                      <View style={styles.detailSeparator} />
                      
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>REPS</Text>
                        <Text style={styles.detailValue}>{item.reps}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.exerciseStatsBar}>
                      <View style={[styles.statsBarFill, {width: `${Math.min(100, item.sets * 10)}%`}]} />
                    </View>
                  </Surface>
                )}
              />
            )}
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
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
                labelStyle={styles.endButtonLabel}
              >
                End Workout
              </Button>
            )}
          </View>
        </View>
      )}

      {/* Add this Modal content */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Surface style={styles.modalContent}>
            <View style={{ overflow: 'hidden' }}>
              <Text style={styles.modalTitle}>
                {editingExercise ? 'Edit Exercise' : 'Add Exercise'}
              </Text>
              
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

// Updated styles for modern workout UI
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
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
    backgroundColor: '#161616',
    borderRadius: 16,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  
  exerciseActions: {
    flexDirection: 'row',
  },
  
  actionIcon: {
    margin: 0,
    marginLeft: 4,
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
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  
  addButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 12,
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%', // Limit height to 80% of screen
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
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
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  templateItem: {
    backgroundColor: '#161616',
    borderRadius: 16,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 10,
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
  modalButtonContent: {
    paddingVertical: 8,
  },
});
