// Firebase Configuration
// Replace with your Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyBptvW7U80-6pgLovbYsVCaMnH96VUWAnM",
    authDomain: "weather-prediction-6c2c8.firebaseapp.com",
    projectId: "weather-prediction-6c2c8",
    storageBucket: "weather-prediction-6c2c8.firebasestorage.app",
    messagingSenderId: "172136312159",
    appId: "1:172136312159:web:6b14d5944992ca20379aea",
    databaseURL: "https://weather-prediction-6c2c8-default-rtdb.asia-southeast1.firebasedatabase.app"
};


// Initialize Firebase (only once)
let db;
let firebaseInitialized = false;

// Check if Firebase is already initialized
if (typeof firebase !== 'undefined') {
    try {
        // Check if already initialized
        if (!firebase.apps || !firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("✅ Firebase initialized successfully");
        } else {
            console.log("✅ Firebase already initialized");
        }
        db = firebase.database();
        firebaseInitialized = true;
    } catch (error) {
        console.error("❌ Firebase initialization error:", error);
        firebaseInitialized = false;
    }
} else {
    console.error("❌ Firebase SDK not loaded");
    firebaseInitialized = false;
}

// Collection/Reference names
const COLLECTIONS = {
    SENSOR_DATA: 'sensor_readings',
    WEATHER_DATA: 'weather_data',
    POLLUTION_DATA: 'pollution_data',
    ALERTS: 'alerts',
    TRENDS: 'trends',
    DAILY_AVERAGES: 'daily_averages'
};

// Clean undefined values from object
function cleanUndefinedValues(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null && !(typeof value === 'number' && isNaN(value))) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                cleaned[key] = cleanUndefinedValues(value);
            } else {
                cleaned[key] = value;
            }
        }
    }
    return cleaned;
}

// Save sensor data to Firebase
async function saveSensorDataToFirebase(data, type = 'sensor_readings') {
    if (!firebaseInitialized) {
        console.warn("Firebase not initialized, cannot save data");
        return false;
    }
    
    try {
        const timestamp = Date.now();
        const recordId = timestamp;
        
        // Clean data to remove undefined values
        const cleanData = cleanUndefinedValues(data);
        
        const record = {
            id: recordId,
            timestamp: timestamp,
            createdAt: new Date().toISOString(),
            type: type,
            data: cleanData
        };
        
        await db.ref(`${COLLECTIONS[type.toUpperCase()] || type}/${recordId}`).set(record);
        console.log(`✅ Data saved to Firebase: ${type}`);
        return true;
    } catch (error) {
        console.error("❌ Error saving to Firebase:", error);
        return false;
    }
}

// Sync ThingSpeak data to Firebase (fixed version)
async function syncToFirebase(sensorData) {
    if (!firebaseInitialized) {
        console.warn("Firebase not initialized, skipping sync");
        return false;
    }
    
    if (!sensorData || Object.keys(sensorData).length === 0) {
        console.warn("No data to sync");
        return false;
    }
    
    try {
        const timestamp = Date.now();
        const recordId = timestamp;
        
        // Extract and clean main data
        let mainData = {};
        let weatherData = {};
        let pollutionData = {};
        
        if (sensorData.main && sensorData.main.feeds && sensorData.main.feeds.length > 0) {
            const latestMain = sensorData.main.feeds[sensorData.main.feeds.length - 1];
            mainData = {
                field1: latestMain.field1 ? parseFloat(latestMain.field1) : null,
                field2: latestMain.field2 ? parseFloat(latestMain.field2) : null,
                field3: latestMain.field3 ? parseFloat(latestMain.field3) : null,
                field4: latestMain.field4 ? parseFloat(latestMain.field4) : null,
                field5: latestMain.field5 ? parseFloat(latestMain.field5) : null,
                field6: latestMain.field6 ? parseFloat(latestMain.field6) : null,
                field7: latestMain.field7 ? parseFloat(latestMain.field7) : null
            };
            
            weatherData = {
                temperature: mainData.field1,
                humidity: mainData.field2,
                pressure: mainData.field3,
                rainfall: mainData.field7
            };
            
            pollutionData = {
                pm25: mainData.field4,
                pm10: mainData.field5,
                aqi: mainData.field6
            };
        }
        
        if (sensorData.airQuality && sensorData.airQuality.feeds && sensorData.airQuality.feeds.length > 0) {
            const latestAir = sensorData.airQuality.feeds[sensorData.airQuality.feeds.length - 1];
            pollutionData.voc = latestAir.field1 ? parseFloat(latestAir.field1) : null;
            pollutionData.nox = latestAir.field2 ? parseFloat(latestAir.field2) : null;
            weatherData.light = latestAir.field3 ? parseFloat(latestAir.field3) : null;
        }
        
        // Remove null/undefined values
        weatherData = cleanUndefinedValues(weatherData);
        pollutionData = cleanUndefinedValues(pollutionData);
        
        // Save main sensor reading (only if it has data)
        if (Object.keys(mainData).length > 0 && Object.values(mainData).some(v => v !== null)) {
            const cleanMain = cleanUndefinedValues(mainData);
            await db.ref(`${COLLECTIONS.SENSOR_DATA}/${recordId}`).set({
                id: recordId,
                timestamp: timestamp,
                createdAt: new Date().toISOString(),
                data: cleanMain
            });
        }
        
        // Save weather data (only if it has data)
        if (Object.keys(weatherData).length > 0 && Object.values(weatherData).some(v => v !== null)) {
            await db.ref(`${COLLECTIONS.WEATHER_DATA}/${recordId}`).set({
                id: recordId,
                timestamp: timestamp,
                createdAt: new Date().toISOString(),
                ...weatherData
            });
        }
        
        // Save pollution data (only if it has data)
        if (Object.keys(pollutionData).length > 0 && Object.values(pollutionData).some(v => v !== null)) {
            await db.ref(`${COLLECTIONS.POLLUTION_DATA}/${recordId}`).set({
                id: recordId,
                timestamp: timestamp,
                createdAt: new Date().toISOString(),
                ...pollutionData
            });
        }
        
        console.log("✅ Data synced to Firebase at:", new Date().toISOString());
        return true;
    } catch (error) {
        console.error("❌ Error syncing to Firebase:", error);
        return false;
    }
}

