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
  Platform,
  Image,
  Modal
} from 'react-native';
import { Card, Button, IconButton, Avatar, Divider, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getGlobalWorkouts, toggleLike, addComment, saveTemplate } from '../data/firebaseHelpers';
import { format } from 'date-fns';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
  
  const categories = [
    { id: 1, title: 'Workouts', icon: 'dumbbell', navigate: true },
    { id: 2, title: 'Monthly Challenges', icon: 'trophy-outline', navigate: false },
    { id: 3, title: 'Diets', icon: 'food-apple', navigate: false },
    { id: 4, title: 'Trending', icon: 'trending-up', navigate: false }
  ];

  // Format duration helper function
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'globalWorkouts'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
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

      return () => unsubscribe();
    } catch (error) {
      console.error('Error loading workouts:', error);
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const cleanup = loadWorkouts();
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkouts();
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
          // Weight intentionally omitted
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

  // Render comment section
  const renderComments = (item) => (
    <View style={styles.commentsSection}>
      <Divider style={styles.divider} />
      
      {/* Comments List */}
      {item.comments?.map((comment, index) => (
        <View key={index} style={styles.commentContainer}>
          <View style={styles.commentHeader}>
            <Avatar.Image 
              size={24} 
              source={comment.userPhotoURL ? { uri: comment.userPhotoURL } : defaultAvatar}
            />
            <Text style={styles.commentUser}>{comment.userDisplayName}</Text>
            <Text style={styles.commentTime}>
              {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
            </Text>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
        </View>
      ))}

      {/* Comment Input */}
      {selectedWorkout?.id === item.id && (
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment..."
            multiline
            maxLength={500}
          />
          <IconButton
            icon="send"
            size={20}
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
          <TouchableOpacity style={styles.userHeader}>
            <Avatar.Image 
              size={40} 
              source={item.userPhotoURL ? { uri: item.userPhotoURL } : defaultAvatar} 
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
            <IconButton icon="dots-vertical" size={20} onPress={() => {}} />
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

  if (loading) {
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
            source={user?.photoURL ? { uri: user.photoURL } : defaultAvatar}
            style={styles.profileImage}
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.categoriesWrapper}>
          {categories.map(category => (
            <TouchableOpacity 
              key={category.id} 
              style={styles.categoryBox}
              onPress={() => category.navigate && navigation.navigate('Profile')}
              activeOpacity={category.navigate ? 0.7 : 1}
            >
              <MaterialCommunityIcons 
                name={category.icon} 
                size={24} 
                color="#3B82F6"
              />
              <Text style={styles.categoryTitle}>{category.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />
        
        <FlatList
          data={workouts}
          renderItem={renderWorkout}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Latest Activities</Text>
          }
          contentContainerStyle={styles.feedContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No workouts found</Text>
          }
        />
      </ScrollView>

      {/* Template Name Modal */}
      <Modal
        visible={templateNameModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTemplateNameModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Surface style={styles.modalContent}>
            <View style={{ overflow: 'hidden' }}>
              <Text style={styles.modalTitle}>Save Template</Text>
              <Text style={styles.modalSubtitle}>Give this workout template a name:</Text>
              
              <TextInput
                style={styles.templateNameInput}
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="Template Name"
                placeholderTextColor="#666"
              />
              
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setTemplateNameModalVisible(false);
                    setTemplateName('');
                    setCurrentWorkout(null);
                  }}
                  style={styles.cancelButton}
                >
                  Cancel
                </Button>
                
                <Button
                  mode="contained"
                  onPress={saveWorkoutTemplate}
                  style={styles.saveButton}
                  disabled={!templateName.trim()}
                >
                  Save
                </Button>
              </View>
            </View>
          </Surface>
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
  scrollView: {
    flex: 1,
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
  categoriesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  categoryBox: {
    width: '48%',
    height: 70,
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
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
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
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
  commentUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
    flex: 1,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
  },
  commentText: {
    fontSize: 15,
    color: '#CCC',
    marginLeft: 32,
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#222',
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  templateNameInput: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#3B82F6',
    borderRadius: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },
});

export default CommunityScreen;