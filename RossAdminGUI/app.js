const state = {
  mode: 'select',
  floorPlanUrl: '',
  rooms: [],
  microphones: [],
  selectedRoomId: null,
  drawStart: null,
  dragRoomStart: null,
  activeDragRoomId: null,
  heatmapEnabled: true,
  simIntervalId: null,
  roomCounter: 1,
  micCounter: 1,
};

const refs = {
  floorPlanInput: document.getElementById('floorPlanInput'),
  floorPlanImage: document.getElementById('floorPlanImage'),
  canvasWrap: document.getElementById('canvasWrap'),
  overlayLayer: document.getElementById('overlayLayer'),
  draftRoom: document.getElementById('draftRoom'),
  placeholderState: document.getElementById('placeholderState'),
  modeButtons: document.getElementById('modeButtons'),
  roomInspector: document.getElementById('roomInspector'),
  roomInspectorTemplate: document.getElementById('roomInspectorTemplate'),
  micList: document.getElementById('micList'),
  roomList: document.getElementById('roomList'),
  randomizeBtn: document.getElementById('randomizeBtn'),
  simulateBtn: document.getElementById('simulateBtn'),
  simStatus: document.getElementById('simStatus'),
  toggleHeatBtn: document.getElementById('toggleHeatBtn'),
  fitViewBtn: document.getElementById('fitViewBtn'),
};

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roomAverage(roomId) {
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room || room.micIds.length === 0) {
    return 0;
  }

  const values = room.micIds
    .map((micId) => state.microphones.find((mic) => mic.id === micId)?.level ?? 0)
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function heatColor(level) {
  const normalized = clamp(level / 100, 0, 1);
  const hue = 120 - normalized * 120;
  return `hsla(${hue}, 90%, 52%, 0.35)`;
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  refs.canvasWrap.style.cursor = mode === 'draw-room' ? 'crosshair' : 'default';
}

function getRelativePoint(event) {
  const rect = refs.canvasWrap.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  return { x, y };
}

function applyRoomElementGeometry(roomEl, room) {
  roomEl.style.left = `${room.x * 100}%`;
  roomEl.style.top = `${room.y * 100}%`;
  roomEl.style.width = `${room.w * 100}%`;
  roomEl.style.height = `${room.h * 100}%`;
}

function renderOverlay() {
  refs.overlayLayer.innerHTML = '';

  state.rooms.forEach((room) => {
    const roomEl = document.createElement('div');
    roomEl.className = 'room-box';
    if (room.id === state.selectedRoomId) {
      roomEl.classList.add('selected');
    }

    const avg = roomAverage(room.id);
    roomEl.style.background = state.heatmapEnabled ? heatColor(avg) : 'transparent';
    roomEl.dataset.id = room.id;

    applyRoomElementGeometry(roomEl, room);

    const label = document.createElement('div');
    label.className = 'room-label';
    label.textContent = `${room.name} · ${Math.round(avg)} dB`;
    roomEl.appendChild(label);

    roomEl.addEventListener('mousedown', (event) => {
      event.stopPropagation();
      state.selectedRoomId = room.id;
      if (state.mode === 'select') {
        const point = getRelativePoint(event);
        state.activeDragRoomId = room.id;
        state.dragRoomStart = {
          point,
          roomX: room.x,
          roomY: room.y,
        };
      }
      renderAll();
    });

    refs.overlayLayer.appendChild(roomEl);
  });
}

function renderMicList() {
  if (state.microphones.length === 0) {
    refs.micList.className = 'list empty';
    refs.micList.textContent = 'No room microphones yet.';
    return;
  }

  refs.micList.className = 'list';
  refs.micList.innerHTML = '';

  state.microphones.forEach((mic) => {
    const item = document.createElement('div');
    item.className = 'item';

    const room = state.rooms.find((roomItem) => roomItem.id === mic.roomId);

    item.innerHTML = `
      <div class="item-head">
        <strong>${mic.name}</strong>
        <span>${Math.round(mic.level)} dB</span>
      </div>
      <input type="range" min="0" max="100" value="${mic.level}" data-mic-slider="${mic.id}" />
      <div class="hint">Room: ${room?.name || 'Unassigned'}</div>
    `;

    refs.micList.appendChild(item);
  });

  refs.micList.querySelectorAll('[data-mic-slider]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const mic = state.microphones.find((item) => item.id === slider.dataset.micSlider);
      if (!mic) {
        return;
      }
      mic.level = Number(slider.value);
      renderAll();
    });
  });
}

