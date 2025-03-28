// data/messagingHelpers.js
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc, 
  setDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  increment,
  arrayUnion,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';

/**
 * Create or get an existing conversation between two users
 * Stores chat data under each user's document
 */
export async function startDirectMessage(currentUserId, otherUserId) {
  try {
    if (!currentUserId || !otherUserId) {
      throw new Error("Both user IDs are required");
    }
    
    if (currentUserId === otherUserId) {
      throw new Error("Cannot start a conversation with yourself");
    }
    
    // Create a unique ID based on both users (sorted to ensure consistency)
    const memberIds = [currentUserId, otherUserId].sort();
    const conversationId = memberIds.join('__');
    
    // Get both users' info
    const [currentUserDoc, otherUserDoc] = await Promise.all([
      getDoc(doc(db, 'users', currentUserId)),
      getDoc(doc(db, 'users', otherUserId))
    ]);
    
    if (!currentUserDoc.exists() || !otherUserDoc.exists()) {
      throw new Error("One or both users not found");
    }
    
    const currentUserData = currentUserDoc.data();
    const otherUserData = otherUserDoc.data();
    
    // Create chat data to store under each user's document
    const chatData = {
      members: [currentUserId, otherUserId],
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: "",
      unreadCount: 0
    };
    
    // Try to initialize both users' chat data
    try {
      // Store chat data for current user
      const currentUserChatRef = doc(db, 'users', currentUserId, 'chats', conversationId);
      const currentUserChatSnap = await getDoc(currentUserChatRef);
      
      if (!currentUserChatSnap.exists()) {
        await setDoc(currentUserChatRef, {
          ...chatData,
          withUser: {
            id: otherUserId,
            displayName: otherUserData.displayName || otherUserData.username || 'User',
            photoURL: otherUserData.photoURL || null
          }
        });
      }
    } catch (error) {
      console.error("Error creating chat for current user:", error);
      // Continue anyway to attempt creating the second user's chat
    }
    
    // Admin mode - create the chat entry for the other user via Functions
    // THIS IS A SPECIAL APPROACH - in production you'd use Cloud Functions or 
    // another server-side approach for this operation
    try {
      // Create admin chat document (this requires rules to allow creating chat docs for any user)
      // Use the 'generate' collection which has permissive rules for testing
      await addDoc(collection(db, 'generate'), {
        type: 'CREATE_CHAT',
        targetUserId: otherUserId,
        chatId: conversationId,
        fromUserId: currentUserId,
        fromUserName: currentUserData.displayName || currentUserData.username || 'User',
        fromUserPhoto: currentUserData.photoURL || null,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.log("Could not request chat creation for other user:", error);
      // This is expected with normal security rules - we'll handle chat creation on first message
    }
    
    return {
      id: conversationId,
      otherUser: {
        id: otherUserId,
        name: otherUserData.displayName || otherUserData.username || 'User',
        image: otherUserData.photoURL || null
      }
    };
  } catch (error) {
    console.error("Error starting conversation:", error);
    throw error;
  }
}

/**
 * Send a message in a conversation - stores message for sender and notifies receiver
 */
export async function sendMessage(conversationId, senderId, receiverId, text) {
  try {
    if (!text.trim() || !conversationId) {
      throw new Error("Message cannot be empty");
    }
    
    const timestamp = serverTimestamp();
    const messageData = {
      text: text.trim(),
      senderId,
      createdAt: timestamp
    };
    
    // First, store the message in the sender's subcollection
    try {
      // Add message to sender's chat subcollection
      const senderMessageRef = collection(db, 'users', senderId, 'chats', conversationId, 'messages');
      await addDoc(senderMessageRef, messageData);
      
      // Update sender's chat metadata
      const senderChatRef = doc(db, 'users', senderId, 'chats', conversationId);
      await updateDoc(senderChatRef, {
        lastMessage: text.trim(),
        lastMessageAt: timestamp
      });
    } catch (error) {
      console.error("Error sending message (sender side):", error);
      throw error;
    }
    
    // Then, notify the recipient using the 'generate' collection
    // (This will be processed by cloud functions in production)
    try {
      await addDoc(collection(db, 'generate'), {
        type: 'NEW_MESSAGE',
        chatId: conversationId,
        senderId: senderId,
        receiverId: receiverId,
        text: text.trim(),
        timestamp: timestamp
      });
    } catch (error) {
      console.log("Failed to notify recipient:", error);
      // Not critical, so we don't throw
    }
    
    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

/**
 * Mark messages as read for the current user
 */
export async function markConversationAsRead(conversationId, userId) {
  try {
    if (!conversationId || !userId) return false;
    
    const userChatRef = doc(db, 'users', userId, 'chats', conversationId);
    
    try {
      await updateDoc(userChatRef, {
        unreadCount: 0
      });
      return true;
    } catch (error) {
      // Silent fail - this is not critical functionality
      console.log("Could not mark as read:", error);
      return false;
    }
  } catch (error) {
    console.error("Error in markConversationAsRead:", error);
    return false;
  }
}

/**
 * Get all conversations for a user
 */
export async function getUserConversations(userId) {
  if (!userId) return [];
  
  try {
    const chatsRef = collection(db, 'users', userId, 'chats');
    const q = query(chatsRef, orderBy('lastMessageAt', 'desc'));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      lastMessageAt: doc.data().lastMessageAt?.toDate() || new Date(),
      otherUser: doc.data().withUser || {}
    }));
  } catch (error) {
    console.error("Error getting user conversations:", error);
    // Return empty array instead of throwing
    return [];
  }
}

/**
 * Listen to messages in a conversation
 * @returns {function} Unsubscribe function
 */
export function listenToMessages(userId, conversationId, callback) {
  if (!userId || !conversationId) return () => {};
  
  try {
    // Reference to the messages subcollection under the user's document
    const messagesRef = collection(db, 'users', userId, 'chats', conversationId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      
      callback(messages);
      
      // Mark as read silently
      markConversationAsRead(conversationId, userId).catch(() => {});
    }, 
    (error) => {
      console.error("Error listening to messages:", error);
      callback([]);
    });
  } catch (error) {
    console.error("Error setting up message listener:", error);
    return () => {};
  }
}