// Get latest readings from Firebase
async function getLatestFromFirebase(type = 'sensor_readings', limit = 20) {
    if (!firebaseInitialized) {
        console.warn("Firebase not initialized");
        return [];
    }
    
    try {
        const snapshot = await db.ref(COLLECTIONS[type.toUpperCase()] || type)
            .orderByChild('timestamp')
            .limitToLast(limit)
            .once('value');
        
        const data = [];
        snapshot.forEach(childSnapshot => {
            data.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        return data.reverse();
    } catch (error) {
        console.error("❌ Error reading from Firebase:", error);
        return [];
    }
}

// Calculate and save daily averages
async function calculateAndSaveDailyAverages() {
    if (!firebaseInitialized) return;
    
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterdayTimestamp = yesterday.getTime();
        const todayTimestamp = today.getTime();
        
        // Get weather data from yesterday
        const snapshot = await db.ref(COLLECTIONS.WEATHER_DATA)
            .orderByChild('timestamp')
            .startAt(yesterdayTimestamp)
            .endAt(todayTimestamp - 1)
            .once('value');
        
        const readings = [];
        snapshot.forEach(childSnapshot => {
            readings.push(childSnapshot.val());
        });
        
        if (readings.length === 0) {
            console.log("No readings for yesterday");
            return;
        }
        
        // Calculate averages
        let tempSum = 0, tempCount = 0;
        let humiditySum = 0, humidityCount = 0;
        let pressureSum = 0, pressureCount = 0;
        let aqiSum = 0, aqiCount = 0;
        
        readings.forEach(reading => {
            if (reading.temperature && !isNaN(reading.temperature)) {
                tempSum += reading.temperature;
                tempCount++;
            }
            if (reading.humidity && !isNaN(reading.humidity)) {
                humiditySum += reading.humidity;
                humidityCount++;
            }
            if (reading.pressure && !isNaN(reading.pressure)) {
                pressureSum += reading.pressure;
                pressureCount++;
            }
            if (reading.aqi && !isNaN(reading.aqi)) {
                aqiSum += reading.aqi;
                aqiCount++;
            }
        });
        
        const dailyAverage = {
            date: yesterday.toISOString().split('T')[0],
            temperature: tempCount > 0 ? tempSum / tempCount : null,
            humidity: humidityCount > 0 ? humiditySum / humidityCount : null,
            pressure: pressureCount > 0 ? pressureSum / pressureCount : null,
            aqi: aqiCount > 0 ? aqiSum / aqiCount : null,
            readingsCount: readings.length
        };
        
        // Clean undefined values
        const cleanAverage = cleanUndefinedValues(dailyAverage);
        
        await db.ref(`${COLLECTIONS.DAILY_AVERAGES}/${yesterday.toISOString().split('T')[0]}`).set(cleanAverage);
        console.log("✅ Daily averages saved:", cleanAverage);
        
        return cleanAverage;
    } catch (error) {
        console.error("❌ Error calculating daily averages:", error);
    }
}

// Export Firebase functions
if (typeof window !== 'undefined') {
    window.firebaseHelpers = {
        saveSensorDataToFirebase,
        syncToFirebase,
        getLatestFromFirebase,
        calculateAndSaveDailyAverages,
        firebaseInitialized
    };
}