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
  Dimensions
} from 'react-native';
import { TouchableOpacity } from 'react-native';
import { Button } from 'react-native-paper';
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
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// Get redirect URI for current environment
const redirectUri = makeRedirectUri({
  scheme: 'peakfit',
  path: 'auth'
});

const googleConfig = {
  iosClientId: '1074755682998-95lcclulfbq36di4do14imf2uvcrkaof.apps.googleusercontent.com',
  androidClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com',
  webClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com', // Add this
  expoClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com'
};

export default function LoginScreen({ navigation }) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Platform.OS === 'web' ? googleConfig.webClientId : googleConfig.expoClientId, // Use webClientId for web
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    responseType: ResponseType.IdToken,
    redirectUri,
    scopes: ['profile', 'email'],
    usePKCE: true,
    proxy: true // Enable proxy for development
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/logo.png')} // Add your logo
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>PeakFit</Text>
          <Text style={styles.subtitle}>
            {isRegister ? 'Create your account' : 'Welcome back'}
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            mode="contained"
            onPress={isRegister ? handleRegister : handleLogin}
            loading={loading}
            style={styles.primaryButton}
            disabled={loading}
          >
            {isRegister ? 'Create Account' : 'Sign In'}
          </Button>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            style={styles.googleButton}
            icon="google"
            disabled={loading}
          >
            Continue with Google
          </Button>
        </View>

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

      {/* Username Modal */}
      <Modal
        visible={showUsernameModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose a Username</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <Button
              mode="contained"
              onPress={handleSetUsername}
              loading={loading}
              style={styles.button}
              disabled={loading}
            >
              Set Username
            </Button>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  innerContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 32,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  primaryButton: {
    padding: 4,
    borderRadius: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
  },
  googleButton: {
    borderRadius: 12,
    borderColor: '#E0E0E0',
  },
  toggleContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  toggleText: {
    color: '#007AFF',
    fontSize: 16,
  },
  error: {
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
});
