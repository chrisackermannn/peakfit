import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  StatusBar
} from 'react-native';
import { Button } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../Firebase/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const defaultAvatar = require('../../assets/default-avatar.png');
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB in bytes

export default function EditProfileScreen({ navigation }) {
  const { user, updateUserProfile } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [imageUri, setImageUri] = useState(user?.photoURL || null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Add this to hide the header
  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Hide the default header
    });
  }, [navigation]);
  
  // Request permissions on component mount
  useEffect(() => {
    if (Platform.OS !== 'web') {
      requestPermissions();
    }
  }, []);
  
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable photo library access to change your profile picture',
          [{ text: 'OK' }]
        );
      }
    }
  };
  
  // Pick image from gallery
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6, // Reduced quality for better performance
      });
      
      if (!result.canceled && result.assets?.[0]) {
        setImageUri(result.assets[0].uri);
        console.log("Image selected:", result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };
  
  // Upload image to Firebase Storage
  const uploadImage = async (uri) => {
    if (!user?.uid) throw new Error('User not found');
    
    try {
      // Create blob from URI
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Upload to Firebase Storage in the profilePics path to match rules
      // Use the explicit bucket name to avoid CORS issues
      const storage = getStorage(undefined, "gs://fir-basics-90f1d.firebasestorage.app");
      const filename = `profile_${Date.now()}.jpg`;
      const storageRef = ref(storage, `profilePics/${user.uid}/${filename}`);
      
      // Add metadata with content-type to help with CORS issues
      const metadata = {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      };
      
      // Upload the image with metadata
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob, metadata);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload is ${progress}% done`);
          },
          (error) => {
            console.error('Upload error:', error);
            reject(error);
          },
          async () => {
            try {
              // Get download URL of the uploaded image
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Profile image uploaded successfully. URL:', downloadURL);
              resolve(downloadURL);
            } catch (error) {
              console.error('Error getting download URL:', error);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };
  
  // Validate form inputs
  const validateForm = () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return false;
    }
    
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert('Error', 'Username can only contain letters, numbers and underscore');
      return false;
    }
    
    return true;
  };
  
  // Update profile data
  const updateProfileData = async (photoURL) => {
    try {
      // First, update Firestore doc
      const userRef = doc(db, 'users', user.uid);
      const updateData = {
        username: username.toLowerCase(),
        displayName: displayName || username,
        bio: bio || '',
        updatedAt: new Date().toISOString()
      };
      
      // Add photoURL if it changed
      if (photoURL && photoURL !== user.photoURL) {
        updateData.photoURL = photoURL;
      }
      
      await updateDoc(userRef, updateData);
      console.log("Firestore document updated successfully");
      
      // Update Auth profile
      try {
        // Create auth update object
        const authUpdateData = {
          displayName: displayName || username,
          username: username.toLowerCase(),
          bio: bio || ''
        };
        
        // Add photoURL if it's a valid URL
        if (photoURL && photoURL !== user.photoURL) {
          authUpdateData.photoURL = photoURL;
        }
        
        await updateUserProfile(authUpdateData);
        console.log("Auth profile updated successfully");
      } catch (authError) {
        console.warn("Auth update warning (non-critical):", authError.message);
        // Continue anyway since Firestore is the source of truth
      }
      
      return true;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };
  
  // Handle save button press
  const handleSave = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      let photoURL = user?.photoURL;
      
      // Only process image if it has changed
      if (imageUri && imageUri !== user?.photoURL) {
        try {
          console.log("Processing image upload...");
          photoURL = await uploadImage(imageUri);
          console.log("Image upload completed with URL:", photoURL);
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          
          Alert.alert(
            'Profile Picture Upload Failed',
            'Could not upload profile picture. Continue with other changes?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
              { 
                text: 'Continue', 
                onPress: async () => {
                  try {
                    await updateProfileData(user?.photoURL);
                    Alert.alert(
                      'Success',
                      'Profile updated successfully (without new photo)!',
                      [
                        { 
                          text: 'OK', 
                          onPress: () => {
                            navigation.reset({
                              index: 0,
                              routes: [{ name: 'Profile', params: { forceRefresh: true } }]
                            });
                          }
                        }
                      ]
                    );
                  } catch (error) {
                    Alert.alert('Error', `Failed to update profile: ${error.message || 'Unknown error'}`);
                  } finally {
                    setLoading(false);
                  }
                }
              }
            ],
            { cancelable: false }
          );
          return;
        }
      }
      
      // Update profile with photo URL
      await updateProfileData(photoURL);
      
      Alert.alert(
        'Success',
        'Profile updated successfully!',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Reset the navigation to ensure a full refresh of Profile screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Profile', params: { forceRefresh: true, timestamp: Date.now() } }]
              });
            }
          }
        ]
      );
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', `Failed to update profile: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }
  
  return (
    <LinearGradient
      colors={['#0A0A0A', '#1A1A1A']}
      style={[styles.container, { paddingTop: insets.top }]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
    >
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{width: 24}} />
          </View>
          
          <View style={styles.profileSection}>
            <TouchableOpacity 
              style={styles.avatarContainer} 
              onPress={pickImage}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.avatarBorder}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              >
                <Image 
                  source={imageUri ? { uri: imageUri } : defaultAvatar}
                  style={styles.profileImage}
                  defaultSource={defaultAvatar}
                />
              </LinearGradient>
              
              <View style={styles.editIconWrapper}>
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.editIcon}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                >
                  <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
                </LinearGradient>
              </View>
            </TouchableOpacity>
            
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </View>
          
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="account" size={20} color="#3B82F6" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Username"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  maxLength={20}
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="badge-account" size={20} color="#3B82F6" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Display Name"
                  placeholderTextColor="#666"
                  maxLength={30}
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <View style={[styles.inputWrapper, styles.bioWrapper]}>
                <MaterialCommunityIcons 
                  name="text-box-outline" 
                  size={20} 
                  color="#3B82F6" 
                  style={[styles.inputIcon, {alignSelf: 'flex-start', marginTop: 12}]} 
                />
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={4}
                  maxLength={150}
                />
              </View>
              <Text style={styles.charCount}>{bio ? bio.length : 0}/150</Text>
            </View>
            
            <TouchableOpacity
              style={styles.saveButtonContainer}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.saveButton}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  avatarBorder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: '#222',
  },
  editIconWrapper: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  editIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0A0A0A',
  },
  changePhotoText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
    paddingLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 14,
  },
  bioWrapper: {
    alignItems: 'flex-start',
    paddingTop: 6,
    paddingBottom: 6,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
    paddingRight: 8,
  },
  saveButtonContainer: {
    marginTop: 10,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  }
});
