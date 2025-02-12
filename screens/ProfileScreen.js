import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Button, Divider } from 'react-native-paper';

export default function ProfileScreen({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://pbs.twimg.com/profile_images/1169607372651847688/XVap8w7n_400x400.jpg' }} // Placeholder profile image
          style={styles.profileImage}
        />
        <Text style={styles.name}>Chris Ackermann</Text>
        <Text style={styles.bio}>Fitness Enthusiast | Strength Training | 175 lbs Goal</Text>
        <Button mode="contained" style={styles.editProfileButton} onPress={() => navigation.navigate('EditProfile')}>
          Edit Profile
        </Button>
      </View>

      <Divider style={styles.divider} />

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>120</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>35</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>45</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
      </View>

      <Divider style={styles.divider} />

      {/* Settings Section */}
      <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('AccountSettings')}>
        <Text style={styles.optionText}>Account Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('PrivacySettings')}>
        <Text style={styles.optionText}>Privacy Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={() => console.log('Logging out...')}>
        <Text style={[styles.optionText, { color: 'red' }]}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { alignItems: 'center', marginBottom: 20 },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  name: { fontSize: 22, fontWeight: 'bold' },
  bio: { fontSize: 14, color: '#777', textAlign: 'center', marginVertical: 5 },
  editProfileButton: { marginTop: 10, backgroundColor: '#007AFF' },
  divider: { marginVertical: 15, height: 1, backgroundColor: '#ddd' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 14, color: '#777' },
  option: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  optionText: { fontSize: 16 },
});
