import React, { useState, useEffect } from 'react';
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
  ScrollView,
  SafeAreaView,
  Image,
  Modal
} from 'react-native';
import { Card, Button, IconButton, Avatar, Divider } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getGlobalWorkouts, toggleLike, addComment, saveTemplate } from '../data/firebaseHelpers';
import { format } from 'date-fns';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { showMessage } from "react-native-flash-message";

const defaultAvatar = require('../assets/default-avatar.png');

const CommunityScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [templateNameModalVisible, setTemplateNameModalVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [activeTab, setActiveTab] = useState('global');

  // Format duration helper function
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadWorkouts = async (tab = activeTab) => {
    try {
      setLoading(true);
      let workoutQuery;
      
      if (tab === 'global') {
        // Global feed - all public workouts
        workoutQuery = query(
          collection(db, 'globalWorkouts'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      } else {
        // Friends feed - only workouts from friends
        if (!user?.uid) {
          setWorkouts([]);
          setLoading(false);
          return () => {};
        }
        
        // Get current user's friend list from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          setWorkouts([]);
          setLoading(false);
          return () => {};
        }
        
        const userData = userDocSnap.data();
        const friendIds = userData.friends || [];
        
        // If no friends, show empty state
        if (friendIds.length === 0) {
          setWorkouts([]);
          setLoading(false);
          return () => {};
        }
        
        // Query workouts from friends only
        workoutQuery = query(
          collection(db, 'globalWorkouts'),
          where('userId', 'in', friendIds),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      }

      const unsubscribe = onSnapshot(workoutQuery, (snapshot) => {
        const newWorkouts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          likes: doc.data().likes || [],
          comments: doc.data().comments || []
        }));
        setWorkouts(newWorkouts);
        setLoading(false);
      }, (error) => {
        console.error('Snapshot error:', error);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading workouts:', error);
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const cleanup = loadWorkouts(activeTab);
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [activeTab, user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkouts(activeTab);
    setRefreshing(false);
  };

  const handleLike = async (workoutId) => {
    if (!user?.uid) return;
    try {
      await toggleLike(workoutId, user.uid);
    } catch (error) {
      console.error('Error liking workout:', error);
    }
  };

  const handleComment = async (workoutId) => {
    if (!comment.trim() || !user?.uid) return;
    
    try {
      const commentData = {
        userId: user.uid,
        userDisplayName: user.displayName || user.username || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        text: comment.trim(),
        createdAt: new Date().toISOString()
      };

      await addComment(workoutId, commentData);
      setComment('');
      setSelectedWorkout(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    }
  };

  // Template functions
  const copyWorkoutTemplate = (workout) => {
    if (!user?.uid) {
      Alert.alert('Login Required', 'Please log in to save templates');
      return;
    }
    
    setCurrentWorkout(workout);
    setTemplateName('');
    setTemplateNameModalVisible(true);
  };

  const saveWorkoutTemplate = async () => {
    if (!templateName.trim() || !currentWorkout) {
      Alert.alert('Error', 'Please provide a name for the template');
      return;
    }
    
    try {
      const templateData = {
        name: templateName.trim(),
        sourceWorkout: {
          id: currentWorkout.id,
          userDisplayName: currentWorkout.userDisplayName || 'Anonymous'
        },
        exercises: currentWorkout.exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps
        }))
      };
      
      await saveTemplate(user.uid, templateData);
      
      showMessage({
        message: "Template Saved!",
        description: "Access it when starting a new workout",
        type: "success",
        backgroundColor: "#3B82F6",
        duration: 3000,
        icon: "success"
      });
      
      setTemplateNameModalVisible(false);
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Could not save workout template');
    }
  };

  // Navigate to user profile
  const handleUserPress = (userId) => {
    navigation.navigate('UserProfile', { userId });
  };

  // Render comment section
  const renderComments = (item) => (
    <View style={styles.commentsSection}>
      <Divider style={styles.divider} />
      
      {/* Comments List */}
      {item.comments?.map((comment, index) => {
        // Generate unique timestamp for each avatar to force refresh
        const imageKey = Date.now() + index;
        return (
          <View key={index} style={styles.commentContainer}>
            <View style={styles.commentHeader}>
              <TouchableOpacity 
                onPress={() => handleUserPress(comment.userId)}
                style={styles.commentAvatarContainer}
              >
                <Avatar.Image 
                  size={24} 
                  source={
                    comment.userPhotoURL 
                      ? { uri: `${comment.userPhotoURL}?t=${imageKey}` } 
                      : defaultAvatar
                  }
                />
              </TouchableOpacity>
              <Text style={styles.commentUser}>{comment.userDisplayName}</Text>
              <Text style={styles.commentTime}>
                {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.text}</Text>
          </View>
        );
      })}

      {/* Comment Input */}
      {selectedWorkout?.id === item.id && (
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <IconButton
            icon="send"
            size={20}
            color="#3B82F6"
            onPress={() => handleComment(item.id)}
            disabled={!comment.trim()}
          />
        </View>
      )}
    </View>
  );

  // Render workout card
  const renderWorkout = ({ item }) => (
    <Card style={styles.workoutCard}>
      <Card.Content>
        <View style={styles.userInfo}>
          <TouchableOpacity 
            style={styles.userHeader}
            onPress={() => handleUserPress(item.userId)}
          >
            <Avatar.Image 
              size={40} 
              source={item.userPhotoURL ? { uri: `${item.userPhotoURL}?t=${Date.now()}` } : defaultAvatar} 
            />
            <View style={styles.userMeta}>
              <Text style={styles.userName}>
                {item.userDisplayName || 'Anonymous'}
              </Text>
              <Text style={styles.timestamp}>
                {format(item.createdAt, 'MMM d, yyyy')}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.cardActions}>
            <IconButton 
              icon="content-copy" 
              size={20} 
              color="#3B82F6"
              onPress={() => copyWorkoutTemplate(item)}
              style={styles.copyButton}
            />
          </View>
        </View>

        <View style={styles.workoutContent}>
          <View style={styles.workoutMeta}>
            <Text style={styles.workoutStats}>
              🏋️‍♂️ {item.exercises?.length || 0} exercises
            </Text>
            <Text style={styles.workoutStats}>
              ⏱️ {formatDuration(item.duration)}
            </Text>
          </View>

          <View style={styles.exercisesList}>
            {item.exercises?.map((exercise, index) => (
              <Text key={index} style={styles.exerciseItem}>
                • {exercise.name}: {exercise.sets}×{exercise.reps} @ {exercise.weight}lbs
              </Text>
            ))}
          </View>
        </View>

        {renderActionButtons({ item })}

        {selectedWorkout?.id === item.id && renderComments(item)}
      </Card.Content>
    </Card>
  );

  const renderActionButtons = ({ item }) => (
    <View style={styles.actions}>
      <Button 
        icon={({size}) => (
          <MaterialCommunityIcons 
            name="heart"
            size={24}
            color={item.likes?.includes(user?.uid) ? '#FF3B30' : '#666'}
          />
        )}
        mode="outlined"
        onPress={() => handleLike(item.id)}
        style={styles.actionButton}
        labelStyle={{
          color: '#666'
        }}
      >
        {item.likes?.length || 0}
      </Button>

      <Button 
        icon={({size}) => (
          <MaterialCommunityIcons 
            name="comment"
            size={24}
            color={selectedWorkout?.id === item.id ? '#007AFF' : '#666'}
          />
        )}
        mode="outlined"
        onPress={() => setSelectedWorkout(selectedWorkout?.id === item.id ? null : item)}
        style={styles.actionButton}
        labelStyle={{
          color: '#666'
        }}
      >
        {item.comments?.length || 0}
      </Button>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Community</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Image 
            source={user?.photoURL ? { uri: `${user.photoURL}?t=${Date.now()}` } : defaultAvatar}
            style={styles.profileImage}
          />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'global' && styles.activeTab]} 
          onPress={() => setActiveTab('global')}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.activeTabText]}>Global</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]} 
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>Friends</Text>
        </TouchableOpacity>
      </View>

      {workouts.length > 0 ? (
        <FlatList
          data={workouts}
          renderItem={renderWorkout}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <MaterialCommunityIcons 
            name={activeTab === 'global' ? "earth" : "account-group"} 
            size={60} 
            color="#666" 
          />
          <Text style={styles.emptyText}>
            {activeTab === 'global' 
              ? "No workouts posted yet" 
              : "No workout posts from friends yet"}
          </Text>
          {activeTab === 'friends' && (
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('Friends')}
              style={styles.findFriendsButton}
            >
              Find Friends
            </Button>
          )}
        </ScrollView>
      )}

      {/* Template Name Modal */}
      <Modal
        visible={templateNameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTemplateNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.contentWrapper}>
              <Text style={styles.modalTitle}>Save as Template</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter template name"
                placeholderTextColor="#999"
                value={templateName}
                onChangeText={setTemplateName}
              />
              <View style={styles.modalButtons}>
                <Button
                  mode="text"
                  onPress={() => setTemplateNameModalVisible(false)}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={saveWorkoutTemplate}
                  style={[styles.modalButton, styles.saveButton]}
                >
                  Save
                </Button>
              </View>
            </View>
          </View>
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
    backgroundColor: '#141414',
    borderBottomColor: '#222',
    borderBottomWidth: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  activeTabText: {
    color: '#FFFFFF',
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
  feedContainer: {
    paddingBottom: 20,
  },
  workoutCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMeta: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 13,
    color: '#666',
  },
  workoutContent: {
    marginVertical: 12,
  },
  workoutMeta: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 16,
  },
  workoutStats: {
    fontSize: 15,
    color: '#999',
  },
  exercisesList: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  exerciseItem: {
    fontSize: 15,
    color: '#FFF',
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#3B82F6',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  likedButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  findFriendsButton: {
    backgroundColor: '#3B82F6',
    marginTop: 16,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyButton: {
    marginRight: -8,
  },
  commentsSection: {
    marginTop: 12,
  },
  commentContainer: {
    marginVertical: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAvatarContainer: {
    marginRight: 8,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
  },
  commentText: {
    fontSize: 14,
    color: '#DDD',
    paddingLeft: 32,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingLeft: 12,
  },
  commentInput: {
    flex: 1,
    color: '#FFF',
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  contentWrapper: {
    borderRadius: 16,
  }
});

export default CommunityScreen;