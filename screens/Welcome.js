import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Welcome = ({ navigation }) => {
    useEffect(() => {
        const checkLoginStatus = async () => {
            const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
            if (isLoggedIn === 'True') {
                navigation.navigate('Login'); // Navigate to login screen if user is logged in
            }
        };
        checkLoginStatus();
    }, []);

    const handleGetStarted = async () => {
        await AsyncStorage.setItem('hasLaunched', 'true');
        navigation.navigate('Login'); // or 'Tabs' if you want to skip the login screen
    };

    return (
        <ImageBackground 
            source={{ uri: 'http://media.tumblr.com/tumblr_m9e6d99lpi1ro2d43.gif' }} 
            style={styles.background}
        >
            <View style={styles.container}>
                <Text style={styles.title}>Welcome to PeakFit</Text>
                <TouchableOpacity 
                    style={styles.button} 
                    onPress={handleGetStarted}
                >
                    <Text style={styles.buttonText}>Get Started</Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0)',
    },
    title: {
        fontSize: 40,
        color: '#fff',
        marginBottom: 20,
    },
    button: {
        position: 'absolute',
        bottom: 20,
        backgroundColor: '#65558F',
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 5,
        width: 400,
        alignItems: 'center',
        
        
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
    },
});

export default Welcome;