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
          disabled={loading}
          style={styles.saveButton}
        >
          Save Profile
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    paddingTop: 30,
  },
  imageContainer: {
    position: 'relative',
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    marginBottom: 30,
    backgroundColor: '#2A2A2A',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  editBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    width: '90%',
    maxWidth: 400,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#FFF',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#FFF',
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
