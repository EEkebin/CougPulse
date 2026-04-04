const SVG_SIZE = 1000;

const state = {
  mode: 'select',
  floorPlanUrl: '',
  rooms: [],
  microphones: [],
  selectedRoomId: null,
  interaction: {
    rectStart: null,
    rectCurrent: null,
    polygonPoints: [],
    polygonHover: null,
    dragRoomId: null,
    dragStartPoint: null,
    dragInitialPoints: null,
  },
  heatmapEnabled: true,
  simIntervalId: null,
  roomCounter: 1,
  micCounter: 1,
};

const refs = {
  floorPlanInput: document.getElementById('floorPlanInput'),
  floorPlanImage: document.getElementById('floorPlanImage'),
  canvasWrap: document.getElementById('canvasWrap'),
  overlaySvg: document.getElementById('overlaySvg'),
  placeholderState: document.getElementById('placeholderState'),
  modeButtons: document.getElementById('modeButtons'),
  modeHint: document.getElementById('modeHint'),
  roomInspector: document.getElementById('roomInspector'),
  roomInspectorTemplate: document.getElementById('roomInspectorTemplate'),
  micList: document.getElementById('micList'),
  roomList: document.getElementById('roomList'),
  randomizeBtn: document.getElementById('randomizeBtn'),
  simulateBtn: document.getElementById('simulateBtn'),
  simStatus: document.getElementById('simStatus'),
  toggleHeatBtn: document.getElementById('toggleHeatBtn'),
  fitViewBtn: document.getElementById('fitViewBtn'),
  finishPolygonBtn: document.getElementById('finishPolygonBtn'),
  cancelPolygonBtn: document.getElementById('cancelPolygonBtn'),
};

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clonePoints(points) {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function pointsToSvg(points) {
  return points.map((point) => `${Math.round(point.x * SVG_SIZE)},${Math.round(point.y * SVG_SIZE)}`).join(' ');
}

function centroid(points) {
  if (points.length === 0) {
    return { x: 0.5, y: 0.5 };
  }

  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );

  return { x: total.x / points.length, y: total.y / points.length };
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
  state.interaction.rectStart = null;
  state.interaction.rectCurrent = null;

  if (mode !== 'draw-polygon') {
    state.interaction.polygonPoints = [];
    state.interaction.polygonHover = null;
  }

  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });

  refs.canvasWrap.style.cursor = mode === 'select' ? 'default' : 'crosshair';
  refs.modeHint.textContent =
    mode === 'select'
      ? 'Select a room to move it and manage assigned microphones.'
      : mode === 'draw-rect'
      ? 'Click and drag to draw a rectangular room.'
      : 'Click to place polygon vertices, then Finish Shape.';

  updatePolygonButtons();
  renderOverlay();
}

function updatePolygonButtons() {
  const polygonMode = state.mode === 'draw-polygon';
  refs.finishPolygonBtn.classList.toggle('hidden', !polygonMode);
  refs.cancelPolygonBtn.classList.toggle('hidden', !polygonMode);
  refs.finishPolygonBtn.disabled = state.interaction.polygonPoints.length < 3;
}

