/*
Chen Family Dashboard — Starter Version

Step 1: Get your Google Calendar public iCal URL:
Google Calendar web → Settings → choose calendar → Integrate calendar → Public address in iCal format.

Step 2: Paste the URL below.
Important: If your calendar is private, this demo will not load events directly from the browser.
For private calendars, use the Google Calendar API version later.
*/

const API_KEY = "AIzaSyCpN5mYzvVTidHNfjEzJBW-vqKGRI9oL6E";
const CLIENT_ID = "622004485521-2dcibpdk8jqbdsq9vlcsu6oqipb1ao6d.apps.googleusercontent.com";
const CALENDAR_ID = "2v686b30c3l6maln3diodb5690@group.calendar.google.com";

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

let tokenClient;
let gapiInited = false;
let gisInited = false;

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    document.body.appendChild(script);
  });
}

async function init() {
  updateClock();
  setInterval(updateClock, 1000);

  await loadScript("https://apis.google.com/js/api.js");
  await loadScript("https://accounts.google.com/gsi/client");

  gapi.load("client", async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableSignIn();
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (resp) => {
      if (resp.error) return console.error(resp);
      await loadCalendarEvents();
      setInterval(loadCalendarEvents, 10 * 60 * 1000);
    },
  });

  gisInited = true;
  maybeEnableSignIn();
}

function maybeEnableSignIn() {
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
  if (t.includes("chinese") || t.includes("tuition")) return "📚";
  if (t.includes("school")) return "🏫";
  if (t.includes("birthday")) return "🎂";
  if (t.includes("holiday")) return "🎉";
  if (t.includes("swim")) return "🏊";
  if (t.includes("piano")) return "🎹";
  return "📌";
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
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
  return date.toLocaleDateString("en-SG", { weekday: "long" });
}

function renderFourDays(events) {
  const grid = document.querySelector(".grid");
  const today = new Date();

  grid.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const day = addDays(today, i);
    const dayEvents = events.filter(e =>
      sameDay(new Date(e.start.dateTime || e.start.date), day)
    );

    const card = document.createElement("div");
    card.className = "card day-card";

    card.innerHTML = `
      <h2>${dayLabel(day, i)}</h2>
      <div class="day-date">
        ${day.toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
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

function renderEvent(e) {
  const start = new Date(e.start.dateTime || e.start.date);
  const end = e.end ? new Date(e.end.dateTime || e.end.date) : null;
  const allDay = !!e.start.date;

  const timeText = allDay
    ? "All day"
    : `${formatTime(start)}${end ? " – " + formatTime(end) : ""}`;

  return `
    <div class="event">
      <div class="emoji">${emojiFor(e.summary || "Event")}</div>
      <div>
        <div class="event-title">${e.summary || "Untitled event"}</div>
        <div class="event-time">${timeText}</div>
      </div>
    </div>
  `;
}

async function loadCalendarEvents() {
  const now = new Date();
  const max = addDays(startOfDay(now), 4);

  const response = await gapi.client.calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: now.toISOString(),
    timeMax: max.toISOString(),
    showDeleted: false,
    singleEvents: true,
    orderBy: "startTime",
  });

  renderFourDays(response.result.items || []);
}

init();
