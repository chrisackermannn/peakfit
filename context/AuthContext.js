import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState({
    uid: 'tempuser123',
    email: 'test@example.com',
    displayName: 'Test User'
  });

  // Added logout function to clear the user (for now)
  const logout = () => {
    setUser(null);
  };

  const value = {
    user,
    setUser,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
