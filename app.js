// WMO Hava Durumu Kodları (Türkçe Karşılıkları ve İkonlar)
const wmoCodes = {
  0: { desc: "Açık", icon: "fa-sun text-amber-500" },
  1: { desc: "Çoğunlukla Açık", icon: "fa-cloud-sun text-amber-400" },
  2: { desc: "Parçalı Bulutlu", icon: "fa-cloud-sun text-slate-400" },
  3: { desc: "Kapalı", icon: "fa-cloud text-slate-500" },
  45: { desc: "Sisli", icon: "fa-smog text-slate-400" },
  48: { desc: "Buzlu Sis", icon: "fa-smog text-blue-300" },
  51: { desc: "Hafif Çiseleme", icon: "fa-cloud-rain text-blue-400" },
  61: { desc: "Hafif Yağmurlu", icon: "fa-cloud-showers-heavy text-blue-500" },
  63: { desc: "Orta Şiddetli Yağmur", icon: "fa-cloud-showers-heavy text-blue-600" },
  71: { desc: "Hafif Kar Yağışlı", icon: "fa-snowflake text-blue-300" },
  95: { desc: "Gökgürültülü Fırtına", icon: "fa-cloud-bolt text-purple-500" }
};

function getWeatherMeta(code) {
  return wmoCodes[code] || { desc: "Bilinmiyor", icon: "fa-cloud text-slate-400" };
}

// DOM Elemanları
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const geoBtn = document.getElementById('geo-btn');
const themeToggle = document.getElementById('theme-toggle');
const errorBox = document.getElementById('error-box');
const errorMsg = document.getElementById('error-msg');
const loading = document.getElementById('loading');
const weatherContent = document.getElementById('weather-content');
const offlineBanner = document.getElementById('offline-banner');

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  registerSW();
  checkNetworkStatus();

  // Varsayılan olarak İstanbul'u yükle
  getCoordinatesByCity("İstanbul");

  // Olay Dinleyicileri
  searchBtn.addEventListener('click', handleSearch);
  cityInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
  geoBtn.addEventListener('click', getLocationWeather);
  themeToggle.addEventListener('click', toggleTheme);

  window.addEventListener('online', checkNetworkStatus);
  window.addEventListener('offline', checkNetworkStatus);
});

// Çevrim Dışı (Offline) Kontrolü
function checkNetworkStatus() {
  if (!navigator.onLine) {
    offlineBanner.classList.remove('hidden');
  } else {
    offlineBanner.classList.add('hidden');
  }
}

// Tema Yönetimi
function initTheme() {
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleTheme() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.theme = 'light';
  } else {
    document.documentElement.classList.add('dark');
    localStorage.theme = 'dark';
  }
}

// Hata Gösterimi
function showError(message) {
  loading.classList.add('hidden');
  weatherContent.classList.add('hidden');
  errorMsg.textContent = message;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorBox.classList.add('hidden');
  weatherContent.classList.remove('hidden');
}

// Arama Mantığı
function handleSearch() {
  const city = cityInput.value.trim();
  if (!city) {
    showError("Lütfen bir şehir adı girin.");
    return;
  }
  getCoordinatesByCity(city);
}

// Open-Meteo Geocoding API ile Şehir İsmi -> Koordinat Çevrimi
async function getCoordinatesByCity(city) {
  showLoading(true);
  clearError();
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      showError(`"${city}" adında bir şehir bulunamadı.`);
      return;
    }

    const { latitude, longitude, name, country } = data.results[0];
    const locationLabel = country ? `${name}, ${country}` : name;
    
    fetchWeatherData(latitude, longitude, locationLabel);
  } catch (err) {
    showError("Şehir bilgisi alınırken bir ağ hatası oluştu.");
  }
}

// HTML5 Geolocation API ile Kullanıcı Konumu
function getLocationWeather() {
  if (!navigator.geolocation) {
    showError("Tarayıcınız konum erişimini desteklemiyor.");
    return;
  }

  showLoading(true);
  clearError();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchWeatherData(latitude, longitude, "Mevcut Konumunuz");
    },
    () => {
      showError("Konum izni reddedildi veya konuma ulaşılamadı.");
    }
  );
}

// Open-Meteo Weather Forecast API Çağrısı
async function fetchWeatherData(lat, lon, locationName) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json();

    renderWeather(data, locationName);
  } catch (err) {
    showError("Hava durumu bilgisi alınamadı. İnternet bağlantınızı kontrol edin.");
  } finally {
    showLoading(false);
  }
}

// Verileri Ekrana Yazdırma (Render)
function renderWeather(data, locationName) {
  const current = data.current;
  const daily = data.daily;
  const meta = getWeatherMeta(current.weather_code);

  document.getElementById('location-name').textContent = locationName;
  document.getElementById('weather-desc').textContent = meta.desc;
  document.getElementById('weather-icon').innerHTML = `<i class="fa-solid ${meta.icon}"></i>`;
  document.getElementById('temp-current').textContent = Math.round(current.temperature_2m);
  document.getElementById('humidity-val').textContent = `${current.relative_humidity_2m}%`;
  document.getElementById('wind-val').textContent = `${Math.round(current.wind_speed_10m)} km/s`;
  
  document.getElementById('temp-max-today').textContent = `${Math.round(daily.temperature_2m_max[0])}°C`;
  document.getElementById('temp-min-today').textContent = `${Math.round(daily.temperature_2m_min[0])}°C`;

  // Güncelleme saati
  const now = new Date();
  document.getElementById('last-updated').textContent = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;

  // 5 Günlük Tahmin Listesi
  const forecastList = document.getElementById('forecast-list');
  forecastList.innerHTML = '';

  for (let i = 1; i <= 5; i++) {
    const dateStr = daily.time[i];
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
    const dayMeta = getWeatherMeta(daily.weather_code[i]);
    const maxTemp = Math.round(daily.temperature_2m_max[i]);
    const minTemp = Math.round(daily.temperature_2m_min[i]);

    const itemHtml = `
      <div class="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm text-sm">
        <span class="font-medium w-28 text-slate-600 dark:text-slate-300">${dayName}</span>
        <div class="flex items-center gap-2 flex-1 justify-center">
          <i class="fa-solid ${dayMeta.icon}"></i>
          <span class="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">${dayMeta.desc}</span>
        </div>
        <div class="text-right w-24">
          <span class="font-semibold text-slate-800 dark:text-slate-100">${maxTemp}°</span>
          <span class="text-xs text-slate-400 ml-1">${minTemp}°</span>
        </div>
      </div>
    `;
    forecastList.insertAdjacentHTML('beforeend', itemHtml);
  }
}

function showLoading(isLoading) {
  if (isLoading) {
    loading.classList.remove('hidden');
    weatherContent.classList.add('hidden');
  } else {
    loading.classList.add('hidden');
    weatherContent.classList.remove('hidden');
  }
}

// Service Worker Kaydı
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('SW kaydı başarısız:', err);
    });
  }
}