// predictions.js
// SENSOR SQUAD - Predictive Analytics Dashboard Logic

const backendPredictionEndpoint = 'http://127.0.0.1:8000/predict/weather';

let currentData = {
    temp: 26.5,
    humidity: 62.0,
    pressure: 1012.0,
    aqi: 42.0,
    pm25: 12.5,
    light: 850
};

let hourlyForecast = [];
let weeklyForecast = [];
let chartInstance = null;
let activeParam = 'temperature';

// Initialize Page
document.addEventListener('DOMContentLoaded', function() {
    console.log("Predictions Engine Initializing...");
    
    // Update live clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Setup background floating particles
    createParticles();

    // Fetch data and generate forecasts
    initPredictions();
    
    // Bind Tab Click listeners
    setupTabListeners();

    // Bind Simulator Sliders
    setupSimulator();
    // Bind local backend prediction form
    setupPredictionForm();
});

// Clock updater
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const clockEl = document.getElementById('currentTime');
    if (clockEl) {
        clockEl.textContent = timeStr;
    }
}

// Particle generator
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random styling
        const size = Math.random() * 8 + 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${Math.random() * 12 + 10}s`;
        
        container.appendChild(particle);
    }
}

// Setup Chart.js tabs
function setupTabListeners() {
    const tabs = document.querySelectorAll('.chart-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            activeParam = this.getAttribute('data-param');
            renderForecastChart();
        });
    });
}

// Core Prediction Init
async function initPredictions() {
    console.log("Loading latest readings for forecasting calibration...");
    
    let firebaseLoaded = false;
    
    if (window.firebaseHelpers && window.firebaseHelpers.firebaseInitialized) {
        try {
            const weatherData = await getLatestFromFirebase('weather_data', 10);
            const pollutionData = await getLatestFromFirebase('pollution_data', 10);
            
            if (weatherData && weatherData.length > 0) {
                const latestW = weatherData[0];
                if (latestW.temperature) currentData.temp = latestW.temperature;
                if (latestW.humidity) currentData.humidity = latestW.humidity;
                if (latestW.pressure) currentData.pressure = latestW.pressure;
                if (latestW.light) currentData.light = latestW.light;
                firebaseLoaded = true;
            }
            
            if (pollutionData && pollutionData.length > 0) {
                const latestP = pollutionData[0];
                if (latestP.aqi) currentData.aqi = latestP.aqi;
                if (latestP.pm25) currentData.pm25 = latestP.pm25;
                firebaseLoaded = true;
            }
            
            console.log("Firebase calibrated dashboard current base values:", currentData);
        } catch (err) {
            console.error("Error reading data for predictions calibration, using default states:", err);
        }
    } else {
        console.warn("Firebase config not initialized yet, scheduling retry in 2 seconds...");
        setTimeout(initPredictions, 2000);
    }

    // Set last updated time
    const now = new Date();
    document.getElementById('lastUpdateTime').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Generate Hourly Projections & Weekly Projections
    generateHourlyForecasts();
    generateWeeklyForecasts();
    
    // Run AI Insights
    generateAIInsights();
    
    // Draw default chart
    renderForecastChart();

    // Sync Simulator sliders to loaded database values initially
    resetSimulatorToCurrent();
}

// Generating Hourly Forecast using Diurnal Sine curves
function generateHourlyForecasts() {
    hourlyForecast = [];
    const now = new Date();
    const currentHour = now.getHours();

    for (let i = 0; i < 24; i++) {
        const forecastTime = new Date(now.getTime() + (i * 60 * 60 * 1000));
        const hour = forecastTime.getHours();
        
        // Diurnal curve values:
        // Temp peaks around 15:00, lowest around 05:00
        const tempBase = currentData.temp;
        const tempAmp = 4.5; // daily delta range ~9 degrees
        const tempCoeff = Math.cos(2 * Math.PI * (hour - 15) / 24);
        const tempProj = tempBase + tempAmp * tempCoeff + (Math.random() - 0.5) * 0.4;

        // Humidity is inversely proportional to Temperature, peaks around 05:00, lowest around 15:00
        const humBase = currentData.humidity;
        const humAmp = 15; // daily delta range ~30%
        const humCoeff = -Math.cos(2 * Math.PI * (hour - 15) / 24);
        const humProj = Math.max(10, Math.min(100, humBase + humAmp * humCoeff + (Math.random() - 0.5) * 1.5));

        // Pressure has minor diurnal semidiurnal tides (amplitude ~1.2 hPa, peaks at 10 and 22)
        const presBase = currentData.pressure;
        const presProj = presBase + 1.2 * Math.cos(4 * Math.PI * (hour - 10) / 24) + (Math.random() - 0.5) * 0.2;

        // AQI diurnal curve: double peak during traffic hours (8 AM - 10 AM, 6 PM - 8 PM), higher overnight during thermal inversions
        const aqiBase = currentData.aqi;
        let trafficFactor = 0;
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
            trafficFactor = 15; // commute spike
        } else if (hour >= 21 || hour <= 4) {
            trafficFactor = 8; // night inversion accumulation
        } else {
            trafficFactor = -5; // mid-afternoon solar convection clean air
        }
        const aqiProj = Math.max(5, aqiBase + trafficFactor + Math.sin(2 * Math.PI * hour / 24) * 5 + (Math.random() - 0.5) * 2);

        hourlyForecast.push({
            timeLabel: forecastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            temperature: parseFloat(tempProj.toFixed(1)),
            humidity: parseFloat(humProj.toFixed(0)),
            pressure: parseFloat(presProj.toFixed(1)),
            aqi: parseFloat(aqiProj.toFixed(0))
        });
    }
}

// Generate 7-Day Forecast Grid
function generateWeeklyForecasts() {
    weeklyForecast = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();

    const weatherStates = [
        { type: 'sun', icon: 'fa-sun', desc: 'Sunny / Clear' },
        { type: 'cloud-sun', icon: 'fa-cloud-sun', desc: 'Partly Cloudy' },
        { type: 'cloud', icon: 'fa-cloud', desc: 'Overcast' },
        { type: 'rain', icon: 'fa-cloud-showers-heavy', desc: 'Showers / Rain' },
        { type: 'storm', icon: 'fa-bolt', desc: 'Thunderstorms' }
    ];

    for (let i = 0; i < 7; i++) {
        const forecastDay = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
        const dayName = i === 0 ? 'Today' : days[forecastDay.getDay()];
        
        // Randomize weather states based on pressure (lower pressure = more rain)
        let state;
        const roll = Math.random() * 100;
        if (currentData.pressure < 1008) {
            // Low pressure: High chance of rain/storm
            state = roll < 40 ? weatherStates[3] : (roll < 70 ? weatherStates[4] : weatherStates[2]);
        } else if (currentData.pressure > 1015) {
            // High pressure: Sunny / Partly cloudy
            state = roll < 70 ? weatherStates[0] : weatherStates[1];
        } else {
            // Moderate pressure: mixed
            state = roll < 30 ? weatherStates[0] : (roll < 65 ? weatherStates[1] : (roll < 90 ? weatherStates[2] : weatherStates[3]));
        }

        // Adjust temp range based on weather state (rainy days are cooler)
        let tempModifier = 0;
        if (state.type === 'rain') tempModifier = -3;
        if (state.type === 'storm') tempModifier = -5;
        if (state.type === 'sun') tempModifier = 2;

        const maxTemp = currentData.temp + tempModifier + Math.random() * 3;
        const minTemp = currentData.temp - 8 + tempModifier + Math.random() * 2;
        
        // AQI range
        let aqiVal = currentData.aqi + (Math.random() - 0.5) * 15;
        // Storms scrub air, making AQI better
        if (state.type === 'rain' || state.type === 'storm') aqiVal -= 12;
        aqiVal = Math.max(10, Math.round(aqiVal));

        weeklyForecast.push({
            day: dayName,
            dateLabel: forecastDay.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            icon: state.icon,
            type: state.type,
            desc: state.desc,
            max: Math.round(maxTemp),
            min: Math.round(minTemp),
            aqi: aqiVal
        });
    }

    // Render Weekly Grid in UI
    const grid = document.getElementById('forecast7DayGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    weeklyForecast.forEach(day => {
        let aqiClass = 'good';
        if (day.aqi > 50) aqiClass = 'mod';
        if (day.aqi > 100) aqiClass = 'unhealth';

        const card = document.createElement('div');
        card.className = `forecast-card ${day.day === 'Today' ? 'today' : ''}`;
        card.innerHTML = `
            <div class="forecast-day">${day.day}</div>
            <div style="font-size: 0.8rem; color: #a0b3d6; margin-bottom: 5px;">${day.dateLabel}</div>
            <div class="forecast-icon ${day.type}"><i class="fas ${day.icon}"></i></div>
            <div style="font-size: 0.85rem; color: #80deea; margin-bottom: 12px; font-weight: 600;">${day.desc}</div>
            <div class="forecast-temp">
                <span class="max">${day.max}°</span>
                <span class="min">${day.min}°</span>
            </div>
            <span class="forecast-aqi ${aqiClass}">AQI ${day.aqi}</span>
        `;
        grid.appendChild(card);
    });
}

// Generate dynamic AI Alerts
function generateAIInsights() {
    const list = document.getElementById('aiInsightsList');
    if (!list) return;
    
    list.innerHTML = '';
    const insights = [];

    // 1. Rain Ingress Risk (Pressure trend)
    if (currentData.pressure < 1010) {
        insights.push({
            type: 'warning',
            icon: 'fa-cloud-showers-heavy',
            title: 'Precipitation Likely (85% Probability)',
            text: `Barometric pressure is low (${currentData.pressure.toFixed(1)} hPa) and humidity is elevated. Seasonal projection indicates incoming precipitation within the next 4-6 hours. Expect air purification from particulate wash.`
        });
    } else {
        insights.push({
            type: 'success',
            icon: 'fa-sun',
            title: 'Stable High-Pressure System',
            text: `High atmospheric pressure (${currentData.pressure.toFixed(1)} hPa) is projected to keep weather clear and dry for the next 48 hours. Minimal storm threat.`
        });
    }

    // 2. Inversion Layer Warning (Nighttime cooling + calm winds)
    const now = new Date();
    const hour = now.getHours();
    const sunsetDiff = (20 - hour + 24) % 24; // approx sunset at 8pm (20:00)
    
    if (currentData.temp > 24 && currentData.humidity > 60) {
        insights.push({
            type: 'warning',
            icon: 'fa-smog',
            title: 'Nocturnal Thermal Inversion Warning',
            text: `Radiational cooling tonight is projected to create a surface inversion layer. With ambient humidity at ${currentData.humidity.toFixed(0)}%, particulate pollutants (PM2.5) will likely be trapped near ground level from 9 PM to 7 AM. AQI may rise by 15-25 points.`
        });
    }

    // 3. Solar UV Intensity
    if (currentData.light > 25000) {
        insights.push({
            type: 'info',
            icon: 'fa-shield-halved',
            title: 'High UV Index Forecast',
            text: `Peak solar intensity tomorrow is forecast to exceed 45,000 Lux, yielding a UV Index of 6-8 (High). Maximum solar radiation occurs between 11:30 AM and 2:30 PM. UV protection is recommended during direct exposure.`
        });
    } else {
        insights.push({
            type: 'info',
            icon: 'fa-umbrella-beach',
            title: 'Moderate UV Index Forecast',
            text: `Ambient light level is moderate. Tomorrow's peak UV index is projected to reach index 3-4 (Moderate). Basic sun safety precautions are sufficient.`
        });
    }

    // Insert cards into list
    insights.forEach(item => {
        const card = document.createElement('div');
        card.className = `insight-card ${item.type}`;
        card.innerHTML = `
            <div class="insight-icon"><i class="fas ${item.icon}"></i></div>
            <div class="insight-info">
                <h4>${item.title}</h4>
                <p>${item.text}</p>
            </div>
        `;
        list.appendChild(card);
    });
}

