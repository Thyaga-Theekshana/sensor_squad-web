// weather-charts.js - COMPLETE FIX WITH TIMESTAMP HANDLING
let allWeatherData = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log("Weather charts page loaded with Firebase");
    updateTime();
    setInterval(updateTime, 1000);
    loadAllWeatherCharts(20);
    const timeRange = document.getElementById('globalTimeRange');
    if (timeRange) timeRange.addEventListener('change', () => loadAllWeatherCharts(parseInt(timeRange.value)));
});

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) timeElement.textContent = timeStr;
}

// ============================================================
//  FIX: Properly handle timestamps – seconds or milliseconds
// ============================================================
function getDateFromTimestamp(ts) {
    // If timestamp is missing or null, use current time as fallback
    if (ts === undefined || ts === null || ts === 0) {
        console.warn("⚠️ Missing timestamp – using fallback");
        return new Date();
    }
    
    let timestamp = ts;
    
    // If it's a string, try to parse it
    if (typeof timestamp === 'string') {
        timestamp = parseInt(timestamp);
    }
    
    // If it's a number and less than 1e12, it's in seconds (Unix epoch)
    if (typeof timestamp === 'number') {
        if (timestamp < 1e12) {
            timestamp = timestamp * 1000; // Convert seconds to milliseconds
        }
    }
    
    const date = new Date(timestamp);
    
    // If still invalid, use current time
    if (isNaN(date.getTime())) {
        console.warn("⚠️ Invalid timestamp:", ts);
        return new Date();
    }
    
    return date;
}

async function loadAllWeatherCharts(results) {
    if (!window.firebaseHelpers?.firebaseInitialized) {
        showDemoWeatherCharts(results);
        setTimeout(() => loadAllWeatherCharts(results), 3000);
        return;
    }
    try {
        const weatherData = await getLatestFromFirebase('weather_data', results);
        console.log("📊 Raw weather data:", weatherData);
        
        if (!weatherData || weatherData.length === 0) {
            console.warn("No weather data – showing demo charts");
            showDemoWeatherCharts(results);
            return;
        }
        const dataMode = document.getElementById('weatherDataMode');
        if (dataMode) dataMode.hidden = true;
        
        // ✅ Reverse to chronological order (oldest → newest)
        weatherData.reverse();
        
        // ============================================================
        //  FIX: Generate labels from timestamps with fallback
        // ============================================================
        const labels = weatherData.map((item, index) => {
    // Try item.timestamp first, then fallback to item.id (the Firebase key)
    let ts = item.timestamp || item.id;
    const date = getDateFromTimestamp(ts);
    return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
});
        console.log("✅ Labels:", labels);
        
        // ============================================================
        //  CREATE CHARTS
        // ============================================================
        
        // Temperature
        const tempValues = weatherData.map(item => item.temperature || 0);
        console.log("🌡️ Temperature values:", tempValues);
        if (tempValues.some(v => v > 0)) {
            const cur = tempValues[tempValues.length - 1];
            updateCurrentDisplay('tempCurrent', cur, '°C');
            createWeatherChart('tempChartCanvas', 'Temperature', '°C', '#ff4757', labels, tempValues, 0, 50);
        }
        
        // Humidity
        const humidityValues = weatherData.map(item => item.humidity || 0);
        console.log("💧 Humidity values:", humidityValues);
        if (humidityValues.some(v => v > 0)) {
            const cur = humidityValues[humidityValues.length - 1];
            updateCurrentDisplay('humidityCurrent', cur, '%');
            createWeatherChart('humidityChartCanvas', 'Humidity', '%', '#3742fa', labels, humidityValues, 0, 100);
        }
        
        // Pressure
        const pressureValues = weatherData.map(item => item.pressure || 0);
        console.log("📊 Pressure values:", pressureValues);
        if (pressureValues.some(v => v > 0)) {
            const cur = pressureValues[pressureValues.length - 1];
            updateCurrentDisplay('pressureCurrent', cur, 'hPa');
            createWeatherChart('pressureChartCanvas', 'Pressure', 'hPa', '#1abc9c', labels, pressureValues, 980, 1020);
        }
        
        // Rainfall
        const rainfallValues = weatherData.map(item => item.rainfall || 0);
        console.log("🌧️ Rainfall values:", rainfallValues);
        if (rainfallValues.some(v => v > 0)) {
            const cur = rainfallValues[rainfallValues.length - 1];
            updateCurrentDisplay('rainfallCurrent', cur, 'mm');
            createWeatherChart('rainfallChartCanvas', 'Rainfall', 'mm', '#3498db', labels, rainfallValues, 0, 10);
        }
        
        // Light
        const lightValues = weatherData.map(item => item.light || 0);
        console.log("💡 Light values:", lightValues);
        if (lightValues.some(v => v > 0)) {
            const cur = lightValues[lightValues.length - 1];
            updateCurrentDisplay('lightCurrent', cur, 'lux');
            createWeatherChart('lightChartCanvas', 'Light Intensity', 'lux', '#f1c40f', labels, lightValues, 0, 6000);
        }
        
        // Wind Speed
        const windSpeedValues = weatherData.map(item => item.windSpeed || 0);
        console.log("💨 Wind Speed values:", windSpeedValues);
        if (windSpeedValues.some(v => v > 0 || v === 0)) {
            const cur = windSpeedValues[windSpeedValues.length - 1];
            updateCurrentDisplay('windSpeedCurrent', cur, 'm/s');
            createWeatherChart('windSpeedChartCanvas', 'Wind Speed', 'm/s', '#9b59b6', labels, windSpeedValues, 0, 8);
        }
        
        // Wind Direction
        const windDirValues = weatherData.map(item => item.windDirection || 0);
        console.log("🧭 Wind Direction values:", windDirValues);
        if (windDirValues.some(v => v > 0 || v === 0)) {
            const cur = windDirValues[windDirValues.length - 1];
            updateCurrentDisplay('windDirectionCurrent', cur, '°');
            createWeatherChart('windDirectionChartCanvas', 'Wind Direction', '°', '#f39c12', labels, windDirValues, 0, 360);
        }
        
        console.log("✅ Weather charts updated with real data");
    } catch (error) {
        console.error("❌ Error loading weather charts:", error);
        showDemoWeatherCharts(results);
    }
}

