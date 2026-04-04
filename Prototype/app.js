const floors = {
  1: {
    rooms: [
      { name: "Rm 101", x: 15, y: 73, w: 17, h: 14 },
      { name: "Rm 102", x: 18, y: 48, w: 16, h: 20, shape: "angled" },
      { name: "Rm 115", x: 49, y: 20, w: 14, h: 30 },
      { name: "Rm 151", x: 61, y: 36, w: 11, h: 14 },
      { name: "Rm 155", x: 73, y: 36, w: 12, h: 14 },
      { name: "Rm 157", x: 86, y: 36, w: 12, h: 14 },
      { name: "Rm 156", x: 68, y: 72, w: 14, h: 15 },
      { name: "Rm 158", x: 84, y: 72, w: 14, h: 15 }
    ],
    corridors: [
      { x: 48, y: 52, w: 50, h: 8 },
      { x: 60, y: 24, w: 4, h: 28 },
      { x: 33, y: 58, w: 16, h: 8 }
    ],
    stairs: { x: 44, y: 14, w: 8, h: 10 }
  },
  2: {
    rooms: [
      { name: "Study Hall", x: 24, y: 52, w: 9, h: 12, shape: "angled" },
      { name: "Rm 200", x: 35, y: 21, w: 9, h: 37, shape: "slim" },
      { name: "Rm 251", x: 56, y: 38, w: 13, h: 14 },
      { name: "Rm 255", x: 69, y: 38, w: 10, h: 14 },
      { name: "Rm 257", x: 79, y: 38, w: 13, h: 14 },
      { name: "Rm 261", x: 92, y: 38, w: 3.8, h: 14, shape: "tiny" },
      { name: "Rm 263", x: 95.8, y: 38, w: 3.6, h: 14, shape: "tiny" },
      { name: "Rm 254", x: 57, y: 71, w: 17, h: 16 },
      { name: "Rm 256", x: 74, y: 71, w: 17, h: 16 }
    ],
    corridors: [
      { x: 54, y: 53, w: 45, h: 7 },
      { x: 52, y: 36, w: 4, h: 24 },
      { x: 44, y: 58, w: 10, h: 8 },
      { x: 34, y: 58, w: 10, h: 7 }
    ],
    stairs: { x: 45, y: 37, w: 7, h: 13 }
  },
  3: {
    rooms: [
      { name: "Rm 355", x: 66, y: 38, w: 16, h: 14 },
      { name: "Rm 357", x: 82, y: 38, w: 15, h: 14 },
      { name: "Rm 361", x: 97, y: 38, w: 3, h: 14, shape: "tiny" },
      { name: "Rm 363", x: 94, y: 38, w: 3, h: 14, shape: "tiny" },
      { name: "Rm 354", x: 64, y: 71, w: 15, h: 16 },
      { name: "Rm 356", x: 79, y: 71, w: 11, h: 16 },
      { name: "Rm 358", x: 90, y: 71, w: 9, h: 16 },
      { name: "Rm 340", x: 49.5, y: 77, w: 4.5, h: 10, shape: "tiny" }
    ],
    corridors: [
      { x: 54, y: 53, w: 46, h: 7 },
      { x: 50, y: 62, w: 4, h: 15 },
      { x: 54, y: 71, w: 10, h: 6 },
      { x: 50, y: 36, w: 4, h: 24 }
    ],
    stairs: { x: 45, y: 70, w: 5, h: 17 }
  },
  4: {
    rooms: [
      { name: "Rm 451", x: 64, y: 38, w: 14, h: 14 },
      { name: "Rm 455", x: 78, y: 38, w: 12, h: 14 },
      { name: "Rm 457", x: 90, y: 38, w: 6, h: 14 },
      { name: "Rm 461", x: 96, y: 38, w: 2, h: 14, shape: "tiny" },
      { name: "Rm 452", x: 64, y: 71, w: 12, h: 16 },
      { name: "Rm 456", x: 76, y: 71, w: 12, h: 16 },
      { name: "Rm 458", x: 88, y: 71, w: 12, h: 16 },
      { name: "Rm 440", x: 49.5, y: 77, w: 4.5, h: 10, shape: "tiny" }
    ],
    corridors: [
      { x: 54, y: 53, w: 46, h: 7 },
      { x: 50, y: 62, w: 4, h: 15 },
      { x: 54, y: 71, w: 10, h: 6 },
      { x: 50, y: 36, w: 4, h: 24 }
    ],
    stairs: { x: 45, y: 70, w: 5, h: 17 }
  }
};

