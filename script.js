/* File: script.js */
// CONFIG: AI chatbot in demo mode (no API key required)
const AI_CONFIG = { demoMode: true };

// BLE VARIABLES
const connectBtn = document.getElementById('connect-btn');
let bleDevice = null;
let bleCharacteristic = null;

// CHATBOT: Global health data for AI context
let currentData = { heartRate: 0, steps: 0, fall: false, lat: null, lng: null };

// CAREGIVER: Emergency contact data
let caregiverData = JSON.parse(localStorage.getItem('caregiverData')) || null;

// BLE Configuration
const BLE_SERVICE_UUID = 'e267751a-ae76-11eb-8529-0242ac130003';
const BLE_CHARACTERISTIC_UUID = 'e267751b-ae76-11eb-8529-0242ac130003';

// ✅ TELEGRAM ALERT SECTION — Add your own credentials here
const TELEGRAM_BOT_TOKEN = "7805125993:AAEwn_JivPsDbC5xKkISv7eM-pClH9bbkAQ";  // <-- Replace this
const TELEGRAM_CHAT_ID = "6286498044";      // <-- Replace this

// Connect to BLE device
async function connectToBLE() {
  try {
    console.log('Requesting Bluetooth Device...');
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'GetFit BLE' }],
      optionalServices: [BLE_SERVICE_UUID]
    });

    console.log('Connecting to GATT Server...');
    const server = await bleDevice.gatt.connect();

    console.log('Getting Service...');
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);

    console.log('Getting Characteristic...');
    bleCharacteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);

    // Start notifications
    await bleCharacteristic.startNotifications();
    bleCharacteristic.addEventListener('characteristicvaluechanged', handleBLEData);

    connectBtn.innerHTML = '<span class="btn-icon">✓</span> Connected';
    connectBtn.disabled = true;

    bleDevice.addEventListener('gattserverdisconnected', () => {
      console.log('Device disconnected');
      connectBtn.innerHTML = '<span class="btn-icon">🔗</span> Connect Device';
      connectBtn.disabled = false;
      bleDevice = null;
      bleCharacteristic = null;
    });

  } catch (error) {
    console.error('BLE connection failed:', error);
    alert('Failed to connect to device. Make sure Bluetooth is enabled and the device is nearby.');
  }
}

// Handle incoming BLE data
function handleBLEData(event) {
  const value = new TextDecoder().decode(event.target.value);
  try {
    const data = JSON.parse(value);
    console.log('Received BLE data:', data);
    updateDashboard(data);

    if (data.fall) {
      notifyUser('🚨 EMERGENCY: Fall detected!');
      handleEmergency();
    }
  } catch (error) {
    console.error('Failed to parse BLE data:', error);
  }
}

connectBtn.addEventListener('click', connectToBLE);

document.addEventListener('DOMContentLoaded', () => {
  initializeCaregiverSettings();

  if (!navigator.bluetooth) {
    connectBtn.textContent = 'Bluetooth not supported';
    connectBtn.disabled = true;
    alert('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Safari.');
  }
});

// CAREGIVER SETTINGS
function initializeCaregiverSettings() {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const caregiverForm = document.getElementById('caregiver-form');

  if (!settingsBtn) return;

  if (caregiverData) {
    document.getElementById('caregiver-name').value = caregiverData.name || '';
    document.getElementById('caregiver-phone').value = caregiverData.phone || '';
    document.getElementById('caregiver-email').value = caregiverData.email || '';
  }

  settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  settingsClose.addEventListener('click', () => settingsModal.classList.add('hidden'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });

  caregiverForm.addEventListener('submit', (e) => {
    e.preventDefault();
    caregiverData = {
      name: document.getElementById('caregiver-name').value,
      phone: document.getElementById('caregiver-phone').value,
      email: document.getElementById('caregiver-email').value
    };
    localStorage.setItem('caregiverData', JSON.stringify(caregiverData));
    settingsModal.classList.add('hidden');
    alert('Caregiver information saved!');
  });
}


