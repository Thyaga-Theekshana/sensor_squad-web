// multi-channel-config.js
// Firebase-only configuration - ThingSpeak removed

// Firebase configuration (already in firebase-config.js)
// This file now only contains chart configuration for display

// Chart display configuration (for UI only)
const CHART_CONFIG = {
    weather: {
        name: "Weather Parameters",
        icon: "fa-cloud-sun",
        chartIds: ['temp', 'humidity', 'pressure', 'rainfall', 'light']
    },
    pollution: {
        name: "Air Quality & Pollution",
        icon: "fa-smog",
        chartIds: ['pm25', 'pm10', 'aqi', 'voc', 'nox']
    }
};

// Chart ID to display settings mapping
const CHART_DISPLAY_CONFIG = {
    'temp': { name: "Temperature", unit: "°C", color: "#ff4757", category: "weather" },
    'humidity': { name: "Humidity", unit: "%", color: "#3742fa", category: "weather" },
    'pressure': { name: "Pressure", unit: "hPa", color: "#1abc9c", category: "weather" },
    'rainfall': { name: "Rainfall", unit: "mm", color: "#3498db", category: "weather" },
    'light': { name: "Light Intensity", unit: "lux", color: "#f1c40f", category: "weather" },
    'aqi': { name: "AQI", unit: "", color: "#4da6ff", category: "pollution" },
    'pm25': { name: "PM2.5", unit: "µg/m³", color: "#ff6b6b", category: "pollution" },
    'pm10': { name: "PM10", unit: "µg/m³", color: "#ffa726", category: "pollution" },
    'voc': { name: "VOC", unit: "ppb", color: "#f39c12", category: "pollution" },
    'nox': { name: "NOx", unit: "ppb", color: "#e74c3c", category: "pollution" }
};

// Helper function to format values
function formatSensorValue(value, unit) {
    if (value === null || value === undefined || isNaN(value)) return '--';
    if (unit === 'hPa') return value.toFixed(0);
    if (unit === 'lux') return value.toFixed(0);
    if (unit === 'mm') return value.toFixed(1);
    if (unit === '') return Math.round(value);
    return value.toFixed(1);
}