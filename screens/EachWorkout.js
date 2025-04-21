import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  Image,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { getExerciseDetails, searchExercises } from '../data/exerciseAPI'; // Import the API functions

export default function EachWorkout({ route, navigation }) {
  const { workout, userId, userName } = route.params;
  const insets = useSafeAreaInsets();
  
  // State for exercise info modal
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exerciseDetails, setExerciseDetails] = useState(null);
  
  // Format timestamp
  const workoutDate = workout.date 
    ? (workout.date.toDate ? workout.date.toDate() : new Date(workout.date)) 
    : new Date();
    
  // Calculate total weight and sets
  const totalSets = workout.exercises?.reduce((acc, ex) => acc + (ex.sets || 0), 0) || 0;
  const totalWeight = workout.totalWeight || 
    workout.exercises?.reduce(
      (acc, ex) => acc + ((ex.weight || 0) * (ex.sets || 0) * (ex.reps || 0)), 
      0
    ) || 0;
  
  // Format duration
  const duration = workout.duration
    ? `${Math.floor(workout.duration / 60)}m ${workout.duration % 60}s`
    : 'No duration';
  
  useEffect(() => {
    // Hide the default header
    navigation.setOptions({
      headerShown: false
    });
  }, []);
  
  const handleInfoPress = async (exercise) => {
    setSelectedExercise(exercise);
    setInfoModalVisible(true);
    setExerciseDetails(null); // Reset previous details
    setLoading(true);
    
    try {
      // Always search by name since apiId might not be saved with the workout
      const searchResults = await searchExercises(exercise.name);
      
      if (searchResults && searchResults.length > 0) {
        // Use the first match from search results
        const details = searchResults[0];
        console.log("Found exercise details:", details.name, details.gifUrl ? "Has GIF" : "No GIF");
        setExerciseDetails(details);
      } else {
        console.log("No exercise details found for:", exercise.name);
        // No results found
        setExerciseDetails(null);
      }
    } catch (error) {
      console.error('Error fetching exercise details:', error);
      Alert.alert('Error', 'Could not fetch exercise details');
      setExerciseDetails(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0A0A0A', '#121212']}
      style={[styles.container, { paddingTop: insets.top }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{workout.title || workout.name || "Workout Details"}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Workout Summary Card */}
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.summaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryTitle}>Workout Summary</Text>
                <Text style={styles.summaryUser}>By {userName || 'User'}</Text>
              </View>
              <View style={styles.summaryDate}>
                <Text style={styles.summaryDateText}>
                  {format(workoutDate, 'MMM d, yyyy')}
                </Text>
                <Text style={styles.summaryTimeText}>
                  {format(workoutDate, 'h:mm a')}
                </Text>
              </View>
            </View>
            
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.2)']}
                  style={styles.statCircle}
                >
                  <MaterialCommunityIcons name="clock-outline" size={20} color="#3B82F6" />
                </LinearGradient>
                <Text style={styles.statValue}>{duration}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              
              <View style={styles.statItem}>
                <LinearGradient
                  colors={['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)']}
                  style={styles.statCircle}
                >
                  <MaterialCommunityIcons name="dumbbell" size={20} color="#10B981" />
                </LinearGradient>
                <Text style={styles.statValue}>{workout.exercises?.length || 0}</Text>
                <Text style={styles.statLabel}>Exercises</Text>
              </View>
              
              <View style={styles.statItem}>
                <LinearGradient
                  colors={['rgba(250, 204, 21, 0.2)', 'rgba(217, 119, 6, 0.2)']}
                  style={styles.statCircle}
                >
                  <MaterialCommunityIcons name="repeat" size={20} color="#FACC15" />
                </LinearGradient>
                <Text style={styles.statValue}>{totalSets}</Text>
                <Text style={styles.statLabel}>Sets</Text>
              </View>
              
              <View style={styles.statItem}>
                <LinearGradient
                  colors={['rgba(239, 68, 68, 0.2)', 'rgba(185, 28, 28, 0.2)']}
                  style={styles.statCircle}
                >
                  <MaterialCommunityIcons name="weight" size={20} color="#EF4444" />
                </LinearGradient>
                <Text style={styles.statValue}>{Math.floor(totalWeight).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Weight</Text>
              </View>
            </View>
            
            {workout.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{workout.notes}</Text>
              </View>
            )}
          </LinearGradient>
        </View>
        
        {/* Exercises Section */}
        <Text style={styles.sectionTitle}>Exercises</Text>
        
        {workout.exercises && workout.exercises.length > 0 ? (
          <View style={styles.exercisesList}>
            {workout.exercises.map((exercise, index) => (
              <View key={exercise.id || index} style={styles.exerciseCard}>
                <LinearGradient
                  colors={['#1A1A1A', '#121212']}
                  style={styles.exerciseGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <TouchableOpacity
                      onPress={() => handleInfoPress(exercise)}
                      style={styles.infoButton}
                    >
                      <MaterialCommunityIcons name="information" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.setsTable}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableCell, styles.tableHeaderText]}>SET</Text>
                      <Text style={[styles.tableCell, styles.tableHeaderText]}>WEIGHT</Text>
                      <Text style={[styles.tableCell, styles.tableHeaderText]}>REPS</Text>
                    </View>
                    
                    {exercise.setDetails ? (
                      // New format with detailed sets
                      exercise.setDetails.map((set, setIndex) => (
                        <View key={setIndex} style={styles.tableRow}>
                          <Text style={[styles.tableCell, styles.tableCellText]}>{setIndex + 1}</Text>
                          <Text style={[styles.tableCell, styles.tableCellText]}>{set.weight || 0} lbs</Text>
                          <Text style={[styles.tableCell, styles.tableCellText]}>{set.reps || 0}</Text>
                        </View>
                      ))
                    ) : (
                      // Old format with just counts
                      Array.from({ length: exercise.sets || 0 }).map((_, setIndex) => (
                        <View key={setIndex} style={styles.tableRow}>
                          <Text style={[styles.tableCell, styles.tableCellText]}>{setIndex + 1}</Text>
                          <Text style={[styles.tableCell, styles.tableCellText]}>{exercise.weight || 0} lbs</Text>
                          <Text style={[styles.tableCell, styles.tableCellText]}>{exercise.reps || 0}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </LinearGradient>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyExercises}>
            <Text style={styles.emptyText}>No exercises recorded</Text>
          </View>
        )}
      </ScrollView>
      
      {/* Exercise Info Modal */}
      <Modal
        visible={infoModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedExercise?.name}</Text>
              <TouchableOpacity
                onPress={() => setInfoModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            ) : exerciseDetails ? (
              <ScrollView style={styles.modalScrollView}>
                {exerciseDetails.gifUrl && (
                  <View style={styles.imageContainer}>
                    <Image 
                      source={{ uri: exerciseDetails.gifUrl }} 
                      style={styles.exerciseImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
                
                <View style={styles.detailsContainer}>
                  {exerciseDetails.equipment && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="dumbbell" size={20} color="#3B82F6" />
                      <Text style={styles.detailLabel}>Equipment:</Text>
                      <Text style={styles.detailText}>{exerciseDetails.equipment}</Text>
                    </View>
                  )}
                  
                  {(exerciseDetails.muscle || exerciseDetails.target) && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="arm-flex" size={20} color="#3B82F6" />
                      <Text style={styles.detailLabel}>Target Muscle:</Text>
                      <Text style={styles.detailText}>{exerciseDetails.muscle || exerciseDetails.target}</Text>
                    </View>
                  )}
                  
                  {exerciseDetails.instructions && (
                    <View style={styles.instructionsContainer}>
                      <Text style={styles.instructionsTitle}>Instructions:</Text>
                      <Text style={styles.instructionsText}>{exerciseDetails.instructions}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.noInfoContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#94A3B8" />
                <Text style={styles.noInfoText}>No exercise information available</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  
  // Summary Card
  summaryCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryGradient: {
    padding: 16,
    borderRadius: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryUser: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  summaryDate: {
    alignItems: 'flex-end',
  },
  summaryDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E0',
  },
  summaryTimeText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  notesSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E0',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  
  // Exercises Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  exercisesList: {
    gap: 12,
  },
  exerciseCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  exerciseGradient: {
    padding: 16,
    borderRadius: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  setsTable: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tableCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tableCellText: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  emptyExercises: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: 500,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E0',
    marginLeft: 8,
    marginRight: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  instructionsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 22,
  },
  noInfoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noInfoText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
    textAlign: 'center',
  },
});