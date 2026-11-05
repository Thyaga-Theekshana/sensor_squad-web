// multi-channel-config.js - Firebase-only configuration
const CHART_CONFIG = {
    weather: { name: "Weather Parameters", icon: "fa-cloud-sun", chartIds: ['temp', 'humidity', 'pressure', 'rainfall', 'light', 'windSpeed', 'windDirection'] },
    pollution: { name: "Air Quality & Pollution", icon: "fa-smog", chartIds: ['pm25', 'pm10', 'aqi', 'voc', 'nox','co','co2'] }
};
const CHART_DISPLAY_CONFIG = {
    'temp': { name: "Temperature", unit: "°C", color: "#ff4757", category: "weather" },
    'humidity': { name: "Humidity", unit: "%", color: "#3742fa", category: "weather" },
    'pressure': { name: "Pressure", unit: "hPa", color: "#1abc9c", category: "weather" },
    'rainfall': { name: "Rainfall", unit: "mm", color: "#3498db", category: "weather" },
    'light': { name: "Light Intensity", unit: "lux", color: "#f1c40f", category: "weather" },
    'windSpeed': { 
    name: "Wind Speed", 
    unit: "m/s", 
    color: "#00ff88", 
    category: "weather" 
},

'windDirection': { 
    name: "Wind Direction", 
    unit: "°", 
    color: "#ff00ff", 
    category: "weather" 
},
    'aqi': { name: "AQI", unit: "", color: "#4da6ff", category: "pollution" },
    'pm25': { name: "PM2.5", unit: "µg/m³", color: "#ff6b6b", category: "pollution" },
    'pm10': { name: "PM10", unit: "µg/m³", color: "#ffa726", category: "pollution" },
    'voc': { name: "VOC", unit: "ppb", color: "#f39c12", category: "pollution" },
    'nox': { name: "NOx", unit: "ppb", color: "#e74c3c", category: "pollution" },
    'co2': { name: "CO₂", unit: "ppm", color: "#00e676", category: "pollution" },
    'co':  { name: "CO", unit: "ppm", color: "#9b59b6", category: "pollution" },
};
function formatSensorValue(value, unit) {
    if (value === null || value === undefined || isNaN(value)) return '--';
    if (unit === 'hPa') return value.toFixed(0);
    if (unit === 'lux') return value.toFixed(0);
    if (unit === 'mm') return value.toFixed(1);
    if (unit === '') return Math.round(value);
    return value.toFixed(1);
}