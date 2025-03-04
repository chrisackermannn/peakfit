const https = require('https');

const customExercises = {
    "deadlift": {
        "id": "custom-deadlift",
        "name": "Deadlift",
        "muscle": "Back, Legs",
        "equipment": "Barbell",
        "instructions": "Stand with feet hip-width apart. Grip the barbell and lift it by extending your hips and knees."
    },
    "overhead-press": {
        "id": "custom-overhead-press",
        "name": "Overhead Press",
        "muscle": "Shoulders",
        "equipment": "Barbell",
        "instructions": "Lift the barbell from your shoulders overhead until your arms are fully extended."
    }
};

function getExerciseByID(id) {
    // Check if the exercise is in the custom database
    if (customExercises[id]) {
        console.log("Custom Exercise Found:", customExercises[id]);
        return;
    }

    // If not found locally, fetch from the API
    const options = {
        method: 'GET',
        hostname: 'exercisedb.p.rapidapi.com',
        port: null,
        path: `/exercises/exercise/${id}`,
        headers: {
            'x-rapidapi-key': 'fca3818c54msh7164d45030a5f8dp171e30jsnf70643ccdbba',
            'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
        }
    };

    const req = https.request(options, function (res) {
        const chunks = [];

        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('end', function () {
            const body = Buffer.concat(chunks);
            console.log(body.toString());
        });
    });

    req.end();
}

// Example Usage
getExerciseByID("deadlift"); // Fetches from local database
getExerciseByID("0001"); // Fetches from API
