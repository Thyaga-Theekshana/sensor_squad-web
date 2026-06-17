// predictions.js — ML-powered 24h + API 7-day forecasting

const PREDICTION_API_BASE = window.PREDICTION_API_URL || 'http://127.0.0.1:5001';

let currentData = {
    temp: 26.5,
    humidity: 62.0,
    pressure: 1012.0,
    aqi: 42.0,
    pm25: 12.5,
    pm10: 18.0,
    light: 850,
    rainfall: 0,
    windSpeed: 2.5
};

let hourlyForecast = [];
let weeklyForecast = [];
let chartInstance = null;
let activeParam = 'temperature';
let mlPredictions = null;
let apiMeta = { modelLoaded: false, source: 'fallback' };
let initRetryCount = 0;

document.addEventListener('DOMContentLoaded', function () {
    updateClock();
    setInterval(updateClock, 1000);
    createParticles();
    setupTabListeners();
    setupSimulator();
    initPredictions();
});

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('currentTime');
    if (clockEl) {
        clockEl.textContent = `${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | ${now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
}

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 8 + 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${Math.random() * 12 + 10}s`;
        container.appendChild(particle);
    }
}

function setupTabListeners() {
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            activeParam = this.getAttribute('data-param');
            renderForecastChart();
        });
    });
}

// ─── AQI helpers ───────────────────────────────────────────────

function getAQICategory(aqi) {
    if (aqi <= 50) return { level: 'GOOD', label: 'Good', color: '#00cc66', advice: 'Air quality is satisfactory. Ideal for outdoor activities.' };
    if (aqi <= 100) return { level: 'MODERATE', label: 'Moderate', color: '#ffcc00', advice: 'Acceptable for most people. Sensitive groups should limit prolonged exertion.' };
    if (aqi <= 150) return { level: 'SENSITIVE', label: 'Unhealthy for Sensitive Groups', color: '#ff9933', advice: 'Children, elderly, and those with respiratory issues should reduce outdoor activity.' };
    if (aqi <= 200) return { level: 'UNHEALTHY', label: 'Unhealthy', color: '#ff6666', advice: 'Everyone may experience health effects. Limit outdoor exposure.' };
    if (aqi <= 300) return { level: 'VERY UNHEALTHY', label: 'Very Unhealthy', color: '#cc3333', advice: 'Health alert — avoid outdoor activities. Use air purifiers indoors.' };
    return { level: 'HAZARDOUS', label: 'Hazardous', color: '#990099', advice: 'Emergency conditions. Stay indoors with sealed windows.' };
}

function pm25FromAQI(aqi) {
    return Math.max(1, parseFloat((aqi * 0.28).toFixed(1)));
}

