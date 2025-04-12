// screens/ChatConversationScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  SafeAreaView,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { 
  collection, 
  query, 
  orderBy,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { 
  sendMessage, 
  markConversationAsRead, 
  listenToMessages 
} from '../data/messagingHelpers';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const defaultAvatar = require('../assets/default-avatar.png');

export default function ChatConversationScreen({ route, navigation }) {
  const { conversationId, otherUser } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const flatListRef = useRef(null);
  
  // Track processed messages to prevent duplicates
  const processedMessageIds = useRef({});
  
  // Only create message listener once
  const messageListener = useRef(null);
  
  // Mark conversation as read when opening
  useEffect(() => {
    if (user?.uid && conversationId) {
      markConversationAsRead(conversationId, user.uid)
        .catch(err => console.error("Error marking as read:", err));
    }
    
    return () => {
      // Clean up listener on unmount
      if (messageListener.current) {
        messageListener.current();
        messageListener.current = null;
      }
    };
  }, []);
  
  // Set up message listener only once
  useEffect(() => {
    if (!user?.uid || !conversationId || !otherUser?.id || messageListener.current) {
      return;
    }
    
    setLoading(true);
    
    // Set up the message listener
    messageListener.current = listenToMessages(
      user.uid,
      conversationId,
      (newMessages) => {
        if (newMessages.length === 0) {
          setLoading(false);
          return;
        }
        
        // Update message state avoiding duplicates
        setMessages(prevMessages => {
          // Map of existing messages for quick lookups
          const existingMessagesMap = {};
          prevMessages.forEach(msg => {
            existingMessagesMap[msg.id] = true;
          });
          
          let hasChanges = false;
          const processedMessages = [...prevMessages];
          
          // Filter and process only new messages
          newMessages.forEach(newMsg => {
            // Skip if already processed or a duplicate
            if (processedMessageIds.current[newMsg.id] || existingMessagesMap[newMsg.id]) {
              return;
            }
            
            // Mark this message ID as processed
            processedMessageIds.current[newMsg.id] = true;
            
            // Check if this replaces a local temporary message
            const localMsgIndex = processedMessages.findIndex(msg => 
              msg.id.startsWith('local-') && 
              msg.text === newMsg.text && 
              msg.senderId === newMsg.senderId
            );
            
            if (localMsgIndex !== -1) {
              // Replace the temporary local message
              processedMessages.splice(localMsgIndex, 1);
            }
            
            // Add the new server-confirmed message
            processedMessages.push(newMsg);
            hasChanges = true;
          });
          
          // If nothing changed, keep current state
          if (!hasChanges) {
            return prevMessages;
          }
          
          // Sort by timestamp
          return processedMessages.sort((a, b) => {
            const timeA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const timeB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return timeA - timeB;
          });
        });
        
        setLoading(false);
        
        // Scroll to bottom after message update
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }, 100);
      }
    );
    
    return () => {
      if (messageListener.current) {
        messageListener.current();
        messageListener.current = null;
      }
    };
  }, [user?.uid, conversationId, otherUser?.id]);
  
  // Send a new message
  const handleSend = async () => {
    if (!text.trim() || !user?.uid || !otherUser?.id || sending) {
      return;
    }
    
    try {
      setSending(true);
      const messageText = text.trim();
      setText('');
      
      // Generate a unique temporary ID
      const localId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Add temporary message to local state
      const localMessage = {
        id: localId,
        text: messageText,
        senderId: user.uid,
        createdAt: new Date()
      };
      
      // Mark as processed to prevent duplication
      processedMessageIds.current[localId] = true;
      setMessages(prevMessages => [...prevMessages, localMessage]);
      
      // Send to Firebase
      await sendMessage(conversationId, user.uid, otherUser.id, messageText);
      
      // Scroll to bottom
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSending(false);
    }
  };
  
  // Format message time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp instanceof Date ? timestamp : 
               (typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp));
    
    return format(date, 'h:mm a');
  };
  
  // Render a single message
  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === user?.uid;
    
    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessageContainer : styles.otherUserMessageContainer
      ]}>
        {!isCurrentUser && (
          <Image
            source={otherUser?.image ? { uri: otherUser.image } : defaultAvatar}
            style={styles.messageAvatar}
            defaultSource={defaultAvatar}
          />
        )}
        
        {isCurrentUser ? (
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            style={[
              styles.message,
              styles.currentUserMessage
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.message, styles.otherUserMessage]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
          </View>
        )}
      </View>
    );
  };
  
  // Go back
  const handleBack = () => {
    navigation.goBack();
  };
  
  if (loading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <LinearGradient
        colors={['#111827', '#1E293B']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <IconButton
          icon="arrow-left"
          color="#FFFFFF"
          size={24}
          onPress={handleBack}
          style={styles.backIcon}
        />
        
        <View style={styles.headerInfo}>
          <Image
            source={otherUser?.image ? { uri: otherUser.image } : defaultAvatar}
            style={styles.headerAvatar}
            defaultSource={defaultAvatar}
          />
          
          <Text style={styles.headerTitle} numberOfLines={1}>
            {otherUser?.name || 'Chat'}
          </Text>
        </View>
        
        <View style={{ width: 40 }} />
      </LinearGradient>
      
      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={['rgba(59, 130, 246, 0.1)', 'rgba(37, 99, 235, 0.05)']}
            style={styles.emptyIconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons name="message-text-outline" size={60} color="#3B82F6" />
          </LinearGradient>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          extraData={messages.length}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => {
            if (flatListRef.current && messages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }}
          onLayout={() => {
            if (flatListRef.current && messages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }}
        />
      )}
      
      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <LinearGradient
            colors={['#FF3B30', '#E11D48']}
            style={styles.errorGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.errorText}>{error}</Text>
          </LinearGradient>
        </View>
      )}
      
      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <LinearGradient
          colors={['#181818', '#121212']}
          style={styles.inputContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={styles.sendButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons
                name="send"
                size={20}
                color="#FFFFFF"
              />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: '#0A0A0A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 250,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backIcon: {
    marginRight: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 32,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  currentUserMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherUserMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  message: {
    padding: 14,
    borderRadius: 20,
    maxWidth: '100%',
  },
  currentUserMessage: {
    borderBottomRightRadius: 4,
  },
  otherUserMessage: {
    backgroundColor: '#222222',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    maxHeight: 120,
    minHeight: 46,
  },
  sendButton: {
    marginLeft: 12,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  sendButtonGradient: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  errorContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  errorGradient: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});