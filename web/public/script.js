// script.js - Main dashboard (trends removed, ticker added)
let currentSensorData = {
    temperature: null, humidity: null, pressure: null,
    pm2_5: null, pm10: null, aqi: null, rainfall: null,
    voc: null, nox: null, co2: null, light: null,
    windSpeed: null, windDirection: null, co: null
};
let weatherChart = null, pollutionChart = null;

function getTimeOnly(timestamp) {
    let date = new Date(timestamp);
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    return hours + ':' + minutes;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("Dashboard initialized with Firebase");
    updateTime();
    setInterval(updateTime, 1000);
    loadLatestDataFromFirebase();
    loadWeatherGraphFromFirebase(20);
    loadPollutionGraphFromFirebase(20);
    loadDashboardForecast();
    setupEventListeners();
    setInterval(() => {
        loadLatestDataFromFirebase();
        loadWeatherGraphFromFirebase(parseInt(document.getElementById('weatherTimeRange')?.value || 20));
        loadPollutionGraphFromFirebase(parseInt(document.getElementById('pollutionTimeRange')?.value || 20));
    }, 30000);
    setInterval(loadDashboardForecast, 15 * 60 * 1000);
});

const DASHBOARD_PREDICTION_API_CANDIDATES = [
    window.PREDICTION_API_URL,
    'http://127.0.0.1:8000',
    'http://localhost:8000'
].filter(Boolean).map(url => url.replace(/\/+$/, ''));

async function fetchDashboardJson(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function resolveDashboardPredictionApi() {
    let lastError = new Error('No prediction API URL is configured.');
    for (const base of DASHBOARD_PREDICTION_API_CANDIDATES) {
        try {
            const response = await fetchDashboardJson(`${base}/health`, 2000);
            if (response.ok) return base;
            lastError = new Error(`API health check returned ${response.status}.`);
        } catch (error) {
            lastError = error;
        }
    }
    throw new Error(`Prediction API is unavailable: ${lastError.message}`);
}

async function fetchDashboardForecast(base, path) {
    const response = await fetchDashboardJson(`${base}${path}`, 15000);
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || `Request failed with status ${response.status}.`);
    }
    return result;
}

