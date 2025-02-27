// In your AuthContext.js file

// OPTION 1: Make sure the user object correctly reflects your actual authenticated user
// If you're manually setting the user for testing, update your AuthContext to use the actual Firebase auth UID:

// Example AuthContext implementation that ensures user is correctly set
import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../Firebase/firebaseConfig'; // Import your Firebase auth instance
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Use the actual Firebase auth user
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'User'
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);