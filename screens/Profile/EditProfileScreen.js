import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Button } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, uploadString } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../../Firebase/firebaseConfig';
import { useAuth } from '../../context/AuthContext';

const defaultAvatar = require('../../assets/default-avatar.png');

export default function EditProfileScreen({ navigation }) {
  const { user, updateUserProfile } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [imageUri, setImageUri] = useState(user?.photoURL || null);
  const [loading, setLoading] = useState(false);
  
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
        mediaType: 'photo',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true, // Request base64 data for web upload workaround
      });
      
      if (!result.canceled && result.assets?.[0]?.uri) {
        const selectedUri = result.assets[0].uri;
        console.log("Image selected:", selectedUri);
        setImageUri(selectedUri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Use the direct upload method for simplicity and reliability
  const uploadImage = async (uri) => {
    try {
      setLoading(true);
      
      // If URI is unchanged, skip upload
      if (uri === user?.photoURL) {
        console.log("Photo URL unchanged, skipping upload");
        return uri;
      }
      
      console.log("Starting image upload process...");
      
      // For web platform uploads - use a CORS friendly approach
      if (Platform.OS === 'web') {
        try {
          // Create a unique filename based on userId and timestamp
          const timestamp = Date.now();
          const filename = `profile_${user.uid}_${timestamp}.jpg`;
          const fullPath = `profilePics/${user.uid}/${filename}`;
          
          // Reference to where the file will be stored
          const storageRef = ref(storage, fullPath);
          
          console.log(`Uploading to Firebase: ${fullPath}`);
          
          // Get base64 data from the image
          // This approach bypasses the CORS issue by not making a fetch request
          let base64Data;
          
          if (uri.startsWith('data:')) {
            // The URI is already a base64 data URL
            base64Data = uri.split(',')[1];
          } else {
            // Try to get the base64 from the picker result
            // This requires setting base64: true in launchImageLibraryAsync options
            const response = await fetch(uri);
            const blob = await response.blob();
            const reader = new FileReader();
            
            // Convert blob to base64
            base64Data = await new Promise((resolve) => {
              reader.onloadend = () => {
                const base64String = reader.result;
                resolve(base64String.split(',')[1]);
              };
              reader.readAsDataURL(blob);
            });
          }
          
          // Upload as base64 string - this avoids CORS issues
          await uploadString(storageRef, base64Data, 'base64', {
            contentType: 'image/jpeg',
          });
          
          // Get download URL
          const downloadURL = await getDownloadURL(storageRef);
          console.log("Upload successful, download URL:", downloadURL);
          return downloadURL;
        }
        catch (error) {
          console.error("Web upload error:", error);
          throw error;
        }
      }

      // For native platforms
      console.log("Starting native image upload...");
      
      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.size > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5MB');
      }
      
      // Get image data
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create a unique filename
      const timestamp = Date.now();
      const filename = `profile_${user.uid}_${timestamp}.jpg`;
      const fullPath = `profilePics/${user.uid}/${filename}`;
      
      // Reference to storage location
      const storageRef = ref(storage, fullPath);
      
      // Set proper metadata for storage rules
      const metadata = {
        contentType: 'image/jpeg',
        customMetadata: {
          userId: user.uid,
          uploadedAt: new Date().toISOString()
        }
      };
      
      console.log(`Uploading to: ${fullPath}`);
      
      // Upload with resumable support for mobile
      const uploadTask = await uploadBytesResumable(storageRef, blob, metadata);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      
      console.log("Upload successful, URL:", downloadURL);
      return downloadURL;
    }
    catch (error) {
      console.error("Image upload failed:", error);
      
      // Provide a fallback link if image upload fails
      // Return user's existing photo URL or default image URL
      console.log("Using fallback URL due to upload failure");
      return user.photoURL || null;
    }
    finally {
      setLoading(false);
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

  // Update profile data in Firestore and Auth
  const updateProfileData = async (photoURL) => {
    try {
      console.log(`Updating profile with photo URL: ${photoURL}`);
      
      // First, update Firestore document
      const userRef = doc(db, 'users', user.uid);
      const updateData = {
        username: username.toLowerCase(),
        displayName: displayName || username,
        bio: bio || '',
        photoURL: photoURL || null,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(userRef, updateData);
      console.log("Firestore document updated successfully");
      
      // Then update Auth profile
      await updateUserProfile({
        displayName: displayName || username,
        photoURL: photoURL || null,
        username: username.toLowerCase(),
        bio: bio || ''
      });
      
      console.log("Auth profile updated successfully");
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
          photoURL = await uploadImage(imageUri);
        } catch (error) {
          console.error('Upload error:', error);
          Alert.alert(
            'Image Upload Error',
            'Failed to upload profile picture. Do you want to continue with other profile changes?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
              { 
                text: 'Continue', 
                onPress: async () => {
                  try {
                    await updateProfileData(user?.photoURL);
                    Alert.alert('Profile Updated', 'Your profile was updated without changing the photo.');
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Profile', params: { forceRefresh: true } }]
                    });
                  } catch (err) {
                    Alert.alert('Error', 'Failed to update profile.');
                  } finally {
                    setLoading(false);
                  }
                }
              }
            ]
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
              // Use navigation reset to ensure we go back to Profile properly
              navigation.reset({
                index: 0,
                routes: [{ name: 'Profile', params: { forceRefresh: true } }]
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
