import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const ExerciseLevelScreen = ({ navigation }) => {
    const [selectedLevel, setSelectedLevel] = useState('');

    const handleLevelSelect = (level) => {
        setSelectedLevel(level);
    };

    const handleNext = () => {
        if (!selectedLevel) {
            alert('Please select an exercise level.');
            return;
        }
        // Navigate to the next screen
        navigation.navigate('Tabs', { exerciseLevel: selectedLevel });
    };

    return (
        <View style={styles.container}>
            {/* Title */}
            <Text style={styles.title}>Select Your Exercise Level</Text>
            <Text style={styles.subtitle}>
                Choose the level that best describes your current fitness experience.
            </Text>

            {/* Exercise Level Buttons */}
            <View style={styles.levelContainer}>
                <TouchableOpacity
                    style={[
                        styles.levelButton,
                        selectedLevel === 'Beginner' && styles.selectedButton,
                    ]}
                    onPress={() => handleLevelSelect('Beginner')}
                >
                    <Text
                        style={[
                            styles.levelButtonText,
                            selectedLevel === 'Beginner' && styles.selectedButtonText,
                        ]}
                    >
                        Beginner
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.levelButton,
                        selectedLevel === 'Intermediate' && styles.selectedButton,
                    ]}
                    onPress={() => handleLevelSelect('Intermediate')}
                >
                    <Text
                        style={[
                            styles.levelButtonText,
                            selectedLevel === 'Intermediate' && styles.selectedButtonText,
                        ]}
                    >
                        Intermediate
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.levelButton,
                        selectedLevel === 'Expert' && styles.selectedButton,
                    ]}
                    onPress={() => handleLevelSelect('Expert')}
                >
                    <Text
                        style={[
                            styles.levelButtonText,
                            selectedLevel === 'Expert' && styles.selectedButtonText,
                        ]}
                    >
                        Expert
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Next Button */}
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f9f9f9',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    levelContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 40,
    },
    levelButton: {
        width: '80%',
        paddingVertical: 15,
        borderRadius: 8,
        backgroundColor: '#e0e0e0',
        alignItems: 'center',
        marginBottom: 15,
    },
    levelButtonText: {
        fontSize: 18,
        color: '#333',
    },
    selectedButton: {
        backgroundColor: '#007AFF',
    },
    selectedButtonText: {
        color: '#fff',
    },
    nextButton: {
        width: '80%',
        paddingVertical: 15,
        borderRadius: 8,
        backgroundColor: '#007AFF',
        alignItems: 'center',
    },
    nextButtonText: {
        fontSize: 18,
        color: '#fff',
        fontWeight: 'bold',
    },
});

export default ExerciseLevelScreen;