function updateCurrentAQIDisplay() {
    const aqi = Math.round(currentData.aqi);
    const cat = getAQICategory(aqi);
    const pm25 = currentData.pm25 || pm25FromAQI(aqi);
    const pm10 = currentData.pm10 || parseFloat((pm25 * 1.6).toFixed(1));

    const valueEl = document.getElementById('currentAqiValue');
    const badgeEl = document.getElementById('currentAqiBadge');
    const labelEl = document.getElementById('currentAqiLabel');
    const pm25El = document.getElementById('currentPm25');
    const pm10El = document.getElementById('currentPm10');
    const adviceEl = document.getElementById('currentAqiAdvice');
    const ringEl = document.getElementById('currentAqiRing');
    const cardEl = document.getElementById('currentAqiCard');

    if (valueEl) valueEl.textContent = aqi;
    if (badgeEl) {
        badgeEl.textContent = cat.level;
        badgeEl.style.background = cat.color + '22';
        badgeEl.style.borderColor = cat.color;
        badgeEl.style.color = cat.color;
    }
    if (labelEl) labelEl.textContent = cat.label;
    if (pm25El) pm25El.textContent = pm25.toFixed(1);
    if (pm10El) pm10El.textContent = pm10.toFixed(1);
    if (adviceEl) adviceEl.textContent = cat.advice;
    if (ringEl) {
        const pct = Math.min(aqi / 300, 1);
        ringEl.style.strokeDashoffset = 502 - pct * 502;
        ringEl.style.stroke = cat.color;
        ringEl.style.filter = `drop-shadow(0 0 8px ${cat.color})`;
    }
    if (cardEl) cardEl.style.borderColor = cat.color + '55';

    const tempEl = document.getElementById('currentAqiTemp');
    const humEl = document.getElementById('currentAqiHum');
    if (tempEl) tempEl.textContent = `${currentData.temp.toFixed(1)} °C`;
    if (humEl) humEl.textContent = `${currentData.humidity.toFixed(0)} %`;

    document.querySelectorAll('.aqi-scale-item').forEach(item => {
        const max = parseInt(item.dataset.max, 10);
        const min = parseInt(item.dataset.min, 10);
        item.classList.toggle('active', aqi >= min && aqi <= max);
    });

    const trendEl = document.getElementById('aqiTrendText');
    if (trendEl && hourlyForecast.length > 6) {
        const later = hourlyForecast[6].aqi;
        const diff = later - aqi;
        if (diff > 8) trendEl.innerHTML = `<i class="fas fa-arrow-trend-up"></i> Rising +${Math.round(diff)} by 6h (watch evening traffic)`;
        else if (diff < -8) trendEl.innerHTML = `<i class="fas fa-arrow-trend-down"></i> Improving ${Math.round(diff)} by 6h`;
        else trendEl.innerHTML = `<i class="fas fa-minus"></i> Stable over next 6 hours`;
    }
}

function updateDataSourceBadge() {
    const badge = document.getElementById('forecastSourceBadge');
    if (!badge) return;
    const ml = apiMeta.modelLoaded ? 'LSTM 24h' : 'Statistical 24h';
    const week = apiMeta.sevenDaySource === 'open-meteo' ? 'Open-Meteo 7-day' : '7-day unavailable';
    badge.className = apiMeta.modelLoaded ? 'source-badge ml' : 'source-badge fallback';
    badge.innerHTML = `<i class="fas fa-satellite"></i> ${ml} · ${week} · Moratuwa`;
}

// ─── Firebase data ─────────────────────────────────────────────

async function loadFirebaseData() {
    if (!window.firebaseHelpers?.firebaseInitialized) {
        if (initRetryCount < 8) {
            initRetryCount++;
            setTimeout(initPredictions, 2000);
        }
        return null;
    }

    const weatherData = await getLatestFromFirebase('weather_data', 48);
    const pollutionData = await getLatestFromFirebase('pollution_data', 48);

    if (weatherData?.length) {
        const latestW = weatherData[0];
        if (latestW.temperature != null) currentData.temp = latestW.temperature;
        if (latestW.humidity != null) currentData.humidity = latestW.humidity;
        if (latestW.pressure != null) currentData.pressure = latestW.pressure;
        if (latestW.light != null) currentData.light = latestW.light;
        if (latestW.rainfall != null) currentData.rainfall = latestW.rainfall;
    }

    if (pollutionData?.length) {
        const latestP = pollutionData[0];
        if (latestP.aqi != null) currentData.aqi = latestP.aqi;
        if (latestP.pm25 != null) currentData.pm25 = latestP.pm25;
        if (latestP.pm10 != null) currentData.pm10 = latestP.pm10;
    }

    return mergeHistoryRecords(weatherData || [], pollutionData || []);
}

