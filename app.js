let config = [];
let currentIndex = 1;
let cycleTime = 10;

async function loadConfig() {
  try {
    const res = await fetch('config.json');
    config = await res.json();
    cycleTime = config[0].cycle;
    
    // Start the clock ONCE at the beginning
    startClock();
    startDisplay();
  } catch (err) {
    console.error("Failed to load config:", err);
  }
}

function startDisplay() {
  showItem();
  setInterval(() => {
    currentIndex++;
    if (currentIndex >= config.length) {
      currentIndex = 1;
    }
    showItem();
  }, cycleTime * 1000);
}

function startClock() {
  const clock = document.getElementById('clock');
  // Check if clock element exists to avoid errors
  if (!clock) return; 

  setInterval(() => {
    const now = new Date();
    clock.innerText = now.toLocaleTimeString();
  }, 1000);
}

async function loadWeather(url) {
  const res = await fetch(url);
  const data = await res.json();

  return `
    <div style="text-align: center;">
      <h1>Denver Weather</h1>
      <p style="font-size: 2rem;">${data.current.temperature_2m}°F</p>
      <p>Wind: ${data.current.wind_speed_10m} mph</p>
    </div>
  `;
}

async function showItem() {
  const item = config[currentIndex];
  const content = document.getElementById('content');

  if (item.type === 'Image') {
    content.innerHTML = `<img src="${item.URL}" style="max-width:80vw; max-height:80vh; object-fit: contain;">`;
  } 
  else if (item.type === 'Clock') {
    content.innerHTML = `<h1>Full Screen Clock</h1>`;
  } 
  else if (item.type === 'Weather') {
    content.innerHTML = await loadWeather(item.URL);
  }
}

loadConfig();