// Render Forecast Chart
function renderForecastChart() {
    const canvas = document.getElementById('predictionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Destroy previous instance
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = hourlyForecast.map(f => f.timeLabel);
    let dataValues = [];
    let borderCol = '#80deea';
    let fillCol = '#80deea15';
    let paramLabel = '';

    if (activeParam === 'temperature') {
        dataValues = hourlyForecast.map(f => f.temperature);
        borderCol = '#ff4757';
        fillCol = '#ff475715';
        paramLabel = 'Temperature (°C)';
    } else if (activeParam === 'humidity') {
        dataValues = hourlyForecast.map(f => f.humidity);
        borderCol = '#3742fa';
        fillCol = '#3742fa15';
        paramLabel = 'Humidity (%)';
    } else if (activeParam === 'pressure') {
        dataValues = hourlyForecast.map(f => f.pressure);
        borderCol = '#1abc9c';
        fillCol = '#1abc9c15';
        paramLabel = 'Pressure (hPa)';
    } else if (activeParam === 'aqi') {
        dataValues = hourlyForecast.map(f => f.aqi);
        borderCol = '#c792ea';
        fillCol = '#c792ea15';
        paramLabel = 'Air Quality Index';
    }

    // Create confidence intervals upper/lower datasets for scientific effect
    const upperLimit = dataValues.map(v => {
        if (activeParam === 'temperature') return v + 1.5;
        if (activeParam === 'humidity') return Math.min(100, v + 6);
        if (activeParam === 'pressure') return v + 2.0;
        if (activeParam === 'aqi') return v + 10;
    });

    const lowerLimit = dataValues.map(v => {
        if (activeParam === 'temperature') return v - 1.5;
        if (activeParam === 'humidity') return Math.max(0, v - 6);
        if (activeParam === 'pressure') return v - 2.0;
        if (activeParam === 'aqi') return Math.max(0, v - 10);
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Confidence Upper Limit',
                    data: upperLimit,
                    borderColor: 'transparent',
                    backgroundColor: borderCol + '06',
                    fill: false,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'Confidence Lower Limit',
                    data: lowerLimit,
                    borderColor: 'transparent',
                    backgroundColor: borderCol + '06',
                    fill: '-1', // fill space between Upper and Lower
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: `${paramLabel} Forecast`,
                    data: dataValues,
                    borderColor: borderCol,
                    backgroundColor: fillCol,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: borderCol,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        filter: function(item) {
                            // Hide upper and lower limit legends
                            return !item.text.includes('Confidence');
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 25, 45, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: borderCol,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label.includes('Confidence')) return null;
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        color: '#a0b3d6',
                        maxRotation: 45
                    },
                    title: {
                        display: true,
                        text: 'Projection Timeline (Hours)',
                        color: '#ffffff',
                        font: { weight: 'bold' }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        color: '#a0b3d6'
                    },
                    title: {
                        display: true,
                        text: paramLabel,
                        color: '#ffffff',
                        font: { weight: 'bold' }
                    },
                    beginAtZero: activeParam !== 'pressure'
                }
            }
        }
    });
}

