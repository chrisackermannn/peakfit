import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ProfileInfoScreen = ({ navigation }) => {
    const [sex, setSex] = useState('');
    const [height, setHeight] = useState('');
    const [heightUnit, setHeightUnit] = useState('cm'); // Default metric system for height
    const [weight, setWeight] = useState('');
    const [weightUnit, setWeightUnit] = useState('kg'); // Default metric system for weight
    const [goal, setGoal] = useState('');
    const [goalUnit, setGoalUnit] = useState('kg'); // Default metric system for goal weight

    const handleNext = () => {
        if (!sex || !height || !weight || !goal) {
            alert('Please fill in all fields.');
            return;
        }
        navigation.navigate('ExerciseLevel');
    };

    return (
        <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                {/* Title and Subtitle */}
                <Text style={styles.title}>Profile Information</Text>
                <Text style={styles.subtitle}>Where are you and what are your goals?</Text>

                {/* Sex Selection */}
                <Text style={styles.label}>What is your sex?</Text>
                <View style={styles.checkboxContainer}>
                    <TouchableOpacity
                        style={[
                            styles.checkbox,
                            sex === 'Male' && styles.selectedCheckbox,
                        ]}
                        onPress={() => setSex('Male')}
                    >
                        <Text
                            style={[
                                styles.checkboxText,
                                sex === 'Male' && styles.selectedCheckboxText,
                            ]}
                        >
                            Male
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.checkbox,
                            sex === 'Female' && styles.selectedCheckbox,
                        ]}
                        onPress={() => setSex('Female')}
                    >
                        <Text
                            style={[
                                styles.checkboxText,
                                sex === 'Female' && styles.selectedCheckboxText,
                            ]}
                        >
                            Female
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Height Input */}
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Height"
                        value={height}
                        onChangeText={setHeight}
                        keyboardType="numeric"
                    />
                    <TouchableOpacity
                        style={styles.dropdown}
                        onPress={() =>
                            setHeightUnit((prev) => (prev === 'cm' ? 'in' : 'cm'))
                        }
                    >
                        <Text style={styles.dropdownText}>{heightUnit}</Text>
                    </TouchableOpacity>
                </View>

                {/* Weight Input */}
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Weight"
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="numeric"
                    />
                    <TouchableOpacity
                        style={styles.dropdown}
                        onPress={() =>
                            setWeightUnit((prev) => (prev === 'kg' ? 'lb' : 'kg'))
                        }
                    >
                        <Text style={styles.dropdownText}>{weightUnit}</Text>
                    </TouchableOpacity>
                </View>

                {/* Goal Weight Input */}
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Weight Goal"
                        value={goal}
                        onChangeText={setGoal}
                        keyboardType="numeric"
                    />
                    <TouchableOpacity
                        style={styles.dropdown}
                        onPress={() =>
                            setGoalUnit((prev) => (prev === 'kg' ? 'lb' : 'kg'))
                        }
                    >
                        <Text style={styles.dropdownText}>{goalUnit}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Footer with Back and Next Buttons */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#555',
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    checkboxContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    checkbox: {
        flex: 1,
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    selectedCheckbox: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    checkboxText: {
        fontSize: 16,
        color: '#555',
    },
    selectedCheckboxText: {
        color: '#fff',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    input: {
        flex: 1,
        padding: 15,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        marginRight: 10,
    },
    dropdown: {
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        backgroundColor: '#f2f2f2',
    },
    dropdownText: {
        fontSize: 16,
        color: '#555',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
        backgroundColor: '#fff',
    },
    backButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f2f2f2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextButton: {
        flex: 1,
        marginLeft: 20,
        backgroundColor: '#007AFF',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    nextButtonText: {
        fontSize: 18,
        color: '#fff',
        fontWeight: 'bold',
    },
});

export default ProfileInfoScreen;