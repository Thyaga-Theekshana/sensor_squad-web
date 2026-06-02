// script.js
// Main dashboard with Firebase Realtime Database only

// Firebase helpers are loaded from firebase-config.js
let currentSensorData = {
    temperature: null,
    humidity: null,
    pressure: null,
    pm25: null,
    pm10: null,
    aqi: null,
    rainfall: null,
    voc: null,
    nox: null,
    light: null
};

// Chart instances
let weatherChart = null;
let pollutionChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log("Dashboard initialized with Firebase");
    updateTime();
    setInterval(updateTime, 1000);
    
    // Load initial data from Firebase
    loadLatestDataFromFirebase();
    loadWeatherGraphFromFirebase(20);
    loadPollutionGraphFromFirebase(20);
    
    // Setup event listeners for refresh buttons
    setupEventListeners();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        loadLatestDataFromFirebase();
        loadWeatherGraphFromFirebase(parseInt(document.getElementById('weatherTimeRange')?.value || 20));
        loadPollutionGraphFromFirebase(parseInt(document.getElementById('pollutionTimeRange')?.value || 20));
    }, 30000);
});

function setupEventListeners() {
    const weatherTimeRange = document.getElementById('weatherTimeRange');
    if (weatherTimeRange) {
        weatherTimeRange.addEventListener('change', function() {
            loadWeatherGraphFromFirebase(parseInt(this.value));
        });
    }
    
    const pollutionTimeRange = document.getElementById('pollutionTimeRange');
    if (pollutionTimeRange) {
        pollutionTimeRange.addEventListener('change', function() {
            loadPollutionGraphFromFirebase(parseInt(this.value));
        });
    }
    
    const refreshWeather = document.getElementById('refreshWeatherGraph');
    if (refreshWeather) {
        refreshWeather.addEventListener('click', function() {
            loadWeatherGraphFromFirebase(parseInt(document.getElementById('weatherTimeRange').value));
        });
    }
    
    const refreshPollution = document.getElementById('refreshPollutionGraph');
    if (refreshPollution) {
        refreshPollution.addEventListener('click', function() {
            loadPollutionGraphFromFirebase(parseInt(document.getElementById('pollutionTimeRange').value));
        });
    }
}

// Update current time display
function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = `${dateStr} | ${timeStr}`;
    }
}

// Load latest data from Firebase
async function loadLatestDataFromFirebase() {
    console.log("Loading latest data from Firebase...");
    
    if (!window.firebaseHelpers || !window.firebaseHelpers.firebaseInitialized) {
        console.warn("Firebase not initialized yet, retrying in 2 seconds...");
        setTimeout(loadLatestDataFromFirebase, 2000);
        return;
    }
    
    try {
        // Get latest weather data
        const weatherData = await getLatestFromFirebase('weather_data', 1);
        if (weatherData && weatherData.length > 0) {
            const latest = weatherData[0];
            currentSensorData.temperature = latest.temperature;
            currentSensorData.humidity = latest.humidity;
            currentSensorData.pressure = latest.pressure;
            currentSensorData.rainfall = latest.rainfall;
            currentSensorData.light = latest.light;
        }
        
        // Get latest pollution data
        const pollutionData = await getLatestFromFirebase('pollution_data', 1);
        if (pollutionData && pollutionData.length > 0) {
            const latest = pollutionData[0];
            currentSensorData.pm25 = latest.pm25;
            currentSensorData.pm10 = latest.pm10;
            currentSensorData.aqi = latest.aqi;
            currentSensorData.voc = latest.voc;
            currentSensorData.nox = latest.nox;
        }
        
        // Update UI with latest values
        updateDashboardUI();
        
        console.log("✅ Dashboard updated from Firebase", currentSensorData);
        
    } catch (error) {
        console.error("Error loading data from Firebase:", error);
    }
}