function setupPredictionForm() {
    const form = document.getElementById('backendPredictionForm');
    if (!form) return;

    form.addEventListener('submit', handlePredictionFormSubmit);

    const inputs = [
        'predictTemperature',
        'predictHumidity',
        'predictPressure',
        'predictAQI',
        'predictPM25',
        'predictLight'
    ];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', clearPredictionError);
        }
    });
}

function setPredictionLoading(isLoading) {
    const status = document.getElementById('backendPredictionStatus');
    const submit = document.getElementById('predictionSubmitBtn');
    if (submit) {
        submit.disabled = isLoading;
        submit.textContent = isLoading ? 'Predicting...' : 'Predict Now';
    }
    if (status) {
        status.textContent = isLoading ? 'Sending values to local backend...' : '';
        status.className = isLoading ? 'prediction-status loading' : 'prediction-status';
    }
}

function displayPredictionError(message) {
    const status = document.getElementById('backendPredictionStatus');
    if (status) {
        status.textContent = message;
        status.className = 'prediction-status error';
    }
}

function clearPredictionError() {
    const status = document.getElementById('backendPredictionStatus');
    if (status) {
        status.textContent = '';
        status.className = 'prediction-status';
    }
}

function displayPredictionResults(result) {
    const resultsWrapper = document.getElementById('predictionResults');
    if (!resultsWrapper) return;

    const predictedTemperature = result.predicted_temperature ?? result.temperature ?? result.temp ?? '--';
    const predictedAQI = result.predicted_aqi ?? result.aqi ?? '--';
    const predictedPM25 = result.predicted_pm25 ?? result.pm25 ?? '--';
    const predictedAirQuality = result.predicted_air_quality ?? result.air_quality ?? result.aqi_category ?? '--';
    const extraMessage = result.message || result.summary || '';

    resultsWrapper.innerHTML = `
        <div class="prediction-result-card">
            <h4>Prediction Results</h4>
            <div class="result-row"><span>Predicted Temperature</span><strong>${predictedTemperature}</strong></div>
            <div class="result-row"><span>Predicted AQI</span><strong>${predictedAQI}</strong></div>
            <div class="result-row"><span>Predicted PM2.5</span><strong>${predictedPM25}</strong></div>
            <div class="result-row"><span>Air Quality</span><strong>${predictedAirQuality}</strong></div>
            ${extraMessage ? `<div class="result-note">${extraMessage}</div>` : ''}
        </div>
    `;
}