function setForecastText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function hasForecastNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function renderDashboardHourlyForecast(hours, source) {
    if (!Array.isArray(hours) || hours.length === 0) {
        throw new Error('The API returned no hourly forecast data.');
    }

    const temperatures = hours
        .map(hour => hour.temperature)
        .filter(hasForecastNumber)
        .map(Number);
    if (temperatures.length === 0) {
        throw new Error('The hourly forecast did not include temperatures.');
    }

    const aqiHours = hours.filter(hour => hasForecastNumber(hour.aqi));
    const peakAqi = aqiHours.reduce((peak, hour) => Number(hour.aqi) > Number(peak.aqi) ? hour : peak, aqiHours[0]);
    const rainfall = hours.reduce((total, hour) => {
        const amount = Number(hour.rainfall);
        return total + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    setForecastText('forecastTempRange', `${Math.min(...temperatures).toFixed(1)}–${Math.max(...temperatures).toFixed(1)} °C`);
    setForecastText('forecastPeakAqi', aqiHours.length
        ? `${Math.round(Number(peakAqi.aqi))}${peakAqi.timeLabel ? ` at ${peakAqi.timeLabel}` : ''}`
        : 'Unavailable');
    setForecastText('forecastRainTotal', `${rainfall.toFixed(1)} mm`);
    setForecastText('forecastSource', source === 'lstm' ? 'LSTM model' : (source || 'Prediction API'));
}

function markDashboardHourlyForecastUnavailable() {
    setForecastText('forecastTempRange', 'Unavailable');
    setForecastText('forecastPeakAqi', 'Unavailable');
    setForecastText('forecastRainTotal', 'Unavailable');
    setForecastText('forecastSource', 'Unavailable');
}

async function loadDashboardForecast() {
    const status = document.getElementById('dashboardForecastStatus');
    if (status) status.textContent = 'Refreshing 24-hour forecast...';

    try {
        const base = await resolveDashboardPredictionApi();
        const hourlyResult = await fetchDashboardForecast(base, '/forecast/24h');
        renderDashboardHourlyForecast(hourlyResult.hours, hourlyResult.source);

        const updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (status) status.textContent = `24-hour ${hourlyResult.source || 'API'} forecast · Updated ${updatedAt}.`;
    } catch (error) {
        markDashboardHourlyForecastUnavailable();
        if (status) status.textContent = `${error.message}. Check the prediction API URL and ensure the backend is running.`;
        console.error('Dashboard forecast refresh failed:', error);
    }
}

function setupEventListeners() {
    const weatherRange = document.getElementById('weatherTimeRange');
    if (weatherRange) weatherRange.addEventListener('change', () => loadWeatherGraphFromFirebase(parseInt(weatherRange.value)));
    const pollutionRange = document.getElementById('pollutionTimeRange');
    if (pollutionRange) pollutionRange.addEventListener('change', () => loadPollutionGraphFromFirebase(parseInt(pollutionRange.value)));
    const refreshWeather = document.getElementById('refreshWeatherGraph');
    if (refreshWeather) refreshWeather.addEventListener('click', () => loadWeatherGraphFromFirebase(parseInt(document.getElementById('weatherTimeRange').value)));
    const refreshPollution = document.getElementById('refreshPollutionGraph');
    if (refreshPollution) refreshPollution.addEventListener('click', () => loadPollutionGraphFromFirebase(parseInt(document.getElementById('pollutionTimeRange').value)));
}

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const el = document.getElementById('currentTime');
    if (el) el.textContent = timeStr;
}

async function loadLatestDataFromFirebase() {
    if (!window.firebaseHelpers || !window.firebaseHelpers.firebaseInitialized) {
        showDemoSensorReadings();
        setTimeout(loadLatestDataFromFirebase, 2000);
        return;
    }
    try {
        const weatherData = await getLatestFromFirebase('weather_data', 1);
        const pollutionData = await getLatestFromFirebase('pollution_data', 1);
        if (!weatherData?.length && !pollutionData?.length) {
            showDemoSensorReadings();
            return;
        }

        currentSensorData = {
            temperature: null, humidity: null, pressure: null,
            pm2_5: null, pm10: null, aqi: null, rainfall: null,
            voc: null, nox: null, co2: null, light: null,
            windSpeed: null, windDirection: null, co: null
        };
        setDashboardDataMode('LIVE');
        if (weatherData?.length) {
            const w = weatherData[0];
            currentSensorData.temperature = w.temperature;
            currentSensorData.humidity = w.humidity;
            currentSensorData.pressure = w.pressure;
            currentSensorData.rainfall = w.rainfall;
            currentSensorData.light = w.light;
            currentSensorData.windSpeed = w.windSpeed;
            currentSensorData.windDirection = w.windDirection;
        }
        if (pollutionData?.length) {
            const p = pollutionData[0];
            currentSensorData.pm2_5 = p.pm2_5;      // ✅ fixed field name
            currentSensorData.pm10 = p.pm10;
            currentSensorData.aqi = p.aqi;
            currentSensorData.voc = p.voc;
            currentSensorData.nox = p.nox;
            currentSensorData.co2 = p.co2;
            currentSensorData.co = p.co;
        }
        updateDashboardUI();
        updateTicker();
    } catch (error) {
        console.error(error);
        showDemoSensorReadings();
    }
}

function setDashboardDataMode(mode) {
    const badge = document.getElementById('dashboardDataBadge');
    const label = document.getElementById('dashboardDataMode');
    if (badge) badge.classList.toggle('demo', mode === 'DEMO');
    if (label) label.textContent = mode;
}

function showDemoSensorReadings() {
    const phase = Date.now() / (30 * 60 * 1000) * 2 * Math.PI;
    currentSensorData = {
        temperature: 29.5 + 1.2 * Math.sin(phase),
        humidity: 80 - 2.5 * Math.sin(phase),
        pressure: 1011.5 + 0.6 * Math.sin(phase / 2),
        pm2_5: 12 + 1.5 * Math.sin(phase),
        pm10: 31 + 3 * Math.sin(phase),
        aqi: 50 + 4 * Math.sin(phase),
        rainfall: 0,
        voc: 120 + 5 * Math.sin(phase),
        nox: 8 + Math.sin(phase),
        co2: 420 + 4 * Math.sin(phase),
        light: 850,
        windSpeed: 3.75 + 0.6 * Math.sin(phase / 2),
        windDirection: 225,
        co: 0.4
    };
    setDashboardDataMode('DEMO');
    updateDashboardUI();
    updateTicker();
}

function updateTicker() {
    const setTicker = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };
    if (currentSensorData.temperature != null) setTicker('tickerTemp', Number(currentSensorData.temperature).toFixed(1));
    if (currentSensorData.humidity != null) setTicker('tickerHum', Number(currentSensorData.humidity).toFixed(1));
    if (currentSensorData.aqi != null) setTicker('tickerAQI', Math.round(Number(currentSensorData.aqi)));
    if (currentSensorData.pm2_5 != null) setTicker('tickerPM25', Number(currentSensorData.pm2_5).toFixed(1));
    if (currentSensorData.light != null) setTicker('tickerLight', Number(currentSensorData.light).toFixed(0));
}

