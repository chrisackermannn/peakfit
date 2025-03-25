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
  TouchableOpacity
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

const googleConfig = {
  iosClientId: '1074755682998-95lcclulfbq36di4do14imf2uvcrkaof.apps.googleusercontent.com',
  androidClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com',
  webClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com',
  expoClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com'
};

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Platform.OS === 'web' ? googleConfig.webClientId : googleConfig.expoClientId,
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    responseType: ResponseType.IdToken,
    redirectUri,
    scopes: ['profile', 'email'],
    usePKCE: true,
    proxy: true
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
  
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleResponse(response);
    }
  }, [response]);
  
  const handleGoogleResponse = async (res) => {
    try {
      let idToken = res?.authentication?.idToken;
      if (!idToken && res?.params?.id_token) {
        idToken = res.params.id_token;
      }
      if (!idToken) throw new Error('Google authentication failed: No ID token.');
      
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const uid = userCredential.user.uid;
      
      // Check Firestore doc
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists() || !userSnap.data().username) {
        setTempUserData(userCredential.user);
        setShowUsernameModal(true);
      } else {
        navigation.replace('Tabs');
      }
    } catch (err) {
      console.error('Google Sign-In Error:', err.message);
      setError(err.message);
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
      setError(err.message);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    try {
      const result = await promptAsync();
      
      if (result?.type === 'success') {
        const { id_token } = result.params;
        const credential = GoogleAuthProvider.credential(id_token);
        const auth = getAuth();
        const userCredential = await signInWithCredential(auth, credential);
        
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists() || !userDoc.data().username) {
          setTempUserData(userCredential.user);
          setShowUsernameModal(true);
        } else {
          navigation.replace('Tabs');
        }
      }
    } catch (error) {
      console.error('Google Sign In Error:', error);
      setError('Failed to sign in with Google. Please try again.');
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
            <Surface style={styles.logoContainer}>
              <View style={{ overflow: 'hidden' }}>
                <MaterialCommunityIcons name="dumbbell" size={48} color="#3B82F6" />
              </View>
            </Surface>
            <Text style={styles.appName}>PeakFit</Text>
            <Text style={styles.tagline}>Your Personal Fitness Journey</Text>
          </View>
          
          <Surface style={styles.formCard}>
            <View style={{ overflow: 'hidden' }}>
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
              
              <Surface style={styles.comingSoonCard}>
                <View style={{ overflow: 'hidden' }}>
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
        
        {/* Username Modal */}
        <Modal
          visible={showUsernameModal}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <Surface style={styles.modalCard}>
              <View style={{ overflow: 'hidden' }}>
                <Text style={styles.modalTitle}>Create Your Profile</Text>
                
                {error ? (
                  <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="alert-circle" size={20} color="#FF3B30" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
                
                <Text style={styles.modalSubtitle}>
                  Choose a unique username to continue
                </Text>
                
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons name="account-outline" size={20} color="#666" style={styles.inputIcon} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  backgroundContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0A0A0A',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginLeft: 8,
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
    // These styles fix the background color issue
    backgroundColor: 'transparent',
    outlineStyle: 'none', // For web platforms
    outlineWidth: 0,       // For web platforms
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
    paddingHorizontal: 12,
    fontSize: 14,
  },
  googleButton: {
    borderColor: '#3B82F6',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  socialButtonLabel: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
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
  modalCard: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: 24,
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