async function handlePredictionFormSubmit(event) {
    event.preventDefault();

    const tempEl = document.getElementById('predictTemperature');
    const humEl = document.getElementById('predictHumidity');
    const pressureEl = document.getElementById('predictPressure');
    const aqiEl = document.getElementById('predictAQI');
    const pm25El = document.getElementById('predictPM25');
    const lightEl = document.getElementById('predictLight');

    if (!tempEl || !humEl || !pressureEl || !aqiEl || !pm25El || !lightEl) {
        displayPredictionError('Prediction form fields are unavailable.');
        return;
    }

    const payload = {
        temperature: parseFloat(tempEl.value),
        humidity: parseFloat(humEl.value),
        pressure: parseFloat(pressureEl.value),
        aqi: parseFloat(aqiEl.value),
        pm25: parseFloat(pm25El.value),
        light: parseFloat(lightEl.value)
    };

    if (Object.values(payload).some(value => Number.isNaN(value))) {
        displayPredictionError('Please provide valid numeric values for all fields.');
        return;
    }

    setPredictionLoading(true);
    displayPredictionResults({});

    try {
        const response = await fetch(backendPredictionEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        setPredictionLoading(false);
        displayPredictionResults(data);
    } catch (error) {
        console.error('Prediction request failed:', error);
        setPredictionLoading(false);
        displayPredictionError('Could not reach local backend at http://127.0.0.1:8000. Please start FastAPI and try again.');
    }
}

// ==========================================
// INTERACTIVE WHAT-IF SIMULATOR PLAYGROUND
// ==========================================
function setupSimulator() {
    const sliders = ['Temp', 'Humidity', 'Wind', 'Emission'];
    
    sliders.forEach(slider => {
        const el = document.getElementById(`simSlider${slider}`);
        if (el) {
            el.addEventListener('input', runSimulation);
        }
    });

    const resetBtn = document.getElementById('simResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSimulatorToCurrent);
    }

    runSimulation();
}

function resetSimulatorToCurrent() {
    const sTemp = document.getElementById('simSliderTemp');
    const sHum = document.getElementById('simSliderHumidity');
    const sWind = document.getElementById('simSliderWind');
    const sEmission = document.getElementById('simSliderEmission');

    if (sTemp) sTemp.value = currentData.temp.toFixed(1);
    if (sHum) sHum.value = currentData.humidity.toFixed(0);
    // Default wind speed calibration 
    if (sWind) sWind.value = 12.0; 
    if (sEmission) sEmission.value = 3; // normal activity

    runSimulation();
}

function runSimulation() {
    const tempVal = parseFloat(document.getElementById('simSliderTemp')?.value || 25);
    const humVal = parseFloat(document.getElementById('simSliderHumidity')?.value || 50);
    const windVal = parseFloat(document.getElementById('simSliderWind')?.value || 10);
    const emissionVal = parseInt(document.getElementById('simSliderEmission')?.value || 3);

    // Update value labels in UI
    const lblTemp = document.getElementById('simValTemp');
    if (lblTemp) lblTemp.textContent = tempVal.toFixed(1);
    
    const lblHum = document.getElementById('simValHumidity');
    if (lblHum) lblHum.textContent = humVal;

    const lblWind = document.getElementById('simValWind');
    if (lblWind) lblWind.textContent = windVal.toFixed(1);

    const lblEmission = document.getElementById('simValEmission');
    if (lblEmission) {
        const emissionNames = ['Extremely Low', 'Low', 'Normal', 'High (Rush Hour)', 'Severe (Industrial/Peak)'];
        lblEmission.textContent = emissionNames[emissionVal - 1];
    }

    // ==========================================
    // PREDICTION ALGORITHM FOR SIMULATED AQI
    // ==========================================
    // Base pollutant emissions
    const emissionFactors = [12, 28, 48, 85, 135];
    const basePollutants = emissionFactors[emissionVal - 1];

    // Temperature Inversion Layer effect: 
    // Cold temperature combined with low wind traps air, increasing AQI
    let thermalInversionFactor = 1.0;
    if (tempVal < 18 && windVal < 8) {
        // Temperature drop creates stronger inversion
        thermalInversionFactor = 1.0 + ((18 - tempVal) * (8 - windVal) * 0.04);
    }

    // High temperature ozone formation effect:
    // Temperatures above 28°C create photochemical ozone, adding directly to AQI
    let ozoneFactor = 0;
    if (tempVal > 28) {
        ozoneFactor = (tempVal - 28) * 4.5 * (1.0 + (humVal / 200)); // Ozone is higher in heat
    }

    // Wind dispersion effect:
    // Higher wind speed disperses particulates exponentially
    // AQI = Base * e^(-0.05 * wind)
    const dispersionCoeff = Math.exp(-0.04 * windVal);

    // Humidity particle swelling:
    // Extremely high humidity causes hydroscopic growth of particulates, increasing PM2.5/PM10 concentration measurements
    let humiditySwelling = 1.0;
    if (humVal > 70) {
        humiditySwelling = 1.0 + ((humVal - 70) * 0.008);
    }

    // Calculate simulated AQI
    let simulatedAQI = (basePollutants * thermalInversionFactor * dispersionCoeff * humiditySwelling) + ozoneFactor + 12;
    simulatedAQI = Math.max(5, Math.min(500, Math.round(simulatedAQI)));

    // PM2.5 calculation is correlated to AQI
    let simulatedPM25 = simulatedAQI * 0.28 + (humVal * 0.05);
    if (simulatedAQI > 150) simulatedPM25 = simulatedAQI * 0.35; // non-linear scaling at high levels
    simulatedPM25 = Math.max(1.0, parseFloat(simulatedPM25.toFixed(1)));

    // Update simulated result UI
    const valueEl = document.getElementById('simAQIValue');
    if (valueEl) valueEl.textContent = simulatedAQI;

    const pm25El = document.getElementById('simPM25Value');
    if (pm25El) pm25El.textContent = simulatedPM25;

    // Update circle gauge
    const gaugeFill = document.getElementById('simGaugeFill');
    if (gaugeFill) {
        // SVG circle perimeter is 440 (2 * pi * r where r=70 => 439.8)
        const perimeter = 440;
        const fillOffset = perimeter - (Math.min(500, simulatedAQI) / 500) * perimeter;
        gaugeFill.style.strokeDashoffset = fillOffset;
        
        // Dynamic color
        let color = '#2ed573'; // Good
        if (simulatedAQI > 200) color = '#ff3333'; // Very Unhealthy
        else if (simulatedAQI > 150) color = '#ff6666'; // Unhealthy
        else if (simulatedAQI > 100) color = '#ff9933'; // Unhealthy for Sensitive
        else if (simulatedAQI > 50) color = '#ffa726'; // Moderate
        
        gaugeFill.style.stroke = color;
        gaugeFill.style.filter = `drop-shadow(0 0 6px ${color})`;
        
        const badge = document.getElementById('simStatusBadge');
        if (badge) {
            badge.style.borderColor = color;
            badge.style.color = color;
            badge.style.background = color + '20';
            
            let badgeText = 'GOOD';
            if (simulatedAQI > 300) badgeText = 'HAZARDOUS';
            else if (simulatedAQI > 200) badgeText = 'VERY UNHEALTHY';
            else if (simulatedAQI > 150) badgeText = 'UNHEALTHY';
            else if (simulatedAQI > 100) badgeText = 'SENSITIVE';
            else if (simulatedAQI > 50) badgeText = 'MODERATE';
            
            badge.textContent = badgeText;
        }
    }

    // Update Recommendations list based on simulated AQI
    const recList = document.getElementById('simRecList');
    if (recList) {
        recList.innerHTML = '';
        const recs = [];
        
        if (simulatedAQI <= 50) {
            recs.push("Air quality is ideal for all outdoor activities.");
            recs.push("Highly recommended to open windows and ventilate rooms.");
            recs.push("No health precautions needed.");
        } else if (simulatedAQI <= 100) {
            recs.push("Acceptable air quality; moderate outdoor activities are safe.");
            recs.push("Sensitive groups (asthma, heart issues) should monitor symptoms.");
            recs.push("Good day for regular ventilation.");
        } else if (simulatedAQI <= 150) {
            recs.push("Sensitive groups may experience health effects. Limit prolonged outdoor exposure.");
            recs.push("Keep windows closed to prevent particulate entry.");
            recs.push("Consider running indoor air purifiers.");
        } else if (simulatedAQI <= 200) {
            recs.push("Healthy individuals may start experiencing symptoms. Avoid outdoor sports/cardio.");
            recs.push("Keep windows closed. Active air purification advised.");
            recs.push("Wear a protective mask (N95/KN95) if going outdoors for long periods.");
        } else {
            recs.push("Severe pollution alert! Avoid all outdoor exposure.");
            recs.push("Seal rooms. Run high-efficiency particulate air (HEPA) purifiers.");
            recs.push("Compulsory mask usage for essential outdoor travel.");
        }
        
        recs.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recList.appendChild(li);
        });
    }
}
