// In your AuthContext.js file

// OPTION 1: Make sure the user object correctly reflects your actual authenticated user
// If you're manually setting the user for testing, update your AuthContext to use the actual Firebase auth UID:

// Example AuthContext implementation that ensures user is correctly set
import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '../Firebase/firebaseConfig'; // Import your Firebase auth instance
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get additional user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data();
          
          // Combine Firebase auth data with Firestore data
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: userData?.displayName || userData?.username || 'Anonymous',
            photoURL: firebaseUser.photoURL,
            username: userData?.username || '',
            bio: userData?.bio || '',
          });
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserProfile = async (profileData) => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: profileData.displayName,
        photoURL: profileData.photoURL
      });

      // Update local user state with new data
      setUser(prev => ({
        ...prev,
        ...profileData
      }));

      return true;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  const checkAdminStatus = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data().isAdmin === true;
      }
      return false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  const value = {
    user,
    loading,
    updateUserProfile,
    checkAdminStatus,
    // ...other existing values
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};