/**
 * @file app.js
 * @description
 * Main JavaScript file for the Digital Signage project.
 *
 * This file loads display settings from config.json and renders:
 * - RSS news feeds
 * - Weather information
 * - Cryptocurrency charts
 * - Chicago Art Institute artwork
 * - Static images
 * - API cards
 * - Live clock and date
 */

/**
 * Stores the full configuration loaded from config.json.
 * @type {Array<Object>}
 */
let config = [];

/**
 * Default cycle time in seconds for RSS article rotation.
 * @type {number}
 */
let cycleTime = 10;

/**
 * Stores all RSS feed configuration items.
 * @type {Array<Object>}
 */
let rssItems = [];

/**
 * Stores all non-RSS configuration items such as weather, images, crypto, and API cards.
 * @type {Array<Object>}
 */
let staticItems = [];

/**
 * Tracks the currently displayed RSS feed index.
 * @type {number}
 */
let currentRssIndex = 0;

/**
 * Refresh time in seconds for static content.
 * @type {number}
 */
let staticRefreshTime = 60;

/**
 * Stores the active article timer so it can be cleared before starting a new one.
 * @type {?number}
 */
let articleTimer = null;

/**
 * Loads the project configuration from config.json and starts all display systems.
 *
 * @async
 * @function loadConfig
 * @returns {Promise<void>}
 */
async function loadConfig() {
  try {
    const res = await fetch('config.json');
    config = await res.json();
    cycleTime = config[0].cycle;

    const allItems = config.slice(1);
    rssItems = allItems.filter((item) => item.type === 'RSS');
    staticItems = allItems.filter((item) => item.type !== 'RSS');

    const staticCycles = staticItems
      .map((item) => Number(item.cycle))
      .filter((value) => Number.isFinite(value) && value > 0);
    staticRefreshTime = staticCycles.length ? Math.min(...staticCycles) : 60;

    startClock();
    await renderStaticItems();
    await renderCrypto();
    await renderChicagoArt();
    startStaticRefresh();
    startCryptoRefresh();
    startChicagoArtRefresh();
    startRssDisplay();
    startAutoScroll('feedContent', 0.4, 2000);
    startAutoScroll('apiContent', 0.3, 3000);

  } catch (_err) {
    console.error('Failed to load config:', _err);
  }
}

/**
 * Starts the refresh timer for static display items.
 *
 * @function startStaticRefresh
 * @returns {void}
 */
function startStaticRefresh() {
  setInterval(() => {
    renderStaticItems();
  }, staticRefreshTime * 1000);
}

/**
 * Renders cryptocurrency chart cards into their matching content panels.
 *
 * Each crypto item is mapped to a specific HTML element based on its cryptoId.
 *
 * @async
 * @function renderCrypto
 * @returns {Promise<void>}
 */
async function renderCrypto() {
  const cryptoItems = staticItems.filter((item) => item.type === 'Crypto');
  if (!cryptoItems.length) return;

  const boxMap = {
    'bitcoin':  'bitcoinContent',
    'ethereum': 'ethereumContent',
    'dogecoin': 'dogecoinContent',
  };

  for (const item of cryptoItems) {
    const boxId = boxMap[item.cryptoId] || 'bitcoinContent';
    const box = document.getElementById(boxId);
    if (!box) continue;

    try {
      box.style.display = 'block';
      box.innerHTML = await loadCryptoChart(item);
    } catch {
      box.innerHTML = '<p>Crypto data unavailable.</p>';
      box.style.display = 'block';
    }
  }
}

/**
 * Starts the cryptocurrency refresh timer.
 *
 * Crypto charts refresh once every hour.
 *
 * @function startCryptoRefresh
 * @returns {void}
 */
function startCryptoRefresh() {
  setInterval(renderCrypto, 60 * 60 * 1000);
}

/**
 * Renders artwork from the Art Institute of Chicago API.
 *
 * @async
 * @function renderChicagoArt
 * @returns {Promise<void>}
 */
