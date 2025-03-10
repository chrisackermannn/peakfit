import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen.js';
import WorkoutScreen from '../screens/WorkoutScreen.js';
import ProfileScreen from '../screens/ProfileScreen.js';
import communityScreen from '../screens/Community.js';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'home';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Workout') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Community') {
            iconName = focused ? 'chatbox' : 'chatbox-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{
        headerTitle: 'PeakFit',
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons 
            name={focused ? 'home' : 'home-outline'} 
            size={size} 
            color={color} 
          />
        ),
      }} />
      <Tab.Screen name="Workout" component={WorkoutScreen} options={{ headerTitle: 'Workout' }} />
      <Tab.Screen name="Community" component={communityScreen} options={{ headerTitle: 'Community' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerTitle: 'Profile' }} />
    </Tab.Navigator>
  );
}