function updateDashboardUI() {
    // Helper: safely set text content
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    if (currentSensorData.temperature != null) {
        setText('currentTemp', Number(currentSensorData.temperature).toFixed(1));
        setText('heroTemp', Number(currentSensorData.temperature).toFixed(1));
    } else {
        setText('currentTemp', '--');
        setText('heroTemp', '--');
    }
    setText('currentHumidity', currentSensorData.humidity != null ? Number(currentSensorData.humidity).toFixed(1) : '--');
    if (currentSensorData.pressure != null) {
        const p = Number(currentSensorData.pressure).toFixed(0);
        setText('currentPressure', p);
        setText('pressureSummary', p + ' hPa');
    } else {
        setText('currentPressure', '--');
        setText('pressureSummary', '-- hPa');
    }
    if (currentSensorData.aqi != null) {
        const aqi = Math.round(Number(currentSensorData.aqi));
        setText('currentAQI', aqi);
        setText('heroAQI', aqi);
        updateAQIStatus(Number(currentSensorData.aqi));
        updateAQIBadge(Number(currentSensorData.aqi));
    } else {
        setText('currentAQI', '--');
        setText('heroAQI', '--');
        setText('aqiStatus', 'Unavailable');
        setText('heroAQIStatus', 'Unavailable');
        setText('aqiLevel', '--');
    }
    if (currentSensorData.pm2_5 != null) {
        setText('heroPM25', Number(currentSensorData.pm2_5).toFixed(1));
        setText('currentPM25', Number(currentSensorData.pm2_5).toFixed(1));
    } else {
        setText('heroPM25', '--');
        setText('currentPM25', '--');
    }
    setText('currentPM10', currentSensorData.pm10 != null ? Number(currentSensorData.pm10).toFixed(1) : '--');
    setText('currentRainfall', currentSensorData.rainfall != null ? Number(currentSensorData.rainfall).toFixed(1) : '--');
    setText('currentVOC', currentSensorData.voc != null ? Number(currentSensorData.voc).toFixed(1) : '--');
    setText('currentNOx', currentSensorData.nox != null ? Number(currentSensorData.nox).toFixed(1) : '--');
    if (currentSensorData.co2 != null) {
        const el = document.getElementById('currentCO2');
        if (el) el.textContent = Number(currentSensorData.co2).toFixed(0);
    }
    if (currentSensorData.co != null) {
        setText('currentCO', Number(currentSensorData.co).toFixed(2));
    } else setText('currentCO', '--');
    if (currentSensorData.light != null) {
        setText('currentLight', Number(currentSensorData.light).toFixed(0));
        const uv = calculateUVLevel(Number(currentSensorData.light));
        setText('uvSummary', uv.uv);
        setText('uvLevel', uv.level);
    } else setText('currentLight', '--');
    if (currentSensorData.windSpeed != null) {
        setText('currentWind', Number(currentSensorData.windSpeed).toFixed(1));
        setText('windSummary', Number(currentSensorData.windSpeed).toFixed(1) + ' m/s');
    } else {
        setText('currentWind', '--');
        setText('windSummary', '-- m/s');
    }
    if (currentSensorData.windDirection != null) {
        setText('currentWindDir', Number(currentSensorData.windDirection).toFixed(0));
        const windDirection = Number(currentSensorData.windDirection);
        const dir =
            (windDirection >= 315 || windDirection < 45) ? "N" :
            (windDirection < 135) ? "E" :
            (windDirection < 225) ? "S" : "W";
        setText('windDirSummary', dir);
    } else setText('currentWindDir', '--');
    updateSunriseSunset();
    setText('lastUpdateTime', new Date().toLocaleTimeString());
}