async function renderChicagoArt() {
  const chicagoArtBox   = document.getElementById('chicagoArtContent');
  const chicagoArtItems = staticItems.filter((item) => item.type === 'ChicagoArt');
  if (!chicagoArtBox || !chicagoArtItems.length) return;

  try {
    const cards = await Promise.all(chicagoArtItems.map(() => loadChicagoArt()));
    chicagoArtBox.style.display = 'block';
    chicagoArtBox.innerHTML = cards.join('');
  } catch {
    chicagoArtBox.style.display = 'none';
  }
}

/**
 * Starts the Chicago Art refresh timer.
 *
 * Artwork refreshes once every minute.
 *
 * @function startChicagoArtRefresh
 * @returns {void}
 */
function startChicagoArtRefresh() {
  setInterval(renderChicagoArt, 1 * 60 * 1000);
}

/**
 * Starts the RSS feed display and rotates between configured RSS feeds.
 *
 * @function startRssDisplay
 * @returns {void}
 */
function startRssDisplay() {
  showRssItem();

  if (rssItems.length <= 1) return;

  /**
   * Schedules the next RSS feed transition after all articles from the current feed rotate.
   *
   * @function scheduleNext
   * @returns {void}
   */
  function scheduleNext() {
    const currentItem = rssItems[currentRssIndex];
    const maxItems = currentItem.maxItems || 5;
    const waitTime = cycleTime * maxItems * 1000;

    setTimeout(() => {
      clearTimeout(articleTimer);
      articleTimer = null;
      currentRssIndex = (currentRssIndex + 1) % rssItems.length;
      showRssItem();
      scheduleNext();
    }, waitTime);
  }

  scheduleNext();
}

/**
 * Starts the live clock and date display.
 *
 * Updates the clock once every second.
 *
 * @function startClock
 * @returns {void}
 */
function startClock() {
  const clock = document.getElementById('clock');
  if (!clock) return;

  setInterval(() => {
    const now = new Date();
    const time = now.toLocaleTimeString();
    const date = now.toDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    clock.innerHTML = '<span id="time">' + time + '</span><span id="date">' + date + '</span>';
  }, 1000);
}

/**
 * Converts weather API codes into readable weather symbols and labels.
 *
 * @function getWeatherSymbol
 * @param {number} code - Weather condition code from the weather API.
 * @returns {string} Weather icon and description.
 */
function getWeatherSymbol(code) {
  if (code === 0)                return '☀️ Clear';
  if (code === 1)                return '🌤️ Mostly Clear';
  if (code === 2)                return '⛅️ Partly Cloudy';
  if (code === 3)                return '☁️ Overcast';
  if (code >= 45 && code <= 48) return '🌫️ Foggy';
  if (code >= 51 && code <= 55) return '🌦️ Drizzle';
  if (code >= 61 && code <= 65) return '🌧️ Rainy';
  if (code >= 71 && code <= 77) return '❄️ Snowy';
  if (code >= 80 && code <= 82) return '🌧️ Showers';
  if (code >= 85 && code <= 86) return '🌨️ Snow Showers';
  if (code >= 95 && code <= 99) return '⛈️ Thunderstorm';
  return '🌡️ Unknown';
}

/**
 * Loads weather data from an API URL and returns weather card HTML.
 *
 * @async
 * @function loadWeather
 * @param {string} url - Weather API URL.
 * @param {string} [title='Weather'] - Display title for the weather card.
 * @returns {Promise<string>} Weather card HTML string.
 */
