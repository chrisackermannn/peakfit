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
  Platform
} from 'react-native';
import { Surface, Button, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { getUserWorkouts } from '../data/firebaseHelpers';
import { format } from 'date-fns';
// Import from your messagingHelpers instead of streamChat
import { startDirectMessage } from '../data/messagingHelpers';
import { CommonActions } from '@react-navigation/native';

const defaultAvatar = require('../assets/default-avatar.png');

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { user } = useAuth();
  
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
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          color="#FFFFFF"
          size={24}
          onPress={() => navigation.goBack()}
          style={styles.backIcon}
        />
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {/* User Profile Header */}
        <Surface style={styles.profileHeader}>
          <View style={styles.profileTop}>
            <Image 
              source={userData?.photoURL ? { uri: userData.photoURL } : defaultAvatar} 
              style={styles.profileImage}
              defaultSource={defaultAvatar}
            />
            
            <View style={styles.userInfo}>
              <View style={styles.userDetails}>
                <Text style={styles.displayName}>{userData.displayName || userData.username}</Text>
                <Text style={styles.username}>@{userData.username}</Text>
                
                {/* Friend button - only show if it's not the current user's profile */}
                {user?.uid !== userId && (
                  <View style={styles.actionButtons}>
                    <Button
                      mode={isFriend ? "outlined" : "contained"}
                      onPress={toggleFriend}
                      loading={friendLoading}
                      disabled={friendLoading}
                      style={[styles.friendButton, isFriend && styles.unfriendButton]}
                      labelStyle={isFriend ? styles.unfriendButtonLabel : {}}
                    >
                      {isFriend ? "Unfriend" : "Add Friend"}
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={startChat}
                      style={styles.chatButton}
                      icon="chat"
                    >
                      Message
                    </Button>
                  </View>
                )}
              </View>
            </View>
          </View>
          
          {/* Bio Section */}
          {userData.bio ? (
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{userData.bio}</Text>
            </View>
          ) : null}
        </Surface>
        
        {/* Workouts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          
          {workouts.length === 0 ? (
            <Text style={styles.noWorkoutsText}>No workouts to display</Text>
          ) : (
            <FlatList
              data={workouts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Surface style={styles.workoutCard}>
                  <View style={styles.workoutHeader}>
                    <Text style={styles.workoutTitle}>
                      {item.name || 'Workout'}
                    </Text>
                    <Text style={styles.workoutDate}>
                      {item.date ? formatDate(item.date) : 'No date'}
                    </Text>
                  </View>
                  
                  <View style={styles.workoutDetails}>
                    <View style={styles.workoutStat}>
                      <MaterialCommunityIcons name="weight-lifter" size={18} color="#4299e1" />
                      <Text style={styles.workoutStatText}>
                        {item.totalWeight || 0} lbs
                      </Text>
                    </View>
                    
                    <View style={styles.workoutStat}>
                      <MaterialCommunityIcons name="dumbbell" size={18} color="#4299e1" />
                      <Text style={styles.workoutStatText}>
                        {item.exercises?.length || 0} exercises
                      </Text>
                    </View>
                  </View>
                </Surface>
              )}
              scrollEnabled={false}
            />
          )}
        </View>
        
        {/* Add some padding at the bottom to account for the tab bar */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Tab Bar Navigation - Styled exactly like the Tabs.js navigator */}
      <View style={[
        styles.tabBar, 
        { height: 60 + bottomInset, paddingBottom: bottomInset }
      ]}>
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigateToTab('Home')}
        >
          <MaterialCommunityIcons name="home-outline" size={24} color="#999" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigateToTab('Workout')}
        >
          <MaterialCommunityIcons name="dumbbell" size={24} color="#999" />
          <Text style={styles.tabLabel}>Workout</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigateToTab('Community')}
        >
          <MaterialCommunityIcons name="account-group-outline" size={24} color="#999" />
          <Text style={styles.tabLabel}>Community</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigateToTab('Profile')}
        >
          <MaterialCommunityIcons name="account-outline" size={24} color="#999" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 20,
  },
  backIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 16,
    textAlign: 'center',
  },
  profileHeader: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 10,
    margin: 16,
    elevation: 3,
  },
  profileTop: {
    flexDirection: 'row',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#A0AEC0',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  friendButton: {
    marginRight: 8,
    borderRadius: 8,
  },
  unfriendButton: {
    borderColor: '#E53E3E',
  },
  unfriendButtonLabel: {
    color: '#E53E3E',
  },
  chatButton: {
    borderRadius: 8,
  },
  bioContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
  },
  bioText: {
    fontSize: 16,
    color: '#CBD5E0',
    lineHeight: 22,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  workoutCard: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  workoutDate: {
    fontSize: 14,
    color: '#A0AEC0',
  },
  workoutDetails: {
    flexDirection: 'row',
    marginTop: 8,
  },
  workoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  workoutStatText: {
    color: '#A0AEC0',
    fontSize: 14,
    marginLeft: 6,
  },
  noWorkoutsText: {
    color: '#A0AEC0',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  // Tab Bar - Styled exactly like in Tabs.js
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    paddingBottom: 4,
    color: '#999',
    marginTop: 4,
  },
});