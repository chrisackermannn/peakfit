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
  TextInput,
  StatusBar,
  Platform
} from 'react-native';
import { Surface, Button, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { db } from '../Firebase/firebaseConfig';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { getUserFriends, searchUsers } from '../data/firebaseHelpers';
import { startDirectMessage } from '../data/messagingHelpers';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const defaultAvatar = require('../assets/default-avatar.png');

export default function FriendsScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Load friends on component mount
  useEffect(() => {
    loadFriends();
    
    // Hide default header
    navigation.setOptions({
      headerShown: false
    });
  }, []);
  
  // Load friends from Firestore
  const loadFriends = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const userFriends = await getUserFriends(user.uid);
      setFriends(userFriends);
    } catch (err) {
      console.error('Error loading friends:', err);
      setError('Failed to load friends');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle search submission
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      setSearching(true);
      setError(null);
      
      const results = await searchUsers(searchQuery);
      
      // Filter out the current user from results
      const filtered = results.filter(result => result.id !== user?.uid);
      
      setSearchResults(filtered);
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };
  
  // Refresh friends list
  const onRefresh = () => {
    setRefreshing(true);
    loadFriends();
  };
  
  // Remove friend
  const removeFriend = async (friendId) => {
    if (!user?.uid || !friendId) return;
    
    try {
      // Update friends array in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        friends: arrayRemove(friendId)
      });
      
      // Update local state
      setFriends(friends.filter(friend => friend.id !== friendId));
    } catch (error) {
      console.error('Error removing friend:', error);
      setError('Failed to remove friend');
    }
  };

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
    <View style={styles.friendCard}>
      <LinearGradient
        colors={['rgba(30, 41, 59, 0.7)', 'rgba(15, 23, 42, 0.7)']}
        style={styles.friendCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity 
          style={styles.friendContent}
          onPress={() => viewProfile(item.id)}
          activeOpacity={0.8}
        >
          <Image
            source={item.photoURL ? { uri: item.photoURL } : defaultAvatar}
            style={styles.friendAvatar}
            defaultSource={defaultAvatar}
          />
          
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{item.displayName || item.username}</Text>
            <Text style={styles.friendUsername}>@{item.username}</Text>
            {item.bio && (
              <Text style={styles.friendBio} numberOfLines={1}>{item.bio}</Text>
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.friendActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => startChat(item.id)}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.actionButtonGradient}
            >
              <MaterialCommunityIcons name="chat-outline" size={16} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => removeFriend(item.id)}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.actionButtonGradient}
            >
              <MaterialCommunityIcons name="account-remove" size={16} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
  
  // Render a search result item
  const renderSearchResultItem = ({ item }) => {
    // Check if this user is already a friend
    const isFriend = friends.some(friend => friend.id === item.id);
    
    return (
      <View style={styles.searchResultCard}>
        <LinearGradient
          colors={['rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
          style={styles.searchResultGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity 
            style={styles.resultContent}
            onPress={() => viewProfile(item.id)}
            activeOpacity={0.8}
          >
            <Image
              source={item.photoURL ? { uri: item.photoURL } : defaultAvatar}
              style={styles.resultAvatar}
              defaultSource={defaultAvatar}
            />
            
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{item.displayName || item.username}</Text>
              <Text style={styles.resultUsername}>@{item.username}</Text>
            </View>
            
            {isFriend ? (
              <View style={styles.friendIndicator}>
                <MaterialCommunityIcons name="account-check" size={16} color="#10B981" />
                <Text style={styles.friendIndicatorText}>Friend</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => {
                  viewProfile(item.id);
                }}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.addButtonGradient}
                >
                  <Text style={styles.addButtonText}>View Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
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
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.spacer} />
      </View>
      
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <LinearGradient
          colors={['rgba(30, 41, 59, 0.6)', 'rgba(15, 23, 42, 0.6)']}
          style={styles.searchGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.searchInputContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for users..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <MaterialCommunityIcons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            style={[
              styles.searchButton,
              !searchQuery.trim() && styles.searchButtonDisabled
            ]}
            onPress={handleSearch}
            disabled={!searchQuery.trim() || searching}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={styles.searchButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.searchButtonText}>
                {searching ? 'Searching...' : 'Search'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
      
      {/* Main Content: Search Results or Friends List */}
      {searchResults.length > 0 ? (
        <View style={styles.searchResultsContainer}>
          <View style={styles.resultsTitleContainer}>
            <Text style={styles.resultsTitle}>Search Results</Text>
            <TouchableOpacity onPress={clearSearch}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={searchResults}
            renderItem={renderSearchResultItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.searchResultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="account-search" size={60} color="#374151" />
                <Text style={styles.emptyText}>No results found</Text>
              </View>
            }
          />
        </View>
      ) : (
        <View style={styles.friendsContainer}>
          <Text style={styles.sectionTitle}>
            {friends.length > 0 ? `Your Friends (${friends.length})` : 'Your Friends'}
          </Text>
          
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <FlatList
              data={friends}
              renderItem={renderFriendItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.friendsList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#3B82F6"
                  colors={["#3B82F6"]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="account-group" size={60} color="#374151" />
                  <Text style={styles.emptyText}>No friends yet</Text>
                  <Text style={styles.emptySubtext}>Search for users to add them as friends</Text>
                </View>
              }
            />
          )}
        </View>
      )}
      
      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
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
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchGradient: {
    padding: 16,
    borderRadius: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 8,
    paddingVertical: 4,
  },
  searchButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Friends section
  friendsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  friendsList: {
    paddingBottom: 20,
  },
  friendCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  friendCardGradient: {
    borderRadius: 16,
    padding: 12,
  },
  friendContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#222',
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  friendUsername: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  friendBio: {
    fontSize: 14,
    color: '#CBD5E0',
    marginTop: 4,
  },
  friendActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    marginLeft: 10,
    overflow: 'hidden',
    borderRadius: 20,
  },
  actionButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Search results section
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  searchResultsList: {
    paddingBottom: 20,
  },
  searchResultCard: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  searchResultGradient: {
    padding: 14,
    borderRadius: 14,
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultUsername: {
    fontSize: 14,
    color: '#94A3B8',
  },
  friendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  friendIndicatorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 6,
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Loading, empty and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
  }
});