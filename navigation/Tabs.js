import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import CommunityScreen from '../screens/Community';
import MessagesScreen from '../screens/MessagesScreen';
import { triggerHaptic } from '../App';

const Tab = createBottomTabNavigator();

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#121212',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 90 : 60,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        headerShown: false,
        // Keep all screens mounted and running in the background
        lazy: false,
        // Don't detach screens when navigating away
        detachInactiveScreens: false,
        // Optimize screen transitions on iOS
        freezeOnBlur: false
      }}
      // Keep all screens in memory
      backBehavior="initialRoute"
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        listeners={({ navigation }) => ({
          tabPress: () => {
            triggerHaptic('light');
          },
        })}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={28} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Workout"
        component={WorkoutScreen}
        listeners={({ navigation }) => ({
          tabPress: () => {
            triggerHaptic('medium');
          },
        })}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="dumbbell" size={28} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        listeners={({ navigation }) => ({
          tabPress: () => {
            triggerHaptic('light');
          },
        })}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group" size={28} color={color} />
          ),
        }}
      />
      {/* Register MessagesScreen but don't show it in the tab bar */}
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          // This removes the tab completely (no space allocated)
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          // These ensure it's fully hidden from the tab bar
          tabBarButton: () => null,
          tabBarVisible: false
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={({ navigation }) => ({
          tabPress: () => {
            triggerHaptic('light');
          },
        })}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={28} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