function updateCurrentDisplay(elementId, value, unit) {
    const el = document.getElementById(elementId);
    if (el && value !== undefined && value !== null && !isNaN(value)) {
        el.textContent = `${value.toFixed(1)} ${unit}`;
    }
}

function createWeatherChart(canvasId, name, unit, color, labels, values, minVal, maxVal) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`❌ Canvas not found: ${canvasId}`);
        return;
    }
    if (canvas.chart) {
        canvas.chart.destroy();
    }
    
    // Show only last 20 points
    const displayLabels = labels.slice(-20);
    const displayValues = values.slice(-20);
    
    const ctx = canvas.getContext('2d');
    canvas.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: name + (unit ? ` (${unit})` : ''),
                data: displayValues,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#ffffff', font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            return `${name}: ${context.parsed.y.toFixed(1)} ${unit}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { 
                        color: '#a0b3d6', 
                        maxRotation: 45,
                        font: { size: 9 },
                        autoSkip: true,
                        maxTicksLimit: 10
                    },
                    title: { display: true, text: 'Time', color: '#ffffff' }
                },
                y: {
                    min: minVal !== undefined ? minVal : 0,
                    max: maxVal !== undefined ? maxVal : 100,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#a0b3d6' },
                    title: { display: true, text: name, color: '#ffffff' },
                    beginAtZero: name !== 'Pressure' && name !== 'Wind Direction'
                }
            }
        }
    });
}

function showDemoWeatherCharts(results) {
    console.log("🔄 Showing demo weather charts (fallback)");
    const dataMode = document.getElementById('weatherDataMode');
    if (dataMode) dataMode.hidden = false;
    const now = new Date();
    const labels = [];
    for (let i = results - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - (i * 5 * 60000));
        labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    const smoothSeries = (base, amplitude) => Array.from(
        { length: results },
        (_, index) => base + amplitude * Math.sin(index * 0.22)
    );
    const demos = [
        { id: 'tempChartCanvas', name: 'Temperature', unit: '°C', color: '#ff4757', values: smoothSeries(29.5, 1.4) },
        { id: 'humidityChartCanvas', name: 'Humidity', unit: '%', color: '#3742fa', values: smoothSeries(80, 2.5) },
        { id: 'pressureChartCanvas', name: 'Pressure', unit: 'hPa', color: '#1abc9c', values: smoothSeries(1011.5, 0.6) },
        { id: 'rainfallChartCanvas', name: 'Rainfall', unit: 'mm', color: '#3498db', values: smoothSeries(0.1, 0.1) },
        { id: 'lightChartCanvas', name: 'Light Intensity', unit: 'lux', color: '#f1c40f', values: smoothSeries(850, 120) },
        { id: 'windSpeedChartCanvas', name: 'Wind Speed', unit: 'm/s', color: '#9b59b6', values: smoothSeries(3.75, 0.7) }
    ];
    
    demos.forEach(d => {
        d.current = d.values[d.values.length - 1];
        const curEl = document.getElementById(d.id.replace('ChartCanvas', 'Current'));
        if (curEl) curEl.textContent = `${d.current.toFixed(1)} ${d.unit}`;
        createWeatherChart(d.id, d.name, d.unit, d.color, labels, d.values, 0,
            d.id === 'pressureChartCanvas' ? 1020 : (d.id === 'lightChartCanvas' ? 2000 : (d.id === 'windSpeedChartCanvas' ? 8 : 100)));
    });
}