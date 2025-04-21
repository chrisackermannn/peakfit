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
  StatusBar
} from 'react-native';
import { Surface, Button, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { getUserWorkouts } from '../data/firebaseHelpers';
import { format } from 'date-fns';
import { startDirectMessage } from '../data/messagingHelpers';
import { CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  // For iOS safe area bottom padding
  const bottomInset = Platform.OS === 'ios' ? 24 : 0;
  
  // Navigation helpers
  const navigateToTab = (tabName) => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          { name: 'Tabs', params: { screen: tabName } },
        ],
      })
    );
  };
  
  // Load user data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get user profile data
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          setError('User not found');
          setLoading(false);
          return;
        }
        
        setUserData(userDoc.data());
        
        // Check if this user is in the current user's friends list
        if (user?.uid) {
          const currentUserDoc = await getDoc(doc(db, 'users', user.uid));
          if (currentUserDoc.exists()) {
            const friends = currentUserDoc.data().friends || [];
            setIsFriend(friends.includes(userId));
          }
        }
        
        // Get user's workouts
        const userWorkouts = await getUserWorkouts(userId);
        setWorkouts(userWorkouts);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [userId, user?.uid]);
  
  // Toggle friend status
  const toggleFriend = async () => {
    if (!user?.uid) return;
    
    try {
      setFriendLoading(true);
      const userRef = doc(db, 'users', user.uid);
      
      if (isFriend) {
        // Remove friend
        await updateDoc(userRef, {
          friends: arrayRemove(userId)
        });
      } else {
        // Add friend
        await updateDoc(userRef, {
          friends: arrayUnion(userId)
        });
      }
      
      setIsFriend(!isFriend);
    } catch (error) {
      console.error('Error toggling friend status:', error);
    } finally {
      setFriendLoading(false);
    }
  };
  
  // Start chat
  const startChat = async () => {
    try {
      if (!user?.uid || !userId) return;
      
      // Use your custom messaging helper
      const conversation = await startDirectMessage(user.uid, userId);
      
      navigation.navigate('ChatConversation', { 
        conversationId: conversation.id,
        otherUser: conversation.otherUser
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Could not start conversation');
    }
  };
  
  // Format date helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : 
                (timestamp instanceof Date ? timestamp : new Date(timestamp));
    return format(date, 'MMM d, yyyy');
  };

  // Hide the default header
  useEffect(() => {
    navigation.setOptions({
      headerShown: false
    });
  }, [navigation]);
  
  if (loading) {
    return (
      <LinearGradient 
        colors={['#0A0A0A', '#1A1A1A']} 
        style={styles.loadingContainer}
      >
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#3B82F6" />
      </LinearGradient>
    );
  }
  
  if (error) {
    return (
      <LinearGradient 
        colors={['#0A0A0A', '#1A1A1A']} 
        style={styles.errorContainer}
      >
        <StatusBar barStyle="light-content" />
        <MaterialCommunityIcons name="alert-circle-outline" size={60} color="#E53E3E" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Top gradient header with profile info */}
      <LinearGradient
        colors={['#111827', '#1E293B']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.profileHeaderContent}>
          <Image 
            source={userData?.photoURL ? { uri: userData.photoURL } : defaultAvatar} 
            style={styles.profileImage}
            defaultSource={defaultAvatar}
          />
          
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{userData?.displayName || userData?.username}</Text>
            <Text style={styles.username}>@{userData?.username}</Text>
            
            <View style={styles.joinedInfo}>
              <MaterialCommunityIcons name="calendar" size={14} color="#94A3B8" />
              <Text style={styles.joinedText}>
                Joined {userData?.createdAt ? formatDate(userData.createdAt) : 'recently'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
      
      {/* Action buttons */}
      <View style={styles.actionContainer}>
        <LinearGradient
          colors={['rgba(30, 41, 59, 0.7)', 'rgba(15, 23, 42, 0.7)']}
          style={styles.actionsGradient}
        >
          {user?.uid !== userId && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isFriend ? styles.unfriendButton : styles.friendButton
                ]}
                onPress={toggleFriend}
                disabled={friendLoading}
              >
                <LinearGradient
                  colors={isFriend ? ['#475569', '#334155'] : ['#3B82F6', '#2563EB']}
                  style={styles.actionButtonGradient}
                >
                  {friendLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons 
                        name={isFriend ? "account-minus" : "account-plus"} 
                        size={18} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.actionButtonText}>
                        {isFriend ? 'Unfriend' : 'Add Friend'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={startChat}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.actionButtonGradient}
                >
                  <MaterialCommunityIcons name="chat" size={18} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Message</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </View>
      
      {/* User bio */}
      {userData?.bio && (
        <View style={styles.bioContainer}>
          <LinearGradient
            colors={['rgba(30, 41, 59, 0.4)', 'rgba(15, 23, 42, 0.4)']}
            style={styles.bioGradient}
          >
            <Text style={styles.bioText}>{userData.bio}</Text>
          </LinearGradient>
        </View>
      )}
      
      {/* Workouts section */}
      <View style={styles.workoutsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          <Text style={styles.workoutCount}>{workouts.length}</Text>
        </View>
        
        {workouts.length > 0 ? (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.workoutCard}>
                <LinearGradient
                  colors={['rgba(30, 41, 59, 0.6)', 'rgba(15, 23, 42, 0.6)']}
                  style={styles.workoutGradient}
                >
                  <View style={styles.workoutHeader}>
                    <View style={styles.workoutDate}>
                      <LinearGradient
                        colors={['#3B82F6', '#2563EB']}
                        style={styles.dateCircle}
                      >
                        <Text style={styles.dateDay}>
                          {item.createdAt ? format(item.createdAt.toDate(), 'd') : '--'}
                        </Text>
                        <Text style={styles.dateMonth}>
                          {item.createdAt ? format(item.createdAt.toDate(), 'MMM') : '---'}
                        </Text>
                      </LinearGradient>
                    </View>
                    
                    <View style={styles.workoutInfo}>
                      <Text style={styles.workoutTitle}>{item.title || "Workout"}</Text>
                      <Text style={styles.workoutDuration}>
                        {item.duration ? `${Math.round(item.duration / 60)} min` : 'No duration'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.workoutStats}>
                    <View style={styles.statItem}>
                      <MaterialCommunityIcons name="weight" size={16} color="#60A5FA" />
                      <Text style={styles.statValue}>
                        {item.totalWeight ? `${Math.round(item.totalWeight)} lbs` : '--'}
                      </Text>
                      <Text style={styles.statLabel}>Volume</Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <MaterialCommunityIcons name="dumbbell" size={16} color="#34D399" />
                      <Text style={styles.statValue}>
                        {item.exercises?.length || 0}
                      </Text>
                      <Text style={styles.statLabel}>Exercises</Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <MaterialCommunityIcons name="fire" size={16} color="#F87171" />
                      <Text style={styles.statValue}>
                        {item.calories ? `${item.calories}` : '--'}
                      </Text>
                      <Text style={styles.statLabel}>Calories</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}
            contentContainerStyle={styles.workoutsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWorkouts}>
                <Text style={styles.emptyText}>No workouts yet</Text>
              </View>
            }
          />
        ) : (
          <View style={styles.emptyWorkouts}>
            <MaterialCommunityIcons name="dumbbell" size={60} color="#374151" />
            <Text style={styles.emptyText}>No workouts yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FFF',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Header styles
  header: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginTop: 10,
    marginBottom: 16,
  },
  profileHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 8,
  },
  joinedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinedText: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 6,
  },
  
  // Action buttons section
  actionContainer: {
    paddingHorizontal: 16,
    marginTop: -20,
    zIndex: 10,
  },
  actionsGradient: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 5,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  friendButton: {
    backgroundColor: '#3B82F6',
  },
  unfriendButton: {
    backgroundColor: '#475569',
  },
  
  // Bio section
  bioContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  bioGradient: {
    borderRadius: 16,
    padding: 16,
  },
  bioText: {
    fontSize: 16,
    color: '#E2E8F0',
    lineHeight: 24,
  },
  
  // Workouts section
  workoutsSection: {
    flex: 1,
    marginTop: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  workoutCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  workoutsList: {
    padding: 16,
  },
  workoutCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  workoutGradient: {
    padding: 16,
    borderRadius: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  workoutDate: {
    marginRight: 16,
  },
  dateCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateMonth: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  workoutDuration: {
    fontSize: 14,
    color: '#94A3B8',
  },
  workoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyWorkouts: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  }
});