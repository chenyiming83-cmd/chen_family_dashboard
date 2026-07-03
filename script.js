const API_KEY = "AIzaSyCpN5mYzvVTidHNfjEzJBW-vqKGRI9oL6E";
const CLIENT_ID = "622004485521-2dcibpdk8jqbdsq9vlcsu6oqipb1ao6d.apps.googleusercontent.com";
const CALENDAR_ID = "2v686b30c3l6maln3diodb5690@group.calendar.google.com";

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

let tokenClient;
let gapiInited = false;
let gisInited = false;
let refreshTimer = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function init() {
  updateClock();
  setInterval(updateClock, 1000);

  try {
    await loadScript("https://apis.google.com/js/api.js");
    await loadScript("https://accounts.google.com/gsi/client");

    gapi.load("client", async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });

      gapiInited = true;
      maybeShowSignIn();
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) {
          console.error(resp);
          return;
        }

        await loadCalendarEvents();

        if (!refreshTimer) {
          refreshTimer = setInterval(loadCalendarEvents, 60 * 1000);
        }
      },
    });

    gisInited = true;
    maybeShowSignIn();
  } catch (err) {
    console.error("Initialization error:", err);
    document.querySelector(".grid").innerHTML =
      `<div class="empty">Unable to load dashboard</div>`;
  }
}

function maybeShowSignIn() {
  if (gapiInited && gisInited) {
    document.querySelector(".grid").innerHTML =
      `<button onclick="signIn()" class="signin">Connect Google Calendar</button>`;
  }
}

function signIn() {
  tokenClient.requestAccessToken({ prompt: "consent" });
}

function updateClock() {
  const now = new Date();

  document.getElementById("clock").textContent = now.toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Singapore",
  });

  document.getElementById("dateLine").textContent = now.toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Singapore",
  });
}

function emojiFor(title) {
  const t = title.toLowerCase();

  if (t.includes("badminton")) return "🏸";
  if (t.includes("gym") || t.includes("gymnastics")) return "🤸";
  if (t.includes("chinese") || t.includes("tuition") || t.includes("science")) return "📚";
  if (t.includes("school")) return "🏫";
  if (t.includes("birthday")) return "🎂";
  if (t.includes("holiday")) return "🎉";
  if (t.includes("swim")) return "🏊";
  if (t.includes("piano")) return "🎹";
  if (t.includes("dance")) return "💃";
  if (t.includes("art")) return "🎨";
  if (t.includes("soccer") || t.includes("lions") || t.includes("cup")) return "⚽";

  return "📌";
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function formatTime(date) {
  return date.toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });
}

function dayLabel(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";

  return date.toLocaleDateString("en-SG", {
    weekday: "long",
    timeZone: "Asia/Singapore",
  });
}

function renderFourDays(events) {
  const grid = document.querySelector(".grid");
  const today = new Date();

  grid.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const day = addDays(today, i);

    const dayEvents = events.filter((event) => {
      const eventDate = new Date(event.start.dateTime || event.start.date);
      return sameDay(eventDate, day);
    });

    const card = document.createElement("div");
    card.className = "card day-card";

    card.innerHTML = `
      <h2>${dayLabel(day, i)}</h2>

      <div class="day-date">
        ${day.toLocaleDateString("en-SG", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Singapore",
        })}
      </div>

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
  const start = new Date(event.start.dateTime || event.start.date);
  const end = event.end ? new Date(event.end.dateTime || event.end.date) : null;
  const allDay = !!event.start.date;

  const timeText = allDay
    ? "All day"
    : `${formatTime(start)}${end ? " – " + formatTime(end) : ""}`;

  return `
    <div class="event">
      <div class="emoji">${emojiFor(title)}</div>
      <div>
        <div class="event-title">${title}</div>
        <div class="event-time">${timeText}</div>
      </div>
    </div>
  `;
}

async function loadCalendarEvents() {
  const now = new Date();
  const min = startOfDay(now);
  const max = addDays(min, 4);

  const response = await gapi.client.calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: min.toISOString(),
    timeMax: max.toISOString(),
    showDeleted: false,
    singleEvents: true,
    orderBy: "startTime",
  });

  renderFourDays(response.result.items || []);
}

init();