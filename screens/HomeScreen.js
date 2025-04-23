import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Animated,
  ScrollView,
  Dimensions,
  FlatList,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  RefreshControl // Add this import
} from 'react-native';
import { Surface, IconButton, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { collection, query, onSnapshot, limit, orderBy, doc, getDoc, addDoc, getDocs, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { format, addDays, isToday, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { searchUsers, getUserWorkouts } from '../data/firebaseHelpers';
import HealthStats from '../components/HealthStats';
import { triggerHaptic } from '../App';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, getCurrentChallenge } from '../components/Badge';
import { 
  getUserChallengeProgress, 
  countUserLegExercises, 
  getUserBadges,
  ensureUserHasFounderBadge 
} from '../services/BadgeTracker';

const defaultAvatar = require('../assets/default-avatar.png');
const { width, height } = Dimensions.get('window');

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

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

// Web-friendly touchable component
const WebTouchable = ({ onPress, style, children, testID }) => {
  if (Platform.OS === 'web') {
    return (
      <div 
        onClick={onPress} 
        style={{ cursor: 'pointer' }}
        data-testid={testID}
      >
        <View style={style}>
          {children}
        </View>
      </div>
    );
  } else {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        style={style}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dates, setDates] = useState([]);
  const [profileImage, setProfileImage] = useState(null);
  const [scrollY, setScrollY] = useState(new Animated.Value(0));
  
  // Challenge tracking
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [challengeTarget, setChallengeTarget] = useState(32); // Default for April challenge
  const [userBadges, setUserBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userWorkouts, setUserWorkouts] = useState([]);
  
  // References for date list
  const dateListRef = useRef();
  
  // Header opacity interpolation
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  // Search user state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef(null);

  // Unread messages state
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Refreshing state
  const [refreshing, setRefreshing] = useState(false);

  // Load user data and challenge progress
  useEffect(() => {
    if (!user?.uid) return;
    
    setLoading(true);
    
    // Generate dates for the calendar
    const today = new Date();
    const dateArray = [];
    for (let i = -15; i <= 15; i++) {
      dateArray.push(addDays(today, i));
    }
    setDates(dateArray);
    
    // Load profile image
    if (user.photoURL) {
      setProfileImage({ uri: user.photoURL });
    }
    
    // Load workouts and challenge progress
    const loadUserData = async () => {
      try {
        // Get user's workouts
        const workouts = await getUserWorkouts(user.uid);
        setUserWorkouts(workouts);
        
        // Ensure user has founder badge (automatically adds it if not present)
        await ensureUserHasFounderBadge(user.uid);
        
        // Count current leg exercises
        const legCount = await countUserLegExercises(user.uid);
        setChallengeProgress(legCount);
        
        // Get challenge details
        const challenge = getCurrentChallenge();
        setChallengeTarget(challenge.target);
        
        // Check if user earned a badge and save to Firebase if they did
        if (legCount >= challenge.target) {
          const badgeAwarded = await checkAndAwardBadge(user.uid, legCount, challenge.target);
          
          // If badge was just awarded (not previously earned), show a notification or animation
          if (badgeAwarded) {
            // You could trigger some UI animation or notification here
            console.log("New badge earned!");
          }
        }
        
        // Get user badges
        const badges = await getUserBadges(user.uid);
        setUserBadges(badges);
      } catch (error) {
        console.error("Error loading user data:", error);
        Alert.alert(
          "Data Loading Error",
          "Could not load workout data. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
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

  // Center the date selector on today's date
  useEffect(() => {
    if (dates.length > 0 && dateListRef.current) {
      // Find the index of today
      const todayIndex = dates.findIndex(date => isToday(date));
      if (todayIndex !== -1) {
        // Center today's date
        setTimeout(() => {
          try {
            dateListRef.current?.scrollToIndex({
              index: todayIndex,
              animated: false,
              viewPosition: 0.5 // Center the item
            });
          } catch (error) {
            console.log("Error scrolling to today:", error);
            // Fallback for scroll issues
            dateListRef.current?.scrollToOffset({
              offset: todayIndex * 60, // Approximate item width
              animated: false
            });
          }
        }, 150); // Give more time for the list to initialize
      }
    }
  }, [dates]);
  
  // Navigation handlers
  const navigateToMessages = () => {
    navigation.navigate('Messages');
  };
  
  const navigateToProfile = () => {
    navigation.navigate('Profile');
  };
  
  const navigateToSearchUsers = () => {
    setShowSearchModal(true);
    // Reset search state when opening modal
    setSearchQuery('');
    setSearchResults([]);
  };
  
  const navigateToWorkout = () => {
    navigation.navigate('Workout');
  };
  
  const navigateToCommunity = () => {
    navigation.navigate('Community');
  };
  
  // Search user functions - fixed to properly search
  const handleSearchInputChange = (text) => {
    setSearchQuery(text);
    
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    
    // Set a short debounce to avoid too many requests while typing
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  };

  const performSearch = async (query) => {
    if (!query.trim() || query.trim().length < 2) return;
    
    try {
      setSearching(true);
      console.log("Searching for users with query:", query);
      
      const results = await searchUsers(query.trim());
      console.log(`Found ${results.length} results for "${query}"`);
      
      setSearchResults(results.filter(user => 
        user && user.id && (user.username || user.displayName)
      ));
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert("Search Error", "Failed to search for users. Please try again.");
    } finally {
      setSearching(false);
    }
  };
  
  // Select a date
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    triggerHaptic('light');
  };
  
  // Render date item
  const renderDateItem = ({ item }) => {
    const isSelected = isSameDay(item, selectedDate);
    const isToday_ = isToday(item);
    
    return (
      <TouchableOpacity
        style={[
          styles.dateItem,
          isSelected && styles.selectedDateItem
        ]}
        onPress={() => handleDateSelect(item)}
      >
        <Text style={[
          styles.dayName,
          isSelected && styles.selectedDayName
        ]}>
          {format(item, 'EEE')}
        </Text>
        <View style={[
          styles.dateCircle,
          isSelected && styles.selectedDateCircle,
          isToday_ && styles.todayCircle,
          isSelected && isToday_ && styles.selectedTodayCircle
        ]}>
          <Text style={[
            styles.dateText,
            isSelected && styles.selectedDateText
          ]}>
            {format(item, 'd')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Fixed notification badge style to ensure it's not cut off
  const notificationBadgeStyle = {
    position: 'absolute',
    top: -6, // Move up further to ensure it's not cut off
    right: -6, // Move right further to ensure it's not cut off
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 10, // Increased for better appearance
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 4, // More horizontal padding
    zIndex: 10, // Ensure it's on top
  };

  // Render top section with profile and action buttons
  const renderTopSection = () => (
    <View style={[styles.topSection, { marginTop: insets.top + 10 }]}>
      <View style={styles.welcomeSection}>
        <Text style={styles.greetingText}>Hello,</Text>
        <Text style={styles.nameText}>{user?.displayName || 'Fitness Pro'}</Text>
      </View>
      
      <View style={styles.topRightButtons}>
        {/* Messages button with fixed notification badge */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={navigateToMessages}
          testID="messages-button"
          accessible={true}
          accessibilityLabel="Messages"
          accessibilityRole="button"
        >
          <View style={styles.iconButtonWrapper}>
            <LinearGradient
              colors={['#2A2A2A', '#1A1A1A']}
              style={styles.iconButtonGradient}
            >
              <MaterialCommunityIcons name="chat-outline" size={22} color="#FFFFFF" />
            </LinearGradient>
            {unreadMessages > 0 && (
              <View style={notificationBadgeStyle}>
                <Text style={styles.notificationText}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        {/* Search users button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={navigateToSearchUsers}
          testID="search-users-button"
          accessible={true}
          accessibilityLabel="Find users"
          accessibilityRole="button"
        >
          <LinearGradient
            colors={['#2A2A2A', '#1A1A1A']}
            style={styles.iconButtonGradient}
          >
            <MaterialCommunityIcons name="account-search-outline" size={22} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Profile button */}
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={navigateToProfile}
          testID="profile-button"
          accessible={true}
          accessibilityLabel="Your profile"
          accessibilityRole="button"
        >
          <Image 
            source={profileImage || defaultAvatar} 
            style={styles.profileImage}
            defaultSource={defaultAvatar}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Render top navigation buttons
  const renderTopNavButtons = () => (
    <View style={styles.navButtonsContainer}>
      <TouchableOpacity 
        style={styles.navButton}
        onPress={navigateToWorkout}
        testID="workout-nav-button"
      >
        <LinearGradient
          colors={['#3B82F6', '#2563EB']}
          style={styles.navButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="dumbbell" size={22} color="#FFFFFF" />
          <Text style={styles.navButtonText}>Start Workout</Text>
        </LinearGradient>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navButton}
        onPress={navigateToCommunity}
        testID="community-nav-button"
      >
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.navButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="account-group" size={22} color="#FFFFFF" />
          <Text style={styles.navButtonText}>Community</Text>
        </LinearGradient>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navButton}
        onPress={navigateToProfile}
        testID="profile-nav-button"
      >
        <LinearGradient
          colors={['#EC4899', '#BE185D']}
          style={styles.navButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="account" size={22} color="#FFFFFF" />
          <Text style={styles.navButtonText}>Profile</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
  
  // Improved Monthly Challenge component
  const renderMonthlyChallenge = () => {
    const milestones = [
      { threshold: 8, label: '8' },
      { threshold: 16, label: '16' },
      { threshold: 24, label: '24' },
      { threshold: 32, label: '32' }
    ];
    
    const currentChallenge = getCurrentChallenge();
    const earnedBadge = userBadges.find(badge => badge.id === currentChallenge.id);
    const month = format(new Date(), 'MMMM');
    const progress = Math.min(challengeProgress, challengeTarget);
    const progressPercentage = (progress / challengeTarget) * 100;
    
    return (
      <View style={styles.challengeCard}>
        <LinearGradient
          colors={['#1A1A1A', '#121212']}
          style={styles.challengeGradient}
        >
          {/* Challenge Header */}
          <View style={styles.challengeHeader}>
            <View style={styles.challengeBadgeContainer}>
              {currentChallenge.image && (
                <Image 
                  source={currentChallenge.image}
                  style={styles.challengeBadgeImage}
                  resizeMode="contain"
                />
              )}
            </View>
            <View style={styles.challengeInfo}>
              <Text style={styles.challengeMonthly}>{month}'s Monthly Challenge</Text>
              <Text style={styles.challengeTitle}>{currentChallenge.name}</Text>
              <Text style={styles.challengeSubtitle}>{currentChallenge.description}</Text>
            </View>
          </View>
          
          {/* Progress Display */}
          <View style={styles.progressSection}>
            <View style={styles.progressStatsRow}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{progress}</Text>
                <Text style={styles.progressStatLabel}>Completed</Text>
              </View>
              <View style={styles.progressDivider} />
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{challengeTarget}</Text>
                <Text style={styles.progressStatLabel}>Target</Text>
              </View>
            </View>
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${progressPercentage}%` }
                ]}
              />
            </View>
            
            {/* Milestone Markers */}
            {milestones.map((milestone, index) => {
              const position = (milestone.threshold / challengeTarget) * 100;
              const isCompleted = progress >= milestone.threshold;
              
              return (
                <View 
                  key={index} 
                  style={[
                    styles.milestoneMarker,
                    { left: `${position}%` }
                  ]}
                >
                  <View 
                    style={[
                      styles.milestoneCircle,
                      isCompleted && styles.completedMilestoneCircle
                    ]}
                  >
                    {isCompleted ? (
                      <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text style={styles.milestoneLabel}>
                    {milestone.threshold}
                  </Text>
                </View>
              );
            })}
          </View>
          
          {/* Completion Badge Display */}
          {earnedBadge && (
            <View style={styles.badgeEarnedContainer}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.1)']} 
                style={styles.badgeEarnedGradient}
              >
                <MaterialCommunityIcons name="trophy" size={20} color="#10B981" />
                <Text style={styles.badgeEarnedText}>Challenge Completed!</Text>
              </LinearGradient>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  // Search modal component - formatted exactly like the provided code
  const renderUserSearchModal = () => {
    // Define handleSearch function locally in this component
    const handleSearch = () => {
      if (!searchQuery.trim()) return;
      performSearch(searchQuery);
    };

    return (
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
    );
  };

  // Refresh handler
  const onRefresh = useCallback(async () => {
    if (!user?.uid) return;
    
    setRefreshing(true);
    console.log("Refreshing home data...");
    
    try {
      // Get user's workouts
      const workouts = await getUserWorkouts(user.uid);
      setUserWorkouts(workouts);
      
      // Ensure user has founder badge
      await ensureUserHasFounderBadge(user.uid);
      
      // Count current leg exercises
      const legCount = await countUserLegExercises(user.uid);
      setChallengeProgress(legCount);
      
      // Get challenge details
      const challenge = getCurrentChallenge();
      setChallengeTarget(challenge.target);
      
      // Check for badge earning
      if (legCount >= challenge.target) {
        await checkAndAwardBadge(user.uid, legCount, challenge.target);
      }
      
      // Get user badges
      const badges = await getUserBadges(user.uid);
      setUserBadges(badges);
      
      // Check if user profile photo has changed by fetching latest user data
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Only update profile image if it's different from current one
        const currentPhotoURL = profileImage?.uri;
        const newPhotoURL = userData.photoURL;
        
        if (newPhotoURL && newPhotoURL !== currentPhotoURL) {
          console.log("Profile picture updated");
          setProfileImage({ uri: newPhotoURL });
        }
      }
      
      console.log("Home data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid, profileImage?.uri]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Floating header */}
      <Animated.View 
        style={[
          styles.floatingHeader, 
          { 
            opacity: headerOpacity,
            paddingTop: insets.top
          }
        ]}
      >
        <SafeBlurComponent style={{ width: '100%', height: '100%' }}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Home</Text>
          </View>
        </SafeBlurComponent>
      </Animated.View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={["#3B82F6"]}
            progressBackgroundColor="#1A1A1A"
          />
        }
      >
        {/* Top section */}
        {renderTopSection()}
        
        {/* Date Selector */}
        <View style={styles.dateSelector}>
          <FlatList
            ref={dateListRef}
            data={dates}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderDateItem}
            keyExtractor={(item) => item.toISOString()}
            contentContainerStyle={styles.dateList}
            initialNumToRender={10}
            maxToRenderPerBatch={15}
            windowSize={5}
            getItemLayout={(data, index) => ({
              length: 60, // Approximate width of each date item
              offset: 60 * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              console.log('Failed to scroll to index:', info);
              // Fallback to offset-based scrolling
              setTimeout(() => {
                if (dateListRef.current) {
                  dateListRef.current.scrollToOffset({
                    offset: info.averageItemLength * info.index,
                    animated: false
                  });
                }
              }, 100);
            }}
          />
        </View>
        
        {/* Top Navigation Buttons */}
        {renderTopNavButtons()}
        
        {/* Monthly Challenge */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          renderMonthlyChallenge()
        )}
        
        {/* Health stats */}
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
              </LinearGradient>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* User search modal */}
      {renderUserSearchModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  
  // Top section with welcome, profile and action icons
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  welcomeSection: {
    flex: 1,
  },
  greetingText: {
    fontSize: 16,
    color: '#A0AEC0',
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  topRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: 12,
  },
  // New wrapper for icon button - to handle notification badge properly
  iconButtonWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  iconButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    // Using inline style notificationBadgeStyle instead
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  profileButton: {
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        cursor: 'pointer',
      }
    }),
  },
  profileImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  
  // Date selector styles
  dateSelector: {
    marginBottom: 16,
  },
  dateList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dateItem: {
    alignItems: 'center',
    width: 60, // Fixed width for proper centering
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  selectedDateItem: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  dayName: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
  },
  selectedDayName: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    position: 'relative',
  },
  selectedDateCircle: {
    backgroundColor: '#3B82F6',
  },
  todayCircle: {
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  selectedTodayCircle: {
    borderColor: 'transparent',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  
  // Top navigation buttons
  navButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  navButton: {
    flex: 1,
    borderRadius: 12,
    marginHorizontal: 4,
    overflow: 'hidden',
    height: 44,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        cursor: 'pointer',
      }
    }),
  },
  navButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingHorizontal: 8,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  
  // Challenge card styles
  challengeCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  challengeGradient: {
    padding: 20,
    borderRadius: 20,
  },
  challengeHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  challengeBadgeContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  challengeBadgeImage: {
    width: 40,
    height: 40,
  },
  challengeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  challengeMonthly: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10B981',
    marginBottom: 4,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  challengeSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  progressStat: {
    flex: 1,
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressStatLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  progressDivider: {
    height: 24,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  progressBarContainer: {
    marginBottom: 8,
    height: 40,
    position: 'relative',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  milestoneMarker: {
    position: 'absolute',
    top: 12,
    alignItems: 'center',
    transform: [{ translateX: -8 }],
  },
  milestoneCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedMilestoneCircle: {
    backgroundColor: '#10B981',
  },
  milestoneLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  badgeEarnedContainer: {
    marginTop: 16,
  },
  badgeEarnedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  badgeEarnedText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  
  // Section titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  
  // Stats section
  statsCardContainer: {
    marginBottom: 20,
  },
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }
    }),
  },
  statsCard: {
    borderRadius: 16,
    padding: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statsSubtitle: {
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 4,
  },
  
  // Loading state
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  
  // User search modal
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
});