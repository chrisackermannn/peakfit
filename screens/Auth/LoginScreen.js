import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,  // Make sure Image is imported
  Dimensions,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  ScrollView,
  Easing // Import Easing for animations
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Use SafeAreaView correctly by importing it
import { Button, Surface } from 'react-native-paper';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, OAuthProvider, updateProfile } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  collection, 
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../Firebase/firebaseConfig';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// Fix the import paths - remove the redundant '../screens/'
import HomeScreen from '../HomeScreen';
import ProfileScreen from '../ProfileScreen';
import WorkoutScreen from '../WorkoutScreen';
import CommunityScreen from '../Community';
import { triggerHaptic } from '../../App';
import Constants from 'expo-constants'; // Import Constants

// Import environment variables
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, 
         GOOGLE_ANDROID_CLIENT_ID, GOOGLE_EXPO_CLIENT_ID } from '@env';

// Add this line to import your logo
const peakfitLogo = require('../../assets/peakfit-logo.png');

WebBrowser.maybeCompleteAuthSession();

// Determine if running in Expo Go or standalone app
const isExpoGo = Constants.appOwnership === 'expo';

// Set up redirect URI for Google auth
const redirectUri = makeRedirectUri({
  scheme: "peakfit",
  path: "auth"
});

console.log("Redirect URI configured as:", redirectUri);
console.log("Running in Expo Go:", isExpoGo);

const { width, height } = Dimensions.get('window');