// Used Ai to help
// Prompt: How can we show the weather for the next 3 days
async function loadWeather(url, title = 'Weather') {
  const res = await fetch(url);
  const data = await res.json();

  const temp = data.current.temperature_2m;
  const wind = data.current.wind_speed_10m;
  const symbol = getWeatherSymbol(data.current.weather_code);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let forecastHTML = '';
  for (let i = 1; i <= 3; i++) {
    const parts = data.daily.time[i].split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = days[date.getDay()];
    const high = Math.round(data.daily.temperature_2m_max[i]);
    const low = Math.round(data.daily.temperature_2m_min[i]);
    const icon = getWeatherSymbol(data.daily.weather_code[i]);
    forecastHTML += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0; border-top: 1px solid rgba(148,163,184,0.2); font-size: 0.65rem;">
        <span style="width: 28px; color: #94a3b8;">${day}</span>
        <span>${icon}</span>
        <span style="color: #f87171;">${high}°</span>
        <span style="color: #7dd3fc;">${low}°</span>
      </div>
    `;
  }

  return `
    <div>
      <h2>${escapeHtml(title)}</h2>
      <p style="font-size: 1rem; margin: 2px 0 1px 0;">${symbol}</p>
      <p style="font-size: 1.2rem; margin: 2px 0 1px 0;">${temp}°F</p>
      <p style="margin: 0; font-size: 0.7rem;">Wind: ${wind} mph</p>
      <div style="margin-top: 6px;">${forecastHTML}</div>
    </div>
  `;
}

/**
 * Loads cryptocurrency price data and creates a Chart.js chart card.
 *
 * @async
 * @function loadCryptoChart
 * @param {Object} item - Cryptocurrency configuration object.
 * @param {string} item.cryptoId - CoinGecko cryptocurrency ID.
 * @param {string} [item.vs_currency='usd'] - Currency used for comparison.
 * @param {number} [item.days=7] - Number of days of chart data to load.
 * @param {string} [item.chartType='line'] - Chart.js chart type.
 * @param {string} [item.color='#6bff6b'] - Chart color.
 * @param {string} item.title - Display title for the chart.
 * @returns {Promise<string>} Crypto chart HTML string.
 */
async function loadCryptoChart(item) {
  const url = `https://api.coingecko.com/api/v3/coins/${item.cryptoId}/market_chart?vs_currency=${item.vs_currency || 'usd'}&days=${item.days || 7}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const data = await res.json();
  if (!data.prices) throw new Error('No price data in response');

  const prices = data.prices.map(([timestamp, price]) => ({
    time: new Date(timestamp).toLocaleDateString(),
    price: price.toFixed(2)
  }));

  const chartId = `cryptoChart_${item.cryptoId}`;

  const html = `
    <div class="cryptoCard">
      <h3 style="margin:0 0 6px 0; font-size:0.95rem;">${escapeHtml(item.title)}</h3>
      <div class="chartWrapper"><canvas id="${chartId}"></canvas></div>
    </div>
  `;

  setTimeout(() => {
    const ctx = document.getElementById(chartId);
    if (ctx) {
      new Chart(ctx, {
        type: item.chartType || 'line',
        data: {
          labels: prices.map(p => p.time),
          datasets: [{
            label: item.title,
            data: prices.map(p => parseFloat(p.price)),
            borderColor: item.color || '#6bff6b',
            backgroundColor: (item.color || '#6bff6b') + '1a',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: false }
          }
        }
      });
    }
  }, 100);

  return html;
}

/**
 * Escapes unsafe HTML characters to help prevent HTML injection.
 *
 * @function escapeHtml
 * @param {string} str - Raw string to sanitize.
 * @returns {string} HTML-safe string.
 */
function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

/**
 * Loads RSS feed data through RSS2JSON and returns article card HTML.
 *
 * @async
 * @function loadRss
 * @param {string} url - RSS feed URL.
 * @param {number} [maxItems=5] - Maximum number of RSS items to display.
 * @returns {Promise<string>} RSS feed HTML string.
 */
// Used ai for help with this
// Prompt: CORSPROXY isn't working can you help with that
async function loadRss(url, maxItems = 5) {
  const proxyUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url);
  const res = await fetch(proxyUrl);
  const data = await res.json();

  if (data.status !== 'ok' || !data.items?.length) {
    return '<div><h1>Feed Unavailable</h1><p>' + (data.message || 'No items found.') + '</p></div>';
  }

  const items = data.items.slice(0, maxItems);

  let html = '<div class="article-feed">';
  items.forEach((item, i) => {
    const decoded = item.title
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
    const desc = item.description
      ? stripHtml(item.description).substring(0, 300) + '...'
      : '';
    const date = item.pubDate
      ? new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';

    html += `
      <div class="article-card" style="display: ${i === 0 ? 'flex' : 'none'}" data-index="${i}">
        <div class="article-source">${escapeHtml(data.feed.title)} <span class="article-date">${date}</span></div>
        <h1 class="article-title">${escapeHtml(decoded)}</h1>
        <div class="article-divider"></div>
        <p class="article-desc">${escapeHtml(desc)}</p>
        <div class="article-num">${i + 1} / ${items.length}</div>
      </div>
    `;
  });
  html += '</div>';

  return html;
}