function getRelativePoint(event) {
  const rect = refs.canvasWrap.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function rectPoints(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function polygonBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function normalizeRoomPoints(points) {
  return points.map((point) => ({
    x: clamp(point.x, 0, 1),
    y: clamp(point.y, 0, 1),
  }));
}

function translatePoints(points, deltaX, deltaY) {
  const bounds = polygonBounds(points);

  const allowedX = clamp(deltaX, -bounds.minX, 1 - bounds.maxX);
  const allowedY = clamp(deltaY, -bounds.minY, 1 - bounds.maxY);

  return points.map((point) => ({
    x: point.x + allowedX,
    y: point.y + allowedY,
  }));
}

function addRoom(points, shape) {
  const normalized = normalizeRoomPoints(points);
  const bounds = polygonBounds(normalized);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  if (width < 0.03 || height < 0.03) {
    return;
  }

  const room = {
    id: uid('room'),
    name: `Room ${state.roomCounter++}`,
    shape,
    points: normalized,
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

function renderOverlay() {
  refs.overlaySvg.innerHTML = '';

  state.rooms.forEach((room) => {
    const avg = roomAverage(room.id);

    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    shape.setAttribute('points', pointsToSvg(room.points));
    shape.setAttribute('class', `room-shape${room.id === state.selectedRoomId ? ' selected' : ''}`);
    shape.setAttribute('fill', state.heatmapEnabled ? heatColor(avg) : 'transparent');
    shape.style.pointerEvents = state.mode === 'select' ? 'auto' : 'none';

    shape.addEventListener('pointerdown', (event) => {
      if (state.mode !== 'select') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const point = getRelativePoint(event);
      state.selectedRoomId = room.id;
      state.interaction.dragRoomId = room.id;
      state.interaction.dragStartPoint = point;
      state.interaction.dragInitialPoints = clonePoints(room.points);
      renderAll();
    });

    const center = centroid(room.points);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(center.x * SVG_SIZE));
    label.setAttribute('y', String(center.y * SVG_SIZE));
    label.setAttribute('class', 'room-label');
    label.textContent = `${room.name} · ${Math.round(avg)} dB`;
    label.style.pointerEvents = 'none';

    refs.overlaySvg.appendChild(shape);
    refs.overlaySvg.appendChild(label);
  });

  renderDraftShape();
}

function renderDraftShape() {
  if (state.mode === 'draw-rect' && state.interaction.rectStart && state.interaction.rectCurrent) {
    const points = rectPoints(state.interaction.rectStart, state.interaction.rectCurrent);
    const draft = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    draft.setAttribute('points', pointsToSvg(points));
    draft.setAttribute('class', 'draft-shape');
    refs.overlaySvg.appendChild(draft);
    return;
  }

  if (state.mode !== 'draw-polygon') {
    return;
  }

  const draftPoints = clonePoints(state.interaction.polygonPoints);
  if (state.interaction.polygonHover) {
    draftPoints.push(state.interaction.polygonHover);
  }

  if (draftPoints.length >= 2) {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', pointsToSvg(draftPoints));
    polyline.setAttribute('class', 'draft-shape');
    polyline.setAttribute('fill', 'none');
    refs.overlaySvg.appendChild(polyline);
  }

  if (state.interaction.polygonPoints.length >= 3) {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', pointsToSvg(state.interaction.polygonPoints));
    polygon.setAttribute('class', 'draft-shape');
    refs.overlaySvg.appendChild(polygon);
  }

  state.interaction.polygonPoints.forEach((point) => {
    const vertex = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    vertex.setAttribute('cx', String(point.x * SVG_SIZE));
    vertex.setAttribute('cy', String(point.y * SVG_SIZE));
    vertex.setAttribute('r', '6');
    vertex.setAttribute('class', 'draft-vertex');
    refs.overlaySvg.appendChild(vertex);
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
      <div class="hint">Shape: ${room.shape === 'polygon' ? 'Polygon' : 'Rectangle'} · Mics: ${room.micIds.length}</div>
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

  roomMicSummary.textContent = `${room.shape === 'polygon' ? 'Polygon' : 'Rectangle'} room · ${room.micIds.length} microphone(s) assigned.`;

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
  updatePolygonButtons();
}

function finalizePolygon() {
  if (state.interaction.polygonPoints.length < 3) {
    return;
  }

  addRoom(state.interaction.polygonPoints, 'polygon');
  state.interaction.polygonPoints = [];
  state.interaction.polygonHover = null;
  renderAll();
}

function cancelPolygonDraft() {
  state.interaction.polygonPoints = [];
  state.interaction.polygonHover = null;
  renderOverlay();
  updatePolygonButtons();
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

refs.overlaySvg.addEventListener('pointerdown', (event) => {
  if (!state.floorPlanUrl) {
    return;
  }

  const point = getRelativePoint(event);

  if (state.mode === 'select') {
    state.selectedRoomId = null;
    renderAll();
    return;
  }

  if (state.mode === 'draw-rect') {
    state.interaction.rectStart = point;
    state.interaction.rectCurrent = point;
    renderOverlay();
    return;
  }

  if (state.mode === 'draw-polygon') {
    state.interaction.polygonPoints.push(point);
    state.interaction.polygonHover = point;
    renderOverlay();
    updatePolygonButtons();
  }
});

window.addEventListener('pointermove', (event) => {
  if (!state.floorPlanUrl) {
    return;
  }

  const point = getRelativePoint(event);

  if (state.mode === 'draw-rect' && state.interaction.rectStart) {
    state.interaction.rectCurrent = point;
    renderOverlay();
    return;
  }

  if (state.mode === 'draw-polygon') {
    state.interaction.polygonHover = point;
    renderOverlay();
    return;
  }

  if (state.interaction.dragRoomId && state.interaction.dragStartPoint && state.interaction.dragInitialPoints) {
    const room = state.rooms.find((item) => item.id === state.interaction.dragRoomId);
    if (!room) {
      return;
    }

    const deltaX = point.x - state.interaction.dragStartPoint.x;
    const deltaY = point.y - state.interaction.dragStartPoint.y;
    room.points = translatePoints(state.interaction.dragInitialPoints, deltaX, deltaY);
    renderOverlay();
  }
});

window.addEventListener('pointerup', () => {
  if (state.mode === 'draw-rect' && state.interaction.rectStart && state.interaction.rectCurrent) {
    addRoom(rectPoints(state.interaction.rectStart, state.interaction.rectCurrent), 'rect');
    state.interaction.rectStart = null;
    state.interaction.rectCurrent = null;
    renderAll();
    return;
  }

  if (state.interaction.dragRoomId) {
    state.interaction.dragRoomId = null;
    state.interaction.dragStartPoint = null;
    state.interaction.dragInitialPoints = null;
    renderAll();
  }
});

refs.overlaySvg.addEventListener('dblclick', (event) => {
  if (state.mode !== 'draw-polygon') {
    return;
  }

  event.preventDefault();
  finalizePolygon();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && state.mode === 'draw-polygon') {
    finalizePolygon();
  }

  if (event.key === 'Escape' && state.mode === 'draw-polygon') {
    cancelPolygonDraft();
  }
});

refs.finishPolygonBtn.addEventListener('click', finalizePolygon);
refs.cancelPolygonBtn.addEventListener('click', cancelPolygonDraft);

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
