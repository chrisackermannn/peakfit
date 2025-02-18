import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Divider } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getStats } from '../data/firebaseHelpers';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user && user.uid) {
      loadStats();
    } else {
      console.log("User not loaded yet.");
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const userStats = await getStats(user.uid);
      console.log("Fetched stats:", userStats);
      if (userStats && userStats.length > 0) {
        setStats(userStats[0]);
      } else {
        setStats({});
      }
    } catch (err) {
      console.error("Error in loadStats:", err);
      setError(err.message);
      setStats({});
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Loading user...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {/* Profile Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: user.photoURL || 'https://pbs.twimg.com/profile_images/1169607372651847688/XVap8w7n_400x400.jpg' }}
          style={styles.profileImage}
        />
        <Text style={styles.name}>{user.displayName || 'User'}</Text>
        <Text style={styles.bio}>Fitness Enthusiast | Strength Training | 175 lbs Goal</Text>
        <Button
          mode="contained"
          style={styles.editProfileButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          Edit Profile
        </Button>
      </View>

      <Divider style={styles.divider} />

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {stats && stats.weight ? stats.weight : '--'}
          </Text>
          <Text style={styles.statLabel}>Weight (lbs)</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>120</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {stats && stats.bodyFat ? stats.bodyFat : '--'}
          </Text>
          <Text style={styles.statLabel}>Body Fat %</Text>
        </View>
      </View>

      <Divider style={styles.divider} />

      {/* Measurements Section */}
      {stats && stats.measurements && (
        <View style={styles.measurementsContainer}>
          <Text style={styles.sectionTitle}>Body Measurements</Text>
          <View style={styles.measurementsGrid}>
            <View style={styles.measurementBox}>
              <Text style={styles.measurementValue}>
                {stats.measurements.chest || '--'}"
              </Text>
              <Text style={styles.measurementLabel}>Chest</Text>
            </View>
            <View style={styles.measurementBox}>
              <Text style={styles.measurementValue}>
                {stats.measurements.waist || '--'}"
              </Text>
              <Text style={styles.measurementLabel}>Waist</Text>
            </View>
            <View style={styles.measurementBox}>
              <Text style={styles.measurementValue}>
                {stats.measurements.arms || '--'}"
              </Text>
              <Text style={styles.measurementLabel}>Arms</Text>
            </View>
            <View style={styles.measurementBox}>
              <Text style={styles.measurementValue}>
                {stats.measurements.legs || '--'}"
              </Text>
              <Text style={styles.measurementLabel}>Legs</Text>
            </View>
          </View>
        </View>
      )}

      <Divider style={styles.divider} />

      {/* Settings Section */}
      <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('AccountSettings')}>
        <Text style={styles.optionText}>Account Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('PrivacySettings')}>
        <Text style={styles.optionText}>Privacy Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={logout}>
        <Text style={[styles.optionText, { color: 'red' }]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
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
  measurementsContainer: { marginVertical: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  measurementsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  measurementBox: { width: '48%', backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  measurementValue: { fontSize: 18, fontWeight: 'bold' },
  measurementLabel: { fontSize: 14, color: '#777', marginTop: 5 },
  option: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  optionText: { fontSize: 16 },
  errorText: { color: 'red', textAlign: 'center', marginBottom: 10 },
});
