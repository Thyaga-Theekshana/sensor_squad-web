// pollution-charts.js
// Firebase-only for pollution charts

let allPollutionData = null;
const POLLUTION_CHART_IDS = ['aqi', 'pm25', 'pm10', 'voc', 'nox'];
const INACTIVE_CHART_IDS = ['co', 'so2', 'no2', 'o3'];

document.addEventListener('DOMContentLoaded', function() {
    console.log("Pollution charts page loaded with Firebase");
    updateTime();
    setInterval(updateTime, 1000);
    loadAllPollutionCharts(20);
    
    const timeRange = document.getElementById('globalTimeRange');
    if (timeRange) {
        timeRange.addEventListener('change', function() {
            loadAllPollutionCharts(parseInt(this.value));
        });
    }
    initializePollutionUI();
});

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) timeElement.textContent = timeStr;
}

function initializePollutionUI() {
    updateAQIGauge(0);
    updateHealthTips(0);
    updateComparisonBars({});
}

async function loadAllPollutionCharts(results) {
    console.log(`Loading pollution charts from Firebase with ${results} results`);
    
    if (!window.firebaseHelpers || !window.firebaseHelpers.firebaseInitialized) {
        console.warn("Firebase not initialized yet");
        setTimeout(() => loadAllPollutionCharts(results), 1000);
        return;
    }
    
    try {
        const pollutionData = await getLatestFromFirebase('pollution_data', results);
        
        if (!pollutionData || pollutionData.length === 0) {
            console.warn("No pollution data in Firebase");
            showDemoPollutionCharts(results);
            return;
        }
        
        allPollutionData = pollutionData;
        
        const labels = pollutionData.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        
        let latestAQI = 0;
        const pollutants = {};
        
        // AQI chart
        const aqiValues = pollutionData.map(item => item.aqi || 0);
        if (aqiValues.some(v => v > 0)) {
            latestAQI = aqiValues[aqiValues.length - 1];
            pollutants.aqi = latestAQI;
            updateCurrentValueDisplay('aqi', latestAQI, '');
            updateChart('aqi', 'AQI', '', '#4da6ff', labels, aqiValues, latestAQI);
        }
        
        // PM2.5 chart
        const pm25Values = pollutionData.map(item => item.pm25 || 0);
        if (pm25Values.some(v => v > 0)) {
            const current = pm25Values[pm25Values.length - 1];
            pollutants.pm25 = current;
            updateCurrentValueDisplay('pm25', current, 'µg/m³');
            updateChart('pm25', 'PM2.5', 'µg/m³', '#ff6b6b', labels, pm25Values, current);
        }
        
        // PM10 chart
        const pm10Values = pollutionData.map(item => item.pm10 || 0);
        if (pm10Values.some(v => v > 0)) {
            const current = pm10Values[pm10Values.length - 1];
            pollutants.pm10 = current;
            updateCurrentValueDisplay('pm10', current, 'µg/m³');
            updateChart('pm10', 'PM10', 'µg/m³', '#ffa726', labels, pm10Values, current);
        }
        
        // VOC chart
        const vocValues = pollutionData.map(item => item.voc || 0);
        if (vocValues.some(v => v > 0)) {
            const current = vocValues[vocValues.length - 1];
            pollutants.voc = current;
            updateCurrentValueDisplay('voc', current, 'ppb');
            updateChart('voc', 'VOC', 'ppb', '#f39c12', labels, vocValues, current);
        }
        
        // NOx chart
        const noxValues = pollutionData.map(item => item.nox || 0);
        if (noxValues.some(v => v > 0)) {
            const current = noxValues[noxValues.length - 1];
            pollutants.nox = current;
            updateCurrentValueDisplay('nox', current, 'ppb');
            updateChart('nox', 'NOx', 'ppb', '#e74c3c', labels, noxValues, current);
        }
        
        // Update UI components
        if (latestAQI > 0) {
            updateAQIGauge(latestAQI);
            updateHealthTips(latestAQI);
            updateAQIScaleHighlight(latestAQI);
        }
        
        if (Object.keys(pollutants).length > 0) {
            updateComparisonBars(pollutants);
        }
        
        // Inactive charts (show zero)
        INACTIVE_CHART_IDS.forEach(chartId => {
            showInactiveChartDemo(chartId, results);
        });
        
    } catch (error) {
        console.error("Error loading pollution charts:", error);
        showDemoPollutionCharts(results);
    }
}

function getPollutionCanvasId(chartId) {
    const canvasMap = {
        'aqi': 'aqiChartCanvas', 'pm25': 'pm25ChartCanvas', 'pm10': 'pm10ChartCanvas',
        'voc': 'vocChartCanvas', 'nox': 'noxChartCanvas', 'co': 'coChartCanvas',
        'so2': 'so2ChartCanvas', 'no2': 'no2ChartCanvas', 'o3': 'o3ChartCanvas'
    };
    return canvasMap[chartId];
}