/**
 * Removes HTML tags from a string and returns plain text.
 *
 * @function stripHtml
 * @param {string} html - HTML content string.
 * @returns {string} Plain text content.
 */
function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

/**
 * Cycles through visible RSS article cards.
 *
 * @function cycleArticles
 * @returns {void}
 */
function cycleArticles() {
  const cards = document.querySelectorAll('.article-card');
  if (!cards.length) return;

  let visible = 0;
  cards.forEach((c, i) => { if (c.style.display !== 'none') visible = i; });

  cards[visible].style.display = 'none';
  const next = (visible + 1) % cards.length;
  cards[next].style.display = 'flex';

  articleTimer = setTimeout(cycleArticles, cycleTime * 1000);
}

/**
 * Retrieves a nested object value using dot notation.
 *
 * Example:
 * getValuePath(data, 'current.temperature')
 *
 * @function getValuePath
 * @param {Object} obj - Source object.
 * @param {string} path - Dot notation path.
 * @returns {*} Retrieved value, or undefined if the path does not exist.
 */
function getValuePath(obj, path) {
  return path.split('.').reduce(
    (current, key) => current && typeof current === 'object' ? current[key] : undefined,
    obj
  );
}

/**
 * Loads data from a custom API endpoint and returns an API card.
 *
 * @async
 * @function loadApiCard
 * @param {Object} item - API configuration object.
 * @param {string} item.URL - API endpoint URL.
 * @param {string} [item.title='API Data'] - Card title.
 * @param {string} [item.valuePath] - Dot notation path to the value inside the API response.
 * @param {string} [item.prefix=''] - Text displayed before the API value.
 * @param {string} [item.suffix=''] - Text displayed after the API value.
 * @returns {Promise<string>} API card HTML string.
 */
async function loadApiCard(item) {
  const res = await fetch(item.URL);
  const data = await res.json();

  const rawValue = item.valuePath ? getValuePath(data, item.valuePath) : data;
  const value = rawValue === undefined || rawValue === null ? 'N/A' : String(rawValue);

  return `
    <div class="infoCard">
      <h2>${escapeHtml(item.title || 'API Data')}</h2>
      <p style="font-size: 1.1rem; margin: 0; line-height: 1.4;">${escapeHtml(item.prefix || '')}${escapeHtml(value)}${escapeHtml(item.suffix || '')}</p>
    </div>
  `;
}

/**
 * Tests multiple image URLs and resolves with the first valid image.
 *
 * @function probeImages
 * @param {Array<Object>} candidates - Candidate image objects.
 * @param {string} candidates[].url - Image URL.
 * @param {string} candidates[].title - Image title.
 * @param {number} [timeoutMs=6000] - Timeout in milliseconds.
 * @returns {Promise<?Object>} Valid image object, or null if no image loads.
 */
function probeImages(candidates, timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (!candidates.length) { resolve(null); return; }

    let failed = 0;
    const timer = setTimeout(() => resolve(null), timeoutMs);

    candidates.forEach(({ url, title }) => {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timer);
        resolve({ url, title });
      };
      img.onerror = () => {
        if (++failed === candidates.length) {
          clearTimeout(timer);
          resolve(null);
        }
      };
      img.src = url;
    });
  });
}

/**
 * Loads random artwork from the Art Institute of Chicago API.
 *
 * @async
 * @function loadChicagoArt
 * @returns {Promise<string>} Artwork image HTML string, or an empty string if unavailable.
 */
