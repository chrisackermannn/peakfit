import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform
} from 'react-native';
import { Surface, Button, IconButton, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,
  getDoc
} from 'firebase/firestore';
import { db } from '../Firebase/firebaseConfig';
import { getUserWorkouts } from '../data/firebaseHelpers';

const defaultAvatar = require('../assets/default-avatar.png');

export default function AdminScreen({ navigation }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userWorkouts, setUserWorkouts] = useState([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if current user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.uid) {
        navigation.replace('Login');
        return;
      }
      
      try {
        // CURRENT APPROACH - Checking only in admin collection with isAdmin field
        // This is causing your access denied issue
        
        // NEW APPROACH - Check both collections like ProfileScreen does
        console.log('Checking admin status for user:', user.uid);
        
        // Check in admin collection 
        const adminRef = doc(db, 'admin', 'users');
        const adminDoc = await getDoc(adminRef);
        
        // Check in users collection for isAdmin flag
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        const isAdminInAdminCollection = adminDoc.exists() && 
          adminDoc.data().list?.includes(user.uid);
        
        const isAdminInUserCollection = userDoc.exists() && 
          userDoc.data().isAdmin === true;
        
        // If either check passes, the user is an admin
        const isAdmin = isAdminInAdminCollection || isAdminInUserCollection;
        
        console.log('Admin check in AdminScreen:');
        console.log('- In admin collection:', isAdminInAdminCollection);
        console.log('- In user document:', isAdminInUserCollection);
        console.log('- Final result:', isAdmin);
        
        if (!isAdmin) {
          Alert.alert(
            'Access Denied',
            'You do not have admin privileges.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        Alert.alert('Error', 'Could not verify admin status.');
        navigation.goBack();
      }
    };

    checkAdminStatus();
  }, [user, navigation]);

  // Load all users
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), orderBy('displayName'));
        const querySnapshot = await getDocs(q);
        
        const usersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          key: doc.id // For FlatList
        }));
        
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
        Alert.alert('Error', 'Could not load users.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [refreshKey]);
  
  // Filter users based on search query
  const filteredUsers = searchQuery 
    ? users.filter(user => 
        (user.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (user.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  // Handle user selection and show user details
  const handleUserSelect = async (selectedUser) => {
    setSelectedUser(selectedUser);
    setLoadingWorkouts(true);
    
    try {
      const workouts = await getUserWorkouts(selectedUser.id);
      setUserWorkouts(workouts);
    } catch (error) {
      console.error('Error fetching user workouts:', error);
    } finally {
      setLoadingWorkouts(false);
      setModalVisible(true);
    }
  };

  // Update user admin status
  const toggleAdminStatus = async (userId, currentStatus) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAdmin: !currentStatus
      });
      
      Alert.alert(
        'Success', 
        `User is now ${!currentStatus ? 'an admin' : 'no longer an admin'}.`
      );
      
      // Refresh the user list
      setRefreshKey(old => old + 1);
      setModalVisible(false);
    } catch (error) {
      console.error('Error updating admin status:', error);
      if (error.code === 'permission-denied') {
        Alert.alert('Error', 'You do not have permission to perform this action.');
      } else {
        Alert.alert('Error', 'Failed to update admin status.');
      }
    }
  };
  
  // Delete user account
  const deleteUserAccount = async (userId) => {
    Alert.alert(
      'Confirm Deletion',
      'This will permanently delete the user account. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the user document
              await deleteDoc(doc(db, 'users', userId));
              
              // Note: This only deletes the Firestore document
              // In a production app, you would also want to:
              // 1. Delete the Firebase Auth user
              // 2. Delete user's storage files
              // 3. Delete other related collections
              
              Alert.alert('Success', 'User account has been deleted.');
              setRefreshKey(old => old + 1);
              setModalVisible(false);
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', 'Failed to delete user account.');
            }
          }
        }
      ]
    );
  };

  // Render user item for the list
  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => handleUserSelect(item)}
    >
      <View style={styles.userItemContent}>
        <Image 
          source={item.photoURL ? { uri: item.photoURL } : defaultAvatar}
          style={styles.userAvatar}
          defaultSource={defaultAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName || item.username || 'Anonymous'}</Text>
          <Text style={styles.userEmail}>{item.email || 'No email'}</Text>
        </View>
      </View>
      
      {item.isAdmin && (
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>Admin</Text>
        </View>
      )}
      
      <MaterialCommunityIcons 
        name="chevron-right" 
        size={24} 
        color="#999" 
      />
    </TouchableOpacity>
  );

  // User details modal
  const renderUserDetailsModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <Surface style={styles.modalContent}>
          <View style={styles.contentWrapper}>
            {selectedUser && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>User Details</Text>
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={() => setModalVisible(false)}
                  />
                </View>
                
                <View style={styles.userProfile}>
                  <Image
                    source={selectedUser.photoURL ? { uri: selectedUser.photoURL } : defaultAvatar}
                    style={styles.profileImage}
                    defaultSource={defaultAvatar}
                  />
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{selectedUser.displayName || selectedUser.username || 'Anonymous'}</Text>
                    <Text style={styles.profileUsername}>@{selectedUser.username || 'unknown'}</Text>
                    <Text style={styles.profileEmail}>{selectedUser.email || 'No email'}</Text>
                  </View>
                </View>
                
                <View style={styles.userBio}>
                  <Text style={styles.bioLabel}>Bio:</Text>
                  <Text style={styles.bioText}>{selectedUser.bio || 'No bio provided.'}</Text>
                </View>
                
                <View style={styles.adminActions}>
                  <Button
                    mode="contained"
                    icon={selectedUser.isAdmin ? "shield-off" : "shield-account"}
                    onPress={() => toggleAdminStatus(selectedUser.id, selectedUser.isAdmin)}
                    style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
                  >
                    {selectedUser.isAdmin ? "Remove Admin" : "Make Admin"}
                  </Button>
                  
                  <Button
                    mode="contained"
                    icon="delete"
                    onPress={() => deleteUserAccount(selectedUser.id)}
                    style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                  >
                    Delete Account
                  </Button>
                </View>
                
                <Divider style={{ marginVertical: 16 }} />
                
                <Text style={styles.sectionTitle}>User Workouts</Text>
                
                {loadingWorkouts ? (
                  <ActivityIndicator size="large" color="#3B82F6" style={{ marginVertical: 20 }} />
                ) : userWorkouts.length > 0 ? (
                  <FlatList
                    data={userWorkouts}
                    keyExtractor={item => item.id}
                    style={styles.workoutsList}
                    renderItem={({ item }) => (
                      <Surface style={styles.workoutCard}>
                        <View style={styles.contentWrapper}>
                          <Text style={styles.workoutTitle}>{item.name || 'Unnamed Workout'}</Text>
                          <Text style={styles.workoutDate}>
                            {new Date(item.date?.seconds * 1000 || Date.now()).toLocaleDateString()}
                          </Text>
                          <Text style={styles.exerciseCount}>
                            {item.exercises?.length || 0} exercises
                          </Text>
                        </View>
                      </Surface>
                    )}
                  />
                ) : (
                  <Text style={styles.noWorkouts}>No workouts found for this user.</Text>
                )}
              </>
            )}
          </View>
        </Surface>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.headerCard}>
        <View style={styles.contentWrapper}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Manage Users and Accounts</Text>
        </View>
      </Surface>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={24} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, username or email"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.userList}
        ItemSeparatorComponent={() => <Divider />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        )}
      />

      {renderUserDetailsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    padding: 20,
    backgroundColor: '#3B82F6',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  userList: {
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
  },
  userItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  adminBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '90%',
    borderRadius: 16,
    padding: 20,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profileUsername: {
    fontSize: 16,
    color: '#666',
  },
  profileEmail: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  userBio: {
    marginBottom: 16,
  },
  bioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  adminActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  workoutsList: {
    maxHeight: 200,
  },
  workoutCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  workoutDate: {
    fontSize: 14,
    color: '#666',
  },
  exerciseCount: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  noWorkouts: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
  contentWrapper: {
    borderRadius: 12,
    // No overflow property
  },
});