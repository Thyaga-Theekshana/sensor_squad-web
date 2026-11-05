// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBptvW7U80-6pgLovbYsVCaMnH96VUWAnM",
    authDomain: "weather-prediction-6c2c8.firebaseapp.com",
    projectId: "weather-prediction-6c2c8",
    storageBucket: "weather-prediction-6c2c8.firebasestorage.app",
    messagingSenderId: "172136312159",
    appId: "1:172136312159:web:6b14d5944992ca20379aea",
    databaseURL: "https://weather-prediction-6c2c8-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let db;
let firebaseInitialized = false;

if (typeof firebase !== 'undefined') {
    try {
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

const COLLECTIONS = {
    SENSOR_DATA: 'sensor_readings',
    WEATHER_DATA: 'weather_data',
    POLLUTION_DATA: 'pollution_data',
    ALERTS: 'alerts',
    TRENDS: 'trends',
    DAILY_AVERAGES: 'daily_averages'
};

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

async function saveSensorDataToFirebase(data, type = 'sensor_readings') {
    if (!firebaseInitialized) {
        console.warn("Firebase not initialized, cannot save data");
        return false;
    }
    try {
        const timestamp = Date.now();
        const recordId = timestamp;
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

        const snapshot = await db.ref(COLLECTIONS.WEATHER_DATA)
            .orderByChild('timestamp')
            .startAt(yesterdayTimestamp)
            .endAt(todayTimestamp - 1)
            .once('value');
        const readings = [];
        snapshot.forEach(childSnapshot => readings.push(childSnapshot.val()));
        if (readings.length === 0) return;

        let tempSum = 0, tempCount = 0, humiditySum = 0, humidityCount = 0;
        let pressureSum = 0, pressureCount = 0, aqiSum = 0, aqiCount = 0;
        readings.forEach(reading => {
            if (reading.temperature && !isNaN(reading.temperature)) { tempSum += reading.temperature; tempCount++; }
            if (reading.humidity && !isNaN(reading.humidity)) { humiditySum += reading.humidity; humidityCount++; }
            if (reading.pressure && !isNaN(reading.pressure)) { pressureSum += reading.pressure; pressureCount++; }
            if (reading.aqi && !isNaN(reading.aqi)) { aqiSum += reading.aqi; aqiCount++; }
        });
        const dailyAverage = {
            date: yesterday.toISOString().split('T')[0],
            temperature: tempCount > 0 ? tempSum / tempCount : null,
            humidity: humidityCount > 0 ? humiditySum / humidityCount : null,
            pressure: pressureCount > 0 ? pressureSum / pressureCount : null,
            aqi: aqiCount > 0 ? aqiSum / aqiCount : null,
            readingsCount: readings.length
        };
        const cleanAverage = cleanUndefinedValues(dailyAverage);
        await db.ref(`${COLLECTIONS.DAILY_AVERAGES}/${yesterday.toISOString().split('T')[0]}`).set(cleanAverage);
        console.log("✅ Daily averages saved:", cleanAverage);
        return cleanAverage;
    } catch (error) {
        console.error("❌ Error calculating daily averages:", error);
    }
}

if (typeof window !== 'undefined') {
    window.firebaseHelpers = {
        saveSensorDataToFirebase,
        getLatestFromFirebase,
        calculateAndSaveDailyAverages,
        firebaseInitialized
    };
}