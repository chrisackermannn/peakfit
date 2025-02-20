const https = require('https');

const options = {
    method: 'GET',
    hostname: 'exercisedb.p.rapidapi.com',
    port: null,
    path: '/exercises?limit=10&offset=0',
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
        const data = body.toString();
        const jsonData = JSON.parse(data);
        console.log(jsonData);
    });
});

req.on('error', function (e) {
    console.error(`Problem with request: ${e.message}`);
});

req.end();