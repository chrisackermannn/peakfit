// screens/UserProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity,
  ScrollView, 
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Surface, Button, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { saveTemplate } from '../data/firebaseHelpers';
import { format, formatDistanceToNow } from 'date-fns';
import { startDirectMessage } from '../data/messagingHelpers';
import { CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showMessage } from "react-native-flash-message";

const defaultAvatar = require('../assets/default-avatar.png');

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [userData, setUserData] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFriend, setIsFriend] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateNameModalVisible, setTemplateNameModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // Format duration helper
  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    } else if (remainingSeconds === 0) {
      return `${minutes}m`;
    } else {
      return `${minutes}m ${remainingSeconds}s`;
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        
        // Fetch user profile data
        const userDocRef = doc(db, 'users', userId);
        const userSnapshot = await getDoc(userDocRef);
        
        if (!userSnapshot.exists()) {
          setError('User not found');
          setLoading(false);
          return;
        }
        
        const userData = {
          id: userSnapshot.id,
          ...userSnapshot.data()
        };
        
        setUserData(userData);
        
        // Check if this user is in the current user's friends list
        if (user?.uid) {
          const currentUserRef = doc(db, 'users', user.uid);
          const currentUserSnap = await getDoc(currentUserRef);
          
          if (currentUserSnap.exists()) {
            const friends = currentUserSnap.data().friends || [];
            setIsFriend(friends.includes(userId));
          }
        }
        
        // Fetch user's public workouts from globalWorkouts collection
        // Using only where clause to avoid requiring compound index
        const workoutsQuery = query(
          collection(db, 'globalWorkouts'),
          where('userId', '==', userId)
        );
        
        const workoutsSnapshot = await getDocs(workoutsQuery);
        
        // Sort the workouts on client side by createdAt date
        const workoutsData = workoutsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate ? 
                       doc.data().createdAt.toDate() : 
                       new Date()
          }))
          .sort((a, b) => b.createdAt - a.createdAt); // Sort newest first
        
        setWorkouts(workoutsData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading user profile:', err);
        setError('Failed to load user data');
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [userId, user?.uid]);
  
  const handleFriendToggle = async () => {
    if (!user?.uid) {
      Alert.alert('Sign in required', 'Please sign in to add friends');
      return;
    }
    
    try {
      setFriendLoading(true);
      
      const currentUserRef = doc(db, 'users', user.uid);
      
      if (isFriend) {
        // Remove from friends list
        await updateDoc(currentUserRef, {
          friends: arrayRemove(userId)
        });
        
        setIsFriend(false);
      } else {
        // Add to friends list
        await updateDoc(currentUserRef, {
          friends: arrayUnion(userId)
        });
        
        setIsFriend(true);
      }
    } catch (err) {
      console.error('Error updating friends:', err);
      Alert.alert('Error', 'Failed to update friends list');
    } finally {
      setFriendLoading(false);
    }
  };
  
  const handleMessage = async () => {
    if (!user?.uid) {
      Alert.alert('Sign in required', 'Please sign in to send messages');
      return;
    }
    
    try {
      const chatId = await startDirectMessage(user.uid, userId);
      
      if (chatId) {
        // Change from 'ChatScreen' to 'ChatConversationScreen'
        navigation.navigate('ChatConversationScreen', { 
          chatId, 
          otherUserId: userId
        });
      } else {
        throw new Error('Failed to create chat');
      }
    } catch (err) {
      console.error('Error starting message:', err);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  // Copy workout to templates
  const copyWorkoutTemplate = (workout) => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to save templates');
      return;
    }
    
    setSelectedTemplate(workout);
    setTemplateName(workout.name || 'New Template');
    setTemplateNameModalVisible(true);
  };
  
  // Save workout template
  const saveWorkoutTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }
    
    try {
      await saveTemplate(user.uid, {
        name: templateName,
        exercises: selectedTemplate.exercises,
        createdAt: new Date(),
        sourceWorkout: {
          id: selectedTemplate.id,
          userId: selectedTemplate.userId,
          userDisplayName: selectedTemplate.userDisplayName || 'Anonymous'
        }
      });
      
      setTemplateNameModalVisible(false);
      
      showMessage({
        message: "Template Saved",
        description: "Workout template has been saved to your library",
        type: "success",
        duration: 3000
      });
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Could not save workout template');
    }
  };
  
  const renderWorkoutItem = ({ item }) => {
    // Format date for display
    let timeAgo = 'recently';
    try {
      if (item.createdAt instanceof Date) {
        timeAgo = formatDistanceToNow(item.createdAt, { addSuffix: true });
      }
    } catch (error) {
      console.log('Error formatting date:', error);
    }
    
    return (
      <Surface style={styles.workoutCard}>
        <LinearGradient
          colors={['#1A1A1A', '#131313']}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.workoutHeader}>
            <View>
              <Text style={styles.workoutName}>{item.name || "Workout"}</Text>
              <Text style={styles.workoutDate}>{timeAgo}</Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => copyWorkoutTemplate(item)}
              style={styles.saveTemplateButton}
            >
              <MaterialCommunityIcons name="content-save-outline" size={18} color="#3B82F6" />
              <Text style={styles.saveTemplateText}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.workoutMeta}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#60A5FA" />
              <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
            </View>
            
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="dumbbell" size={16} color="#60A5FA" />
              <Text style={styles.metaText}>{item.exercises?.length || 0} exercises</Text>
            </View>
            
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="weight" size={16} color="#60A5FA" />
              <Text style={styles.metaText}>
                {Math.floor(item.totalWeight || 0).toLocaleString()} lb
              </Text>
            </View>
          </View>
          
          {/* Exercise List */}
          <View style={styles.exercisesList}>
            {item.exercises?.slice(0, 3).map((exercise, index) => (
              <View key={index} style={styles.exerciseItem}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseDetails}>
                  {exercise.sets} × {exercise.reps} @ {exercise.weight}lbs
                </Text>
              </View>
            ))}
            
            {(item.exercises?.length || 0) > 3 && (
              <Text style={styles.moreExercises}>+{item.exercises.length - 3} more exercises</Text>
            )}
          </View>
        </LinearGradient>
      </Surface>
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={60} color="#f43f5e" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with back button */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 16 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView}>
        {/* Profile Info */}
        <View style={styles.profileContainer}>
          <Image 
            source={userData?.photoURL ? { uri: userData.photoURL } : defaultAvatar} 
            style={styles.profileImage}
          />
          <View style={styles.userInfo}>
            <Text style={styles.displayName}>
              {userData?.displayName || userData?.username || 'User'}
            </Text>
            <Text style={styles.username}>@{userData?.username || 'username'}</Text>
          </View>
        </View>
        
        {/* Action Buttons */}
        {user?.uid && userId !== user.uid && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, isFriend ? styles.unfriendButton : styles.friendButton]}
              onPress={handleFriendToggle}
              disabled={friendLoading}
            >
              <MaterialCommunityIcons 
                name={isFriend ? "account-remove" : "account-plus"} 
                size={20} 
                color={isFriend ? "#FF3B30" : "#3B82F6"} 
              />
              <Text style={[styles.actionButtonText, isFriend ? styles.unfriendText : styles.friendText]}>
                {isFriend ? 'Unfriend' : 'Add Friend'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.messageButton}
              onPress={handleMessage}
            >
              <MaterialCommunityIcons name="message-text" size={20} color="#3B82F6" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Workouts Section */}
        <View style={styles.workoutSection}>
          <Text style={styles.sectionTitle}>Workouts</Text>
          
          {workouts.length > 0 ? (
            workouts.map((workout) => (
              <View key={workout.id} style={styles.workoutWrapper}>
                {renderWorkoutItem({ item: workout })}
              </View>
            ))
          ) : (
            <View style={styles.emptyWorkouts}>
              <MaterialCommunityIcons name="dumbbell" size={50} color="#666" />
              <Text style={styles.emptyText}>No workouts to show</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save Template Modal */}
      <Modal
        visible={templateNameModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setTemplateNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismissArea} 
            activeOpacity={1} 
            onPress={() => setTemplateNameModalVisible(false)}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.templateModalContent}>
                <Text style={styles.modalTitle}>Save Workout Template</Text>
                <TextInput
                  style={styles.templateNameInput}
                  placeholder="Template Name"
                  placeholderTextColor="#777"
                  value={templateName}
                  onChangeText={setTemplateName}
                  autoFocus
                />
                <View style={styles.templateModalButtons}>
                  <Button
                    mode="text"
                    onPress={() => setTemplateNameModalVisible(false)}
                    style={{ flex: 1 }}
                    labelStyle={{ color: '#999', fontWeight: '600', fontSize: 16 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={saveWorkoutTemplate}
                    style={{
                      flex: 1.3,
                      borderRadius: 12,
                      backgroundColor: '#3B82F6',
                    }}
                    contentStyle={{
                      paddingVertical: 8,
                    }}
                    labelStyle={{
                      color: '#FFF',
                      fontWeight: '600',
                      fontSize: 16,
                    }}
                  >
                    Save
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  profileContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  userInfo: {
    alignItems: 'center',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  friendButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  unfriendButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  friendText: {
    color: '#3B82F6',
  },
  unfriendText: {
    color: '#FF3B30',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  messageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 8,
  },
  workoutSection: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#f43f5e',
    textAlign: 'center',
    marginTop: 16,
  },
  emptyWorkouts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  
  // Workout card styles
  workoutWrapper: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  workoutCard: {
    borderRadius: 20,
  },
  cardGradient: {
    padding: 16,
    borderRadius: 20,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  workoutDate: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  saveTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  saveTemplateText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  workoutMeta: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  metaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  exercisesList: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
  },
  exerciseItem: {
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#3B82F6',
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseDetails: {
    color: '#999',
    fontSize: 13,
    marginTop: 2,
  },
  moreExercises: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalDismissArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  templateModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  templateNameInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 24,
  },
  templateModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
});