function renderRoomList() {
  if (state.rooms.length === 0) {
    refs.roomList.className = 'list empty';
    refs.roomList.textContent = 'No rooms yet.';
    return;
  }

  refs.roomList.className = 'list';
  refs.roomList.innerHTML = '';

  state.rooms.forEach((room) => {
    const item = document.createElement('div');
    item.className = 'item';
    const avg = roomAverage(room.id);
    item.innerHTML = `
      <div class="item-head">
        <strong>${room.name}</strong>
        <span>${Math.round(avg)} dB</span>
      </div>
      <div class="hint">Mics: ${room.micIds.length}</div>
    `;

    item.addEventListener('click', () => {
      state.selectedRoomId = room.id;
      renderAll();
    });

    refs.roomList.appendChild(item);
  });
}

function renderRoomInspector() {
  const room = state.rooms.find((item) => item.id === state.selectedRoomId);
  if (!room) {
    refs.roomInspector.className = 'inspector empty';
    refs.roomInspector.textContent = 'Select a room to rename or assign microphones.';
    return;
  }

  refs.roomInspector.className = 'inspector';
  refs.roomInspector.innerHTML = refs.roomInspectorTemplate.innerHTML;

  const nameInput = document.getElementById('roomNameInput');
  const roomMicSummary = document.getElementById('roomMicSummary');
  const addRoomMicBtn = document.getElementById('addRoomMicBtn');
  const removeRoomMicBtn = document.getElementById('removeRoomMicBtn');
  const deleteRoomBtn = document.getElementById('deleteRoomBtn');

  nameInput.value = room.name;
  nameInput.addEventListener('input', () => {
    room.name = nameInput.value.trim() || 'Untitled Room';
    renderAll();
  });

  roomMicSummary.textContent = `${room.micIds.length} microphone(s) assigned to this room.`;

  addRoomMicBtn.addEventListener('click', () => {
    addMicToRoom(room.id);
    renderAll();
  });

  removeRoomMicBtn.addEventListener('click', () => {
    if (room.micIds.length === 0) {
      return;
    }

    const micId = room.micIds[room.micIds.length - 1];
    room.micIds = room.micIds.slice(0, -1);
    state.microphones = state.microphones.filter((mic) => mic.id !== micId);
    renderAll();
  });

  deleteRoomBtn.addEventListener('click', () => {
    const roomMicIds = new Set(room.micIds);
    state.microphones = state.microphones.filter((mic) => !roomMicIds.has(mic.id));
    state.rooms = state.rooms.filter((item) => item.id !== room.id);
    state.selectedRoomId = null;
    renderAll();
  });
}

function renderAll() {
  renderOverlay();
  renderMicList();
  renderRoomList();
  renderRoomInspector();
}

function addRoomFromDrag(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  const width = right - left;
  const height = bottom - top;
  if (width < 0.03 || height < 0.03) {
    return;
  }

  const room = {
    id: uid('room'),
    name: `Room ${state.roomCounter++}`,
    x: left,
    y: top,
    w: width,
    h: height,
    micIds: [],
  };

  state.rooms.push(room);
  addMicToRoom(room.id);
  state.selectedRoomId = room.id;
}

function addMicToRoom(roomId) {
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room) {
    return;
  }

  const mic = {
    id: uid('mic'),
    name: `Mic ${state.micCounter++}`,
    roomId,
    level: 35 + Math.round(Math.random() * 30),
  };

  state.microphones.push(mic);
  room.micIds.push(mic.id);
}