// Update all dashboard UI elements
function updateDashboardUI() {
    // Temperature
    if (currentSensorData.temperature) {
        document.getElementById('currentTemp').textContent = currentSensorData.temperature.toFixed(1);
        document.getElementById('heroTemp').innerText = currentSensorData.temperature.toFixed(1);
    }
    
    // Humidity
    if (currentSensorData.humidity) {
        document.getElementById('currentHumidity').textContent = currentSensorData.humidity.toFixed(1);
    }
    
    // Pressure
    if (currentSensorData.pressure) {
        const pressure = currentSensorData.pressure.toFixed(0);
        document.getElementById('currentPressure').textContent = pressure;
        document.getElementById('pressureSummary').textContent = pressure + ' hPa';
    }
    
    // AQI
    if (currentSensorData.aqi) {
        const roundedAQI = Math.round(currentSensorData.aqi);
        document.getElementById('currentAQI').textContent = roundedAQI;
        document.getElementById('heroAQI').innerText = roundedAQI;
        updateAQIStatus(currentSensorData.aqi);
        updateAQIBadge(currentSensorData.aqi);
    }
    
    // PM2.5
    if (currentSensorData.pm25) {
        document.getElementById('heroPM25').innerText = currentSensorData.pm25.toFixed(1);
        document.getElementById('currentPM25').textContent = currentSensorData.pm25.toFixed(1);
    }
    
    // PM10
    if (currentSensorData.pm10) {
        document.getElementById('currentPM10').textContent = currentSensorData.pm10.toFixed(1);
        document.getElementById('pm10Value').innerHTML = currentSensorData.pm10.toFixed(1) + '<span class="sensor-unit">µg/m³</span>';
    }
    
    // Rainfall
    if (currentSensorData.rainfall) {
        document.getElementById('currentRainfall').textContent = currentSensorData.rainfall.toFixed(1);
        document.getElementById('rainfallValue').innerHTML = currentSensorData.rainfall.toFixed(1) + '<span class="sensor-unit">mm</span>';
    }
    
    // VOC
    if (currentSensorData.voc) {
        document.getElementById('currentVOC').textContent = currentSensorData.voc.toFixed(1);
        document.getElementById('vocValue').innerHTML = currentSensorData.voc.toFixed(1) + '<span class="sensor-unit">ppb</span>';
    }
    
    // NOx
    if (currentSensorData.nox) {
        document.getElementById('currentNOx').textContent = currentSensorData.nox.toFixed(1);
        document.getElementById('noxValue').innerHTML = currentSensorData.nox.toFixed(1) + '<span class="sensor-unit">ppb</span>';
    }
    
    // Light
    if (currentSensorData.light) {
        document.getElementById('currentLight').textContent = currentSensorData.light.toFixed(0);
        document.getElementById('lightValue').innerHTML = currentSensorData.light.toFixed(0) + '<span class="sensor-unit">lux</span>';
        
        // Calculate UV from light
        const uvData = calculateUVLevel(currentSensorData.light);
        document.getElementById('uvSummary').textContent = uvData.uv;
        document.getElementById('uvLevel').textContent = uvData.level;
    }
    
    // Wind (inactive - show zero)
    document.getElementById('currentWind').textContent = '0';
    document.getElementById('windSummary').textContent = '0 km/h';
    document.getElementById('currentWindDir').textContent = '0';
    document.getElementById('windDirValue').innerHTML = '0<span class="sensor-unit">°</span>';
    document.getElementById('windDirSummary').textContent = 'N';
    
    // Update sunrise/sunset
    updateSunriseSunset();
    
    // Last update time
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
}

