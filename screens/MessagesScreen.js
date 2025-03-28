// screens/MessagesScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, IconButton, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
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

  useEffect(() => {
    if (user?.uid) {
      loadConversations();
    }
    
    return () => {
      // Clean up when component unmounts
    };
  }, [user?.uid]);
  
  // Load conversations from Firestore
  const loadConversations = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      setError(null);
      
      try {
        // Get all conversations for the current user
        const conversationsData = await getUserConversations(user.uid);
        setConversations(conversationsData || []);
      } catch (err) {
        console.error('Error loading conversations:', err);
        
        if (err.code === 'permission-denied') {
          setError('You have no message history yet. Start a conversation to begin messaging.');
        } else {
          setError('Failed to load messages. Please try again later.');
        }
      }
    } catch (err) {
      console.error('Error in loadConversations:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    
    const date = timestamp instanceof Date ? timestamp : 
                 (typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp));
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Show time for today, show date for older messages
    if (diffDays === 0) {
      return format(date, 'h:mm a');
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return format(date, 'EEEE'); // Day name
    } else {
      return format(date, 'MMM d'); // Month and day
    }
  };
  
  // Navigate to chat screen with a specific conversation
  const openChat = (conversation) => {
    const otherUser = conversation.withUser || conversation.otherUser || {};
    
    navigation.navigate('ChatConversation', { 
      conversationId: conversation.id,
      otherUser: {
        id: otherUser.id,
        name: otherUser.displayName || otherUser.name || 'User',
        image: otherUser.photoURL || otherUser.image || null
      }
    });
  };
  
  // Navigate to find new people to message
  const goToFindPeople = () => {
    navigation.navigate('Friends');
  };
  
  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };
  
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }
  
  const renderConversationItem = ({ item }) => {
    // Handle both old and new conversation formats
    const otherUser = item.withUser || item.otherUser || {};
    
    return (
      <TouchableOpacity
        style={styles.channelItem}
        onPress={() => openChat(item)}
      >
        <Image
          source={otherUser?.photoURL || otherUser?.image ? { uri: otherUser.photoURL || otherUser.image } : defaultAvatar}
          style={styles.avatar}
          defaultSource={defaultAvatar}
        />
        
        <View style={styles.channelInfo}>
          <View style={styles.channelNameRow}>
            <Text style={styles.channelName}>
              {otherUser?.displayName || otherUser?.name || 'User'}
            </Text>
            <Text style={styles.messageTime}>
              {formatTimestamp(item.lastMessageAt)}
            </Text>
          </View>
          
          <Text style={[
            styles.lastMessage,
            item.unreadCount > 0 && styles.unreadMessage
          ]} numberOfLines={1}>
            {item.lastMessage || 'Start a conversation'}
          </Text>
        </View>
        
        {(item.unreadCount > 0) && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{item.unreadCount}</Text>
          </View>
        )}
        
        <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
      </TouchableOpacity>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          color="#FFFFFF"
          size={24}
          onPress={() => navigation.goBack()}
          style={styles.backIcon}
        />
        <Text style={styles.headerTitle}>Messages</Text>
        
        <IconButton
          icon="account-plus"
          color="#FFFFFF"
          size={24}
          onPress={goToFindPeople}
        />
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="chat-outline" size={60} color="#666" />
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            mode="contained" 
            onPress={goToFindPeople} 
            style={styles.startChatButton}
          >
            Start Messaging
          </Button>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="chat-outline" size={60} color="#666" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <TouchableOpacity
            style={styles.startChatButton}
            onPress={goToFindPeople}
          >
            <Text style={styles.startChatButtonText}>Start a Conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}
    </SafeAreaView>
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
    justifyContent: 'space-between',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  startChatButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  startChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  channelInfo: {
    flex: 1,
    marginLeft: 16,
  },
  channelNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#999',
  },
  unreadMessage: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#3B82F6',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  }
});