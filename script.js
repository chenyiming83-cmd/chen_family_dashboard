const API_KEY = "AIzaSyCpN5mYzvVTidHNfjEzJBW-vqKGRI9oL6E";
const CLIENT_ID = "622004485521-2dcibpdk8jqbdsq9vlcsu6oqipb1ao6d.apps.googleusercontent.com";
const CALENDAR_ID = "2v686b30c3l6maln3diodb5690@group.calendar.google.com";

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const SINGAPORE_TIME_ZONE = "Asia/Singapore";

let tokenClient;
let gapiReady = false;
let gisReady = false;
let isSignedIn = false;
let cachedEvents = [];
let lastRenderedDayKey = "";
let calendarRefreshTimer = null;
let clockTimer = null;
let midnightCheckTimer = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);

    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

async function init() {
  renderLoadingState("Loading dashboard...");
  updateClock();

  clockTimer = setInterval(updateClock, 1000);
  midnightCheckTimer = setInterval(checkForNewDay, 60 * 1000);

  try {
    await loadScript("https://apis.google.com/js/api.js");
    await loadScript("https://accounts.google.com/gsi/client");

    await initGoogleApiClient();
    initGoogleIdentityServices();
    maybeShowSignInButton();
  } catch (error) {
    console.error("Dashboard initialization failed:", error);
    renderErrorState("Unable to load dashboard. Please refresh the page.");
  }
}

function initGoogleApiClient() {
  return new Promise((resolve, reject) => {
    gapi.load("client", async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        });

        gapiReady = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

function initGoogleIdentityServices() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    prompt: "",
    callback: async (response) => {
      if (response.error) {
        console.error("Google sign-in error:", response);
        renderErrorState("Google Calendar connection failed. Please try again.");
        return;
      }

      isSignedIn = true;
      await refreshDashboard();
      startCalendarRefreshTimer();
    },
  });

  gisReady = true;
}

function maybeShowSignInButton() {
  if (!gapiReady || !gisReady || isSignedIn) return;

  document.querySelector(".grid").innerHTML = `
    <button onclick="signIn()" class="signin">Connect Google Calendar</button>
  `;
}

function signIn() {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: "consent" });
}

function startCalendarRefreshTimer() {
  if (calendarRefreshTimer) return;

  calendarRefreshTimer = setInterval(async () => {
    if (!isSignedIn) return;
    await refreshDashboard();
  }, 60 * 1000);
}

async function refreshDashboard() {
  try {
    cachedEvents = await fetchCalendarEvents();
    renderFourDays(cachedEvents);
  } catch (error) {
    console.error("Calendar refresh failed:", error);
    renderErrorState("Unable to refresh calendar. Please reconnect if needed.");
  }
}

async function fetchCalendarEvents() {
  const now = new Date();
  const min = startOfSingaporeDay(now);
  const max = addSingaporeDays(min, 4);

  const response = await gapi.client.calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: min.toISOString(),
    timeMax: max.toISOString(),
    showDeleted: false,
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.result.items || [];
}

function checkForNewDay() {
  updateClock();

  const currentDayKey = getSingaporeDateKey(new Date());

  if (lastRenderedDayKey && currentDayKey !== lastRenderedDayKey) {
    if (isSignedIn) {
      refreshDashboard();
    } else {
      renderEmptyFourDayLayout();
    }
  }
}

function updateClock() {
  const now = new Date();

  document.getElementById("clock").textContent = now.toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SINGAPORE_TIME_ZONE,
  });

  document.getElementById("dateLine").textContent = now.toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SINGAPORE_TIME_ZONE,
  });
}

function renderLoadingState(message) {
  document.querySelector(".grid").innerHTML = `
    <div class="card day-card">
      <h2>Loading</h2>
      <div class="empty">${message}</div>
    </div>
  `;
}

function renderErrorState(message) {
  document.querySelector(".grid").innerHTML = `
    <div class="card day-card">
      <h2>Notice</h2>
      <div class="empty">${message}</div>
    </div>
  `;
}

function renderEmptyFourDayLayout() {
  renderFourDays([]);
}

function renderFourDays(events) {
  const grid = document.querySelector(".grid");
  const today = startOfSingaporeDay(new Date());

  lastRenderedDayKey = getSingaporeDateKey(today);
  grid.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const day = addSingaporeDays(today, i);
    const dayEvents = events.filter((event) => isEventOnSingaporeDay(event, day));

    const card = document.createElement("div");
    card.className = "card day-card";

    card.innerHTML = `
      <h2>${dayLabel(day, i)}</h2>
      <div class="day-date">${formatDayDate(day)}</div>
      <div class="events">
        ${
          dayEvents.length
            ? dayEvents.map(renderEvent).join("")
            : `<div class="empty">No activities 🎈</div>`
        }
      </div>
    `;

    grid.appendChild(card);
  }
}

function renderEvent(event) {
  const title = event.summary || "Untitled event";
  const start = getEventStartDate(event);
  const end = getEventEndDate(event);
  const allDay = Boolean(event.start.date);

  const timeText = allDay
    ? "All day"
    : `${formatTime(start)}${end ? " – " + formatTime(end) : ""}`;

  return `
    <div class="event">
      <div class="emoji">${emojiFor(title)}</div>
      <div>
        <div class="event-title">${escapeHtml(title)}</div>
        <div class="event-time">${timeText}</div>
      </div>
    </div>
  `;
}

function emojiFor(title) {
  const text = title.toLowerCase();

  if (text.includes("badminton")) return "🏸";
  if (text.includes("gym") || text.includes("gymnastics")) return "🤸";
  if (text.includes("chinese") || text.includes("tuition") || text.includes("science")) return "📚";
  if (text.includes("school")) return "🏫";
  if (text.includes("birthday")) return "🎂";
  if (text.includes("holiday") || text.includes("leave")) return "🎉";
  if (text.includes("swim")) return "🏊";
  if (text.includes("piano")) return "🎹";
  if (text.includes("dance")) return "💃";
  if (text.includes("art")) return "🎨";
  if (text.includes("soccer") || text.includes("lions") || text.includes("cup")) return "⚽";

  return "📌";
}

function dayLabel(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";

  return date.toLocaleDateString("en-SG", {
    weekday: "long",
    timeZone: SINGAPORE_TIME_ZONE,
  });
}

function formatDayDate(date) {
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    timeZone: SINGAPORE_TIME_ZONE,
  });
}

function formatTime(date) {
  return date.toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: SINGAPORE_TIME_ZONE,
  });
}

function getEventStartDate(event) {
  return new Date(event.start.dateTime || `${event.start.date}T00:00:00+08:00`);
}

function getEventEndDate(event) {
  if (!event.end) return null;
  return new Date(event.end.dateTime || `${event.end.date}T00:00:00+08:00`);
}

function isEventOnSingaporeDay(event, day) {
  return getSingaporeDateKey(getEventStartDate(event)) === getSingaporeDateKey(day);
}

function startOfSingaporeDay(date) {
  const singaporeParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SINGAPORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = singaporeParts.find((part) => part.type === "year").value;
  const month = singaporeParts.find((part) => part.type === "month").value;
  const day = singaporeParts.find((part) => part.type === "day").value;

  return new Date(`${year}-${month}-${day}T00:00:00+08:00`);
}

function addSingaporeDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getSingaporeDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SINGAPORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.signIn = signIn;
init();