function mergeHistoryRecords(weatherRows, pollutionRows) {
    const byTs = {};

    weatherRows.forEach(row => {
        const ts = row.timestamp || row.id;
        if (!ts) return;
        byTs[ts] = {
            datetime: new Date(ts).toISOString(),
            timestamp: ts,
            temperature: row.temperature ?? currentData.temp,
            humidity: row.humidity ?? currentData.humidity,
            pressure: row.pressure ?? currentData.pressure,
            rainfall: row.rainfall ?? 0,
            light_intensity: row.light ?? currentData.light,
            wind_speed: row.wind_speed ?? currentData.windSpeed,
            wind_direction: row.wind_direction ?? 180,
            voc: 100,
            pm2_5: currentData.pm25,
            co2: 400
        };
    });

    pollutionRows.forEach(row => {
        const ts = row.timestamp || row.id;
        if (!ts) return;
        if (!byTs[ts]) {
            byTs[ts] = {
                datetime: new Date(ts).toISOString(),
                timestamp: ts,
                temperature: currentData.temp,
                humidity: currentData.humidity,
                pressure: currentData.pressure,
                rainfall: 0,
                light_intensity: currentData.light,
                wind_speed: currentData.windSpeed,
                wind_direction: 180,
                voc: 100,
                pm2_5: row.pm25 ?? currentData.pm25,
                co2: 400
            };
        }
        if (row.pm25 != null) byTs[ts].pm2_5 = row.pm25;
        if (row.aqi != null) byTs[ts].aqi = row.aqi;
    });

    return Object.values(byTs).sort((a, b) => a.timestamp - b.timestamp);
}

// ─── ML API ────────────────────────────────────────────────────

async function fetchApiHealth() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${PREDICTION_API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

async function postPredictionApi(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${PREDICTION_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
        signal: controller.signal
    });
    clearTimeout(timer);
    return res.json();
}

async function fetchMLPrediction(historyRecords) {
    const health = await fetchApiHealth();
    if (!health?.model_loaded) {
        apiMeta = { modelLoaded: false, source: 'fallback' };
        return null;
    }

    try {
        let json;
        if (historyRecords?.length >= 3) {
            json = await postPredictionApi('/predict', { data: historyRecords });
        } else {
            json = await postPredictionApi('/predict-from-firebase', {});
        }
        if (json.success && json.predictions) {
            apiMeta = { modelLoaded: true, source: 'ml', horizon: json.predictions.forecast_horizon_hours || 48 };
            return json.predictions;
        }
    } catch (err) {
        console.warn('ML API unavailable:', err.message);
    }

    apiMeta = { modelLoaded: false, source: 'fallback' };
    return null;
}

function buildHourlyFromML(ml, useFallbackOnly) {
    hourlyForecast = [];
    const now = new Date();
    const mlTemp = ml?.temperature ?? currentData.temp;
    const mlHum = ml?.humidity ?? currentData.humidity;
    const mlPres = ml?.pressure ?? currentData.pressure;
    const mlWind = ml?.wind_speed ?? currentData.windSpeed;
    const mlRain = ml?.rainfall ?? 0;

    for (let i = 0; i < 24; i++) {
        const forecastTime = new Date(now.getTime() + i * 3600000);
        const hour = forecastTime.getHours();
        const t = i / 23;

        const diurnalTemp = 4.5 * Math.cos(2 * Math.PI * (hour - 15) / 24);
        const diurnalHum = -15 * Math.cos(2 * Math.PI * (hour - 15) / 24);

        const temp = useFallbackOnly
            ? currentData.temp + diurnalTemp
            : currentData.temp + (mlTemp - currentData.temp) * t + diurnalTemp * (1 - t * 0.5);

        const humidity = useFallbackOnly
            ? Math.max(10, Math.min(100, currentData.humidity + diurnalHum))
            : Math.max(10, Math.min(100, currentData.humidity + (mlHum - currentData.humidity) * t + diurnalHum * (1 - t * 0.5)));

        const pressure = useFallbackOnly
            ? currentData.pressure + 1.2 * Math.cos(4 * Math.PI * (hour - 10) / 24)
            : currentData.pressure + (mlPres - currentData.pressure) * t + 0.8 * Math.cos(4 * Math.PI * (hour - 10) / 24);

        let trafficFactor = 0;
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) trafficFactor = 15;
        else if (hour >= 21 || hour <= 4) trafficFactor = 8;
        else trafficFactor = -5;

        const windDispersion = Math.exp(-0.03 * (useFallbackOnly ? 10 : mlWind));
        const rainWash = mlRain > 0.5 ? -12 : 0;
        const aqi = Math.max(5, Math.round(
            currentData.aqi + trafficFactor * windDispersion + rainWash + Math.sin(2 * Math.PI * hour / 24) * 4
        ));

        hourlyForecast.push({
            timeLabel: forecastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            temperature: parseFloat(temp.toFixed(1)),
            humidity: parseFloat(humidity.toFixed(0)),
            pressure: parseFloat(pressure.toFixed(1)),
            aqi
        });
    }
}

