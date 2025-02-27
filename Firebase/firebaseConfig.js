import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAfnByDnS9VNb-xXUes_AUU3J8fN4937is",
  authDomain: "fir-basics-90f1d.firebaseapp.com",
  databaseURL: "https://fir-basics-90f1d-default-rtdb.firebaseio.com",
  projectId: "fir-basics-90f1d",
  storageBucket: "fir-basics-90f1d.firebasestorage.app",
  messagingSenderId: "1074755682998",
  appId: "1:1074755682998:web:ee6b4864876c7cba311c17",
  measurementId: "G-KG2ETG67DM"
};

const app = initializeApp(firebaseConfig);

let auth;
if (Platform.OS === 'web') {
  // Use default browser persistence for web
  auth = getAuth(app);
} else {
  // Use ReactNativeAsyncStorage for native apps
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
}

const db = getFirestore(app);

export { auth, db };
