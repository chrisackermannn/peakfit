import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Checkbox, RadioButton } from 'react-native-paper';

const ProfileInfoScreen = ({ navigation }) => {
    const [Sex, setSex] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [age, setAge] = useState('');
    const [goal, setGoal] = useState('');

    const handleNext = () => {
        // Add validation and registration logic here
        navigation.navigate('ExerciseLevel');
    };
    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Profile Information</Text>
            <Text style={styles.subtitle}>Where are you and what are your goals.</Text>
            <View>
                <label>What is your sex</label>
                <Checkbox
                    style={styles.radioButton}
                    value={Sex}
                    onPress={setSex}
                >
                    Male
                </Checkbox>
                <Checkbox
                    style={styles.radioButton}
                    value={Sex}
                    onPress={setSex}
                >
                    Female
                </Checkbox>
                

            </View>
        </ScrollView>

    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        color: '#555',
        marginBottom: 20,
    },
    radioButton: {
        marginTop: 20,
    },
});
export default ProfileInfoScreen;