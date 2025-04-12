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
  Modal,
  Alert,
  Pressable,
} from 'react-native';
import { Surface, IconButton, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { collection, query, onSnapshot, addDoc, serverTimestamp, limit, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { format, addDays, isToday, isSameDay } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import { searchUsers } from '../data/firebaseHelpers';
import HealthStats from '../components/HealthStats';
import { triggerHaptic } from '../App';
import { LinearGradient } from 'expo-linear-gradient';

const defaultAvatar = require('../assets/default-avatar.png');
const { width, height } = Dimensions.get('window');

// Create an Animated FlatList component
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// Create a completely different version of BlurComponent that doesn't use BlurView at all
const SafeBlurComponent = ({ style, children }) => {
  return (
    <View style={[
      style, 
      { 
        backgroundColor: 'rgba(10, 10, 10, 0.85)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)'
      }
    ]}>
      {children}
    </View>
  );
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dates = [-3, -2, -1, 0, 1, 2, 3].map(diff => addDays(new Date(), diff));
  const [profileImage, setProfileImage] = useState(user?.photoURL || null);
  const flatListRef = useRef(null);
  const scrollViewRef = useRef(null);
  const insets = useSafeAreaInsets();
  
  // Search state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef(null); // Add debounce timeout ref
  
  // AI Chat state
  const [chatExpanded, setChatExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  
  // Define chatMaxHeight constant
  const chatMaxHeight = 350;
  
  // Animation values for collapsible chat
  const chatHeight = useRef(new Animated.Value(0)).current;
  
  // Unread messages state
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [scrollY] = useState(new Animated.Value(0));
  
  // Header animation based on scroll
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60, 90],
    outputRange: [0, 0.8, 1],
    extrapolate: 'clamp'
  });
  
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
  
  // Listen for AI responses and chat history
  useEffect(() => {
    if (!user?.uid) return;
    
    // Create a collection for this user's chat history
    const userChatRef = collection(db, 'userChats', user.uid, 'messages');
    
    // Query to get all messages ordered by timestamp
    const messagesQuery = query(userChatRef, orderBy('created_at', 'asc'));
    
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          created_at: data.created_at ? new Date(data.created_at.seconds * 1000) : new Date()
        };
      });
      
      setMessages(newMessages);
    });
    
    return () => unsubscribe();
  }, [user?.uid]);
  
  // Check for unread messages
  useEffect(() => {
    if (!user?.uid) return;
    
    const checkUnreadMessages = async () => {
      try {
        // Get all chats where the current user is a participant
        const chatsRef = collection(db, 'users', user.uid, 'chats');
        const chatsSnapshot = await getDocs(chatsRef);
        
        let totalUnread = 0;
        chatsSnapshot.forEach(doc => {
          const data = doc.data();
          // Sum up unread counts
          totalUnread += data.unreadCount || 0;
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
    if (scrollViewRef.current && chatExpanded) {
      // Wait briefly for layout before scrolling
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
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
    // Start height from its current position
    const initialValue = chatExpanded ? chatMaxHeight : 0;
    const finalValue = chatExpanded ? 0 : chatMaxHeight;
    
    // Set the current value immediately
    chatHeight.setValue(initialValue);
    
    // Toggle state before animation
    setChatExpanded(!chatExpanded);
    
    // Add haptic feedback
    if (Platform.OS === 'ios') {
      triggerHaptic('light');
    }
    
    // Run the animation
    Animated.spring(chatHeight, {
      toValue: finalValue,
      useNativeDriver: false, // Height changes can't use native driver
      friction: 8, // Higher friction = less oscillation
      tension: 40, // Lower tension = slower but smoother
      delay: 0,
    }).start();
    
    // Scroll to bottom after animation if expanding
    if (!chatExpanded && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 200);
    }
  };
  
  // Search function
  const handleSearchInputChange = (text) => {
    setSearchQuery(text);
    
    // Clear any previous debounce timeout
    if (searchDebounce.current) {
      clearTimeout(searchDebounce.current);
    }
    
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    
    // Set a short debounce to avoid too many requests while typing
    searchDebounce.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  };

  const performSearch = async (query) => {
    if (!query.trim() || query.trim().length < 2) return;
    
    try {
      setSearching(true);
      console.log("Searching for:", query.trim());
      
      const results = await searchUsers(query.trim());
      console.log("Search returned results:", results ? results.length : 0);
      
      const validResults = results.filter(user => 
        user && user.id && (user.username || user.displayName)
      );
      
      setSearchResults(validResults);
      console.log("Valid search results:", validResults.length);
    } catch (error) {
      console.error('Error searching users:', error);
      // Only show alert for user-initiated searches (not typing)
      if (query === searchQuery) {
        Alert.alert('Search Error', 'Unable to find users. Please try again.');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    performSearch(searchQuery);
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
  
  // Navigate to Messages screen
  const navigateToMessages = () => {
    navigation.navigate('Messages');
  };
  
  // Format date helper function
  const formatDateForDisplay = (date) => {
    if (isToday(date)) {
      return 'Today';
    }
    
    return format(date, 'EEE, MMM d');
  };
  
  // Render date item for calendar
  const renderDateItem = ({ item, index }) => {
    const isSelected = isSameDay(selectedDate, item);
    const isToday = isSameDay(new Date(), item);
    
    return (
      <TouchableOpacity
        style={[
          styles.dateItem,
          isSelected && styles.selectedDateItem,
        ]}
        onPress={() => {
          setSelectedDate(item);
          triggerHaptic('light');
        }}
      >
        <View style={[
          styles.dateItemInner,
          isSelected ? styles.selectedDateItemInner : (isToday ? styles.todayDateItemInner : null)
        ]}>
          <Text style={[
            styles.dateText,
            isSelected && styles.selectedDateText
          ]}>
            {format(item, 'd')}
          </Text>
          <Text style={[
            styles.dayText,
            isSelected && styles.selectedDayText
          ]}>
            {format(item, 'EEE')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderMainContent = () => {
    return (
      <View style={styles.mainContentContainer}>
        {/* Top Section with Profile & Date */}
        <View style={styles.topSection}>
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
          
          <View style={styles.welcomeSection}>
            <Text style={styles.greetingText}>Hello,</Text>
            <Text style={styles.nameText}>{user?.displayName || 'Fitness Pro'}</Text>
          </View>
          
          <View style={styles.iconButtonsRow}>
            <TouchableOpacity
              style={styles.iconButtonContainer}
              onPress={navigateToMessages}
            >
              <LinearGradient
                colors={['#2A2A2A', '#1A1A1A']}
                style={styles.iconButton}
              >
                <MaterialCommunityIcons name="chat-outline" size={20} color="#FFFFFF" />
                {unreadMessages > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.iconButtonContainer}
              onPress={() => setShowSearchModal(true)}
            >
              <LinearGradient
                colors={['#2A2A2A', '#1A1A1A']}
                style={styles.iconButton}
              >
                <MaterialCommunityIcons name="account-search-outline" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Date Selector */}
        <View style={styles.dateContainer}>
          <Text style={styles.dateTitle}>Select Date</Text>
          <FlatList
            ref={flatListRef}
            data={dates}
            renderItem={renderDateItem}
            keyExtractor={(item) => item.toISOString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateList}
            initialScrollIndex={3} // Start at today
            getItemLayout={(data, index) => ({
              length: 60,
              offset: 60 * index,
              index,
            })}
          />
        </View>
        
        {/* Quick Actions Card */}
        <View style={styles.actionsCard}>
          <LinearGradient
            colors={['#1A1A1A', '#121212']}
            style={styles.actionsCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={styles.actionsCardTitle}>Quick Actions</Text>
            
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  navigation.navigate('Workout');
                  if (Platform.OS === 'ios') {
                    triggerHaptic('medium');
                  }
                }}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.actionButtonGradient}
                >
                  <MaterialCommunityIcons name="dumbbell" size={24} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.actionText}>Workout</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  toggleChat();
                  if (Platform.OS === 'ios') {
                    triggerHaptic('light');
                  }
                }}
              >
                <LinearGradient
                  colors={['#FF3B30', '#E11D48']}
                  style={styles.actionButtonGradient}
                >
                  <MaterialCommunityIcons name="robot" size={24} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.actionText}>AI Coach</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  navigation.navigate('Community');
                  if (Platform.OS === 'ios') {
                    triggerHaptic('light');
                  }
                }}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.actionButtonGradient}
                >
                  <MaterialCommunityIcons name="account-group" size={24} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.actionText}>Community</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
        
        {/* AI Chat Card - Collapsible */}
        <View style={styles.chatCardContainer}>
          <LinearGradient
            colors={['#1A1A1A', '#121212']}
            style={styles.aiChatCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <TouchableOpacity 
              onPress={toggleChat} 
              style={styles.aiChatHeader}
              activeOpacity={0.8}
            >
              <View style={styles.aiTitleArea}>
                <LinearGradient
                  colors={['#FF3B30', '#E11D48']}
                  style={styles.aiIconBackground}
                >
                  <MaterialCommunityIcons name="robot" size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.aiChatTitle}>AI Fitness Coach</Text>
              </View>
              <MaterialCommunityIcons
                name={chatExpanded ? "chevron-up" : "chevron-down"}
                size={24}
                color="#999"
              />
            </TouchableOpacity>
            
            <Animated.View style={[styles.chatContainer, { height: chatHeight }]}>
              <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.messagesContainer}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                  if (scrollViewRef.current && chatExpanded) {
                    scrollViewRef.current.scrollToEnd({ animated: false });
                  }
                }}
              >
                {messages.map(item => (
                  <MessageBubble key={item.id} message={item} />
                ))}
              </ScrollView>
              
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask about fitness, nutrition..."
                    placeholderTextColor="#888"
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
                      size={18}
                      color={input.trim() && !waitingForResponse ? "#FFFFFF" : "#666"}
                    />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Animated.View>
          </LinearGradient>
        </View>
        
        {/* Health Stats Section */}
        <View style={styles.statsCardContainer}>
          <Text style={styles.sectionTitle}>Health Stats</Text>
          {Platform.OS === 'ios' ? (
            <HealthStats />
          ) : (
            <View style={styles.cardContainer}>
              <LinearGradient
                colors={['#1A1A1A', '#121212']}
                style={styles.statsCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <View style={styles.statsHeader}>
                  <View style={styles.statsIconContainer}>
                    <MaterialCommunityIcons name="shoe-print" size={22} color="#3B82F6" />
                  </View>
                  <View style={styles.statsInfo}>
                    <Text style={styles.statsTitle}>Steps Tracker</Text>
                    <Text style={styles.statsSubtitle}>iOS Only</Text>
                  </View>
                </View>
                <View style={styles.statsContent}>
                  <View style={styles.statsMetric}>
                    <Text style={styles.statsCount}>0</Text>
                    <Text style={styles.statsLabel}>Feature only available on iOS</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}
          
          {/* Add some padding at the bottom */}
          <View style={{ height: 40 }} />
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'left']}>
      <StatusBar style="light" />
      
      {/* Fixed Header with Backdrop Effect (without BlurView) */}
      <Animated.View 
        style={[
          styles.fixedHeader,
          { 
            opacity: headerOpacity,
            paddingTop: insets.top > 0 ? 0 : 8
          }
        ]}
      >
        <SafeBlurComponent style={styles.blurHeader}>
          <Text style={styles.headerTitle}>{formatDateForDisplay(selectedDate)}</Text>
        </SafeBlurComponent>
      </Animated.View>
      
      {/* Main Content - Using Animated FlatList to fix the native driver issue */}
      <AnimatedFlatList
        data={[1]} // Single item array
        keyExtractor={() => 'main-content'}
        renderItem={renderMainContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      />
      
      {/* Search User Modal */}
      <Modal
        visible={showSearchModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Find Users</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowSearchModal(false);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <MaterialCommunityIcons name="magnify" size={22} color="#888" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={handleSearchInputChange}
                    placeholder="Search by username..."
                    placeholderTextColor="#888"
                    autoCapitalize="none"
                    returnKeyType="search"
                    onSubmitEditing={handleSearch}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity 
                      onPress={() => setSearchQuery('')}
                      hitSlop={{top: 15, left: 15, bottom: 15, right: 15}}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color="#888" />
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
              </View>
              
              {/* Search Results */}
              {searching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                </View>
              ) : searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={item => item.id}
                  style={styles.searchResultsList}
                  contentContainerStyle={{ paddingBottom: 20 }}
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
                        defaultSource={defaultAvatar}
                      />
                      <View style={styles.userResultInfo}>
                        <Text style={styles.userResultName} numberOfLines={1}>
                          {item.displayName || item.username || 'User'}
                        </Text>
                        {item.username && (
                          <Text style={styles.userResultUsername} numberOfLines={1}>
                            @{item.username}
                          </Text>
                        )}
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.resultDivider} />}
                  ListEmptyComponent={
                    <Text style={styles.noResultsText}>No users found</Text>
                  }
                />
              ) : searchQuery.trim().length > 0 ? (
                <Text style={styles.noResultsText}>No users found</Text>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  mainContentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Fixed Header with Blur
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 100,
  },
  blurHeader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Top Section with Profile & Icons
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  welcomeSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  greetingText: {
    fontSize: 14,
    color: '#999',
  },
  nameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iconButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  iconButtonContainer: {
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0A0A0A',
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Date Selector
  dateContainer: {
    marginBottom: 24,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  dateList: {
    paddingVertical: 8,
  },
  dateItem: {
    width: 60,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginRight: 12,
  },
  dateItemInner: {
    width: 44,
    height: 60,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  selectedDateItemInner: {
    backgroundColor: '#3B82F6',
  },
  todayDateItemInner: {
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  selectedDayText: {
    color: '#FFFFFF',
  },
  
  // Quick Actions Card
  actionsCard: {
    marginBottom: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  actionsCardGradient: {
    borderRadius: 24,
    padding: 24,
  },
  actionsCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    width: '30%',
  },
  actionButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  
  // Chat Card
  chatCardContainer: {
    marginBottom: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  aiChatCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  aiChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  aiTitleArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  aiChatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatContainer: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  
  // Message Bubbles
  messageBubble: {
    padding: 14,
    borderRadius: 18,
    maxWidth: '80%',
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  userText: {
    color: 'white',
    fontSize: 16,
  },
  assistantText: {
    color: 'white',
    fontSize: 16,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  assistantName: {
    color: '#FF3B30',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  
  // Stats Card
  statsCardContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  cardContainer: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  statsCard: {
    borderRadius: 24,
    padding: 20,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statsInfo: {
    flex: 1,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsMetric: {
    flex: 1,
  },
  statsCount: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 14,
    color: '#888',
  },
  
  // Search Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#121212',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: height * 0.8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  searchButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultsList: {
    flex: 1,
    marginTop: 10,
  },
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  userResultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2A2A2A',
  },
  userResultInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  userResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userResultUsername: {
    fontSize: 14,
    color: '#888',
  },
  resultDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
  noResultsText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
});