// ✅ TELEGRAM MESSAGE SENDER FUNCTION
async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram token or chat ID not set");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML"
      })
    });
    const result = await response.json();
    console.log("✅ Telegram alert sent:", result);
  } catch (err) {
    console.error("❌ Telegram send failed:", err);
  }
}
async function sendTelegramAlert(message) {
  const botToken = "7805125993:AAEwn_JivPsDbC5xKkISv7eM-pClH9bbkAQ";
  const chatId = "6286498044";
  const text = encodeURIComponent(message);
  const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${text}`;
  
  try {
    const res = await fetch(url);
    console.log("Telegram alert sent:", await res.json());
  } catch (err) {
    console.error("Failed to send Telegram alert:", err);
  }
}


// EMERGENCY HANDLING
async function handleEmergency() {
  const emergencyModal = document.getElementById('emergency-modal');
  const emergencyContent = document.getElementById('emergency-content');
  emergencyModal.classList.remove('hidden');

  if (!caregiverData) {
    emergencyContent.innerHTML = `
      <p>⚠️ No caregiver configured!</p>
      <button class="emergency-btn" onclick="document.getElementById('settings-modal').classList.remove('hidden'); document.getElementById('emergency-modal').classList.add('hidden');">Setup Caregiver</button>
    `;
    return;
  }

  let locationText, mapsUrl;
  if (currentData.lat && currentData.lng) {
    locationText = `Lat: ${currentData.lat}, Lng: ${currentData.lng}`;
    mapsUrl = `https://maps.google.com/maps?q=${currentData.lat},${currentData.lng}`;
  } else {
    try {
      const position = await getCurrentLocation();
      locationText = `Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude}`;
      mapsUrl = `https://maps.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
    } catch {
      locationText = 'Location unavailable';
      mapsUrl = '';
    }
  }

  // 🆕 Send Telegram alert immediately
  const telegramMessage = `🚨 <b>EMERGENCY ALERT!</b>\n\nFall detected!\n\n👤 Caregiver: ${caregiverData.name}\n📍 ${locationText}\n\n${mapsUrl}`;
  sendTelegramAlert(telegramMessage);

  // Show modal + allow manual alert
  emergencyContent.innerHTML = `
    <p><strong>🚨 FALL DETECTED!</strong></p>
    <p>Caregiver: ${caregiverData.name}</p>
    <div class="location-info">
      <strong>Location:</strong> ${locationText}<br>
      ${mapsUrl ? `<a href="${mapsUrl}" target="_blank">View on Maps</a>` : ''}
    </div>
    <div class="emergency-actions">
      <button class="emergency-btn priority" onclick="sendSequentialAlerts();">📱 SEND ALL ALERTS</button>
      <button class="emergency-btn" onclick="document.getElementById('emergency-modal').classList.add('hidden');">Cancel</button>
    </div>
    <p class="emergency-note">Telegram alert already sent automatically.</p>
  `;

  // Save location for SMS/Email
  window.emergencyData = { locationText, mapsUrl };
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  });
}

// Sequential alerts (SMS → WhatsApp → Email)
function sendSequentialAlerts() {
  const { locationText, mapsUrl } = window.emergencyData;
  const emergencyContent = document.getElementById('emergency-content');

  emergencyContent.innerHTML = `
    <p><strong>Sending alerts to ${caregiverData.name}...</strong></p>
    <div class="emergency-progress">
      <p id="step1">📱 Sending SMS...</p>
      <p id="step2" style="opacity:0.5">💬 Sending WhatsApp...</p>
      <p id="step3" style="opacity:0.5">📧 Sending Email...</p>
    </div>
    <button class="emergency-btn" onclick="document.getElementById('emergency-modal').classList.add('hidden');">Close</button>
  `;

  sendSMS(caregiverData.phone, locationText, mapsUrl);

  setTimeout(() => {
    document.getElementById('step1').style.opacity = '0.5';
    document.getElementById('step2').style.opacity = '1';
    if (navigator.onLine) sendWhatsApp(caregiverData.phone, locationText, mapsUrl);
  }, 3000);

  setTimeout(() => {
    document.getElementById('step2').style.opacity = '0.5';
    document.getElementById('step3').style.opacity = '1';
    if (navigator.onLine && caregiverData.email)
      sendEmail(caregiverData.email, locationText, mapsUrl);
  }, 6000);
}

// SMS/WhatsApp/Email helpers
function sendSMS(phone, location, mapsUrl) {
  const message = `🚨 EMERGENCY: Fall detected! Location: ${location} ${mapsUrl}`;
  const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
  window.location.href = smsUrl;
}

function sendWhatsApp(phone, location, mapsUrl) {
  const message = `🚨 EMERGENCY ALERT 🚨\nFall detected!\nLocation: ${location}\nMaps: ${mapsUrl}`;
  const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
}

function sendEmail(email, location, mapsUrl) {
  const subject = '🚨 EMERGENCY: Fall Detected';
  const body = `Fall detected!\n\nLocation: ${location}\nMaps: ${mapsUrl}`;
  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl);
}

// NOTIFICATIONS
async function notifyUser(message) {
  console.log("🔔 notifyUser:", message);
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') new Notification('Vital Band Alert', { body: message });
}

// DASHBOARD UPDATE
function updateDashboard({ steps, heartRate, fall, lat, lng }) {
  const stepsEl = document.getElementById('steps');
  const heartRateEl = document.getElementById('heart-rate');
  const fallAlertEl = document.getElementById('fall-alert');

  if (stepsEl) stepsEl.textContent = `Steps: ${steps || 0}`;
  if (heartRateEl) heartRateEl.textContent = `BPM: ${heartRate || 0}`;
  if (fallAlertEl) fallAlertEl.textContent = fall ? 'Fall detected!' : 'All good';

  currentData = { heartRate, steps, fall, lat, lng };
}