const levels = [
  { name: "Quiet", className: "level-green", range: [0, 19] },
  { name: "Calm", className: "level-blue", range: [20, 39] },
  { name: "Moderate", className: "level-yellow", range: [40, 59] },
  { name: "Busy", className: "level-orange", range: [60, 79] },
  { name: "Loud", className: "level-red", range: [80, 100] }
];

const state = {
  isLoggedIn: false,
  floor: 1,
  liveTimer: null,
  selectedRoom: null,
  selectedDay: "Mon"
};

const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const floorMap = document.getElementById("floorMap");
const mapTitle = document.getElementById("mapTitle");
const mapTimestamp = document.getElementById("mapTimestamp");
const modeSubtitle = document.getElementById("modeSubtitle");
const predictivePanel = document.getElementById("predictivePanel");
const predictiveTitle = document.getElementById("predictiveTitle");
const predictiveSubtitle = document.getElementById("predictiveSubtitle");
const closePredictivePanelBtn = document.getElementById("closePredictivePanel");
const noiseChart = document.getElementById("noiseChart");
const dayButtons = Array.from(document.querySelectorAll(".day-btn"));
const floorButtons = Array.from(document.querySelectorAll(".floor-btn"));

function levelFromValue(value) {
  return levels.find((l) => value >= l.range[0] && value <= l.range[1]) || levels[0];
}

