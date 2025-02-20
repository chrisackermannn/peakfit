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
import * as AuthSession from 'expo-auth-session';


WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const redirectUri = makeRedirectUri({ useProxy: true });

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '1074755682998-h9n6bi7cshd6vth54eogek5htvq6tclb.apps.googleusercontent.com',
    redirectUri: makeRedirectUri({ useProxy: false }),
    scopes: ['openid', 'profile', 'email'],
    responseType: 'id_token',
  });
  
  
  

  const auth = getAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [username, setUsername] = useState('');
  const [tempUserData, setTempUserData] = useState(null);

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleResponse(response);
    }
  }, [response]);

 

  const handleGoogleResponse = async (response) => {
    try {
      console.log("Full Google Response:", JSON.stringify(response, null, 2));
  
      let idToken = response?.authentication?.idToken;
  
      if (!idToken && response?.params?.id_token) {
        idToken = response.params.id_token; // Extract from response.params
      }
  
      console.log("Extracted ID Token:", idToken);
  
      if (!idToken) {
        throw new Error("Google authentication failed: No ID token received.");
      }
  
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
  
      if (userDoc.exists() && userDoc.data().username) {
        navigation.replace('Tabs');
      } else {
        setTempUserData(userCredential.user);
        setShowUsernameModal(true);
      }
    } catch (err) {
      console.error("Google Sign-In Error:", err.message);
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
      await promptAsync();
    } catch (err) {
      setError(err.message);
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
      const usernameQuery = await getDocs(
        query(collection(db, 'users'), where('username', '==', username.toLowerCase()))
      );
      if (!usernameQuery.empty) {
        setError('Username is already taken');
        return;
      }
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