const Tab = createBottomTabNavigator();

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();
  
  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));
  
  // Auth State
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Username Modal
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tempUserData, setTempUserData] = useState(null);

  // Input Refs
  const usernameInputRef = useRef(null);
  const displayNameInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  
  // Google Auth Request
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Platform.select({
      ios: GOOGLE_IOS_CLIENT_ID,
      android: GOOGLE_ANDROID_CLIENT_ID,
      default: GOOGLE_WEB_CLIENT_ID
    }),
    iosClientId: GOOGLE_IOS_CLIENT_ID, 
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    expoClientId: GOOGLE_EXPO_CLIENT_ID,
    
    // Important config options
    responseType: ResponseType.IdToken,
    redirectUri,
    scopes: ['profile', 'email'],
    
    // Important for Expo Go
    useProxy: true,
    selectAccount: true,
  });
  
  // Entrance animations
  useEffect(() => {
    // Make sure initial values are properly set at the beginning
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    
    const animationTimeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.ease,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.ease,
        }),
      ]).start();
    }, 100);
    
    return () => clearTimeout(animationTimeout);
  }, []);
  
  // Check for Apple Auth availability and force enable on iOS
  useEffect(() => {
    const debugAppleAuth = async () => {
      try {
        console.log("Checking Apple Authentication availability...");
        let isAvailable = false;
        
        try {
          isAvailable = await AppleAuthentication.isAvailableAsync();
          console.log("Apple Authentication isAvailableAsync result:", isAvailable);
        } catch (error) {
          console.log("Error checking Apple Authentication:", error);
        }
        
        // Force enable on iOS for development
        if (Platform.OS === 'ios') {
          console.log("Running on iOS, enabling Apple Sign In regardless of isAvailableAsync result");
          isAvailable = true;
        }
        
        setAppleAuthAvailable(isAvailable);
      } catch (error) {
        console.error("Error in debugAppleAuth:", error);
      }
    };
    
    debugAppleAuth();
  }, []);
  
  // Handle Google Auth response
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleResponse(response);
    } else if (response?.type === 'error') {
      console.error('Google Auth Error:', response.error);
      setError('Google authentication failed. Please try again.');
    }
  }, [response]);
  
  const handleGoogleResponse = async (res) => {
    try {
      setLoading(true);
      setError('');
      
      // Get the ID token from the response
      let idToken = res?.authentication?.idToken;
      
      if (!idToken && res?.params?.id_token) {
        idToken = res.params.id_token;
      }
      
      if (!idToken) {
        console.error('No ID token found in response', res);
        throw new Error('Google authentication failed: No ID token.');
      }
      
      // Create credential for Firebase
      const credential = GoogleAuthProvider.credential(idToken);
      
      // Sign in to Firebase
      const userCredential = await signInWithCredential(auth, credential);
      const uid = userCredential.user.uid;
      
      // Check if user document exists and has username
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists() || !userSnap.data().username) {
        setTempUserData(userCredential.user);
        setShowUsernameModal(true);
      } else {
        // User has full profile, navigate to app
        navigation.replace('Tabs');
      }
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      
      if (Platform.OS === 'ios' && err.message?.includes('network')) {
        setError('Network error. Please check your connection and try again.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with the same email address but different sign-in credentials.');
      } else {
        setError('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log("Starting Apple Sign In process");
      
      // Generate a random nonce
      const rawNonce = Crypto.randomUUID();
      console.log("Generated raw nonce");
      
      // Hash the nonce for Apple
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      console.log("Generated SHA256 nonce");
      
      console.log("Requesting Apple Authentication...");
      
      // Request Apple authentication with more error handling
      let appleCredential;
      try {
        appleCredential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce
        });
        console.log("Apple Authentication successful");
      } catch (appleError) {
        console.log("Apple Authentication error:", appleError);
        if (appleError.code === 'ERR_CANCELED') {
          setError('Sign in was canceled');
        } else {
          setError(`Apple sign in failed: ${appleError.message || appleError}`);
        }
        setLoading(false);
        return;
      }
      
      if (!appleCredential || !appleCredential.identityToken) {
        console.error("Missing identity token from Apple");
        setError('Failed to get authentication token from Apple');
        setLoading(false);
        return;
      }
      
      console.log("Identity token available, creating Firebase credential");
      
      // Create provider and credential for Firebase
      try {
        const provider = new OAuthProvider('apple.com');
        
        const credential = provider.credential({
          idToken: appleCredential.identityToken,
          rawNonce: rawNonce // Important: send the original raw nonce, not the hashed one
        });
        
        console.log("Created Firebase credential, signing in...");
        
        // Sign in to Firebase
        const userCredential = await signInWithCredential(auth, credential);
        const uid = userCredential.user.uid;
        console.log("Firebase sign-in successful, user ID:", uid);
        
        // Check if user document exists and has username
        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);
        
        if (!userSnap.exists() || !userSnap.data().username) {
          // Capture name from Apple if provided (first login only)
          let displayName = userCredential.user.displayName;
          if (appleCredential.fullName) {
            const { familyName, givenName } = appleCredential.fullName;
            if (givenName || familyName) {
              displayName = [givenName, familyName].filter(Boolean).join(' ');
            }
          }
          
          setTempUserData({
            ...userCredential.user,
            displayName: displayName || userCredential.user.displayName || ''
          });
          setShowUsernameModal(true);
        } else {
          navigation.replace('Tabs');
        }
      } catch (firebaseError) {
        console.error('Firebase sign-in error:', firebaseError);
        setError(`Firebase sign-in failed: ${firebaseError.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Apple Sign-In Error:', err);
      setError(`Apple Sign-In failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log("Starting Google sign in with redirect URI:", redirectUri);
      
      // Simplified call with no parameters - useProxy is already configured above
      const result = await promptAsync();
      
      console.log("Google auth result type:", result.type);
      
      if (result.type === 'success') {
        // Processing will continue in useEffect when response changes
        console.log("Authentication success, token will be processed in useEffect");
      } else if (result.type === 'cancel') {
        setError('Sign in was canceled');
      }
    } catch (error) {
      console.error('Google Sign In Error:', error);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists() || !userSnap.data().username) {
        setTempUserData(userCredential.user);
        setShowUsernameModal(true);
      } else {
        navigation.replace('Tabs');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegister = async () => {
    if (!email || !password || !username || !displayName) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password should be at least 8 characters long');
      return;
    }
    
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers and underscore');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Check if username is taken
      const usernameQuery = await getDocs(
        query(collection(db, 'users'), where('username', '==', username.toLowerCase()))
      );
      
      if (!usernameQuery.empty) {
        setError('Username is already taken');
        setLoading(false);
        return;
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      // Create user document with all fields
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        email: email,
        username: username.toLowerCase(),
        displayName: displayName,
        photoURL: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update the auth profile
      await updateProfile(auth.currentUser, {
        displayName: displayName
      });
      
      // Navigate directly to Tabs without showing username modal
      navigation.replace('Tabs');
      
    } catch (err) {
      console.error('Registration error:', err);
      
      if (err.code === 'auth/email-already-in-use') {
        setError('Email address already in use');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError(err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleSetUsername = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Validate username format
      if (username.length < 3) {
        setError('Username must be at least 3 characters');
        setLoading(false);
        return;
      }
      
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Username can only contain letters, numbers and underscore');
        setLoading(false);
        return;
      }
      
      // Check if username is taken
      const usernameQuery = await getDocs(
        query(collection(db, 'users'), where('username', '==', username.toLowerCase()))
      );
      
      if (!usernameQuery.empty) {
        setError('Username is already taken');
        setLoading(false);
        return;
      }
      
      if (!tempUserData?.uid) {
        throw new Error('User data not found');
      }
      
      // Create user document
      const userDocRef = doc(db, 'users', tempUserData.uid);
      await setDoc(userDocRef, {
        email: tempUserData.email,
        username: username.toLowerCase(),
        displayName: displayName || username,
        photoURL: tempUserData.photoURL || null,
        createdAt: serverTimestamp(),
      }, { merge: true });
      
      // Update auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName || username
        });
      }
      
      setShowUsernameModal(false);
      navigation.replace('Tabs');
    } catch (err) {
      console.error('Error setting username:', err);
      setError(err.message || 'Error creating user profile');
    } finally {
      setLoading(false);
    }
  };

  const renderUsernameModal = () => (
    <Modal
      visible={showUsernameModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.usernameModalContent}>
          <Text style={styles.modalTitle}>Complete Your Profile</Text>
          
          {error ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#f43f5e" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="account" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="badge-account" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Display Name (optional)"
              placeholderTextColor="#94A3B8"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>
          
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSetUsername}
            disabled={loading}
          >
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderForm = () => (
    <LinearGradient
      colors={['rgba(30,41,59,0.9)', 'rgba(15,23,42,0.9)']}
      style={styles.formGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Form Title */}
      <Text style={styles.formTitle}>
        {isRegister ? 'Create Account' : 'Welcome Back'}
      </Text>
      
      {/* Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#f43f5e" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      
      {/* Email Input */}
      <View style={styles.inputContainer}>
        <MaterialCommunityIcons name="email-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94A3B8"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          onSubmitEditing={() => isRegister ? usernameInputRef.current?.focus() : passwordInputRef.current?.focus()}
          returnKeyType="next"
          selectionColor="#3B82F6"
          underlineColorAndroid="transparent"
        />
      </View>
      
      {/* Username Input (Registration only) */}
      {isRegister && (
        <View style={styles.inputContainer}>
          <MaterialCommunityIcons name="account" size={20} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            ref={usernameInputRef}
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#94A3B8"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            onSubmitEditing={() => displayNameInputRef.current?.focus()}
            returnKeyType="next"
            selectionColor="#3B82F6"
          />
        </View>
      )}
      
      {/* Display Name Input (Registration only) */}
      {isRegister && (
        <View style={styles.inputContainer}>
          <MaterialCommunityIcons name="badge-account" size={20} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            ref={displayNameInputRef}
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#94A3B8"
            value={displayName}
            onChangeText={setDisplayName}
            blurOnSubmit={false}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            returnKeyType="next"
            selectionColor="#3B82F6"
          />
        </View>
      )}
      
      {/* Password Input */}
      <View style={styles.inputContainer}>
        <MaterialCommunityIcons name="lock-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
        <TextInput
          ref={passwordInputRef}
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94A3B8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          blurOnSubmit={isRegister ? false : true}
          onSubmitEditing={() => isRegister ? confirmPasswordInputRef.current?.focus() : handleLogin()}
          returnKeyType={isRegister ? "next" : "done"}
          selectionColor="#3B82F6"
        />
      </View>
      
      {/* Confirm Password (Registration only) */}
      {isRegister && (
        <View style={styles.inputContainer}>
          <MaterialCommunityIcons name="lock-check-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            ref={confirmPasswordInputRef}
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#94A3B8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            selectionColor="#3B82F6"
          />
        </View>
      )}
      
      {/* Submit Button */}
      <TouchableOpacity
        style={styles.submitButton}
        onPress={isRegister ? handleRegister : handleLogin}
        disabled={loading}
      >
        <LinearGradient
          colors={['#3b82f6', '#2563eb']}
          style={styles.buttonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {isRegister ? 'Create Account' : 'Sign In'}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
      
      {/* Password Reset Info - Only shown in login mode */}
      {!isRegister && (
        <TouchableOpacity style={styles.forgotPasswordContainer}>
          <Text style={styles.forgotPasswordText}>
            Forgot Password? Email PeakFit2025@gmail.com to reset your password
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Or continue with</Text>
        <View style={styles.dividerLine} />
      </View>
      
      {/* Social Sign In Buttons */}
      <View style={styles.socialButtonsContainer}>
        {/* Google Sign In */}
        <TouchableOpacity
          style={[styles.socialButton, loading && styles.disabledButton]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']}
            style={styles.socialButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons name="google" size={22} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Apple Sign In */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => {
              if (appleAuthAvailable) {
                handleAppleSignIn();
              } else {
                Alert.alert('Not Available', 'Apple Sign In is not available on this device');
                console.log("Apple Authentication not available");
              }
            }}
            disabled={loading}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']}
              style={styles.socialButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="apple" size={22} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Toggle Login/Register */}
      <TouchableOpacity
        style={styles.toggleContainer}
        onPress={() => {
          setError('');
          setIsRegister(!isRegister);
          setUsername('');
          setDisplayName('');
          setConfirmPassword('');
        }}
      >
        <Text style={styles.toggleText}>
          {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0} // Add this line
        >
          <ScrollView 
            contentContainerStyle={[
              styles.scrollContent,
              { 
                paddingTop: Math.max(insets.top, 48),
                paddingBottom: Math.max(insets.bottom + 20, 40) // Add extra bottom padding
              }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Animated Content Container */}
            <Animated.View
              style={[
                styles.contentContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              {/* Logo Section */}
              <View style={styles.logoSection}>
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoBackground}
                >
                  <Image 
                    source={peakfitLogo} 
                    style={styles.logo}
                    resizeMode="cover"
                  />
                </LinearGradient>
                <View style={styles.logoTextContainer}>
                  <Text style={styles.appName}>PeakFit</Text>
                  <Text style={styles.tagline}>Reach Your Fitness Summit</Text>
                </View>
              </View>
              
              {/* Form Card */}
              <View style={styles.formContainer}>
                {renderForm()}
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      
      {/* Username Modal */}
      {renderUsernameModal()}
    </SafeAreaView>
  );
}

const Tabs = () => {
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Match your darkest gradient color
  },
  backgroundGradient: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20, // Add more padding for iOS
  },
  contentContainer: {
    width: '100%',
    maxWidth: 480,
  },
  
  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBackground: {
    width: 140,
    height: 140,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Important to keep the image within the rounded corners
    ...Platform.select({
      ios: {
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      }
    })
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoTextContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
  
  // Form Styles
  formContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  formGradient: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 24,
    textAlign: 'center',
  },
  
  // Error Styling
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#f43f5e',
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
  
  // Input Styling
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
    marginLeft: 8,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  
  // Button Styling
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  
  // Social Login Styling
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: '#94a3b8',
    marginHorizontal: 16,
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  socialButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  socialButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
  },
  disabledButton: {
    opacity: 0.6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
  },
  
  // Toggle Container
  toggleContainer: {
    alignItems: 'center',
  },
  toggleText: {
    color: '#60a5fa',
    fontSize: 15,
  },
  
  // Modal Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  usernameModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  
  // Forgot Password Styling
  forgotPasswordContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
