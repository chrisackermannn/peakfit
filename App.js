import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, LogBox, UIManager, Animated, InteractionManager } from 'react-native';
import { AuthProvider } from './context/AuthContext';
import { MessageNotificationsProvider } from './context/MessageNotificationsContext';
import LoginScreen from './screens/Auth/LoginScreen';
import Tabs from './navigation/Tabs';
import EditProfileScreen from './screens/Profile/EditProfileScreen';
import Welcome from './screens/Welcome';
import { PaperProvider } from 'react-native-paper';
import FlashMessage from "react-native-flash-message";
import AdminScreen from './screens/AdminScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import MessagesScreen from './screens/MessagesScreen';
import ChatConversationScreen from './screens/ChatConversationScreen';
import HealthKitService from './services/HealthKitService';
import * as Haptics from 'expo-haptics';

// Enable layout animations for smoother transitions on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Improve performance by tweaking JS thread timings
InteractionManager.setDeadline(1000);

// Create haptic feedback utility
export const triggerHaptic = (type = 'light') => {
  if (Platform.OS === 'ios') {
    switch (type) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      default:
        Haptics.selectionAsync();
    }
  }
};

// Ignore non-critical warnings to improve dev performance
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Sending `onAnimatedValueUpdate` with no listeners registered',
  'When setting overflow to hidden on Surface',
  'HealthKit not available - using demo data',
  'Admin status:',
  'Property \'Surface\' doesn\'t exist',
  'ReferenceError:',
  'Animated: `useNativeDriver`',
  'shadow* style props are deprecated',
  'props.pointerEvents is deprecated',
  'Property \'chatMaxHeight\' doesn\'t exist',
  'Unbalanced calls start/end for tag',
  'nw_connection_copy_connected_',
  'Running "main" with',
  'Client called nw_connection',
  '🟢 Creating JS object'
]);

// Configure Animated API to use native driver by default
if (Platform.OS === 'ios') {
  Animated.timing = (function(originalTiming) {
    return function(value, config) {
      const updatedConfig = {
        ...config,
        useNativeDriver: config.useNativeDriver !== false
      };
      return originalTiming(value, updatedConfig);
    };
  })(Animated.timing);
}

const Stack = createNativeStackNavigator();

// Create a separate component for the navigation structure
function AppNavigator() {
    const [isFirstLaunch, setIsFirstLaunch] = useState(null);

    useEffect(() => {
      const checkFirstLaunch = async () => {
        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        if (hasLaunched === null) {
          await AsyncStorage.setItem('hasLaunched', 'true');
          setIsFirstLaunch(true);
        } else {
          setIsFirstLaunch(false);
        }
      };
      checkFirstLaunch();
    }, []);

    useEffect(() => {
      async function initHealthKit() {
        if (HealthKitService.isAvailable) {
          try {
            await HealthKitService.initialize();
            console.log('HealthKit initialized successfully');
          } catch (error) {
            console.error('Failed to initialize HealthKit', error);
          }
        }
      }
      initHealthKit();
    }, []);

    if (isFirstLaunch === null) {
      return null;
    }

  return (
    <Stack.Navigator 
      initialRouteName={isFirstLaunch ? "Welcome" : "Login"}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#007AFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen 
        name="Welcome" 
        component={Welcome} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Tabs" 
        component={Tabs} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ title: 'Edit Profile' }} 
      />
      <Stack.Screen 
        name="AdminDashboard" 
        component={AdminScreen} 
        options={{ 
          title: 'Admin Dashboard',
          headerStyle: {
            backgroundColor: '#3B82F6',
          },
          headerTintColor: '#fff',
        }} 
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Friends" 
        component={FriendsScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Messages" 
        component={MessagesScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="ChatConversation" 
        component={ChatConversationScreen} 
        options={{ headerShown: false }} 
      />
    </Stack.Navigator>
  );
}

// Main App component
export default function App() {
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const initHealthKit = async () => {
        try {
          await HealthKitService.initialize();
          console.log('HealthKit initialized from App.js');
        } catch (error) {
          console.error('Failed to initialize HealthKit from App.js:', error);
        }
      };
      
      initHealthKit();
    }
  }, []);

  return (
    <AuthProvider>
      <MessageNotificationsProvider>
        <PaperProvider>
          <>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
            <FlashMessage position="top" />
          </>
        </PaperProvider>
      </MessageNotificationsProvider>
    </AuthProvider>
  );
}