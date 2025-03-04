import axios from 'axios';
import { RAPIDAPI_KEY } from '@env';

const API_URL = 'https://exercisedb.p.rapidapi.com/exercises/exercise/';
const API_KEY = 'AIzaSyAfnByDnS9VNb-xXUes_AUU3J8fN4937is'; // Store securely, e.g., in .env

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
    },
});

export const getExerciseByID = async (id) => {
    try {
        const response = await api.get(`${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching exercise:', error);
        return null;
    }
};
