import React from 'react';
import { Platform, StyleSheet } from 'react-native'; 
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CommunityScreen from '../screens/Community';

const Tab = createBottomTabNavigator();

export default function Tabs() {
  // Safe area insets for iOS
  const bottomInset = Platform.OS === 'ios' ? 24 : 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Workout') {
            iconName = focused ? 'dumbbell' : 'dumbbell';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account' : 'account-outline';
          } else if (route.name === 'Community') {
            iconName = focused ? 'account-group' : 'account-group-outline';
          }
          
          return <MaterialCommunityIcons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#999',
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopWidth: 0,
          height: 60 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 10,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
        tabBarItemStyle: {
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          paddingBottom: 4,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
      />
      <Tab.Screen 
        name="Workout" 
        component={WorkoutScreen} 
      />
      <Tab.Screen 
        name="Community" 
        component={CommunityScreen} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
      />
    </Tab.Navigator>
  );
}