function updateAQIStatus(aqi) {
    const el = document.getElementById('aqiStatus');
    let status = "Good", color = "#00cc66";
    if (aqi > 200) { status = "Very Unhealthy"; color = "#ff3333"; }
    else if (aqi > 150) { status = "Unhealthy"; color = "#ff6666"; }
    else if (aqi > 100) { status = "Unhealthy for Sensitive"; color = "#ff9933"; }
    else if (aqi > 50) { status = "Moderate"; color = "#ffcc00"; }
    if (el) {
        el.textContent = status;
        el.style.color = color;
        el.style.background = color + '20';
        el.style.padding = '2px 8px';
        el.style.borderRadius = '10px';
    }
    return status;
}

function updateAQIBadge(aqi) {
    const badge = document.getElementById('aqiLevel');
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
}

function calculateUVLevel(light) {
    if (!light) return { uv: '--', level: '--' };
    if (light > 50000) return { uv: 8, level: 'Very High' };
    if (light > 30000) return { uv: 6, level: 'High' };
    if (light > 10000) return { uv: 4, level: 'Moderate' };
    if (light > 5000) return { uv: 2, level: 'Low' };
    return { uv: 1, level: 'Low' };
}

function updateSunriseSunset() {
    const now = new Date();
    const month = now.getMonth();
    let sunriseHour = 6, sunsetHour = 18;
    if (month >= 5 && month <= 7) { sunriseHour = 5; sunsetHour = 20; }
    else if (month >= 10 || month <= 2) { sunriseHour = 7; sunsetHour = 17; }
    const sunrise = document.getElementById('sunrise');
    const sunset = document.getElementById('sunset');
    if (sunrise) sunrise.textContent = `${sunriseHour.toString().padStart(2,'0')}:30 AM`;
    if (sunset) sunset.textContent = `${(sunsetHour-12).toString().padStart(2,'0')}:30 PM`;
}

