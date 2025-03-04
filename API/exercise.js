const axios = require('axios');

async function getExerciseByID(id) {
    const options = {
        method: 'GET',
        url: `https://exercisedb.p.rapidapi.com/exercises/exercise/${id}`,
        headers: {
            'x-rapidapi-key': 'YOAIzaSyAfnByDnS9VNb-xXUes_AUU3J8fN4937is',
            'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        console.log(response.data);
        return response.data;  // Return data to be used in the mobile app
    } catch (error) {
        console.error(error);
    }
}
