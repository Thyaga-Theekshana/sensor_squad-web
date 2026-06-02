// weather-charts.js
// Firebase-only for weather charts

let allWeatherData = null;
const WEATHER_CHART_IDS = ['temp', 'humidity', 'pressure', 'rainfall', 'light'];

document.addEventListener('DOMContentLoaded', function() {
    console.log("Weather charts page loaded with Firebase");
    updateTime();
    setInterval(updateTime, 1000);
    loadAllWeatherCharts(20);
    
    const timeRange = document.getElementById('globalTimeRange');
    if (timeRange) {
        timeRange.addEventListener('change', function() {
            loadAllWeatherCharts(parseInt(this.value));
        });
    }
});

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) timeElement.textContent = timeStr;
}

async function loadAllWeatherCharts(results) {
    console.log(`Loading weather charts from Firebase with ${results} results`);
    
    if (!window.firebaseHelpers || !window.firebaseHelpers.firebaseInitialized) {
        console.warn("Firebase not initialized yet");
        setTimeout(() => loadAllWeatherCharts(results), 1000);
        return;
    }
    
    try {
        const weatherData = await getLatestFromFirebase('weather_data', results);
        
        if (!weatherData || weatherData.length === 0) {
            console.warn("No weather data in Firebase");
            showDemoWeatherCharts(results);
            return;
        }
        
        allWeatherData = weatherData;
        
        const labels = weatherData.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        
        // Temperature chart
        const tempValues = weatherData.map(item => item.temperature || 0);
        if (tempValues.some(v => v > 0)) {
            updateCurrentDisplay('tempCurrent', tempValues[tempValues.length - 1], '°C');
            createWeatherChart({ id: 'temp', name: 'Temperature', unit: '°C', color: '#ff4757', canvasId: 'tempChartCanvas' }, labels, tempValues);
        }
        
        // Humidity chart
        const humidityValues = weatherData.map(item => item.humidity || 0);
        if (humidityValues.some(v => v > 0)) {
            updateCurrentDisplay('humidityCurrent', humidityValues[humidityValues.length - 1], '%');
            createWeatherChart({ id: 'humidity', name: 'Humidity', unit: '%', color: '#3742fa', canvasId: 'humidityChartCanvas' }, labels, humidityValues);
        }
        
        // Pressure chart
        const pressureValues = weatherData.map(item => item.pressure || 0);
        if (pressureValues.some(v => v > 0)) {
            updateCurrentDisplay('pressureCurrent', pressureValues[pressureValues.length - 1], 'hPa');
            createWeatherChart({ id: 'pressure', name: 'Pressure', unit: 'hPa', color: '#1abc9c', canvasId: 'pressureChartCanvas' }, labels, pressureValues);
        }
        
        // Rainfall chart
        const rainfallValues = weatherData.map(item => item.rainfall || 0);
        if (rainfallValues.some(v => v > 0)) {
            updateCurrentDisplay('rainfallCurrent', rainfallValues[rainfallValues.length - 1], 'mm');
            createWeatherChart({ id: 'rainfall', name: 'Rainfall', unit: 'mm', color: '#3498db', canvasId: 'rainfallChartCanvas' }, labels, rainfallValues);
        }
        
        // Light chart
        const lightValues = weatherData.map(item => item.light || 0);
        if (lightValues.some(v => v > 0)) {
            updateCurrentDisplay('lightCurrent', lightValues[lightValues.length - 1], 'lux');
            createWeatherChart({ id: 'light', name: 'Light Intensity', unit: 'lux', color: '#f1c40f', canvasId: 'lightChartCanvas' }, labels, lightValues);
        }
        
        // Wind sensors (inactive)
        showWindDemoCharts(results);
        
    } catch (error) {
        console.error("Error loading weather charts:", error);
        showDemoWeatherCharts(results);
    }
}

function updateCurrentDisplay(elementId, value, unit) {
    const element = document.getElementById(elementId);
    if (element && value) {
        element.textContent = `${value.toFixed(1)} ${unit}`;
    }
}

function createWeatherChart(fieldConfig, labels, values) {
    const canvas = document.getElementById(fieldConfig.canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (canvas.chart) canvas.chart.destroy();
    
    canvas.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: fieldConfig.name + (fieldConfig.unit ? ` (${fieldConfig.unit})` : ''),
                data: values,
                borderColor: fieldConfig.color,
                backgroundColor: fieldConfig.color + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: fieldConfig.color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#ffffff', font: { size: 12 } } },
                tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#ffffff', bodyColor: '#ffffff' }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6', maxRotation: 45 }, title: { display: true, text: 'Time', color: '#ffffff' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6' }, title: { display: true, text: fieldConfig.name, color: '#ffffff' }, beginAtZero: fieldConfig.id !== 'pressure' }
            }
        }
    });
}