async function fetchSevenDayForecast() {
    weeklyForecast = [];
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`${PREDICTION_API_BASE}/forecast/7day`, { signal: controller.signal });
        clearTimeout(timer);
        const json = await res.json();

        if (json.success && json.forecast?.days?.length) {
            weeklyForecast = json.forecast.days.map(day => ({
                day: day.day,
                dateLabel: day.dateLabel,
                icon: day.icon,
                type: day.type,
                desc: day.desc,
                max: day.max,
                min: day.min,
                aqi: day.aqi,
                precipitation_mm: day.precipitation_mm,
                source: 'open-meteo'
            }));
            apiMeta.sevenDaySource = 'open-meteo';
            apiMeta.sevenDayProvider = json.forecast.provider;
            renderWeeklyGrid();
            return true;
        }
    } catch (err) {
        console.warn('Open-Meteo 7-day forecast failed:', err.message);
    }

    apiMeta.sevenDaySource = null;
    const grid = document.getElementById('forecast7DayGrid');
    if (grid) {
        grid.innerHTML = `<div class="forecast-error"><i class="fas fa-exclamation-triangle"></i> 7-day forecast unavailable. Start the prediction API on port 5001.</div>`;
    }
    return false;
}

function renderWeeklyGrid() {
    const grid = document.getElementById('forecast7DayGrid');
    if (!grid) return;
    grid.innerHTML = '';

    weeklyForecast.forEach(day => {
        const aqiVal = day.aqi;
        const aqiLabel = aqiVal != null ? `AQI ${Math.round(aqiVal)}` : 'AQI N/A';
        const cat = aqiVal != null ? getAQICategory(aqiVal) : { color: '#a0b3d6' };
        let aqiClass = 'good';
        if (aqiVal > 50) aqiClass = 'mod';
        if (aqiVal > 100) aqiClass = 'unhealth';

        const rainNote = day.precipitation_mm > 0 ? `<div class="forecast-rain"><i class="fas fa-tint"></i> ${day.precipitation_mm} mm</div>` : '';

        const card = document.createElement('div');
        card.className = `forecast-card ${day.day === 'Today' ? 'today' : ''}`;
        card.innerHTML = `
            <div class="forecast-day">${day.day}</div>
            <div class="forecast-date">${day.dateLabel}</div>
            <div class="forecast-icon ${day.type}"><i class="fas ${day.icon}"></i></div>
            <div class="forecast-desc">${day.desc}</div>
            ${rainNote}
            <div class="forecast-temp">
                <span class="max">${day.max}°</span>
                <span class="min">${day.min}°</span>
            </div>
            <span class="forecast-aqi ${aqiClass}" style="border-color:${cat.color};color:${cat.color}">${aqiLabel}</span>
        `;
        grid.appendChild(card);
    });
}

// ─── AI Insights (prediction-driven) ───────────────────────────

