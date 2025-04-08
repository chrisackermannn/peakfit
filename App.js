import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './context/AuthContext';
import { MessageNotificationsProvider } from './context/MessageNotificationsContext';
import LoginScreen from './screens/Auth/LoginScreen';
import Tabs from './navigation/Tabs';
import EditProfileScreen from './screens/Profile/EditProfileScreen';
import AccountSettingsScreen from './screens/Profile/AccountSettingsScreen';
import PrivacySettingsScreen from './screens/Profile/PrivacySettingsScreen';
import Welcome from './screens/Welcome';
import { PaperProvider } from 'react-native-paper';
import FlashMessage from "react-native-flash-message";
import AdminScreen from './screens/AdminScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import MessagesScreen from './screens/MessagesScreen';
import ChatConversationScreen from './screens/ChatConversationScreen';
import AccountInfoScreen from './screens/Auth/account_Info_Screen';
import ProfileInfoScreen from './screens/Auth/profile_Info';
import { TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ExerciseLevelScreen from './screens/Auth/Exercise_Level';

const Stack = createNativeStackNavigator();

// Create a separate component for the navigation structure
function AppNavigator() {
  

  return (
    <Stack.Navigator 
      initialRouteName="Welcome"
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
        name="AccountInfo" 
        component={AccountInfoScreen} 
        options={({ navigation }) => ({
          title: 'Account Information',
          headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginLeft: 10 }}>
                  <MaterialCommunityIcons name="arrow-left" size={24} color="#007AFF" />
              </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="ProfileInfo"
        component={ProfileInfoScreen}
        options={({ navigation }) => ({
          title: 'Profile Information',
          headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.navigate('AccountInfo')} style={{ marginLeft: 10 }}>
                  <MaterialCommunityIcons name="arrow-left" size={24} color="#007AFF" />
              </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="ExerciseLevel"
        component={ExerciseLevelScreen}
        options={({ navigation }) => ({
          title: 'Exercise Level',
          headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.navigate('ProfileInfo')} style={{ marginLeft: 10 }}>
                  <MaterialCommunityIcons name="arrow-left" size={24} color="#007AFF" />
              </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ title: 'Edit Profile' }} 
      />
      <Stack.Screen 
        name="AccountSettings" 
        component={AccountSettingsScreen} 
        options={{ title: 'Account Settings' }} 
      />
      <Stack.Screen 
        name="PrivacySettings" 
        component={PrivacySettingsScreen} 
        options={{ title: 'Privacy Settings' }} 
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