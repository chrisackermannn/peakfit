// screens/FriendsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput
} from 'react-native';
import { Surface, Button, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { db } from '../Firebase/firebaseConfig';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { getUserFriends, searchUsers } from '../data/firebaseHelpers';
import { startDirectMessage } from '../data/messagingHelpers';

const defaultAvatar = require('../assets/default-avatar.png');

export default function FriendsScreen({ navigation }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  // Load friends list
  const loadFriends = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const friendsList = await getUserFriends(user.uid);
      setFriends(friendsList);
    } catch (err) {
      console.error('Error loading friends:', err);
      setError('Failed to load friends list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFriends();
  }, [user?.uid]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadFriends();
  };

  // Search for users
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setSearching(true);
      setError(null);
      const results = await searchUsers(searchQuery.trim());
      
      // Filter out current user and already-friended users from results
      const filteredResults = results.filter(result => 
        result.id !== user?.uid && 
        !friends.some(friend => friend.id === result.id)
      );
      
      setSearchResults(filteredResults);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  // Remove a friend
  const removeFriend = async (friendId) => {
    if (!user?.uid) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        friends: arrayRemove(friendId)
      });
      
      // Update the local state
      setFriends(prev => prev.filter(friend => friend.id !== friendId));
    } catch (err) {
      console.error('Error removing friend:', err);
      setError('Failed to remove friend');
    }
  };

  // Start a chat
  const startChat = async (friendId) => {
    try {
      if (!user?.uid) return;
      
      const conversation = await startDirectMessage(user.uid, friendId);
      
      navigation.navigate('ChatConversation', { 
        conversationId: conversation.id,
        otherUser: conversation.otherUser
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      setError('Could not start conversation');
    }
  };

  // View a user's profile
  const viewProfile = (userId) => {
    navigation.navigate('UserProfile', { userId });
  };

  // Clear search results and query
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // Render a friend item
  const renderFriendItem = ({ item }) => (
    <Surface style={styles.friendCard}>
      <TouchableOpacity 
        style={styles.friendContent}
        onPress={() => viewProfile(item.id)}
      >
        <Image
          source={item.photoURL ? { uri: item.photoURL } : defaultAvatar}
          style={styles.friendAvatar}
          defaultSource={defaultAvatar}
        />
        
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.displayName || item.username}</Text>
          <Text style={styles.friendUsername}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.friendActions}>
        <IconButton
          icon="chat"
          color="#3B82F6"
          size={24}
          onPress={() => startChat(item.id)}
          style={styles.chatButton}
        />
        
        <Button
          mode="outlined"
          onPress={() => removeFriend(item.id)}
          style={styles.unfriendButton}
          labelStyle={styles.unfriendButtonLabel}
        >
          Unfriend
        </Button>
      </View>
    </Surface>
  );

  // Render a search result item
  const renderSearchResultItem = ({ item }) => (
    <Surface style={styles.friendCard}>
      <TouchableOpacity 
        style={styles.friendContent}
        onPress={() => viewProfile(item.id)}
      >
        <Image
          source={item.photoURL ? { uri: item.photoURL } : defaultAvatar}
          style={styles.friendAvatar}
        />
        
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.displayName || item.username}</Text>
          <Text style={styles.friendUsername}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      
      <Button
        mode="contained"
        onPress={() => viewProfile(item.id)}
        style={styles.viewProfileButton}
      >
        View Profile
      </Button>
    </Surface>
  );

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
        <Text style={styles.headerTitle}>Friends</Text>
      </View>

      {/* Search Section */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialCommunityIcons name="magnify" size={24} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for new friends..."
            placeholderTextColor="#999"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={clearSearch}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <Button
          mode="contained"
          onPress={handleSearch}
          disabled={!searchQuery.trim() || searching}
          style={[
            styles.searchButton,
            (!searchQuery.trim() || searching) && styles.searchButtonDisabled
          ]}
          labelStyle={styles.searchButtonLabel}
        >
          {searching ? 'Searching...' : 'Search'}
        </Button>
      </View>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          <FlatList
            data={searchResults}
            renderItem={renderSearchResultItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.searchResultsList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No users found</Text>
            }
          />
          <Button
            mode="text"
            onPress={clearSearch}
            style={styles.clearButton}
            labelStyle={styles.clearButtonLabel}
          >
            Clear Results
          </Button>
        </View>
      )}

      {/* Friends List */}
      {searchResults.length === 0 && (
        <View style={styles.friendsContainer}>
          <Text style={styles.sectionTitle}>Your Friends</Text>
          
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <FlatList
              data={friends}
              renderItem={renderFriendItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.friendsList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#3B82F6']} />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="account-group" size={60} color="#666" />
                  <Text style={styles.emptyStateText}>No friends yet</Text>
                  <Text style={styles.emptyStateSubText}>
                    Search for users to add them as friends
                  </Text>
                </View>
              }
            />
          )}
          
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>
      )}
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
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  searchButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  searchButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  friendsContainer: {
    flex: 1,
    padding: 16,
  },
  searchResultsContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  friendsList: {
    paddingBottom: 20,
  },
  searchResultsList: {
    marginBottom: 12,
  },
  friendCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  friendDetails: {
    flex: 1,
    marginLeft: 16,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  friendUsername: {
    fontSize: 14,
    color: '#999',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButton: {
    margin: 0,
    marginRight: 8,
  },
  unfriendButton: {
    backgroundColor: 'transparent',
    borderColor: '#FF3B30',
    borderRadius: 8,
  },
  unfriendButtonLabel: {
    color: '#FF3B30',
  },
  viewProfileButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 16,
  },
  clearButton: {
    marginTop: 8,
  },
  clearButtonLabel: {
    color: '#3B82F6',
    fontSize: 16,
  },
});