function updateCurrentValueDisplay(chartId, value, unit) {
    const element = document.getElementById(`${chartId}Current`);
    if (!element) return;
    
    if (value === null || value === undefined || isNaN(value)) {
        element.textContent = '--';
        return;
    }
    
    const formattedValue = formatPollutionValue(value, chartId);
    element.textContent = chartId === 'aqi' ? formattedValue : `${formattedValue} ${unit}`;
    element.classList.add('updated');
    setTimeout(() => element.classList.remove('updated'), 500);
}

function formatPollutionValue(value, chartId) {
    if (value === null || value === undefined || isNaN(value)) return '--';
    switch(chartId) {
        case 'aqi': return Math.round(value);
        case 'pm25': case 'pm10': return value.toFixed(1);
        default: return value.toFixed(1);
    }
}

function updateChart(chartId, chartName, unit, color, labels, values, currentValue) {
    const canvasId = getPollutionCanvasId(chartId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    if (canvas.chart) canvas.chart.destroy();
    
    const ctx = canvas.getContext('2d');
    canvas.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: chartName + (unit ? ` (${unit})` : ''),
                data: values,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: color,
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
                            let label = context.dataset.label || '';
                            let value = context.parsed.y;
                            return unit ? `${label}: ${value.toFixed(1)} ${unit}` : `${label}: ${Math.round(value)}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6', maxRotation: 45 }, title: { display: true, text: 'Time', color: '#ffffff' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a0b3d6' }, title: { display: true, text: chartName + (unit ? ` (${unit})` : ''), color: '#ffffff' }, beginAtZero: true }
            }
        }
    });
}

function showInactiveChartDemo(chartId, results) {
    const labels = [];
    const now = new Date();
    for (let i = results - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * 5 * 60000));
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    const zeroValues = Array(results).fill(0);
    const inactiveConfigs = {
        'co': { name: 'CO', unit: 'ppb', color: '#8e44ad' },
        'so2': { name: 'SO₂', unit: 'ppb', color: '#e74c3c' },
        'no2': { name: 'NO₂', unit: 'ppb', color: '#3498db' },
        'o3': { name: 'O₃', unit: 'ppb', color: '#2ecc71' }
    };
    
    if (inactiveConfigs[chartId]) {
        const config = inactiveConfigs[chartId];
        updateCurrentValueDisplay(chartId, 0, config.unit);
        updateChart(chartId, config.name, config.unit, config.color, labels, zeroValues, 0);
    }
}

function showDemoPollutionCharts(results) {
    const now = new Date();
    const labels = [];
    for (let i = results - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * 5 * 60000));
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    const demos = [
        { id: 'aqi', name: 'AQI', unit: '', color: '#4da6ff', current: 55,
          values: Array.from({length: results}, (_, i) => 40 + Math.sin(i * 0.2) * 20 + Math.random() * 5) },
        { id: 'pm25', name: 'PM2.5', unit: 'µg/m³', color: '#ff6b6b', current: 15,
          values: Array.from({length: results}, (_, i) => 10 + Math.sin(i * 0.3) * 8 + Math.random() * 3) },
        { id: 'pm10', name: 'PM10', unit: 'µg/m³', color: '#ffa726', current: 16,
          values: Array.from({length: results}, (_, i) => 15 + Math.sin(i * 0.25) * 10 + Math.random() * 3) },
        { id: 'voc', name: 'VOC', unit: 'ppb', color: '#f39c12', current: 284,
          values: Array.from({length: results}, (_, i) => 250 + Math.cos(i * 0.15) * 50 + Math.random() * 20) },
        { id: 'nox', name: 'NOx', unit: 'ppb', color: '#e74c3c', current: 11,
          values: Array.from({length: results}, (_, i) => 8 + Math.sin(i * 0.35) * 6 + Math.random() * 2) }
    ];
    
    const pollutants = {};
    let latestAQI = 0;
    
    demos.forEach(demo => {
        updateCurrentValueDisplay(demo.id, demo.current, demo.unit);
        updateChart(demo.id, demo.name, demo.unit, demo.color, labels, demo.values, demo.current);
        pollutants[demo.id] = demo.current;
        if (demo.id === 'aqi') latestAQI = demo.current;
    });
    
    updateAQIGauge(latestAQI);
    updateHealthTips(latestAQI);
    updateComparisonBars(pollutants);
    updateAQIScaleHighlight(latestAQI);
    
    INACTIVE_CHART_IDS.forEach(chartId => {
        showInactiveChartDemo(chartId, results);
    });
}

// AQI Gauge Functions
function updateAQIGauge(aqi) {
    const gaugeFill = document.getElementById('gaugeFill');
    const gaugeAQI = document.getElementById('gaugeAQI');
    const gaugeStatus = document.getElementById('gaugeStatus');
    if (!gaugeFill || !gaugeAQI) return;
    
    const circumference = 2 * Math.PI * 90;
    const percentage = Math.min(aqi / 500, 1);
    gaugeFill.style.strokeDashoffset = circumference * (1 - percentage);
    gaugeAQI.textContent = Math.round(aqi);
    
    let color, status;
    if (aqi <= 50) { color = '#00cc66'; status = 'Good'; }
    else if (aqi <= 100) { color = '#ffcc00'; status = 'Moderate'; }
    else if (aqi <= 150) { color = '#ff9933'; status = 'Unhealthy for Sensitive'; }
    else if (aqi <= 200) { color = '#ff6666'; status = 'Unhealthy'; }
    else if (aqi <= 300) { color = '#ff3333'; status = 'Very Unhealthy'; }
    else { color = '#990000'; status = 'Hazardous'; }
    
    gaugeFill.style.stroke = color;
    gaugeStatus.textContent = status;
}

function updateAQIScaleHighlight(aqi) {
    document.querySelectorAll('.scale-item').forEach(item => {
        item.classList.remove('active');
        const range = item.dataset.aqiRange;
        if (range) {
            const [min, max] = range.split('-').map(Number);
            if (aqi >= min && aqi <= max) item.classList.add('active');
        }
    });
}

function updateComparisonBars(pollutants) {
    const container = document.getElementById('comparisonBars');
    if (!container) return;
    
    const maxValues = { 'aqi': 500, 'pm25': 100, 'pm10': 150, 'voc': 500, 'nox': 100, 'co': 1000, 'so2': 100, 'no2': 100, 'o3': 100 };
    const displayNames = { 'aqi': 'AQI', 'pm25': 'PM2.5', 'pm10': 'PM10', 'voc': 'VOC', 'nox': 'NOx', 'co': 'CO', 'so2': 'SO₂', 'no2': 'NO₂', 'o3': 'O₃' };
    const colors = { 'aqi': '#4da6ff', 'pm25': '#ff6b6b', 'pm10': '#ffa726', 'voc': '#f39c12', 'nox': '#e74c3c', 'co': '#8e44ad', 'so2': '#e67e22', 'no2': '#3498db', 'o3': '#2ecc71' };
    
    let html = '';
    POLLUTION_CHART_IDS.forEach(key => {
        const value = pollutants[key] || 0;
        const percentage = Math.min((value / maxValues[key]) * 100, 100);
        html += `<div class="comp-bar"><span class="label">${displayNames[key]}</span><div class="bar-container"><div class="bar" style="width: ${percentage}%; background: ${colors[key]}"></div></div><span class="value">${formatPollutionValue(value, key)}</span></div>`;
    });
    INACTIVE_CHART_IDS.forEach(key => {
        html += `<div class="comp-bar" style="opacity: 0.5;"><span class="label">${displayNames[key]}</span><div class="bar-container"><div class="bar" style="width: 0%; background: ${colors[key]}"></div></div><span class="value">0</span></div>`;
    });
    container.innerHTML = html;
}

function updateHealthTips(aqi) {
    const container = document.getElementById('healthTips');
    if (!container) return;
    
    let tips = [];
    if (aqi <= 50) {
        tips = [
            { icon: 'fa-walking', title: 'Perfect for outdoor activities', desc: 'Air quality is good. Enjoy your outdoor activities!' },
            { icon: 'fa-wind', title: 'Ventilate your home', desc: 'Great time to open windows for fresh air.' },
            { icon: 'fa-leaf', title: 'Ideal for plants', desc: 'Your indoor plants will thrive in this air quality.' }
        ];
    } else if (aqi <= 100) {
        tips = [
            { icon: 'fa-mask', title: 'Sensitive groups', desc: 'Consider reducing prolonged outdoor exertion if sensitive.' },
            { icon: 'fa-home', title: 'Keep windows closed', desc: 'Limit outdoor air intake during peak hours.' },
            { icon: 'fa-water', title: 'Stay hydrated', desc: 'Drink plenty of water to help your body.' }
        ];
    } else if (aqi <= 150) {
        tips = [
            { icon: 'fa-head-side-mask', title: 'Wear mask outdoors', desc: 'Consider wearing N95 mask when outside.' },
            { icon: 'fa-hand-holding-heart', title: 'Limit exertion', desc: 'Reduce prolonged or heavy exertion.' },
            { icon: 'fa-lungs', title: 'Take breaks', desc: 'Take more breaks during outdoor activities.' }
        ];
    } else {
        tips = [
            { icon: 'fa-home', title: 'Stay indoors', desc: 'Avoid outdoor activities if possible.' },
            { icon: 'fa-head-side-mask', title: 'Use air purifier', desc: 'Run air purifiers to maintain indoor air quality.' },
            { icon: 'fa-heartbeat', title: 'Monitor symptoms', desc: 'Watch for coughing or shortness of breath.' }
        ];
    }
    
    let html = '';
    tips.forEach(tip => {
        html += `<div class="tip-card"><i class="fas ${tip.icon}"></i><h4>${tip.title}</h4><p>${tip.desc}</p></div>`;
    });
    container.innerHTML = html;
}