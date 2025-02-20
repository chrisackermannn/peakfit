function getExerciseByID(id){
    const http = require('https');

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
    
    const req = http.request(options, function (res) {
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
