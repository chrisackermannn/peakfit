import axios from 'axios';

const BASE_URL = 'https://exercisedb.p.rapidapi.com';
const API_HEADERS = {
  'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
  'x-rapidapi-key': 'a82184d89emsha842c11b6cf5139p1e194djsn505741a7d898'
};

// Fetch initial list of exercises with limit
export async function getInitialExercises(limit = 30) {
  try {
    const response = await axios.get(`${BASE_URL}/exercises?limit=${limit}`, { 
      headers: API_HEADERS 
    });
    
    // The API response already includes gifUrl for each exercise
    return response.data;
  } catch (error) {
    console.error('Error fetching initial exercises:', error);
    return [];
  }
}

// Search exercises by name
export async function searchExercises(query) {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }
    
    const response = await axios.get(
      `${BASE_URL}/exercises/name/${encodeURIComponent(query)}`,
      { headers: API_HEADERS }
    );
    
    // The API response already includes gifUrl for each exercise
    return response.data;
  } catch (error) {
    console.error('Error searching exercises:', error);
    return [];
  }
}

// Get detailed information for a specific exercise by ID
export async function getExerciseDetails(exerciseId) {
  try {
    const response = await axios.get(
      `${BASE_URL}/exercises/exercise/${exerciseId}`,
      { headers: API_HEADERS }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching exercise details:', error);
    return null;
  }
}