async function loadChicagoArt() {
  try {
    const page = Math.floor(Math.random() * 1200) + 1;
    const url = `https://api.artic.edu/api/v1/artworks?fields=id,title,image_id&limit=10&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`AIC error: ${res.status}`);
    const data = await res.json();

    if (!data.data || !data.data.length) return '';

    const candidates = data.data
      .filter((record) => record.image_id)
      .map((record) => ({
        url: `https://www.artic.edu/iiif/2/${record.image_id}/full/843,/0/default.jpg`,
        title: record.title || ''
      }));

    const winner = await probeImages(candidates);
    if (!winner) return '';

    return `<img src="${winner.url}" alt="${escapeHtml(winner.title)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;">`;
  } catch (_err) {
    console.error('Chicago Art error:', _err);
    return '';
  }
}

/**
 * Renders static content sections including weather, images, and API cards.
 *
 * @async
 * @function renderStaticItems
 * @returns {Promise<void>}
 */
async function renderStaticItems() {
  const weatherBox = document.getElementById('weather');
  const imageBox   = document.getElementById('imageContent');
  const apiBox     = document.getElementById('apiContent');

  const weatherItems = staticItems.filter((item) => item.type === 'Weather');
  const imageItems   = staticItems.filter((item) => item.type === 'Image');
  const apiItems     = staticItems.filter((item) => item.type === 'API');

  if (weatherItems.length) {
    try {
      const markup = await Promise.all(
        weatherItems.map((item) => loadWeather(item.URL, item.title || 'Denver Weather'))
      );
      weatherBox.innerHTML = markup.join('');
    } catch {
      weatherBox.innerHTML = '<p>Weather unavailable.</p>';
    }
  }

  if (imageItems.length) {
    imageBox.style.display = 'block';
    imageBox.innerHTML = imageItems.map((item) =>
      `<img class="staticImage" src="${item.URL}" alt="Static signage image">`
    ).join('');
  }

  if (apiItems.length) {
    try {
      const cards = await Promise.all(apiItems.map((item) => loadApiCard(item)));
      apiBox.style.display = 'block';
      apiBox.innerHTML = cards.map(c =>
        c.replace('<div class="infoCard">', '').replace(/<\/div>\s*$/, '')
      ).join('');
    } catch {
      apiBox.innerHTML = '<p>API data unavailable.</p>';
      apiBox.style.display = 'block';
    }
  }
}

/**
 * Displays the currently selected RSS feed and starts article cycling.
 *
 * @async
 * @function showRssItem
 * @returns {Promise<void>}
 */
async function showRssItem() {
  const feedContent = document.getElementById('feedContent');

  if (!rssItems.length) {
    feedContent.innerHTML = '<h1>No RSS items configured.</h1>';
    return;
  }

  if (articleTimer) {
    clearTimeout(articleTimer);
    articleTimer = null;
  }

  const item = rssItems[currentRssIndex];
  try {
    feedContent.innerHTML = await loadRss(item.URL, item.maxItems || 5);
    articleTimer = setTimeout(cycleArticles, cycleTime * 1000);
  } catch (_err) {
    console.error('Failed to load RSS feed:', _err);
    feedContent.innerHTML = `
      <div>
        <h1>Feed Unavailable</h1>
        <p>This RSS URL could not be loaded in-browser.</p>
        <p style="font-size: 1rem;">Check URL, CORS policy, and HTTPS.</p>
      </div>
    `;
  }
}

/**
 * Auto-scrolls an element slowly, pauses at the bottom, then resets to top.
 *
 * @function startAutoScroll
 * @param {string} elementId - ID of the element to scroll.
 * @param {number} speed - Pixels to scroll per active frame.
 * @param {number} pauseMs - Milliseconds to pause at the bottom before resetting.
 * @returns {void}
 */
function startAutoScroll(elementId, speed, pauseMs) {
  const el = document.getElementById(elementId);
  if (!el) return;

  let scrolling = true;
  let frameCount = 0;

  function scroll() {
    if (!scrolling) return;

    frameCount++;
    if (frameCount % 3 === 0) {
      el.scrollTop += speed;
    }

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
      scrolling = false;
      setTimeout(() => {
        el.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          scrolling = true;
          frameCount = 0;
          scroll();
        }, 1000);
      }, pauseMs);
      return;
    }

    requestAnimationFrame(scroll);
  }

  scroll();
}

/**
 * Initializes the Digital Signage application.
 */
loadConfig();