import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Button } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../../Firebase/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import * as FileSystem from 'expo-file-system';

const defaultAvatar = require('../../assets/default-avatar.png');

export default function EditProfileScreen({ navigation }) {
  const { user, updateUserProfile } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [imageUri, setImageUri] = useState(user?.photoURL || null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable photo library access to change your profile picture',
        [{ text: 'OK' }]
      );
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const uploadImage = async (uri) => {
    try {
      setLoading(true);

      // 1. Get file info and validate size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.size > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5MB');
      }

      // 2. Get file extension
      const fileExtension = uri.split('.').pop() || 'jpg';
      const contentType = `image/${fileExtension.toLowerCase()}`;

      // 3. Convert to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // 4. Create unique filename
      const filename = `profile_${Date.now()}.${fileExtension}`;
      const fullPath = `profilePics/${user.uid}/${filename}`;

      // 5. Create storage reference
      const storageRef = ref(storage, fullPath);

      // 6. Set proper metadata
      const metadata = {
        contentType: contentType,
        customMetadata: {
          userId: user.uid,
          uploadedAt: new Date().toISOString()
        }
      };

      // 7. Start upload with proper error handling
      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error('Upload error details:', error);
            switch (error.code) {
              case 'storage/unauthorized':
                reject(new Error('Not authorized'));
                break;
              case 'storage/canceled':
                reject(new Error('Upload canceled'));
                break;
              case 'storage/unknown':
                reject(new Error(`Server Error: ${error.serverResponse}`));
                break;
              default:
                reject(error);
            }
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              reject(new Error('Failed to get download URL'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

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

  const updateProfileData = async (photoURL) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      
      const updateData = {
        username: username.toLowerCase(),
        displayName: displayName || username,
        bio: bio || '',
        photoURL,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updateData);
      await updateUserProfile({
        displayName: displayName || username,
        photoURL,
        username: username.toLowerCase(),
        bio: bio || ''
      });

      return true;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      let photoURL = user?.photoURL;

      if (imageUri && imageUri !== user?.photoURL) {
        try {
          photoURL = await uploadImage(imageUri);
          console.log('Upload successful:', photoURL);
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert(
            'Upload Error',
            'Failed to upload profile picture. Would you like to continue updating other profile information?',
            [
              { 
                text: 'Cancel', 
                style: 'cancel',
                onPress: () => setLoading(false)
              },
              {
                text: 'Continue',
                onPress: async () => {
                  try {
                    await updateProfileData(user?.photoURL);
                    Alert.alert('Success', 'Profile updated without new photo');
                    navigation.goBack();
                  } catch (error) {
                    Alert.alert('Error', 'Failed to update profile: ' + error.message);
                  }
                }
              }
            ]
          );
          return;
        }
      }

      await updateProfileData(photoURL);
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert(
        'Error',
        error.code === 'storage/unknown' 
          ? 'Failed to upload image. Please try a different image or try again later.'
          : error.message
      );
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
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  editBadge: {
    position: 'absolute',
    right: 100,
    bottom: 10,
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
