import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, 
         FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, 
         FIREBASE_APP_ID, FIREBASE_STORAGE_URL } from '@env'; // Ensure to load from .env file

// Firebase Configuration Loaded from .env variables
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY, // Make sure these are set in the .env file
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID
};

// Log for debugging - remove in production
console.log("Firebase config loaded from env variables");

const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Initialize Firebase storage with CORS settings
const storage = getStorage(app, FIREBASE_STORAGE_URL);

// Initialize Auth with persistence
const auth = Platform.OS === 'web' 
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });

// Add error handler
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('User is signed in:', user.uid);
  } else {
    console.log('No user is signed in');
  }
});

export { storage, auth, db };

// Add proper error handling in LoginScreen
const handleLogin = async () => {
  if (!email || !password) {
    setError('Please fill in all fields');
    return;
  }

  try {
    setLoading(true);
    setError('');
    await signInWithEmailAndPassword(auth, email, password);
    // Redirect or proceed with logic after successful login
    navigation.navigate('Home'); // Example redirect
  } catch (err) {
    if (err.code === 'auth/invalid-credential') {
      setError('Invalid email or password');
    } else {
      setError('An error occurred during login');
    }
    console.error('Login error:', err);
  } finally {
    setLoading(false);
  }
};

const pickImage = async () => {
  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Please enable photo library access in settings');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to pick image: ' + error.message);
    console.error('Image picker error:', error);
  }
};

const handleSave = async () => {
  if (!validateForm()) return;
  
  try {
    setLoading(true);
    let photoURL = user?.photoURL;

    if (imageUri && imageUri !== user?.photoURL) {
      try {
        photoURL = await uploadImage(imageUri);
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert(
          'Upload Failed',
          'Could not upload profile picture. Continue with other changes?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Continue', 
              onPress: async () => {
                await updateProfileWithoutPhoto();
              }
            }
          ]
        );
        return;
      }
    }

    await updateProfile(photoURL);
    Alert.alert('Success', 'Profile updated successfully!');
    navigation.goBack();

  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
};

const updateProfile = async (photoURL) => {
  const userRef = doc(db, 'users', user.uid);
  const updateData = {
    username: username.toLowerCase(),
    displayName: displayName || username,
    bio: bio || '',
    photoURL,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(userRef, updateData);
  await updateUserProfile({
    displayName: displayName || username,
    photoURL
  });
};