async function loadWeatherGraphFromFirebase(results = 20) {
    if (!window.firebaseHelpers?.firebaseInitialized) { setTimeout(() => loadWeatherGraphFromFirebase(results), 1000); return; }
    try {
        const weatherData = await getLatestFromFirebase('weather_data', results);
        if (!weatherData || weatherData.length === 0) { showDemoWeatherChart(); return; }
        const labels = weatherData.map(item => new Date(item.timestamp).toLocaleString([], {  hour:'2-digit', minute:'2-digit' }));
        const datasets = [];
        const temp = weatherData.map(i => i.temperature || 0);
        if (temp.some(v=>v>0)) datasets.push({ label:'Temperature (°C)', data:temp, borderColor:'#ff4757', backgroundColor:'#ff475720', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const hum = weatherData.map(i => i.humidity || 0);
        if (hum.some(v=>v>0)) datasets.push({ label:'Humidity (%)', data:hum, borderColor:'#3742fa', backgroundColor:'#3742fa20', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const pres = weatherData.map(i => i.pressure || 0);
        if (pres.some(v=>v>0)) datasets.push({ label:'Pressure (hPa)', data:pres, borderColor:'#1abc9c', backgroundColor:'#1abc9c20', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const rain = weatherData.map(i => i.rainfall || 0);
        if (rain.some(v=>v>0)) datasets.push({ label:'Rainfall (mm)', data:rain, borderColor:'#3498db', backgroundColor:'#3498db20', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const light = weatherData.map(i => i.light || 0);
        if (light.some(v=>v>0)) datasets.push({ label:'Light (lux)', data:light, borderColor:'#f1c40f', backgroundColor:'#f1c40f20', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const windSpeed = weatherData.map(i => i.windSpeed || 0);
        if (windSpeed.some(v => v !== null && v !== undefined)) datasets.push({ label:'Wind Speed (m/s)', data:windSpeed, borderColor:'#00ff88', backgroundColor:'#00ff8820', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const windDirection = weatherData.map(i => i.windDirection || 0);
        if (windDirection.some(v => v !== null && v !== undefined)) datasets.push({ label:'Wind Direction (°)', data:windDirection, borderColor:'#ff00ff', backgroundColor:'#ff00ff20', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        renderWeatherChart(labels, datasets);
    } catch(e) { showDemoWeatherChart(); }
}

async function loadPollutionGraphFromFirebase(results = 20) {
    if (!window.firebaseHelpers?.firebaseInitialized) { setTimeout(() => loadPollutionGraphFromFirebase(results), 1000); return; }
    try {
        const pollutionData = await getLatestFromFirebase('pollution_data', results);
        if (!pollutionData || pollutionData.length === 0) { showDemoPollutionChart(); return; }
        const labels = pollutionData.map(item => {
            const d = new Date(item.timestamp);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        const datasets = [];
        const aqi = pollutionData.map(i => i.aqi || 0);
        if (aqi.some(v=>v>0)) datasets.push({ label:'AQI', data:aqi, borderColor:'#4da6ff', backgroundColor:'#4da6ff20', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const pm25 = pollutionData.map(i => i.pm2_5 || 0);
        if (pm25.some(v=>v>0)) datasets.push({ label:'PM2.5 (µg/m³)', data:pm25, borderColor:'#ff6b6b', backgroundColor:'#ff6b6b20', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const pm10 = pollutionData.map(i => i.pm10 || 0);
        if (pm10.some(v=>v>0)) datasets.push({ label:'PM10 (µg/m³)', data:pm10, borderColor:'#ffa726', backgroundColor:'#ffa72620', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const voc = pollutionData.map(i => i.voc || 0);
        if (voc.some(v=>v>0)) datasets.push({ label:'VOC (ppb)', data:voc, borderColor:'#f39c12', backgroundColor:'#f39c1220', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const nox = pollutionData.map(i => i.nox || 0);
        if (nox.some(v=>v>0)) datasets.push({ label:'NOx (ppb)', data:nox, borderColor:'#e74c3c', backgroundColor:'#e74c3c20', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        const co2 = pollutionData.map(i => i.co2 || 0);
        if (co2.some(v => v > 0)) {
            datasets.push({ label:'CO₂ (ppm)', data:co2, borderColor:'#00e676', backgroundColor:'#00e67620', borderWidth:2, fill:true, tension:0.4, pointRadius:3, spanGaps:true });
        }
        const co = pollutionData.map(i => i.co || 0);
        if (co.some(v => v > 0 || v === 0)) {
            datasets.push({ label:'CO (ppm)', data:co, borderColor:'#9b59b6', backgroundColor:'#9b59b620', borderWidth:2, fill:true, tension:0.4, pointRadius:3 });
        }
        renderPollutionChart(labels, datasets);
    } catch(e) { showDemoPollutionChart(); }
}

function renderWeatherChart(labels, datasets) {
    const canvas = document.getElementById('weatherGraph');
    if (!canvas) return;
    if (weatherChart) weatherChart.destroy();
    weatherChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#fff' } },
                tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#fff', bodyColor: '#fff' }
            },
            scales: {
                y: { display: false, grid: { display: false } }
            }
        }
    });
}

function renderPollutionChart(labels, datasets) {
    const canvas = document.getElementById('pollutionGraph');
    if (!canvas) return;
    if (pollutionChart) pollutionChart.destroy();
    pollutionChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#fff' } },
                tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#fff', bodyColor: '#fff' }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#a0b3d6' } },
                y: { display: false, grid: { display: false }, beginAtZero: true }
            }
        }
    });
}

function showDemoWeatherChart() {
    const now = new Date();
    const labels = Array.from({length:20}, (_,i) => new Date(now.getTime() - (19-i)*5*60000).toLocaleString([], {  hour:'2-digit', minute:'2-digit' }));
    const smoothSeries = (base, amplitude, phase = 0) => Array.from(
        { length: 20 },
        (_, index) => base + amplitude * Math.sin(index * 0.22 + phase)
    );
    const datasets = [
        { label:'Temperature (°C)', data:smoothSeries(29.5, 1.4), borderColor:'#ff4757', backgroundColor:'#ff475720', fill:true, tension:0.4, pointRadius:3 },
        { label:'Humidity (%)', data:smoothSeries(80, 2.5), borderColor:'#3742fa', backgroundColor:'#3742fa20', fill:true, tension:0.4, pointRadius:3 },
        { label:'Pressure (hPa)', data:smoothSeries(1011.5, 0.6), borderColor:'#1abc9c', backgroundColor:'#1abc9c20', fill:true, tension:0.4, pointRadius:3 },
        { label:'Rainfall (mm)', data:smoothSeries(0.1, 0.1), borderColor:'#3498db', backgroundColor:'#3498db20', fill:true, tension:0.4, pointRadius:3 },
        { label:'Light (lux)', data:smoothSeries(850, 120), borderColor:'#f1c40f', backgroundColor:'#f1c40f20', fill:true, tension:0.4, pointRadius:3 },
        { label:'Wind Speed (m/s)', data:smoothSeries(3.75, 0.7), borderColor:'#00ff88', backgroundColor:'#00ff8820', fill:true, tension:0.4, pointRadius:3 }
    ];
    renderWeatherChart(labels, datasets);
}

function showDemoPollutionChart() {
    const now = new Date();
    const labels = Array.from({length:20}, (_,i) => new Date(now.getTime() - (19-i)*5*60000).toLocaleString([], {  hour:'2-digit', minute:'2-digit' }));
    const smoothSeries = (base, amplitude) => Array.from(
        { length: 20 },
        (_, index) => base + amplitude * Math.sin(index * 0.22)
    );
    const datasets = [
        { label:'AQI', data:smoothSeries(50, 6), borderColor:'#4da6ff', backgroundColor:'#4da6ff20', fill:true, tension:0.4, pointRadius:3 },
        { label:'PM2.5 (µg/m³)', data:smoothSeries(16.5, 4), borderColor:'#ff6b6b', backgroundColor:'#ff6b6b20', fill:true, tension:0.4, pointRadius:3 },
        { label:'PM10 (µg/m³)', data:smoothSeries(35, 8), borderColor:'#ffa726', backgroundColor:'#ffa72620', fill:true, tension:0.4, pointRadius:3 },
        { label:'VOC (ppb)', data:smoothSeries(220, 15), borderColor:'#f39c12', backgroundColor:'#f39c1220', fill:true, tension:0.4, pointRadius:3 },
        { label:'NOx (ppb)', data:smoothSeries(8, 1), borderColor:'#e74c3c', backgroundColor:'#e74c3c20', fill:true, tension:0.4, pointRadius:3 },
        { label:'CO₂ (ppm)', data:smoothSeries(420, 8), borderColor:'#00e676', backgroundColor:'#00e67620', fill:true, tension:0.4, pointRadius:3 },
        { label:'CO (ppm)', data:smoothSeries(0.5, 0.1), borderColor:'#9b59b6', backgroundColor:'#9b59b620', fill:true, tension:0.4, pointRadius:3 }
    ];
    renderPollutionChart(labels, datasets);
}