/**
 * Process an incoming message from the other user
 * This is normally done with Cloud Functions, but we're simulating it client-side
 */
export async function processIncomingMessage(messageData) {
  try {
    const { chatId, senderId, receiverId, text, timestamp } = messageData;
    
    if (!chatId || !senderId || !receiverId || !text) {
      throw new Error("Missing message data");
    }
    
    // Ensure the chat exists for the receiver
    const receiverChatRef = doc(db, 'users', receiverId, 'chats', chatId);
    const receiverChatSnap = await getDoc(receiverChatRef);
    
    // If the chat doesn't exist for the receiver yet, we need to create it
    if (!receiverChatSnap.exists()) {
      // Get sender info
      const senderDoc = await getDoc(doc(db, 'users', senderId));
      if (!senderDoc.exists()) {
        throw new Error("Sender not found");
      }
      
      const senderData = senderDoc.data();
      
      // Create the chat document for the receiver
      await setDoc(receiverChatRef, {
        members: [receiverId, senderId],
        createdAt: timestamp || serverTimestamp(),
        lastMessageAt: timestamp || serverTimestamp(),
        lastMessage: text,
        unreadCount: 1,
        withUser: {
          id: senderId,
          displayName: senderData.displayName || senderData.username || 'User',
          photoURL: senderData.photoURL || null
        }
      });
    } else {
      // Update the existing chat document
      await updateDoc(receiverChatRef, {
        lastMessage: text,
        lastMessageAt: timestamp || serverTimestamp(),
        unreadCount: increment(1)
      });
    }
    
    // Add the message to the receiver's messages subcollection
    const receiverMessageRef = collection(receiverChatRef, 'messages');
    await addDoc(receiverMessageRef, {
      text,
      senderId,
      createdAt: timestamp || serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error("Error processing incoming message:", error);
    return false;
  }
}

/**
 * Listen for message notifications
 * This simulates a Cloud Function that would process messages in production
 */
export function listenForMessageNotifications(currentUserId) {
  if (!currentUserId) return () => {};
  
  const notificationsRef = collection(db, 'generate');
  const q = query(notificationsRef, 
    where('type', '==', 'NEW_MESSAGE'),
    where('receiverId', '==', currentUserId));
  
  try {
    return onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const notification = change.doc.data();
          
          // Process the incoming message
          await processIncomingMessage(notification);
          
          // Delete the notification document to avoid processing it again
          // (In production, this would be done by the Cloud Function)
          try {
            await deleteDoc(change.doc.ref);
          } catch (error) {
            console.log("Could not delete notification:", error);
          }
        }
      }
    });
  } catch (error) {
    console.error("Error setting up notifications listener:", error);
    return () => {};
  }
}