function showDemoWeatherCharts(results) {
    console.log("Showing demo weather charts");
    
    // Generate demo time labels
    const now = new Date();
    const labels = [];
    for (let i = results - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * 5 * 60000));
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    // Demo data for weather parameters
    const demos = [
        { id: 'temp', name: 'Temperature', unit: '°C', color: '#ff4757', canvasId: 'tempChartCanvas', 
          currentElement: 'tempCurrent', current: 28.5,
          values: Array.from({length: results}, (_, i) => 25 + Math.sin(i * 0.3) * 3 + Math.random()) },
        { id: 'humidity', name: 'Humidity', unit: '%', color: '#3742fa', canvasId: 'humidityChartCanvas',
          currentElement: 'humidityCurrent', current: 65.2,
          values: Array.from({length: results}, (_, i) => 60 + Math.sin(i * 0.2) * 10 + Math.random() * 5) },
        { id: 'pressure', name: 'Pressure', unit: 'hPa', color: '#1abc9c', canvasId: 'pressureChartCanvas',
          currentElement: 'pressureCurrent', current: 1013.5,
          values: Array.from({length: results}, (_, i) => 1000 + Math.cos(i * 0.1) * 10 + Math.random() * 2) },
        { id: 'rainfall', name: 'Rainfall', unit: 'mm', color: '#3498db', canvasId: 'rainfallChartCanvas',
          currentElement: 'rainfallCurrent', current: 2.5,
          values: Array.from({length: results}, (_, i) => i % 5 === 0 ? Math.random() * 5 : Math.random() * 0.5) },
        { id: 'light', name: 'Light Intensity', unit: 'lux', color: '#f1c40f', canvasId: 'lightChartCanvas',
          currentElement: 'lightCurrent', current: 850,
          values: Array.from({length: results}, (_, i) => 500 + Math.sin(i * 0.2) * 300 + Math.random() * 50) }
    ];
    
    demos.forEach(demo => {
        const currentElement = document.getElementById(demo.currentElement);
        if (currentElement) {
            currentElement.textContent = `${demo.current.toFixed(1)} ${demo.unit}`;
        }
        
        const fieldConfig = {
            id: demo.id,
            name: demo.name,
            unit: demo.unit,
            color: demo.color,
            canvasId: demo.canvasId
        };
        
        createWeatherChart(fieldConfig, labels, demo.values);
    });
    
    // Show wind demo data separately
    showWindDemoCharts(results);
}

function showWindDemoCharts(results) {
    // Generate zero values for wind sensors
    const labels = [];
    const now = new Date();
    for (let i = results - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * 5 * 60000));
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    // Zero values array
    const zeroValues = Array(results).fill(0);
    
    // Wind Speed - Show zero
    const windSpeedElement = document.getElementById('windSpeedCurrent');
    if (windSpeedElement) {
        windSpeedElement.textContent = '0 km/h';
    }
    
    const windSpeedConfig = {
        id: 'windSpeed',
        name: 'Wind Speed',
        unit: 'km/h',
        color: '#9b59b6',
        canvasId: 'windSpeedChartCanvas'
    };
    createWeatherChart(windSpeedConfig, labels, zeroValues);
    
    // Wind Direction - Show zero with N direction
    const windDirElement = document.getElementById('windDirectionCurrent');
    if (windDirElement) {
        windDirElement.textContent = 'N (0°)';
    }
    
    // Special chart for wind direction with zero values
    const canvas = document.getElementById('windDirectionChartCanvas');
    if (canvas) {
        if (canvas.chart) canvas.chart.destroy();
        
        const ctx = canvas.getContext('2d');
        canvas.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Wind Direction (°)',
                    data: zeroValues,
                    borderColor: '#f39c12',
                    backgroundColor: '#f39c1220',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#f39c12',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: '#ffffff', font: { size: 12 } } },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        callbacks: {
                            label: function(context) {
                                return `Wind Direction: N (0°)`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6', maxRotation: 45 }, title: { display: true, text: 'Time', color: '#ffffff' } },
                    y: {
                        min: 0,
                        max: 360,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { 
                            color: '#a0b3d6',
                            stepSize: 45,
                            callback: function(value) {
                                const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
                                const index = Math.round(value / 45);
                                return directions[index] + ' (0°)';
                            }
                        },
                        title: { display: true, text: 'Wind Direction', color: '#ffffff' }
                    }
                }
            }
        });
    }
}

// Helper function to convert degrees to cardinal direction
function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// Format sensor value with appropriate decimal places
function formatSensorValue(value, unit) {
    if (value === null || value === undefined || isNaN(value)) return '--';
    
    if (unit.includes('hPa')) {
        return value.toFixed(0);
    } else if (unit.includes('lux')) {
        return value.toFixed(0);
    } else if (unit.includes('mm')) {
        return value.toFixed(1);
    } else {
        return value.toFixed(1);
    }
}