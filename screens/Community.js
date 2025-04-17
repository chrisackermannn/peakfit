import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
  Modal,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Button, IconButton, Avatar, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getGlobalWorkouts, toggleLike, addComment, saveTemplate } from '../data/firebaseHelpers';
import { format, formatDistanceToNow } from 'date-fns';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs, doc, getDoc, arrayUnion, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { showMessage } from "react-native-flash-message";
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const defaultAvatar = require('../assets/default-avatar.png');

// Safe replacement for BlurView
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

// Helper function for timestamp processing
const processTimestamp = (timestamp) => {
  if (!timestamp) return new Date();
  return timestamp instanceof Date ? timestamp : timestamp.toDate();
};

const CommunityScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('global');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [comment, setComment] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateNameModalVisible, setTemplateNameModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [scrollY] = useState(new Animated.Value(0));
  const [activeCommentWorkoutId, setActiveCommentWorkoutId] = useState(null);
  const [commentText, setCommentText] = useState('');
  
  // Header animation based on scroll
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60, 90],
    outputRange: [0, 0.8, 1],
    extrapolate: 'clamp'
  });
  
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
  
  // Initial load and tab change effect
  useEffect(() => {
    const unsubscribe = loadWorkouts(activeTab);
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [activeTab]);
  
  // Unified workout loading function for both tabs
  const loadWorkouts = (tabType) => {
    setLoading(true);
    
    try {
      let workoutsQuery;
      
      if (tabType === 'global') {
        // Global feed - all public workouts
        workoutsQuery = query(
          collection(db, 'globalWorkouts'), 
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        
        // Listen for real-time updates for the global feed
        const unsubscribe = onSnapshot(workoutsQuery, (snapshot) => {
          const workoutsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: processTimestamp(data.createdAt)
            };
          });
          
          setWorkouts(workoutsData);
          setLoading(false);
          setRefreshing(false);
        }, (error) => {
          console.error('Snapshot error:', error);
          setLoading(false);
          setRefreshing(false);
        });
        
        return unsubscribe;
      } else {
        // Friends tab - uses the same display logic but filters to only show friend's posts
        if (!user?.uid) {
          setWorkouts([]);
          setLoading(false);
          setRefreshing(false);
          return () => {};
        }
        
        // Get all global workouts then filter by friends list
        const globalQuery = query(
          collection(db, 'globalWorkouts'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        
        const unsubscribe = onSnapshot(globalQuery, async (snapshot) => {
          try {
            // Get the user's friends list
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (!userDoc.exists()) {
              console.log("User document not found");
              setWorkouts([]);
              setLoading(false);
              setRefreshing(false);
              return;
            }
            
            const friendIds = userDoc.data().friends || [];
            
            if (friendIds.length === 0) {
              setWorkouts([]);
              setLoading(false);
              setRefreshing(false);
              return;
            }
            
            // Filter workouts to only include those from friends
            const friendWorkouts = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: processTimestamp(doc.data().createdAt)
              }))
              .filter(workout => friendIds.includes(workout.userId));
            
            setWorkouts(friendWorkouts);
          } catch (error) {
            console.error('Error processing friend workouts:', error);
          } finally {
            setLoading(false);
            setRefreshing(false);
          }
        }, (error) => {
          console.error('Snapshot error:', error);
          setLoading(false);
          setRefreshing(false);
        });
        
        return unsubscribe;
      }
    } catch (error) {
      console.error('Error loading workouts:', error);
      setLoading(false);
      setRefreshing(false);
      return () => {};
    }
  };
  
  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkouts(activeTab);
  }, [activeTab, user?.uid]);
  
  // Like/unlike a workout
  const handleLike = async (workoutId) => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to like posts');
      return;
    }
    
    try {
      await toggleLike(workoutId, user.uid);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };
  
  // Add comment to workout
  const handleComment = async (workoutId) => {
    if (!commentText.trim() || !user?.uid) return;
    
    try {
      await addComment(workoutId, {
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        text: commentText,
        createdAt: new Date()
      });
      
      // Clear the comment text but keep the comment section open
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to post comment');
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
  
  // Navigate to user profile
  const handleUserPress = (userId) => {
    navigation.navigate('UserProfile', { userId });
  };
  
  // Loading state component
  const LoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
  
  // Workout Card Component
  const renderWorkoutCard = useCallback(({ item }) => {
    const isLiked = item.likes?.includes(user?.uid);
    const isCommentSelected = activeCommentWorkoutId === item.id;
    
    // Safe timestamp handling for display
    let timeAgo = 'recently';
    try {
      if (item.createdAt instanceof Date) {
        timeAgo = formatDistanceToNow(item.createdAt, { addSuffix: true });
      }
    } catch (error) {
      console.log('Error formatting date:', error);
    }
    
    // Check if this workout belongs to the current user
    const isOwnWorkout = item.userId === user?.uid;
    
    const toggleComment = () => {
      setActiveCommentWorkoutId(isCommentSelected ? null : item.id);
      // Reset comment text when closing or switching comments
      if (!isCommentSelected || activeCommentWorkoutId !== item.id) {
        setCommentText('');
      }
    };
    
    return (
      <View style={styles.cardWrapper}>
        <Surface style={styles.workoutCard}>
          <View style={styles.cardInnerWrapper}>
            <LinearGradient
              colors={['#1A1A1A', '#131313']}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* User Header */}
              <TouchableOpacity 
                style={styles.userInfo}
                onPress={() => handleUserPress(item.userId)}
                activeOpacity={0.8}
              >
                <View style={styles.userHeader}>
                  <Image
                    source={item.userPhotoURL ? { uri: item.userPhotoURL } : defaultAvatar}
                    style={styles.userAvatar}
                    defaultSource={defaultAvatar}
                  />
                  <View style={styles.userMeta}>
                    <Text style={styles.userName}>
                      {isOwnWorkout ? 'You' : (item.userDisplayName || 'Anonymous')}
                    </Text>
                    <Text style={styles.timestamp}>{timeAgo}</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  onPress={() => copyWorkoutTemplate(item)}
                  style={styles.saveTemplateButton}
                >
                  <MaterialCommunityIcons name="content-save-outline" size={18} color="#3B82F6" />
                  <Text style={styles.saveTemplateText}>Save</Text>
                </TouchableOpacity>
              </TouchableOpacity>
              
              {/* Workout Content */}
              <View style={styles.workoutContent}>
                {item.name && (
                  <Text style={styles.workoutTitle}>{item.name}</Text>
                )}
                
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
                    <MaterialCommunityIcons name="fire" size={16} color="#60A5FA" />
                    <Text style={styles.metaText}>{Math.round((item.totalWeight || 0) / 10)} cal</Text>
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
                
                {/* Action Buttons */}
                <View style={styles.actions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, isLiked && styles.likedButton]} 
                    onPress={() => handleLike(item.id)}
                  >
                    <MaterialCommunityIcons 
                      name={isLiked ? "heart" : "heart-outline"}
                      size={20} 
                      color={isLiked ? "#FF3B30" : "#999"}
                    />
                    <Text style={[styles.actionText, isLiked && { color: "#FF3B30" }]}>
                      {item.likes?.length || 0}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, isCommentSelected && styles.activeCommentButton]} 
                    onPress={toggleComment}
                  >
                    <MaterialCommunityIcons 
                      name="comment-outline" 
                      size={20} 
                      color={isCommentSelected ? "#3B82F6" : "#999"} 
                    />
                    <Text style={[styles.actionText, isCommentSelected && styles.activeCommentText]}>
                      {item.comments?.length || 0}
                    </Text>
                  </TouchableOpacity>

                </View>
                
                
                {/* Comments Section - WITH INPUT BELOW */}
                {isCommentSelected && (
                  <View style={styles.commentsSection}>
                    {/* Comments List */}
                    {(item.comments?.length || 0) > 0 ? (
                      item.comments.map((comment, index) => (
                        <View key={index} style={styles.commentContainer}>
                          <View style={styles.commentHeader}>
                            <Image 
                              source={comment.userPhotoURL ? { uri: comment.userPhotoURL } : defaultAvatar} 
                              style={styles.commentAvatar}
                              defaultSource={defaultAvatar}
                            />
                            <Text style={styles.commentUsername}>{comment.userDisplayName}</Text>
                          </View>
                          <Text style={styles.commentText}>{comment.text}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
                    )}
                    
                    {/* Comment Input - INLINE */}
                    <View style={styles.commentInputWrapper}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Add a comment..."
                        placeholderTextColor="#999"
                        value={item.id === activeCommentWorkoutId ? commentText : ''}
                        onChangeText={setCommentText}
                        multiline={true}
                        autoCapitalize="none"
                        autoCorrect={false}
                        blurOnSubmit={false}
                        returnKeyType="default"
                        keyboardAppearance="dark"
                      />
                      <TouchableOpacity 
                        style={[
                          styles.postCommentButton,
                          !commentText.trim() && styles.disabledPostButton
                        ]} 
                        disabled={!commentText.trim()}
                        onPress={() => handleComment(item.id)}
                      >
                        <MaterialCommunityIcons 
                          name="send" 
                          size={18} 
                          color={commentText.trim() ? "#FFF" : "#666"} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        </Surface>
      </View>
    );
  }, [user?.uid, activeCommentWorkoutId, commentText]);

  // Empty state component
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons 
        name={activeTab === 'global' ? "earth" : "account-group"} 
        size={60} 
        color="#666" 
      />
      <Text style={styles.emptyTitle}>No workouts to show</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'global' 
          ? "Be the first to share your workout with the community!" 
          : "Follow friends to see their workouts here"}
      </Text>
      {activeTab === 'friends' && (
        <TouchableOpacity 
          style={styles.findFriendsButton}
          onPress={() => navigation.navigate('Friends')}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            style={styles.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.findFriendsText}>Find Friends</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.navHeader,
          { 
            opacity: headerOpacity,
            paddingTop: insets.top > 0 ? 0 : 8
          }
        ]}
      >
        <Text style={styles.headerTitle}>Community</Text>
      </Animated.View>
      
      <View style={styles.mainContent}>
        {/* Tab Selector */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'global' && styles.activeTab]} 
            onPress={() => setActiveTab('global')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons 
              name="earth" 
              size={18} 
              color={activeTab === 'global' ? "#FFF" : "#999"} 
            />
            <Text style={[styles.tabText, activeTab === 'global' && styles.activeTabText]}>
              Global
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'friends' && styles.activeTab]} 
            onPress={() => setActiveTab('friends')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons 
              name="account-group" 
              size={18} 
              color={activeTab === 'friends' ? "#FFF" : "#999"} 
            />
            <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
              Friends
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Workout List */}
        {loading && !refreshing ? (
          <LoadingState />
        ) : workouts.length > 0 ? (
          <Animated.FlatList
            data={workouts}
            renderItem={renderWorkoutCard}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing} 
                onRefresh={onRefresh}
                tintColor="#3B82F6"
                colors={["#3B82F6"]}
              />
            }
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
          />
        ) : (
          <EmptyState />
        )}
      </View>
      
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
              <View style={[
                styles.templateModalContent,
                { width: 240, padding: 14, alignSelf: 'center', minHeight: 0 }
              ]}>
                <Text style={styles.modalTitle}>Save Workout Template</Text>
                <TextInput
                  style={styles.templateNameInput}
                  placeholder="Template Name"
                  placeholderTextColor="#777"
                  value={templateName}
                  onChangeText={setTemplateName}
                  autoFocus
                />
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 20,
                  gap: 14
                }}>
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
                      minWidth: 0,
                      paddingHorizontal: 0,
                      justifyContent: 'center'
                    }}
                    contentStyle={{
                      paddingHorizontal: 0,
                      minWidth: 0,
                      justifyContent: 'center'
                    }}
                    labelStyle={{
                      color: '#FFF',
                      fontWeight: '600',
                      fontSize: 16,
                      textAlign: 'center'
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  mainContent: {
    flex: 1,
  },
  navHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    backgroundColor: '#0A0A0A',
    zIndex: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginRight: 10,
    backgroundColor: '#1A1A1A',
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  
  // Workout card
  workoutCard: {
    borderRadius: 20,
    marginBottom: 20,
    // Remove overflow property
  },
  cardGradient: {
    borderRadius: 20,
    // Don't use overflow here
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  userMeta: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
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
  
  // Workout content
  workoutContent: {
    padding: 16,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
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
  
  // Exercise list
  exercisesList: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  
  // Action buttons
  actions: {
    flexDirection: 'row',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
    marginLeft: 6,
  },
  activeCommentText: {
    color: '#3B82F6',
  },
  activeCommentButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  likedButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  
  // Comments section
  commentsSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
  },
  commentContainer: {
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  commentUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  commentText: {
    fontSize: 14,
    color: '#E0E0E0',
    paddingLeft: 32,
  },
  noCommentsText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 12,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  postCommentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledPostButton: {
    backgroundColor: '#444',
  },
  keyboardSafeArea: {
    width: '100%',
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  findFriendsButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  gradientButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  findFriendsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    marginLeft: 8,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 130,
  },
  saveButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardWrapper: {
    marginBottom: 20,
  },
  cardInnerWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardWrapper: {
    borderRadius: 20,
    marginBottom: 20,
  },
  cardInnerWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  commentInputWrapper: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  templateModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  templateModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  templateModalSubtitle: {
    color: '#999',
    fontSize: 14,
    marginBottom: 24,
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
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CommunityScreen;