// Load weather graph from Firebase
async function loadWeatherGraphFromFirebase(results = 20) {
    console.log(`Loading weather graph from Firebase with ${results} results`);
    
    if (!window.firebaseHelpers || !window.firebaseHelpers.firebaseInitialized) {
        console.warn("Firebase not initialized yet");
        setTimeout(() => loadWeatherGraphFromFirebase(results), 1000);
        return;
    }
    
    try {
        const weatherData = await getLatestFromFirebase('weather_data', results);
        
        if (!weatherData || weatherData.length === 0) {
            console.warn("No weather data in Firebase");
            showDemoWeatherChart();
            return;
        }
        
        // Process data for chart
        const labels = weatherData.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        
        const datasets = [];
        
        // Temperature data
        const tempValues = weatherData.map(item => item.temperature || 0);
        if (tempValues.some(v => v > 0)) {
            datasets.push({
                label: 'Temperature (°C)',
                data: tempValues,
                borderColor: '#ff4757',
                backgroundColor: '#ff475720',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        // Humidity data
        const humidityValues = weatherData.map(item => item.humidity || 0);
        if (humidityValues.some(v => v > 0)) {
            datasets.push({
                label: 'Humidity (%)',
                data: humidityValues,
                borderColor: '#3742fa',
                backgroundColor: '#3742fa20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        // Pressure data
        const pressureValues = weatherData.map(item => item.pressure || 0);
        if (pressureValues.some(v => v > 0)) {
            datasets.push({
                label: 'Pressure (hPa)',
                data: pressureValues,
                borderColor: '#1abc9c',
                backgroundColor: '#1abc9c20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        // Rainfall data
        const rainfallValues = weatherData.map(item => item.rainfall || 0);
        if (rainfallValues.some(v => v > 0)) {
            datasets.push({
                label: 'Rainfall (mm)',
                data: rainfallValues,
                borderColor: '#3498db',
                backgroundColor: '#3498db20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        // Light data
        const lightValues = weatherData.map(item => item.light || 0);
        if (lightValues.some(v => v > 0)) {
            datasets.push({
                label: 'Light (lux)',
                data: lightValues,
                borderColor: '#f1c40f',
                backgroundColor: '#f1c40f20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        if (datasets.length > 0) {
            renderWeatherChart(labels, datasets);
        } else {
            showDemoWeatherChart();
        }
        
    } catch (error) {
        console.error("Error loading weather graph:", error);
        showDemoWeatherChart();
    }
}

// Load pollution graph from Firebase
async function loadPollutionGraphFromFirebase(results = 20) {
    console.log(`Loading pollution graph from Firebase with ${results} results`);
    
    if (!window.firebaseHelpers || !window.firebaseHelpers.firebaseInitialized) {
        console.warn("Firebase not initialized yet");
        setTimeout(() => loadPollutionGraphFromFirebase(results), 1000);
        return;
    }
    
    try {
        const pollutionData = await getLatestFromFirebase('pollution_data', results);
        
        if (!pollutionData || pollutionData.length === 0) {
            console.warn("No pollution data in Firebase");
            showDemoPollutionChart();
            return;
        }
        
        // Process data for chart
        const labels = pollutionData.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        
        const datasets = [];
        
        // AQI data
        const aqiValues = pollutionData.map(item => item.aqi || 0);
        if (aqiValues.some(v => v > 0)) {
            datasets.push({
                label: 'AQI',
                data: aqiValues,
                borderColor: '#4da6ff',
                backgroundColor: '#4da6ff20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        // PM2.5 data
        const pm25Values = pollutionData.map(item => item.pm25 || 0);
        if (pm25Values.some(v => v > 0)) {
            datasets.push({
                label: 'PM2.5 (µg/m³)',
                data: pm25Values,
                borderColor: '#ff6b6b',
                backgroundColor: '#ff6b6b20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        // PM10 data
        const pm10Values = pollutionData.map(item => item.pm10 || 0);
        if (pm10Values.some(v => v > 0)) {
            datasets.push({
                label: 'PM10 (µg/m³)',
                data: pm10Values,
                borderColor: '#ffa726',
                backgroundColor: '#ffa72620',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        // VOC data
        const vocValues = pollutionData.map(item => item.voc || 0);
        if (vocValues.some(v => v > 0)) {
            datasets.push({
                label: 'VOC (ppb)',
                data: vocValues,
                borderColor: '#f39c12',
                backgroundColor: '#f39c1220',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        // NOx data
        const noxValues = pollutionData.map(item => item.nox || 0);
        if (noxValues.some(v => v > 0)) {
            datasets.push({
                label: 'NOx (ppb)',
                data: noxValues,
                borderColor: '#e74c3c',
                backgroundColor: '#e74c3c20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3
            });
        }
        
        if (datasets.length > 0) {
            renderPollutionChart(labels, datasets);
        } else {
            showDemoPollutionChart();
        }
        
    } catch (error) {
        console.error("Error loading pollution graph:", error);
        showDemoPollutionChart();
    }
}

// Render weather chart
function renderWeatherChart(labels, datasets) {
    const canvas = document.getElementById('weatherGraph');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (weatherChart) weatherChart.destroy();
    
    weatherChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#ffffff', font: { size: 12 }, boxWidth: 15, padding: 15 }
                },
                tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#ffffff', bodyColor: '#ffffff' }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6', maxRotation: 45 }, title: { display: true, text: 'Time', color: '#ffffff' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6' }, title: { display: true, text: 'Value', color: '#ffffff' }, beginAtZero: true }
            }
        }
    });
}

// Render pollution chart
function renderPollutionChart(labels, datasets) {
    const canvas = document.getElementById('pollutionGraph');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (pollutionChart) pollutionChart.destroy();
    
    pollutionChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#ffffff', font: { size: 12 }, boxWidth: 15, padding: 15 }
                },
                tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#ffffff', bodyColor: '#ffffff' }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6', maxRotation: 45 }, title: { display: true, text: 'Time', color: '#ffffff' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6' }, title: { display: true, text: 'Value', color: '#ffffff' }, beginAtZero: true }
            }
        }
    });
}

// Demo functions (fallback when no data in Firebase)
function showDemoWeatherChart() {
    const now = new Date();
    const labels = [];
    for (let i = 19; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * 5 * 60000));
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    const datasets = [
        { label: 'Temperature (°C)', data: Array.from({length: 20}, () => 25 + Math.random() * 5), borderColor: '#ff4757', backgroundColor: '#ff475720', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'Humidity (%)', data: Array.from({length: 20}, () => 60 + Math.random() * 20), borderColor: '#3742fa', backgroundColor: '#3742fa20', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'Pressure (hPa)', data: Array.from({length: 20}, () => 1000 + Math.random() * 20), borderColor: '#1abc9c', backgroundColor: '#1abc9c20', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'Rainfall (mm)', data: Array.from({length: 20}, () => Math.random() * 3), borderColor: '#3498db', backgroundColor: '#3498db20', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'Light (lux)', data: Array.from({length: 20}, () => 500 + Math.random() * 300), borderColor: '#f1c40f', backgroundColor: '#f1c40f20', borderWidth: 2, fill: true, tension: 0.4 }
    ];
    
    renderWeatherChart(labels, datasets);
}

function showDemoPollutionChart() {
    const now = new Date();
    const labels = [];
    for (let i = 19; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * 5 * 60000));
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    const datasets = [
        { label: 'AQI', data: Array.from({length: 20}, () => 30 + Math.random() * 40), borderColor: '#4da6ff', backgroundColor: '#4da6ff20', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'PM2.5 (µg/m³)', data: Array.from({length: 20}, () => 10 + Math.random() * 15), borderColor: '#ff6b6b', backgroundColor: '#ff6b6b20', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'PM10 (µg/m³)', data: Array.from({length: 20}, () => 15 + Math.random() * 20), borderColor: '#ffa726', backgroundColor: '#ffa72620', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'VOC (ppb)', data: Array.from({length: 20}, () => 200 + Math.random() * 100), borderColor: '#f39c12', backgroundColor: '#f39c1220', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'NOx (ppb)', data: Array.from({length: 20}, () => 5 + Math.random() * 10), borderColor: '#e74c3c', backgroundColor: '#e74c3c20', borderWidth: 2, fill: true, tension: 0.4 }
    ];
    
    renderPollutionChart(labels, datasets);
}

// Helper functions
function updateAQIStatus(aqi) {
    let status = "Good";
    let color = "#00cc66";
    
    if (aqi > 200) { status = "Very Unhealthy"; color = "#ff3333"; }
    else if (aqi > 150) { status = "Unhealthy"; color = "#ff6666"; }
    else if (aqi > 100) { status = "Unhealthy for Sensitive"; color = "#ff9933"; }
    else if (aqi > 50) { status = "Moderate"; color = "#ffcc00"; }
    
    const aqiStatusElement = document.getElementById('aqiStatus');
    if (aqiStatusElement) {
        aqiStatusElement.textContent = status;
        aqiStatusElement.style.color = color;
        aqiStatusElement.style.background = color + '20';
        aqiStatusElement.style.padding = '2px 8px';
        aqiStatusElement.style.borderRadius = '10px';
    }
    return status;
}

function updateAQIBadge(aqi) {
    const badge = document.getElementById('aqiLevel');
    const statCard = document.getElementById('aqiStatCard');
    if (!badge) return;
    
    let level = '', color = '';
    if (aqi <= 50) { level = 'GOOD'; color = '#00cc66'; }
    else if (aqi <= 100) { level = 'MODERATE'; color = '#ffcc00'; }
    else if (aqi <= 150) { level = 'SENSITIVE'; color = '#ff9933'; }
    else if (aqi <= 200) { level = 'UNHEALTHY'; color = '#ff6666'; }
    else { level = 'HAZARDOUS'; color = '#ff3333'; }
    
    badge.textContent = level;
    badge.style.background = color + '20';
    badge.style.borderColor = color;
    badge.style.color = color;
    
    if (statCard) statCard.style.borderColor = color;
}

function calculateUVLevel(light) {
    if (!light || isNaN(light)) return { uv: '--', level: '--' };
    let uv, level;
    if (light > 50000) { uv = 8; level = 'Very High'; }
    else if (light > 30000) { uv = 6; level = 'High'; }
    else if (light > 10000) { uv = 4; level = 'Moderate'; }
    else if (light > 5000) { uv = 2; level = 'Low'; }
    else { uv = 1; level = 'Low'; }
    return { uv, level };
}

function updateSunriseSunset() {
    const now = new Date();
    const month = now.getMonth();
    let sunriseHour = 6, sunsetHour = 18;
    if (month >= 5 && month <= 7) { sunriseHour = 5; sunsetHour = 20; }
    else if (month >= 10 || month <= 2) { sunriseHour = 7; sunsetHour = 17; }
    
    document.getElementById('sunrise').textContent = `${sunriseHour.toString().padStart(2, '0')}:30 AM`;
    document.getElementById('sunset').textContent = `${(sunsetHour - 12).toString().padStart(2, '0')}:30 PM`;
}