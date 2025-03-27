import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Button } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../Firebase/firebaseConfig';
import { useAuth } from '../../context/AuthContext';

const defaultAvatar = require('../../assets/default-avatar.png');
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB in bytes

// The configured path where storage-resize-images extension stores resized images
// This needs to match your extension configuration
const RESIZED_IMAGES_PATH = 'resized-images';

export default function EditProfileScreen({ navigation }) {
  const { user, updateUserProfile } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [imageUri, setImageUri] = useState(user?.photoURL || null);
  const [loading, setLoading] = useState(false);
  const [isWebDev] = useState(() => 
    Platform.OS === 'web' && 
    (window?.location?.hostname === 'localhost' || window?.location?.hostname === '127.0.0.1')
  );
  
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
        quality: isWebDev ? 0.05 : 0.6, // Reduced quality since the resize extension will handle resizing
        base64: isWebDev, // Request base64 for web development
      });

      if (!result.canceled && result.assets?.[0]) {
        if (isWebDev && result.assets[0].base64) {
          // For web dev, use data URI to avoid CORS and blob URL issues
          const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
          setImageUri(dataUri);
          console.log("Using base64 data URI for web development");
        } else {
          // For native or production, use the URI
          setImageUri(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.log('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Generate a placeholder URL for web development
  const generatePlaceholderUrl = (userId) => {
    return `https://placeholder-profile-${userId}-${Date.now()}.jpg`;
  };

  // Upload image to Firebase Storage
  const uploadImage = async (uri) => {
    if (!user?.uid) throw new Error('User not found');
    
    // For web development, use localStorage instead of Firebase Storage
    if (isWebDev && uri.startsWith('data:')) {
      console.log("Web development environment detected - using placeholder with localStorage");
      
      // Generate a placeholder URL - this will be stored in Firestore
      const placeholderUrl = generatePlaceholderUrl(user.uid);
      
      // Store the actual data URI in localStorage
      try {
        localStorage.setItem(`profile_image_${user.uid}`, uri);
        console.log("Image data URI saved to localStorage");
        
        // Return the placeholder URL for storage in Firestore
        return placeholderUrl;
      } catch (e) {
        console.warn("Failed to save image to localStorage:", e);
        throw new Error('Failed to store image locally');
      }
    }
    
    // For native or production, upload to Firebase Storage using the resize extension
    try {
      // Create blob from URI
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Check file size
      if (blob.size > MAX_IMAGE_SIZE) {
        Alert.alert('Image Too Large', 'Please choose an image under 3MB');
        throw new Error('Image file is too large (max 3MB)');
      }
      
      // Upload to specific path that triggers the resize extension
      const storage = getStorage();
      // Path format that will trigger the storage-resize-images extension
      // The exact path depends on your extension configuration
      const userProfilePath = `profile-images/${user.uid}`;
      const filename = `profile_${Date.now()}.jpg`;
      const storageRef = ref(storage, `${userProfilePath}/${filename}`);
      
      // Upload the image
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);
        
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
              // Get URL of the original uploaded file
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Original file uploaded successfully. URL:', downloadURL);
              
              // The extension will create resized versions in a path like:
              // resized-images/{userProfilePath}/{filename}_200x200
              // Wait a moment for the resize operation to complete
              setTimeout(async () => {
                try {
                  // Construct the path to the resized image (based on extension config)
                  // This assumes a 200x200 resize configuration in your extension
                  const resizedRef = ref(storage, `${RESIZED_IMAGES_PATH}/${userProfilePath}/${filename}_200x200`);
                  const resizedURL = await getDownloadURL(resizedRef);
                  console.log('Resized image URL:', resizedURL);
                  resolve(resizedURL);
                } catch (resizeError) {
                  console.warn('Could not get resized image, using original:', resizeError);
                  // Fall back to the original URL if resized version isn't available
                  resolve(downloadURL);
                }
              }, 2000); // Wait 2 seconds for resize operation to complete
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
      
      // Add photoURL if it changed (but never the full data URI)
      if (photoURL && photoURL !== user.photoURL) {
        // Make sure we're not storing a full data URI in Firestore
        if (!photoURL.startsWith('data:')) {
          updateData.photoURL = photoURL;
        }
      }
      
      await updateDoc(userRef, updateData);
      console.log("Firestore document updated successfully");
      
      // Update Auth
      try {
        // For Auth updates, don't include photo URL in web dev mode
        if (isWebDev) {
          await updateUserProfile({
            displayName: displayName || username,
            username: username.toLowerCase(),
            bio: bio || ''
            // Omit the photoURL for Auth in web dev mode
          });
          console.log("Auth profile updated (without photo URL for web dev)");
        } else {
          // For native or production, update everything
          await updateUserProfile({
            displayName: displayName || username,
            username: username.toLowerCase(),
            bio: bio || '',
            photoURL: photoURL
          });
          console.log("Auth profile fully updated with photo URL");
        }
        
        // Force refresh of the local user context
        await refreshUserData();
      } catch (authError) {
        console.warn("Auth update error:", authError.message);
      }
      
      return true;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  // Get fresh user data
  const refreshUserData = async () => {
    if (!user?.uid) return;
    
    try {
      // Get the latest data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // In web dev, check if we have a stored image in localStorage
        let photoURL = userData.photoURL;
        if (isWebDev) {
          const storedImage = localStorage.getItem(`profile_image_${user.uid}`);
          if (storedImage && storedImage.startsWith('data:')) {
            // Use the locally stored image instead of the Firestore URL
            photoURL = storedImage;
          }
        }
        
        // Update the local user context - including local image if in web dev
        await updateUserProfile({
          ...user,
          displayName: userData.displayName || userData.username,
          username: userData.username,
          bio: userData.bio || '',
          photoURL: photoURL
        });
        
        console.log("User data refreshed from Firestore");
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
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
    <View style={styles.container}>
      <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
        <Image 
          source={imageUri ? { uri: imageUri } : defaultAvatar}
          style={styles.profileImage}
          defaultSource={defaultAvatar}
        />
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>Change Photo</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            autoCapitalize="none"
            maxLength={20}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display Name"
            maxLength={30}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself"
            multiline
            numberOfLines={4}
            maxLength={150}
          />
        </View>
        
        {isWebDev && (
          <Text style={styles.devNote}>
            Note: In web development mode, profile pictures are saved locally to your browser.
          </Text>
        )}
        
        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          style={styles.saveButton}
          disabled={loading}
        >
          Save Changes
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 20,
    position: 'relative',
    width: 150,
    height: 150,
    alignSelf: 'center',
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  devNote: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    borderRadius: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
