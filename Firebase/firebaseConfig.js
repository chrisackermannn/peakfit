import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAfnByDnS9VNb-xXUes_AUU3J8fN4937is",
  authDomain: "fir-basics-90f1d.firebaseapp.com",
  projectId: "fir-basics-90f1d",
  storageBucket: "fir-basics-90f1d.appspot.com",
  messagingSenderId: "1074755682998",
  appId: "1:1074755682998:web:ee6b4864876c7cba311c17"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Initialize Firebase storage with CORS settings
const storage = getStorage(app);

// If in development, you might want to use emulators
if (process.env.NODE_ENV === 'development') {
  try {
    // Optional: Connect to emulators if they're running
    // connectStorageEmulator(storage, 'localhost', 9199);
  } catch (e) {
    console.warn('Failed to connect to storage emulator:', e);
  }
}

// Initialize Auth with persistence
const auth = Platform.OS === 'web' 
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });

// Add error handler
auth.onAuthStateChanged((user) => {
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
    // Rest of login logic...
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