function generateAIInsights() {
    const list = document.getElementById('aiInsightsList');
    if (!list) return;
    list.innerHTML = '';
    const insights = [];

    const maxAqiHour = hourlyForecast.reduce((best, h, i) => h.aqi > hourlyForecast[best].aqi ? i : best, 0);
    const minAqiHour = hourlyForecast.reduce((best, h, i) => h.aqi < hourlyForecast[best].aqi ? i : best, 0);
    const peakAqi = hourlyForecast[maxAqiHour]?.aqi ?? currentData.aqi;
    const bestAqi = hourlyForecast[minAqiHour]?.aqi ?? currentData.aqi;
    const avgTemp = hourlyForecast.reduce((s, h) => s + h.temperature, 0) / (hourlyForecast.length || 1);
    const worstDay = weeklyForecast.reduce((w, d) => d.aqi > w.aqi ? d : w, weeklyForecast[0] || { aqi: 0, day: '—' });
    const bestDay = weeklyForecast.reduce((b, d) => d.aqi < b.aqi ? d : b, weeklyForecast[0] || { aqi: 999, day: '—' });

    if (apiMeta.modelLoaded) {
        insights.push({
            type: 'success',
            icon: 'fa-robot',
            title: 'LSTM Model Active (24h)',
            text: `Hourly projections use your Moratuwa-trained LSTM (horizon ${apiMeta.horizon || 48}h). Weekly outlook uses live Open-Meteo forecasts.`
        });
    }

    if (apiMeta.sevenDaySource === 'open-meteo') {
        const rainyDays = weeklyForecast.filter(d => d.precipitation_mm > 5);
        insights.push({
            type: rainyDays.length ? 'info' : 'success',
            icon: 'fa-satellite-dish',
            title: 'Open-Meteo 7-Day Forecast (Moratuwa)',
            text: rainyDays.length
                ? `Real forecast data shows rain on ${rainyDays.map(d => d.day).join(', ')} (${rainyDays.map(d => d.precipitation_mm + 'mm').join(', ')}). Data from ERA5/CAMS via open-meteo.com.`
                : 'Seven-day outlook from Open-Meteo live forecast API for University of Moratuwa coordinates (6.796°N, 79.901°E).'
        });
    }

    if (peakAqi > 100) {
        insights.push({
            type: 'warning',
            icon: 'fa-lungs',
            title: `AQI Peak Forecast: ${peakAqi} at ${hourlyForecast[maxAqiHour]?.timeLabel}`,
            text: `Air quality may reach "${getAQICategory(peakAqi).label}" levels. Sensitive groups should avoid outdoor exertion around this window. Best air expected at ${hourlyForecast[minAqiHour]?.timeLabel} (AQI ${bestAqi}).`
        });
    } else if (peakAqi <= 50) {
        insights.push({
            type: 'success',
            icon: 'fa-leaf',
            title: 'Excellent Air Quality Expected',
            text: `All 24 projected hours stay in the Good range (peak AQI ${peakAqi}). Safe for outdoor sports and ventilation.`
        });
    } else {
        insights.push({
            type: 'info',
            icon: 'fa-wind',
            title: `Moderate Air — Peak AQI ${peakAqi}`,
            text: `Peak at ${hourlyForecast[maxAqiHour]?.timeLabel}, improving to ${bestAqi} by ${hourlyForecast[minAqiHour]?.timeLabel}. Generally acceptable for healthy adults.`
        });
    }

    if (avgTemp > currentData.temp + 2) {
        insights.push({
            type: 'warning',
            icon: 'fa-temperature-high',
            title: 'Warming Trend Detected',
            text: `Average projected temperature (${avgTemp.toFixed(1)}°C) is above current (${currentData.temp.toFixed(1)}°C). Heat may increase ozone formation — watch AQI in afternoon hours.`
        });
    } else if (avgTemp < currentData.temp - 2) {
        insights.push({
            type: 'info',
            icon: 'fa-temperature-low',
            title: 'Cooling Trend Ahead',
            text: `Temperatures trending down to ~${avgTemp.toFixed(1)}°C average. Nighttime thermal inversions possible — particulates may accumulate before dawn.`
        });
    }

    if (currentData.pressure < 1010 || mlPredictions?.rainfall > 0.3) {
        insights.push({
            type: 'info',
            icon: 'fa-cloud-rain',
            title: 'Precipitation Signal in Model',
            text: `Pressure at ${currentData.pressure.toFixed(1)} hPa${mlPredictions?.rainfall > 0 ? ` with ${mlPredictions.rainfall.toFixed(1)} mm rain forecast` : ''}. Rain typically washes particulates — expect temporary AQI improvement after showers.`
        });
    }

    insights.push({
        type: worstDay.aqi > 100 ? 'warning' : 'info',
        icon: 'fa-calendar-week',
        title: `7-Day Outlook: Best ${bestDay.day}, Watch ${worstDay.day}`,
        text: `Lowest weekly AQI ~${bestDay.aqi} (${bestDay.day}). Highest ~${worstDay.aqi} (${worstDay.day}, ${worstDay.desc}). Plan outdoor activities accordingly.`
    });

    insights.forEach(item => {
        const card = document.createElement('div');
        card.className = `insight-card ${item.type}`;
        card.innerHTML = `
            <div class="insight-icon"><i class="fas ${item.icon}"></i></div>
            <div class="insight-info"><h4>${item.title}</h4><p>${item.text}</p></div>
        `;
        list.appendChild(card);
    });
}

