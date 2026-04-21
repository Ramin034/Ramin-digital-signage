let config = [];
let cycleTime = 10;
let rssItems = [];
let staticItems = [];
let currentRssIndex = 0;
let staticRefreshTime = 60;

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
    startStaticRefresh();
    startRssDisplay();
  } catch (err) {
    console.error("Failed to load config:", err);
  }
}

function startStaticRefresh() {
  setInterval(() => {
    renderStaticItems();
  }, staticRefreshTime * 1000);
}

function startRssDisplay() {
  showRssItem();

  if (rssItems.length <= 1) {
    return;
  }

  setInterval(() => {
    currentRssIndex = (currentRssIndex + 1) % rssItems.length;
    showRssItem();
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

async function loadWeather(url, title = 'Weather') {
  const res = await fetch(url);
  const data = await res.json();

  return `
    <div>
      <h2>${escapeHtml(title)}</h2>
      <p style="font-size: 2rem; margin: 0;">${data.current.temperature_2m}F</p>
      <p>Wind: ${data.current.wind_speed_10m} mph</p>
    </div>
  `;
}

function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadRss(url, maxItems = 5) {
    const proxyUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url);
    const res = await fetch(proxyUrl);
    const data = await res.json();

    console.log('rss2json status:', data.status, 'items:', data.items?.length);

    if (data.status !== 'ok' || !data.items?.length) {
        return '<div><h1>Feed Unavailable</h1><p>' + (data.message || 'No items found.') + '</p></div>';
    }

    const items = data.items.slice(0, maxItems);
    const list = items.map(item => {
    const decoded = item.title.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    return '<li style="margin: 0.5rem 0;">' + escapeHtml(decoded) + '</li>';
    }).join('');

    return '<div><h1>' + escapeHtml(data.feed.title) + '</h1><ul style="font-size: 1.5rem; line-height: 1.4;">' + list + '</ul></div>';
}

function getValuePath(obj, path) {
  return path.split('.').reduce((current, key) => current && typeof current === 'object' ? current[key] : undefined, obj);
}

async function loadApiCard(item) {
  const res = await fetch(item.URL);
  const data = await res.json();

  const rawValue = item.valuePath ? getValuePath(data, item.valuePath) : data;
  const value = rawValue === undefined || rawValue === null ? 'N/A' : String(rawValue);

  return `
    <div class="infoCard">
      <h2>${escapeHtml(item.title || item.tile || 'API Data')}</h2>
      <p style="font-size: 1.1rem; margin: 0; line-height: 1.4;">${escapeHtml(item.prefix || '')}${escapeHtml(value)}${escapeHtml(item.suffix || '')}</p>
    </div>
  `;
}



async function renderStaticItems() {
  const weatherBox = document.getElementById('weather');
  const staticContent = document.getElementById('staticContent');

  const weatherItems = staticItems.filter((item) => item.type === 'Weather');
  const imageItems = staticItems.filter((item) => item.type === 'Image');
  const apiItems = staticItems.filter((item) => item.type === 'API');

  if (weatherItems.length) {
    try {
      const weatherMarkup = await Promise.all(
        weatherItems.map((item) => loadWeather(item.URL, item.title || 'Denver Weather'))
      );
      weatherBox.innerHTML = weatherMarkup.join('');
    } catch (err) {
      console.error('Failed to load weather:', err);
      weatherBox.innerHTML = '<p>Weather unavailable.</p>';
    }
  } else {
    weatherBox.innerHTML = '<p>No weather source configured.</p>';
  }

  const imageMarkup = imageItems
    .map((item) => `<img class="staticImage" src="${item.URL}" alt="Static signage image">`)
    .join('');

  let apiMarkup = '';
  if (apiItems.length) {
    try {
      const apiCards = await Promise.all(apiItems.map((item) => loadApiCard(item)));
      apiMarkup = apiCards.join('');
    } catch (err) {
      console.error('Failed to load API data:', err);
      apiMarkup = '<div class="infoCard"><p>API data unavailable.</p></div>';
    }
  }

  staticContent.innerHTML = imageMarkup || apiMarkup
    ? `${imageMarkup}${apiMarkup}`
    : '<p>Add Image or API items in config.json for pinned visuals.</p>';
}

async function showRssItem() {
  const feedContent = document.getElementById('feedContent');

  if (!rssItems.length) {
    feedContent.innerHTML = '<h1>No RSS items configured.</h1>';
    return;
  }

  const item = rssItems[currentRssIndex];
  try {
    feedContent.innerHTML = await loadRss(item.URL, item.maxItems || 5);
  } catch (err) {
    console.error('Failed to load RSS feed:', err);
    feedContent.innerHTML = `
      <div>
        <h1>Feed Unavailable</h1>
        <p>This RSS URL could not be loaded in-browser.</p>
        <p style="font-size: 1rem;">Check URL, CORS policy, and HTTPS.</p>
      </div>
    `;
  }
}

loadConfig();