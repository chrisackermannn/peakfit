// context/MessageNotificationsContext.js
import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { listenForMessageNotifications } from '../data/messagingHelpers';

const MessageNotificationsContext = createContext();

export function MessageNotificationsProvider({ children }) {
  const { user } = useAuth();
  
  // Set up a listener for message notifications when the user is logged in
  useEffect(() => {
    let unsubscribe = () => {};
    
    if (user?.uid) {
      unsubscribe = listenForMessageNotifications(user.uid);
    }
    
    return () => unsubscribe();
  }, [user?.uid]);
  
  return (
    <MessageNotificationsContext.Provider value={{}}>
      {children}
    </MessageNotificationsContext.Provider>
  );
}

export const useMessageNotifications = () => useContext(MessageNotificationsContext);