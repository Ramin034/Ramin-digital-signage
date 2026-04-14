let config = [];
let currentIndex = 1; 
let cycleTime = 10;

// 1. Initial Setup
async function loadConfig() {
    try {
        const res = await fetch('config.json');
        config = await res.json();
        cycleTime = config[0].cycle;
        
        startClock();
        updatePersistentWeather(); 
        startDisplay(); 

        // Update weather widget every 15 minutes
        setInterval(updatePersistentWeather, 15 * 60 * 1000);
    } catch (err) {
        document.getElementById('content').innerHTML = "<h1>Config Error</h1>";
    }
}

// 2. The Clock Function
function startClock() {
    const clockElement = document.getElementById('clock');
    setInterval(function() {
        clockElement.innerText = new Date().toLocaleTimeString();
    }, 1000);
}

// 3. The Slide Timer
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

// 4. Top-Right Weather Widget
async function updatePersistentWeather() {
    const weatherElement = document.getElementById('weather-widget');
    
    // Find the weather object in our config array
    let weatherItem = null;
    for (let i = 0; i < config.length; i++) {
        if (config[i].type === 'Weather') {
            weatherItem = config[i];
            break;
        }
    }

    if (weatherItem) {
        try {
            // Weather APIs usually don't need a proxy
            const res = await fetch(weatherItem.URL);
            const data = await res.json();
            const temp = Math.round(data.current.temperature_2m);
            weatherElement.innerHTML = temp + "&deg;F | Denver";
        } catch (e) {
            weatherElement.innerHTML = "Weather Off";
        }
    }
}

// 5. Main Display Logic
async function showItem() {
    const item = config[currentIndex];
    const content = document.getElementById('content');

    // Skip weather if it comes up in the main loop
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
            const proxy = "https://corsproxy.io/?";
            const finalURL = proxy + encodeURIComponent(item.URL);
    
            const res = await fetch(finalURL);
    
            // Log what we actually got back so we can debug
            console.log("Status:", res.status);
            const text = await res.text();
            console.log("Response preview:", text.substring(0, 300));
    
            // Standard XML parsing
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
    
            // Check for RSS 'item' or Atom 'entry' tags
            let newsItems = xmlDoc.getElementsByTagName("item");
            if (newsItems.length === 0) {
                newsItems = xmlDoc.getElementsByTagName("entry");
            }
    
            console.log("Number of items found:", newsItems.length);

            let newsHTML = "<h1>ACM News</h1><ul>";
            for (let i = 0; i < 4; i++) {
                if (newsItems[i]) {
                    const title = newsItems[i].getElementsByTagName("title")[0].textContent;
                    newsHTML += "<li>" + title + "</li>";
                }
            }
            newsHTML += "</ul>";
            content.innerHTML = newsHTML;
        }
    } catch (error) {
        console.error("Fetch failed:", error);
        content.innerHTML = "<h1>Slide Failed</h1><p>Check Proxy/Network</p>";
    }
}

// Launch!
loadConfig();