function toggleSimulation() {
  if (state.simIntervalId) {
    clearInterval(state.simIntervalId);
    state.simIntervalId = null;
    refs.simulateBtn.textContent = 'Start Simulation';
    refs.simStatus.textContent = 'Simulation: Off';
    return;
  }

  state.simIntervalId = window.setInterval(() => {
    state.microphones.forEach((mic) => {
      const drift = (Math.random() - 0.5) * 14;
      mic.level = clamp(mic.level + drift, 15, 100);
    });
    renderAll();
  }, 1000);

  refs.simulateBtn.textContent = 'Stop Simulation';
  refs.simStatus.textContent = 'Simulation: On';
}

refs.floorPlanInput.addEventListener('change', () => {
  const file = refs.floorPlanInput.files?.[0];
  if (!file) {
    return;
  }

  if (state.floorPlanUrl) {
    URL.revokeObjectURL(state.floorPlanUrl);
  }

  state.floorPlanUrl = URL.createObjectURL(file);
  refs.floorPlanImage.src = state.floorPlanUrl;
  refs.floorPlanImage.style.display = 'block';
  refs.placeholderState.classList.add('hidden');
});

refs.modeButtons.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const mode = target.dataset.mode;
  if (!mode) {
    return;
  }

  setMode(mode);
});

refs.canvasWrap.addEventListener('mousedown', (event) => {
  if (!state.floorPlanUrl) {
    return;
  }

  const point = getRelativePoint(event);

  if (state.mode === 'draw-room') {
    state.drawStart = point;
    refs.draftRoom.classList.remove('hidden');
    refs.draftRoom.style.left = `${point.x * 100}%`;
    refs.draftRoom.style.top = `${point.y * 100}%`;
    refs.draftRoom.style.width = '0%';
    refs.draftRoom.style.height = '0%';
    return;
  }
});

window.addEventListener('mousemove', (event) => {
  if (state.drawStart) {
    const point = getRelativePoint(event);
    const left = Math.min(state.drawStart.x, point.x);
    const top = Math.min(state.drawStart.y, point.y);
    const width = Math.abs(point.x - state.drawStart.x);
    const height = Math.abs(point.y - state.drawStart.y);

    refs.draftRoom.style.left = `${left * 100}%`;
    refs.draftRoom.style.top = `${top * 100}%`;
    refs.draftRoom.style.width = `${width * 100}%`;
    refs.draftRoom.style.height = `${height * 100}%`;
  }

  if (state.activeDragRoomId && state.dragRoomStart) {
    const room = state.rooms.find((item) => item.id === state.activeDragRoomId);
    if (!room) {
      return;
    }

    const current = getRelativePoint(event);
    const deltaX = current.x - state.dragRoomStart.point.x;
    const deltaY = current.y - state.dragRoomStart.point.y;

    room.x = clamp(state.dragRoomStart.roomX + deltaX, 0, 1 - room.w);
    room.y = clamp(state.dragRoomStart.roomY + deltaY, 0, 1 - room.h);

    renderOverlay();
    renderRoomList();
  }
});

window.addEventListener('mouseup', (event) => {
  if (state.drawStart) {
    const end = getRelativePoint(event);
    addRoomFromDrag(state.drawStart, end);
    state.drawStart = null;
    refs.draftRoom.classList.add('hidden');
    renderAll();
  }

  state.activeDragRoomId = null;
  state.dragRoomStart = null;
});

refs.randomizeBtn.addEventListener('click', () => {
  state.microphones.forEach((mic) => {
    mic.level = 20 + Math.round(Math.random() * 80);
  });
  renderAll();
});

refs.simulateBtn.addEventListener('click', toggleSimulation);

refs.toggleHeatBtn.addEventListener('click', () => {
  state.heatmapEnabled = !state.heatmapEnabled;
  refs.toggleHeatBtn.textContent = `Heatmap: ${state.heatmapEnabled ? 'On' : 'Off'}`;
  renderOverlay();
});

refs.fitViewBtn.addEventListener('click', () => {
  state.selectedRoomId = null;
  renderAll();
});

setMode('select');
renderAll();