function hashRoomName(name) {
  return name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getLiveValue(room, floor) {
  const now = Date.now();
  const seed = hashRoomName(room) + floor * 13 + Math.floor(now / 4000);
  const base = Math.floor(pseudoRandom(seed) * 100);
  return Math.min(100, Math.max(0, base));
}

function getPredictedHourlyAverage(room, floor, day, hour24) {
  const dayScore = day.charCodeAt(0) + day.charCodeAt(day.length - 1);
  const seed = hashRoomName(room) + floor * 47 + dayScore * 17 + hour24 * 31;
  const value = Math.floor(pseudoRandom(seed) * 100);
  return Math.min(100, Math.max(0, value));
}

function timestampText() {
  return `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function renderPredictiveChart() {
  if (!state.selectedRoom) {
    return;
  }

  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  noiseChart.innerHTML = "";

  hours.forEach((hour24) => {
    const avg = getPredictedHourlyAverage(state.selectedRoom, state.floor, state.selectedDay, hour24);
    const barLevel = levelFromValue(avg);

    const labelHour = hour24 <= 12 ? hour24 : hour24 - 12;
    const suffix = hour24 < 12 ? "a" : "p";

    const column = document.createElement("div");
    column.className = "chart-col";

    const bar = document.createElement("div");
    bar.className = `chart-bar ${barLevel.className}`;
    bar.style.height = `${Math.max(10, Math.round(avg * 1.65))}px`;
    bar.title = `${labelHour}${suffix}:00 - ${avg} dB`; 

    const label = document.createElement("div");
    label.className = "chart-label";
    label.textContent = `${labelHour}${suffix}`;

    column.appendChild(bar);
    column.appendChild(label);
    noiseChart.appendChild(column);
  });

  predictiveSubtitle.textContent = `${state.selectedDay} average noise by time`;
}

function openPredictivePanel(roomName) {
  state.selectedRoom = roomName;
  predictiveTitle.textContent = `${roomName} Predictive Noise`;
  predictivePanel.classList.remove("hidden");
  renderPredictiveChart();
}

function closePredictivePanel() {
  predictivePanel.classList.add("hidden");
}

function renderFloor() {
  const floorData = floors[state.floor];
  mapTitle.textContent = `Floor ${state.floor} Map`;

  floorMap.innerHTML = "";

  const outline = document.createElement("div");
  outline.className = "floor-outline";
  floorMap.appendChild(outline);

  floorData.corridors.forEach((segment) => {
    const corridor = document.createElement("div");
    corridor.className = "corridor";
    corridor.style.left = `${segment.x}%`;
    corridor.style.top = `${segment.y}%`;
    corridor.style.width = `${segment.w}%`;
    corridor.style.height = `${segment.h}%`;
    floorMap.appendChild(corridor);
  });

  const stairs = document.createElement("div");
  stairs.className = "stairs";
  stairs.textContent = "Stairs";
  stairs.style.left = `${floorData.stairs.x}%`;
  stairs.style.top = `${floorData.stairs.y}%`;
  stairs.style.width = `${floorData.stairs.w}%`;
  stairs.style.height = `${floorData.stairs.h}%`;
  floorMap.appendChild(stairs);

  floorData.rooms.forEach((room) => {
    const value = getLiveValue(room.name, state.floor);
    const level = levelFromValue(value);

    const roomNode = document.createElement("article");
    roomNode.className = `room ${level.className}`;
    if (room.shape) {
      roomNode.classList.add(`room-${room.shape}`);
    }

    roomNode.style.left = `${room.x}%`;
    roomNode.style.top = `${room.y}%`;
    roomNode.style.width = `${room.w}%`;
    roomNode.style.height = `${room.h}%`;
    roomNode.title = `Open predictive chart for ${room.name}`;
    roomNode.innerHTML = `
      <div class="label">${room.name}</div>
      <div class="meta">${value} dB est.</div>
      <div class="meta">${level.name}</div>
    `;

    roomNode.addEventListener("click", () => {
      openPredictivePanel(room.name);
    });

    floorMap.appendChild(roomNode);
  });

  mapTimestamp.textContent = timestampText();

  if (state.selectedRoom) {
    const roomExists = floorData.rooms.some((room) => room.name === state.selectedRoom);
    if (roomExists && !predictivePanel.classList.contains("hidden")) {
      renderPredictiveChart();
    } else if (!roomExists) {
      closePredictivePanel();
      state.selectedRoom = null;
    }
  }
}

function startLiveUpdates() {
  stopLiveUpdates();
  state.liveTimer = setInterval(() => {
    renderFloor();
  }, 5000);
}

function stopLiveUpdates() {
  if (state.liveTimer) {
    clearInterval(state.liveTimer);
    state.liveTimer = null;
  }
}

function setFloor(floor) {
  state.floor = floor;
  floorButtons.forEach((btn) => {
    const active = Number(btn.dataset.floor) === floor;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  renderFloor();
}

function showDashboard() {
  state.isLoggedIn = true;
  loginScreen.classList.add("hidden");
  dashboard.classList.remove("hidden");

  modeSubtitle.textContent = "Live View: Click any room to open predictive average noise graph";
  startLiveUpdates();
  setFloor(1);
}

function showLogin() {
  state.isLoggedIn = false;
  stopLiveUpdates();
  dashboard.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  closePredictivePanel();
  state.selectedRoom = null;
  loginForm.reset();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  showDashboard();
});

logoutBtn.addEventListener("click", () => {
  showLogin();
});

floorButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setFloor(Number(btn.dataset.floor));
  });
});

dayButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.selectedDay = btn.dataset.day;
    dayButtons.forEach((item) => item.classList.toggle("active", item === btn));
    if (!predictivePanel.classList.contains("hidden")) {
      renderPredictiveChart();
    }
  });
});

closePredictivePanelBtn.addEventListener("click", () => {
  closePredictivePanel();
});
