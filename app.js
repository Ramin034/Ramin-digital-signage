let config = [];
let currentIndex = 1; 
let cycleTime = 10;

// 1. The Setup Function (Merged with error handling)
async function loadConfig() {
    try {
        const res = await fetch('config.json');
        if (!res.ok) throw new Error("Could not find config.json");
        
        config = await res.json();
        cycleTime = config[0].cycle;
        
        // Start all systems
        startClock();
        updatePersistentWeather(); 
        startDisplay(); 

        // Update weather every 15 minutes
        setInterval(updatePersistentWeather, 15 * 60 * 1000);
    } catch (err) {
        document.getElementById('content').innerHTML = "<h1>Config Error: " + err.message + "</h1>";
        console.error(err);
    }
}

// 2. The Clock Function
function startClock() {
    const clockElement = document.getElementById('clock');
    setInterval(function() {
        const now = new Date();
        clockElement.innerText = now.toLocaleTimeString();
    }, 1000);
}

// 3. The Timer Logic
function startDisplay() {
    showItem(); 

    setInterval(function() {
        currentIndex++;
        if (currentIndex >= config.length) {
            currentIndex = 1; 
        }
        showItem();
    }, cycleTime * 1000);
}

// 4. Persistent Weather (Top Right)
async function updatePersistentWeather() {
    const weatherElement = document.getElementById('weather-widget');
    
    let weatherItem = null;
    for (let i = 0; i < config.length; i++) {
        if (config[i].type === 'Weather') {
            weatherItem = config[i];
            break;
        }
    }

    if (weatherItem) {
        try {
            const res = await fetch(weatherItem.URL);
            const data = await res.json();
            const temp = Math.round(data.current.temperature_2m);
            weatherElement.innerHTML = temp + "&deg;F | Denver";
        } catch (e) {
            weatherElement.innerHTML = "Weather Off";
        }
    }
}

// 5. Main Content Logic
async function showItem() {
    const item = config[currentIndex];
    const content = document.getElementById('content');

    // SKIP Weather slides because it is now in the top-bar
    if (item.type === 'Weather') {
        currentIndex++;
        if (currentIndex >= config.length) currentIndex = 1;
        showItem(); 
        return;
    }

    content.innerHTML = '<h1>Loading ' + item.type + '...</h1>';

    try {
        if (item.type === 'Image') {
            content.innerHTML = '<img src="' + item.URL + '" class="main-image">';
        } 
        else if (item.type === 'RSS') {
            const res = await fetch(item.URL);
            const text = await res.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const newsItems = xmlDoc.getElementsByTagName("item");

            let newsHTML = "<h1>ACM News</h1><ul>";
            for (let i = 0; i < 4; i++) {
                const title = newsItems[i].getElementsByTagName("title")[0].textContent;
                newsHTML += "<li>" + title + "</li>";
            }
            newsHTML += "</ul>";
            content.innerHTML = newsHTML;
        }
    } catch (error) {
        content.innerHTML = "<h1>Slide Failed</h1>";
        console.error(error);
    }
}

// Actually start the app
loadConfig();