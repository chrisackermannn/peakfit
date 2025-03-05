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
  Image
} from 'react-native';
import { Card, Button, IconButton, Avatar, Divider, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getGlobalWorkouts, toggleLike, addComment } from '../data/firebaseHelpers';
import { format } from 'date-fns';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const defaultAvatar = require('../assets/default-avatar.png');

const CommunityScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  
  const categories = [
    { id: 1, title: 'Workouts', icon: 'dumbbell', navigate: true },
    { id: 2, title: 'Monthly Challenges', icon: 'trophy-outline', navigate: false },
    { id: 3, title: 'Diets', icon: 'food-apple', navigate: false },
    { id: 4, title: 'Trending', icon: 'trending-up', navigate: false }
  ];

  // Add formatDuration helper function
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

      return () => unsubscribe(); // Return cleanup function
    } catch (error) {
      console.error('Error loading workouts:', error);
      setLoading(false);
      return () => {}; // Return empty cleanup if error
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

  // Add userPhotoURL to comment data
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

  // Update Card render to include comments
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
          <IconButton icon="dots-vertical" size={20} onPress={() => {}} />
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
                color="#007AFF"
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
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e3f2fd',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  profileImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e3f2fd',
  },
  categoriesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingBottom: 0,
    gap: 8,
  },
  categoryBox: {
    width: '48%',
    height: 70,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    })
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#e3f2fd',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  feedContainer: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  categoryBox: {
    width: '48%',
    aspectRatio: 1.5,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    })
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  feedContainer: {
    padding: 16,
  },
  listContent: {
    padding: 16,
  },
  workoutCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e3f2fd',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    })
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
    color: '#007AFF',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  workoutContent: {
    marginVertical: 12,
  },
  workoutMeta: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  workoutStats: {
    marginRight: 16,
    fontSize: 14,
    color: '#666',
  },
  exercisesList: {
    marginTop: 8,
  },
  exerciseItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e3f2fd',
  },
  actionButton: {
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3f2fd',
    backgroundColor: '#fff',
    minWidth: 72,
  },
  likedButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  activeCommentButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  loading: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  commentTime: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
  },
  commentText: {
    fontSize: 14,
    marginLeft: 32,
    color: '#333',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  commentInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e3f2fd',
    marginVertical: 12,
  }
});

export default CommunityScreen;