// ─── Init orchestration ──────────────────────────────────────────

async function initPredictions() {
    const history = await loadFirebaseData();
    if (history === null) return;

    mlPredictions = await fetchMLPrediction(history);
    buildHourlyFromML(mlPredictions, !apiMeta.modelLoaded);
    await fetchSevenDayForecast();

    const now = new Date();
    const lastUpdate = document.getElementById('lastUpdateTime');
    if (lastUpdate) lastUpdate.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    updateCurrentAQIDisplay();
    updateDataSourceBadge();
    generateAIInsights();
    renderForecastChart();
    resetSimulatorToCurrent();
}

// ─── Chart ───────────────────────────────────────────────────────

function renderForecastChart() {
    const canvas = document.getElementById('predictionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = hourlyForecast.map(f => f.timeLabel);
    const configs = {
        temperature: { values: hourlyForecast.map(f => f.temperature), color: '#ff4757', label: 'Temperature (°C)', zero: false },
        humidity: { values: hourlyForecast.map(f => f.humidity), color: '#3742fa', label: 'Humidity (%)', zero: false },
        pressure: { values: hourlyForecast.map(f => f.pressure), color: '#1abc9c', label: 'Pressure (hPa)', zero: false },
        aqi: { values: hourlyForecast.map(f => f.aqi), color: '#c792ea', label: 'Air Quality Index', zero: true }
    };
    const cfg = configs[activeParam] || configs.temperature;
    const dataValues = cfg.values;

    const margin = activeParam === 'pressure' ? 2 : activeParam === 'aqi' ? 10 : activeParam === 'humidity' ? 6 : 1.5;
    const upperLimit = dataValues.map(v => activeParam === 'humidity' ? Math.min(100, v + margin) : v + margin);
    const lowerLimit = dataValues.map(v => activeParam === 'humidity' ? Math.max(0, v - margin) : Math.max(0, v - margin));

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Upper', data: upperLimit, borderColor: 'transparent', backgroundColor: cfg.color + '06', fill: false, pointRadius: 0, tension: 0.4 },
                { label: 'Lower', data: lowerLimit, borderColor: 'transparent', backgroundColor: cfg.color + '06', fill: '-1', pointRadius: 0, tension: 0.4 },
                {
                    label: `${cfg.label} Forecast`,
                    data: dataValues,
                    borderColor: cfg.color,
                    backgroundColor: cfg.color + '15',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: cfg.color,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#fff', filter: item => !item.text.includes('Upper') && !item.text.includes('Lower') }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 25, 45, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: cfg.color,
                    borderWidth: 1,
                    callbacks: { label: ctx => ctx.dataset.label.includes('Forecast') ? `${ctx.dataset.label}: ${ctx.parsed.y}` : null }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                    ticks: { color: '#a0b3d6', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
                    title: { display: true, text: 'Next 24 Hours', color: '#fff', font: { weight: 'bold' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                    ticks: { color: '#a0b3d6' },
                    title: { display: true, text: cfg.label, color: '#fff', font: { weight: 'bold' } },
                    beginAtZero: cfg.zero
                }
            }
        }
    });
}

// ─── Simulator (unchanged logic) ─────────────────────────────────

function setupSimulator() {
    ['Temp', 'Humidity', 'Wind', 'Emission'].forEach(slider => {
        const el = document.getElementById(`simSlider${slider}`);
        if (el) el.addEventListener('input', runSimulation);
    });
    document.getElementById('simResetBtn')?.addEventListener('click', resetSimulatorToCurrent);
    runSimulation();
}

