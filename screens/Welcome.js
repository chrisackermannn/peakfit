import React from 'react';
import { View, Text, Button, StyleSheet, ImageBackground } from 'react-native';

const Welcome = ({ navigation }) => {
    return (
        <ImageBackground 
            source={{ uri: 'https://example.com/your-gif.gif' }} 
            style={styles.background}
        >
            <View style={styles.container}>
                <Text style={styles.title}>Welcome to PeakFit</Text>
                <Button 
                    title="Get Started" 
                    onPress={() => navigation.navigate('NextScreen')} 
                />
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    title: {
        fontSize: 24,
        color: '#fff',
        marginBottom: 20,
    },
});

export default Welcome;