import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from './context/AuthContext';
import LoginScreen from './screens/Auth/LoginScreen';
import Tabs from './navigation/Tabs';
import EditProfileScreen from './screens/Profile/EditProfileScreen';
import AccountSettingsScreen from './screens/Profile/AccountSettingsScreen';
import PrivacySettingsScreen from './screens/Profile/PrivacySettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
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
            name="AccountSettings" 
            component={AccountSettingsScreen} 
            options={{ title: 'Account Settings' }}
          />
          <Stack.Screen 
            name="PrivacySettings" 
            component={PrivacySettingsScreen} 
            options={{ title: 'Privacy Settings' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
