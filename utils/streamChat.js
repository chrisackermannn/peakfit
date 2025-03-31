// utils/streamChat.js - Alternative approach for testing only!
import { StreamChat } from 'stream-chat';
import { db, auth } from '../Firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// Your Stream API key from the Stream Dashboard
const STREAM_API_KEY = 'fn64w5mszezu'; 
// Stream Chat server secret - WARNING: This should never be in client code in production!
// This is ONLY for local testing during development!
const STREAM_SECRET = 'wkh2rvvr262mzztpt9pdswdpnr46xaz96fp6qp2eucupuw79zf2mpmshxapwrhgm'; // Replace with your secret for testing
let chatClient = null;

// Initialize or get the chat client
const initClient = () => {
  if (!chatClient) {
    chatClient = StreamChat.getInstance(STREAM_API_KEY);
  }
  return chatClient;
};

// Connect user to Stream
export async function connectUserToStream() {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Get or initialize the client
    const client = initClient();
    
    // Check if already connected
    if (client.user && client.user.id === user.uid) {
      console.log("User already connected to Stream");
      return client;
    }
    
    // Get user data from Firestore for name and image
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    
    // FOR TESTING ONLY: Generate token on client side (NEVER do this in production!)
    const token = client.devToken(user.uid);
    
    // Connect user to Stream
    await client.connectUser(
      {
        id: user.uid,
        name: userData.displayName || user.displayName || 'User',
        image: userData.photoURL || user.photoURL || null,
      },
      token
    );
    
    console.log('Connected to Stream Chat');
    return client;
  } catch (error) {
    console.error('Failed to connect to Stream Chat:', error);
    throw error;
  }
}

// Start a direct message channel with another user
export async function startDirectMessage(withUserId) {
  try {
    // Make sure we're connected
    const client = await connectUserToStream();
    const currentUserId = client.user.id;
    
    if (currentUserId === withUserId) {
      throw new Error("Cannot start a conversation with yourself");
    }
    
    // Get the other user from Firestore
    const otherUserDoc = await getDoc(doc(db, 'users', withUserId));
    if (!otherUserDoc.exists()) {
      throw new Error("User not found");
    }
    const otherUserData = otherUserDoc.data();
    
    // Create a deterministic channel ID by sorting user IDs
    const channelId = [currentUserId, withUserId].sort().join('__');
    
    // Create or get the channel
    const channel = client.channel('messaging', channelId, {
      members: [currentUserId, withUserId],
      name: otherUserData.displayName || otherUserData.username || 'Chat',
    });
    
    // Start watching the channel
    await channel.watch();
    
    return channel;
  } catch (error) {
    console.error('Error starting direct message:', error);
    throw error;
  }
}

// Disconnect user from Stream Chat
export async function disconnectUser() {
  try {
    const client = initClient();
    if (client.user) {
      await client.disconnectUser();
      console.log('Disconnected from Stream Chat');
    }
  } catch (error) {
    console.error('Error disconnecting from Stream Chat:', error);
  }
}

// Get the chat client
export const getChatClient = () => initClient();