function resetSimulatorToCurrent() {
    const sTemp = document.getElementById('simSliderTemp');
    const sHum = document.getElementById('simSliderHumidity');
    const sWind = document.getElementById('simSliderWind');
    const sEmission = document.getElementById('simSliderEmission');
    if (sTemp) sTemp.value = currentData.temp.toFixed(1);
    if (sHum) sHum.value = currentData.humidity.toFixed(0);
    if (sWind) sWind.value = 12.0;
    if (sEmission) sEmission.value = 3;
    runSimulation();
}

function runSimulation() {
    const tempVal = parseFloat(document.getElementById('simSliderTemp')?.value || 25);
    const humVal = parseFloat(document.getElementById('simSliderHumidity')?.value || 50);
    const windVal = parseFloat(document.getElementById('simSliderWind')?.value || 10);
    const emissionVal = parseInt(document.getElementById('simSliderEmission')?.value || 3);

    document.getElementById('simValTemp').textContent = tempVal.toFixed(1);
    document.getElementById('simValHumidity').textContent = humVal;
    document.getElementById('simValWind').textContent = windVal.toFixed(1);
    const emissionNames = ['Extremely Low', 'Low', 'Normal', 'High (Rush Hour)', 'Severe (Industrial/Peak)'];
    document.getElementById('simValEmission').textContent = emissionNames[emissionVal - 1];

    const emissionFactors = [12, 28, 48, 85, 135];
    const basePollutants = emissionFactors[emissionVal - 1];
    let thermalInversionFactor = (tempVal < 18 && windVal < 8) ? 1.0 + ((18 - tempVal) * (8 - windVal) * 0.04) : 1.0;
    let ozoneFactor = tempVal > 28 ? (tempVal - 28) * 4.5 * (1.0 + humVal / 200) : 0;
    const dispersionCoeff = Math.exp(-0.04 * windVal);
    let humiditySwelling = humVal > 70 ? 1.0 + ((humVal - 70) * 0.008) : 1.0;

    let simulatedAQI = Math.max(5, Math.min(500, Math.round((basePollutants * thermalInversionFactor * dispersionCoeff * humiditySwelling) + ozoneFactor + 12)));
    let simulatedPM25 = Math.max(1.0, parseFloat((simulatedAQI * (simulatedAQI > 150 ? 0.35 : 0.28) + humVal * 0.05).toFixed(1)));

    document.getElementById('simAQIValue').textContent = simulatedAQI;
    document.getElementById('simPM25Value').textContent = simulatedPM25;

    const cat = getAQICategory(simulatedAQI);
    const gaugeFill = document.getElementById('simGaugeFill');
    if (gaugeFill) {
        gaugeFill.style.strokeDashoffset = 440 - (Math.min(500, simulatedAQI) / 500) * 440;
        gaugeFill.style.stroke = cat.color;
        gaugeFill.style.filter = `drop-shadow(0 0 6px ${cat.color})`;
    }
    const badge = document.getElementById('simStatusBadge');
    if (badge) {
        badge.textContent = cat.level;
        badge.style.borderColor = cat.color;
        badge.style.color = cat.color;
        badge.style.background = cat.color + '20';
    }

    const recList = document.getElementById('simRecList');
    if (recList) {
        recList.innerHTML = '';
        const recs = simulatedAQI <= 50
            ? ['Air quality is ideal for all outdoor activities.', 'Open windows for ventilation.', 'No health precautions needed.']
            : simulatedAQI <= 100
            ? ['Moderate air — sensitive groups monitor symptoms.', 'Regular outdoor activity OK for healthy adults.']
            : simulatedAQI <= 150
            ? ['Sensitive groups limit prolonged outdoor exposure.', 'Keep windows closed. Consider air purifiers.']
            : simulatedAQI <= 200
            ? ['Avoid outdoor sports. Wear N95 if outdoors.', 'Active air purification advised.']
            : ['Severe alert — stay indoors. Seal rooms. HEPA purifiers required.'];
        recs.forEach(rec => { const li = document.createElement('li'); li.textContent = rec; recList.appendChild(li); });
    }
}
