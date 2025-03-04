import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/Auth/LoginScreen';
import Tabs from './navigation/Tabs';
import EditProfileScreen from './screens/Profile/EditProfileScreen';
import AccountSettingsScreen from './screens/Profile/AccountSettingsScreen';
import PrivacySettingsScreen from './screens/Profile/PrivacySettingsScreen';
import Welcome from './screens/Welcome';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  const { user } = useAuth();

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

  if (isFirstLaunch === null) {
    return null; // or a loading spinner
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={isFirstLaunch ? "Welcome" : user ? "Tabs" : "Login"}>
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