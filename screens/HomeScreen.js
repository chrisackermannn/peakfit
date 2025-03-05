// HomeScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image,
  SafeAreaView,
  ScrollView,
  Platform 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, addDays, subDays } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

const defaultAvatar = require('../assets/default-avatar.png');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dates = [-3, -2, -1, 0, 1, 2, 3].map(diff => addDays(new Date(), diff));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dayText}>{format(selectedDate, 'EEEE')}</Text>
            <Text style={styles.dateText}>{format(selectedDate, 'MMM d, yyyy')}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.messageButton}>
              <MaterialCommunityIcons name="message-outline" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Profile')}
              style={styles.profileButton}
            >
              <Image 
                source={user?.photoURL ? { uri: user.photoURL } : defaultAvatar}
                style={styles.profileImage}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Selector */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.dateSelector}
        >
          {dates.map((date, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dateItem,
                date.toDateString() === selectedDate.toDateString() && styles.dateItemActive
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={styles.dateNumber}>{format(date, 'd')}</Text>
              <Text style={styles.dateDay}>{format(date, 'EEE')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Main Card */}
        <Surface style={styles.workoutCard}>
          <Text style={styles.workoutTitle}>Exercise AI API</Text>
          <Text style={styles.workoutSubtitle}>Coming Soon</Text>
        </Surface>

        {/* Steps Section */}
        <Surface style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Steps API</Text>
          <Text style={styles.stepsSubtitle}>Coming Soon</Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  dayText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageButton: {
    marginRight: 12,
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  dateSelector: {
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  dateItem: {
    width: 65,
    height: 80,
    backgroundColor: '#fff',
    marginRight: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
    })
  },
  dateItemActive: {
    backgroundColor: '#e3f2fd', // Changed from #d3d3d3
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  dateDay: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  workoutCard: {
    backgroundColor: '#e3f2fd', // Changed from #d3d3d3
    margin: 20,
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    })
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  workoutSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  startButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 20,
    marginTop: 20,
  },
  stepsCard: {
    backgroundColor: '#e3f2fd', // Changed from #d3d3d3
    margin: 20,
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    })
  },
  comingSoonText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  stepsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  stepsSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
});