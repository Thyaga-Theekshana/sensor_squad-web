// netlify/functions/ingest-weather.js
// This receives data from your SIM800L and forwards to Firebase

exports.handler = async (event) => {
    // Only allow POST requests (your SIM800L will send POST)
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
        };
    }

    try {
        // Parse the weather data from SIM800L
        const weatherData = JSON.parse(event.body);
        
        console.log('Received weather data:', weatherData);
        
        // REPLACE THIS WITH YOUR ACTUAL FIREBASE URL!
        const FIREBASE_DB_URL = 'https://weather-prediction-6c2c8-default-rtdb.asia-southeast1.firebasedatabase.app/';
        
        // Forward data to Firebase Realtime Database
        const response = await fetch(`${FIREBASE_DB_URL}/weather_data.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                temperature: weatherData.temp,
                humidity: weatherData.humidity,
                pressure: weatherData.pressure,
                timestamp: Date.now()
            })
        });
        
        const result = await response.json();
        
        // Return success to SIM800L
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: 'Weather data saved',
                id: result.name 
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};