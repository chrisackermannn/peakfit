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
            source={require('../assets/daniel-apodaca-WdoQio6HPVA-unsplash.jpg')} 
            style={styles.background}
            resizeMode="cover"
        >
            <View style={styles.container}>
                <Text style={styles.title}>Achieve your goals with an efficient plan that adapts to your needs!</Text>
                <TouchableOpacity 
                    style={styles.button} 
                    onPress={handleGetStarted}
                >
                    <Text style={styles.buttonText}>Let's Get Started!</Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    background: {
        width: '100%',
        height: '100%',
        flex: 1,
        
    },
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0)',
    },
    title: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
        paddingHorizontal: 20,
        width: '100%',
        
    },
    button: {
        
        bottom: 10,
        backgroundColor: '#8C0410',
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 5,
        width: 380,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        
        
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
    },
});

export default Welcome;
/* Component 1 */

