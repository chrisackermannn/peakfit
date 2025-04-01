import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Dimensions,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Button, Surface } from 'react-native-paper';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
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
import { makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

WebBrowser.maybeCompleteAuthSession();

// Get redirect URI for current environment
const redirectUri = makeRedirectUri({
  scheme: 'peakfit',
  path: 'auth'
});

// Update these values with your actual Google client IDs
const googleConfig = {
  iosClientId: '1074755682998-95lcclulfbq36di4do14imf2uvcrkaof.apps.googleusercontent.com',
  androidClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com',
  webClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com',
  expoClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com'
};

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  // Configure Google Auth Request with proper platform-specific parameters
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Platform.select({
      ios: googleConfig.iosClientId,
      android: googleConfig.androidClientId,
      web: googleConfig.webClientId,
      default: googleConfig.expoClientId
    }),
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    responseType: ResponseType.IdToken,
    redirectUri,
    scopes: ['profile', 'email'],
    usePKCE: true,
    // Only use this on iOS - important!
    ...(Platform.OS === 'ios' ? { preferEphemeralSession: true } : {})
  });
  
  const auth = getAuth();
  
  // Email/Password vs Registration
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Username Modal
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [username, setUsername] = useState('');
  const [tempUserData, setTempUserData] = useState(null);
  
  // Handle Google Auth Response
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
      
      // Show user-friendly error message
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
      
      // Show user-friendly error messages
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Try again later');
      } else {
        setError(err.message || 'An error occurred during login');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegister = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setTempUserData(userCredential.user);
      setShowUsernameModal(true);
    } catch (err) {
      console.error('Registration error:', err);
      
      // Show user-friendly error messages
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
  
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Configure special options for iOS
      const options = Platform.OS === 'ios' ? { 
        preferEphemeralSession: true,
        showInRecents: true,
      } : {};
      
      // Show auth prompt
      const result = await promptAsync(options);
      
      // Handle result in useEffect to avoid race conditions
      if (result.type !== 'success') {
        if (result.type === 'cancel') {
          setError('Sign in cancelled');
        } else {
          console.warn('Non-success result type:', result.type);
          setError('Failed to sign in with Google');
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Google Sign In Error:', error);
      setError('Failed to sign in with Google. Please try again.');
      setLoading(false);
    }
  };
  
  // After registration or Google sign-in, user must choose a unique username
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
        return;
      }
      
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Username can only contain letters, numbers and underscore');
        return;
      }
      
      // Check if username is taken
      const usernameQuery = await getDocs(
        query(collection(db, 'users'), where('username', '==', username.toLowerCase()))
      );
      
      if (!usernameQuery.empty) {
        setError('Username is already taken');
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
        displayName: username,
        photoURL: tempUserData.photoURL || null,
        createdAt: serverTimestamp(),
      }, { merge: true });
      
      setShowUsernameModal(false);
      navigation.replace('Tabs');
    } catch (err) {
      console.error('Error setting username:', err);
      setError(err.message || 'Error creating user profile');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.backgroundContainer}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.logoSection}>
            <Surface style={styles.logoShadow}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/Peakfit-06.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                  alt="Logo"

                />
              </View>
            </Surface>
          </View>
          
          <Surface style={styles.formShadow}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {isRegister ? 'Create Account' : 'Welcome Back'}
              </Text>
              
              {error ? (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#FF3B30" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Email"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
              
              <Button
                mode="contained"
                onPress={isRegister ? handleRegister : handleLogin}
                loading={loading}
                style={styles.primaryButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                disabled={loading}
              >
                {isRegister ? 'Sign Up' : 'Log In'}
              </Button>
              
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              
              <Button
                mode="outlined"
                onPress={handleGoogleSignIn}
                icon={() => <MaterialCommunityIcons name="google" size={20} color="#3B82F6" />}
                style={styles.googleButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.socialButtonLabel}
                disabled={loading}
              >
                Continue with Google
              </Button>
              
              <Surface style={styles.comingSoonShadow}>
                <View style={styles.comingSoonCard}>
                  <MaterialCommunityIcons name="apple" size={22} color="#999" />
                  <Text style={styles.comingSoonText}>iOS Sign In Coming Soon</Text>
                </View>
              </Surface>
              
              <TouchableOpacity
                onPress={() => {
                  setError('');
                  setIsRegister(!isRegister);
                }}
                style={styles.toggleContainer}
              >
                <Text style={styles.toggleText}>
                  {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </Text>
              </TouchableOpacity>
            </View>
          </Surface>
        </KeyboardAvoidingView>
      </View>
      
      {/* Username Modal */}
      <Modal
        visible={showUsernameModal}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalShadow}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose Username</Text>
              <Text style={styles.modalSubtitle}>
                Pick a unique username for your account
              </Text>
              
              {error ? (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#FF3B30" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="account" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Username"
                  placeholderTextColor="#666"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
              
              <Button
                mode="contained"
                onPress={handleSetUsername}
                loading={loading}
                style={styles.primaryButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                disabled={loading}
              >
                Continue
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  backgroundContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  keyboardView: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoShadow: {
    borderRadius: 24,
    marginBottom: 16,
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
    }),
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#999',
  },
  formShadow: {
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      }
    }),
  },
  formCard: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF3B30',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 14,
    paddingRight: 16,
    backgroundColor: 'transparent',
    outlineStyle: 'none', // For web platforms
    outlineWidth: 0,      // For web platforms
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#999',
    marginHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    borderRadius: 12,
    borderColor: '#3B82F6',
    marginBottom: 16,
  },
  socialButtonLabel: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoonShadow: {
    borderRadius: 12,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  comingSoonCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  comingSoonText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 8,
  },
  toggleContainer: {
    alignItems: 'center',
  },
  toggleText: {
    color: '#3B82F6',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalShadow: {
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  modalCard: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalSubtitle: {
    color: '#999',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
});
