import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const ExerciseLevelScreen = ({ navigation }) => {
    const [exerciseLevel, setExerciseLevel] = useState('');

    const handleNext = () => {
        // Add validation and logic here
        navigation.navigate('Tabs');
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Exercise Level</Text>
            <Text style={styles.subtitle}>This will determine how to build an effective routine for you.</Text>
            <View style={styles.button_container}>

                <button style={styles.button} onPress={setExerciseLevel}>Beginner</button>
                <button style={styles.button} onPress={setExerciseLevel}>Intermediate</button>
                <button style={styles.button} onPress={setExerciseLevel}>Expert</button>

            </View> 
            <TouchableOpacity style={styles.button} onPress={handleNext}>
                <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 20,
    },
    input_container: {
        marginBottom: 20,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 15,
        borderRadius: 5,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
    },
    button_container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
});

export default ExerciseLevelScreen;