import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ShadowCard from '../components/ShadowCard';

const Welcome = ({ navigation }) => {
    useEffect(() => {
        const checkLoginStatus = async () => {
            const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
            if (isLoggedIn === 'True') {
                navigation.replace('Home'); // Navigate to Home screen if already logged in
            }
        };
        checkLoginStatus();
    }, [navigation]);

    const handleGetStarted = async () => {
        await AsyncStorage.setItem('hasLaunched', 'true');
        navigation.navigate('Login'); // Navigate to Login screen
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>PeakFit</Text>
                <Text style={styles.subtitle}>Your Fitness Journey Starts Here</Text>
            </View>
            
            <View style={styles.featuresContainer}>
                <ShadowCard>
                    <View style={styles.featureItem}>
                        <MaterialCommunityIcons name="dumbbell" size={42} color="#3B82F6" />
                        <Text style={styles.featureTitle}>Track Workouts</Text>
                        <Text style={styles.featureText}>
                            Log and analyze your workouts to optimize performance and track progress
                        </Text>
                    </View>
                </ShadowCard>
                
                <View style={styles.featureItem}>
                    <MaterialCommunityIcons name="chart-line" size={42} color="#3B82F6" />
                    <Text style={styles.featureTitle}>Monitor Progress</Text>
                    <Text style={styles.featureText}>
                        Visualize your fitness journey with detailed metrics and insights
                    </Text>
                </View>
                
                <View style={styles.featureItem}>
                    <MaterialCommunityIcons name="account-group" size={42} color="#3B82F6" />
                    <Text style={styles.featureTitle}>Join Community</Text>
                    <Text style={styles.featureText}>
                        Connect with like-minded fitness enthusiasts and share achievements
                    </Text>
                </View>
            </View>
            
            <View style={styles.footer}>
                <TouchableOpacity 
                    style={styles.button} 
                    onPress={handleGetStarted}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>Get Started</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 40,
        alignItems: 'center',
    },
    title: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 18,
        color: '#BBBBBB',
        textAlign: 'center',
    },
    featuresContainer: {
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    featureItem: {
        backgroundColor: '#141414',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        alignItems: 'center',
    },
    featureTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: 16,
        marginBottom: 8,
    },
    featureText: {
        fontSize: 16,
        color: '#BBBBBB',
        textAlign: 'center',
        lineHeight: 22,
    },
    footer: {
        padding: 30,
        alignItems: 'center',
    },
    button: {
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    }
});

export default Welcome;