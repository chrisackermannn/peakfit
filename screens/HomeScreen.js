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
  FlatList
} from 'react-native';
import { Surface, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { collection, query, onSnapshot, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { format, addDays } from 'date-fns';
import * as FileSystem from 'expo-file-system';

const defaultAvatar = require('../assets/default-avatar.png');
const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dates = [-3, -2, -1, 0, 1, 2, 3].map(diff => addDays(new Date(), diff));
  const [profileImage, setProfileImage] = useState(user?.photoURL || null);
  const flatListRef = useRef(null);
  
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
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with Branding */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandName}>PeakFit</Text>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{user?.displayName || 'Fitness Pro'}</Text>
        </View>
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
    // DO NOT add overflow: hidden here
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
  
  // AI Chat Card
  aiChatCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    overflow: 'hidden', // Move overflow to inner container
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  aiChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  aiTitleArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiChatTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
    color: '#FFFFFF',
  },
  chatContainer: {
    // No overflow hidden here to allow for scrolling
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    backgroundColor: '#1A1A1A', // Added background color for visibility
  },
  input: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100, // Limit height for multiline input
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  
  // Steps tracker card
  stepsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    overflow: 'hidden', // Move overflow to inner container
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 16,
  },
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepsInfo: {
    flex: 1,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepsSubtitle: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  stepsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepsMetric: {
    alignItems: 'center',
    width: '30%',
  },
  stepsCount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stepsLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  stepsProgress: {
    flex: 1,
    marginLeft: 16,
  },
  stepsProgressBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  stepsProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  stepsGoal: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  
  // Message bubbles
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
});