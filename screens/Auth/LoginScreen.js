import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Modal 
} from 'react-native';
import { TouchableOpacity } from 'react-native';
import { Button } from 'react-native-paper';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithCredential 
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  // Generate redirect URI for Google OAuth (using Expo proxy for development)
  const redirectUri = makeRedirectUri({ useProxy: true });
  console.log("Redirect URI:", redirectUri);

  // Set up Google auth request using the web client ID and the generated redirect URI
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com',
    redirectUri,
  });

  const auth = getAuth();
  // Toggle between login and registration modes
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // For prompting username if not set in Firestore
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [username, setUsername] = useState('');
  const [tempUserData, setTempUserData] = useState(null);

  // Listen for Google sign-in response changes
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleResponse(response);
    }
  }, [response]);

  // Handle Google sign-in response
  const handleGoogleResponse = async (response) => {
    try {
      const credential = GoogleAuthProvider.credential(response.authentication.idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists() && userDoc.data().username) {
        navigation.replace('Tabs');
      } else {
        setTempUserData(userCredential.user);
        setShowUsernameModal(true);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle login for existing users
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists() && userDoc.data().username) {
        navigation.replace('Tabs');
      } else {
        setTempUserData(userCredential.user);
        setShowUsernameModal(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle registration for new users
  const handleRegister = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // New user: prompt for username since they won't have a Firestore document yet.
      setTempUserData(userCredential.user);
      setShowUsernameModal(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initiate Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      await promptAsync();
    } catch (err) {
      setError(err.message);
    }
  };

  // After login/registration, if a username isn't set, prompt user to choose one.
  const handleSetUsername = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    try {
      setLoading(true);
      setError('');
      // Check if the username is already taken
      const usernameQuery = await getDocs(
        query(collection(db, 'users'), where('username', '==', username.toLowerCase()))
      );
      if (!usernameQuery.empty) {
        setError('Username is already taken');
        return;
      }
      // Save the user document with the chosen username
      await setDoc(doc(db, 'users', tempUserData.uid), {
        email: tempUserData.email,
        username: username.toLowerCase(),
        displayName: username,
        createdAt: new Date().toISOString(),
        photoURL: tempUserData.photoURL || null,
      });
      setShowUsernameModal(false);
      navigation.replace('Tabs');
    } catch (err) {
      setError(err.message);
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
        <Text style={styles.title}>PeakFit</Text>
        <Text style={styles.subtitle}>
          {isRegister ? 'Register an account' : 'Login to your account'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
        {isRegister ? (
          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            style={styles.button}
            disabled={loading}
          >
            Register
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            style={styles.button}
            disabled={loading}
          >
            Login
          </Button>
        )}
        <Button
          mode="outlined"
          onPress={handleGoogleSignIn}
          style={styles.googleButton}
          icon="google"
        >
          Sign in with Google
        </Button>
        <TouchableOpacity onPress={() => {
          setError('');
          setIsRegister(!isRegister);
        }}>
          <Text style={styles.toggleText}>
            {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
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
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#007AFF',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    marginBottom: 15,
    padding: 5,
  },
  googleButton: {
    marginBottom: 15,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 15,
  },
  toggleText: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 10,
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
