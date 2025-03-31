// screens/MessagesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, IconButton, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import { doc, collection, query, where, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { getUserConversations } from '../data/messagingHelpers';
import { format } from 'date-fns';

const defaultAvatar = require('../assets/default-avatar.png');

export default function MessagesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  
  // For iOS safe area bottom padding
  const bottomInset = Platform.OS === 'ios' ? 24 : 0;

  // Load conversations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadConversations();
        setImageKey(Date.now()); // Refresh image cache when screen is focused
      }
      
      return () => {}; // Cleanup function
    }, [user?.uid])
  );
  
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
  
  // Load conversations
  const loadConversations = async () => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      
      if (!refreshing) {
        setLoading(true);
      }
      
      const conversationsData = await getUserConversations(user.uid);
      
      // Ensure user data is up to date by fetching latest user details
      const updatedConversations = await Promise.all(
        conversationsData.map(async (conv) => {
          try {
            if (conv.withUser && conv.withUser.id) {
              // Fetch fresh user data for the conversation partner
              const userDoc = await getDoc(doc(db, 'users', conv.withUser.id));
              
              if (userDoc.exists()) {
                const userData = userDoc.data();
                return {
                  ...conv,
                  withUser: {
                    ...conv.withUser,
                    name: userData.displayName || userData.username || conv.withUser.name || 'User',
                    image: userData.photoURL || conv.withUser.image
                  }
                };
              }
            }
            return conv;
          } catch (err) {
            console.log(`Error fetching user data for conversation ${conv.id}:`, err);
            return conv;
          }
        })
      );
      
      setConversations(updatedConversations);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Handle pull-to-refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };
  
  // Format message date
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const messageDate = timestamp instanceof Date ? 
      timestamp : 
      (typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp));
    
    const now = new Date();
    const isToday = 
      messageDate.getDate() === now.getDate() &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return format(messageDate, 'h:mm a');
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = 
      messageDate.getDate() === yesterday.getDate() &&
      messageDate.getMonth() === yesterday.getMonth() &&
      messageDate.getFullYear() === yesterday.getFullYear();
    
    if (isYesterday) {
      return 'Yesterday';
    }
    
    return format(messageDate, 'MM/dd/yyyy');
  };
  
  // Start a new conversation
  const startNewConversation = () => {
    navigation.navigate('Friends', { action: 'message' });
  };

  // Open a conversation
  const openConversation = (conversation) => {
    navigation.navigate('ChatConversation', {
      conversationId: conversation.id,
      otherUser: conversation.withUser
    });
  };
  
  // View user profile
  const viewProfile = (userId) => {
    navigation.navigate('UserProfile', { userId });
  };
  
  // Render conversation item
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.conversationItem}
      onPress={() => openConversation(item)}
    >
      <TouchableOpacity 
        onPress={() => viewProfile(item.withUser.id)}
        style={styles.avatarContainer}
      >
        <Image 
          source={item.withUser.image ? { uri: `${item.withUser.image}?t=${imageKey}` } : defaultAvatar}
          style={[styles.avatar, item.unreadCount > 0 && styles.unreadAvatar]}
          defaultSource={defaultAvatar}
        />
      </TouchableOpacity>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.withUser.name}
          </Text>
          <Text style={styles.timeText}>
            {formatMessageTime(item.lastMessageAt)}
          </Text>
        </View>
        
        <View style={styles.messageRow}>
          <Text 
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && styles.unreadText
            ]} 
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Empty state component
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="chat-outline"
        size={80}
        color="#888"
      />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a conversation with a friend to see it here
      </Text>
      <Button
        mode="contained"
        onPress={startNewConversation}
        style={styles.newChatButton}
      >
        Start a New Chat
      </Button>
    </View>
  );
  
  // Loading indicator
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            size={24}
            color="#FFFFFF"
            onPress={() => navigation.goBack()}
            style={styles.backIcon}
          />
          <Text style={styles.headerTitle}>Messages</Text>
          <IconButton 
            icon="plus" 
            size={24}
            color="#FFFFFF"
            onPress={startNewConversation}
          />
        </View>
        
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button mode="contained" onPress={loadConversations} style={{ marginTop: 12 }}>
              Try Again
            </Button>
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyComponent}
            ItemSeparatorComponent={() => <Divider style={styles.divider} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#3B82F6']}
                tintColor="#3B82F6"
              />
            }
          />
        )}
      </SafeAreaView>
      
      {/* Tab Bar Navigation - Matches the Tabs.js navigator */}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  header: {
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
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
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2A2A2A',
  },
  unreadAvatar: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    color: '#999',
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  unreadBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  divider: {
    backgroundColor: '#333',
    height: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  newChatButton: {
    marginTop: 16,
    backgroundColor: '#3B82F6',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  // Tab Bar styles - Matches the Tabs.js navigator
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
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    marginTop: 4,
  },
});