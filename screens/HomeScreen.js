// screens/HomeScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
  ActivityIndicator,
  Animated,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  FlatList,
  Modal
} from 'react-native';
import { Surface, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { collection, query, onSnapshot, addDoc, serverTimestamp, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { format, addDays } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import { searchUsers } from '../data/firebaseHelpers';

const defaultAvatar = require('../assets/default-avatar.png');
const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dates = [-3, -2, -1, 0, 1, 2, 3].map(diff => addDays(new Date(), diff));
  const [profileImage, setProfileImage] = useState(user?.photoURL || null);
  const flatListRef = useRef(null);

  // Search state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Handle profile image safely on iOS
  useEffect(() => {
    if (user?.photoURL) {
      if (Platform.OS === 'ios' && user.photoURL.startsWith('blob:')) {
        // For iOS, if we encounter a blob URL, use default image instead
        setProfileImage(null);
      } else {
        setProfileImage(user.photoURL);
      }
    }
  }, [user?.photoURL]);

  // AI Chat state
  const [chatExpanded, setChatExpanded] = useState(false);
  const [messages, setMessages] = useState([{
    id: 'welcome',
    role: 'assistant',
    content: "Hey there! I'm your fitness assistant. Ask me anything about workouts, nutrition, or exercise techniques.",
    created_at: new Date()
  }]);
  const [input, setInput] = useState('');
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  // Animation values for collapsible chat
  const chatHeight = useRef(new Animated.Value(0)).current;

  // Unread messages state
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Listen for AI responses from Firestore
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, 'generate'), limit(50));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      querySnapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();

          // Only process responses for the current user
          if (data.userId === user.uid && data.response && data.status?.state === "COMPLETED") {
            // Update messages state to include the AI response
            setMessages(prev => {
              // Check if we already have this response
              const isDuplicate = prev.some(
                msg => msg.role === 'assistant' && msg.content === data.response
              );

              if (!isDuplicate) {
                setWaitingForResponse(false);

                return [
                  ...prev.filter(msg => !msg.isLoading), // Remove loading indicators
                  {
                    id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    role: 'assistant',
                    content: data.response,
                    created_at: new Date()
                  }
                ];
              }

              return prev;
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Check for unread messages
  useEffect(() => {
    if (!user?.uid) return;

    // Function to check for unread messages
    const checkUnreadMessages = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'chats'),
          where('unreadCount', '>', 0)
        );

        const snapshot = await getDocs(q);

        // Calculate total unread messages across all conversations
        let totalUnread = 0;
        snapshot.forEach(doc => {
          totalUnread += doc.data().unreadCount || 0;
        });

        setUnreadMessages(totalUnread);
      } catch (error) {
        console.error("Error checking unread messages:", error);
      }
    };

    // Initial check
    checkUnreadMessages();

    // Set up listener for real-time updates
    const chatsRef = collection(db, 'users', user.uid, 'chats');
    const unsubscribe = onSnapshot(chatsRef, (snapshot) => {
      let total = 0;
      snapshot.forEach(doc => {
        total += doc.data().unreadCount || 0;
      });
      setUnreadMessages(total);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Scroll to bottom when messages change or chat expands
  useEffect(() => {
    if (flatListRef.current && chatExpanded) {
      // Wait briefly for layout before scrolling
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages, chatExpanded]);

  // Send message to AI
  const sendMessage = async () => {
    if (!input.trim() || !user?.uid || waitingForResponse) return;

    const userMessage = input.trim();
    setInput('');
    setWaitingForResponse(true);

    // Add user message to chat
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: userMessage,
      created_at: new Date()
    }]);

    // Add loading message
    setMessages(prev => [...prev, {
      id: `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: '',
      created_at: new Date(),
      isLoading: true
    }]);

    try {
      // Send to Firestore for processing
      await addDoc(collection(db, 'generate'), {
        userId: user.uid,
        prompt: userMessage,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error sending message:", e);
      // Show error message
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.isLoading);
        filtered.push({
          id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: "Sorry, I couldn't process your request. Please try again.",
          created_at: new Date()
        });
        return filtered;
      });

      setWaitingForResponse(false);
    }
  };

  // Toggle chat expansion
  const toggleChat = () => {
    if (chatExpanded) {
      // Collapse chat
      Animated.timing(chatHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false
      }).start();
    } else {
      // Expand chat
      Animated.timing(chatHeight, {
        toValue: 340,
        duration: 300,
        useNativeDriver: false
      }).start(() => {
        // Scroll to bottom once expanded
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      });
    }
    setChatExpanded(!chatExpanded);
  };

  // Search function
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const results = await searchUsers(searchQuery.trim());
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  // Message bubble component
  const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';

    if (message.isLoading) {
      return (
        <View style={[styles.messageBubble, styles.assistantBubble]}>
          <ActivityIndicator size="small" color="#FF3B30" />
        </View>
      );
    }

    return (
      <View style={[
        styles.messageBubble,
        isUser ? styles.userBubble : styles.assistantBubble
      ]}>
        {!isUser && (
          <View style={styles.assistantHeader}>
            <MaterialCommunityIcons name="robot" size={16} color="#FF3B30" />
            <Text style={styles.assistantName}>Fitness AI</Text>
          </View>
        )}
        <Text style={isUser ? styles.userText : styles.assistantText}>
          {message.content}
        </Text>
      </View>
    );
  };

  const insets = useSafeAreaInsets();

  const navigateToMessages = () => {
    navigation.navigate('Messages');
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" />

      {/* Header with Branding and Search Button */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandName}>PeakFit</Text>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{user?.displayName || 'Fitness Pro'}</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Messages Icon */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={navigateToMessages}
          >
            <MaterialCommunityIcons name="chat" size={24} color="#3B82F6" />
            {unreadMessages > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Search Icon */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowSearchModal(true)}
          >
            <MaterialCommunityIcons name="account-search" size={24} color="#3B82F6" />
          </TouchableOpacity>
          
          {/* Profile Icon */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Image
              source={profileImage ? { uri: profileImage } : defaultAvatar}
              style={styles.profileImage}
              defaultSource={defaultAvatar}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Workout')}
          >
            <View style={[styles.actionBackground, styles.workoutActionBg]}>
              <MaterialCommunityIcons name="dumbbell" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Start Workout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ChatAI')}
          >
            <View style={[styles.actionBackground, styles.aiActionBg]}>
              <MaterialCommunityIcons name="robot" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>AI Coach</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Community')}
          >
            <View style={[styles.actionBackground, styles.communityActionBg]}>
              <MaterialCommunityIcons name="account-group" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Community</Text>
          </TouchableOpacity>
        </View>

        {/* AI Chat Card - Collapsible */}
        <Surface style={styles.cardShadow}>
          <View style={styles.aiChatCard}>
            <TouchableOpacity onPress={toggleChat} style={styles.aiChatHeader}>
              <View style={styles.aiTitleArea}>
                <MaterialCommunityIcons name="robot" size={24} color="#3B82F6" />
                <Text style={styles.aiChatTitle}>AI Fitness Coach</Text>
              </View>
              <MaterialCommunityIcons
                name={chatExpanded ? "chevron-up" : "chevron-down"}
                size={24}
                color="#666"
              />
            </TouchableOpacity>

            <Animated.View style={[styles.chatContainer, { height: chatHeight }]}>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={({ item }) => <MessageBubble message={item} />}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.messagesContainer}
                showsVerticalScrollIndicator={true}
                initialNumToRender={10}
                onLayout={() => {
                  if (flatListRef.current) {
                    flatListRef.current.scrollToEnd({ animated: false });
                  }
                }}
              />

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask about workouts, nutrition..."
                    placeholderTextColor="#666666"
                    multiline
                    maxLength={500}
                    editable={!waitingForResponse}
                  />

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!input.trim() || waitingForResponse) && styles.sendButtonDisabled
                    ]}
                    onPress={sendMessage}
                    disabled={!input.trim() || waitingForResponse}
                  >
                    <MaterialCommunityIcons
                      name="send"
                      size={20}
                      color={input.trim() && !waitingForResponse ? "#FFFFFF" : "#666666"}
                    />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Animated.View>
          </View>
        </Surface>

        {/* Steps API Coming Soon */}
        <Surface style={styles.cardShadow}>
          <View style={styles.stepsCard}>
            <View style={styles.stepsHeader}>
              <View style={styles.stepsIconContainer}>
                <MaterialCommunityIcons name="shoe-print" size={24} color="#3B82F6" />
              </View>
              <View style={styles.stepsInfo}>
                <Text style={styles.stepsTitle}>Steps Tracker</Text>
                <Text style={styles.stepsSubtitle}>Coming Soon</Text>
              </View>
            </View>

            <View style={styles.stepsContent}>
              <View style={styles.stepsMetric}>
                <Text style={styles.stepsCount}>0</Text>
                <Text style={styles.stepsLabel}>Steps Today</Text>
              </View>

              <View style={styles.stepsProgress}>
                <View style={styles.stepsProgressBar}>
                  <View style={[styles.stepsProgressFill, { width: '0%' }]} />
                </View>
                <Text style={styles.stepsGoal}>Goal: 10,000 steps</Text>
              </View>
            </View>
          </View>
        </Surface>

        {/* Add some padding at the bottom */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Search User Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Find Users</Text>
              <IconButton
                icon="close"
                size={24}
                color="#FFFFFF"
                onPress={() => {
                  setShowSearchModal(false);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
              />
            </View>
            <View style={styles.searchInputContainer}>
              <MaterialCommunityIcons name="magnify" size={24} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by username..."
                placeholderTextColor="#999"
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
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
              <Text style={styles.searchButtonText}>
                {searching ? 'Searching...' : 'Search'}
              </Text>
            </TouchableOpacity>
            {/* Search Results */}
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                style={styles.searchResultsList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userResultItem}
                    onPress={() => {
                      navigation.navigate('UserProfile', { userId: item.id });
                      setShowSearchModal(false);
                    }}
                  >
                    <Image
                      source={item.photoURL ? { uri: item.photoURL } : defaultAvatar}
                      style={styles.userResultAvatar}
                    />
                    <View style={styles.userResultInfo}>
                      <Text style={styles.userResultName}>{item.displayName || item.username}</Text>
                      <Text style={styles.userResultUsername}>@{item.username}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.noResultsText}>No users found</Text>
                }
              />
            ) : searching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Define styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1A1A1A',
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#3B82F6',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A2A2A',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
    marginLeft: 10,
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchButtonDisabled: {
    backgroundColor: '#666666',
  },
  searchResultsList: {
    marginTop: 16,
    maxHeight: 300,
  },
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  userResultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userResultUsername: {
    fontSize: 14,
    color: '#999',
  },
  noResultsText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },

  // Keep your existing styles below
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  actionButton: {
    alignItems: 'center',
    width: '30%',
  },
  actionBackground: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    })
  },
  workoutActionBg: {
    backgroundColor: '#3B82F6',
  },
  aiActionBg: {
    backgroundColor: '#FF3B30',
  },
  communityActionBg: {
    backgroundColor: '#10B981',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Card shadow styles for iOS compatibility
  cardShadow: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      }
    }),
  },

  // Add all your other existing styles here...
  messageBubble: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A2A2A',
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  assistantName: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  assistantText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#121212',
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});