# Room Noise Heatmap Prototype

A front-end prototype for creating room bounds on a floor plan, assigning microphones, and visualizing room noise as a heatmap.

## Features

- Upload a floor plan image (`.png`, `.jpg`, etc.)
- Draw rectangular rooms by click-drag
- Draw polygon rooms by placing vertices
- Select and move full room shapes
- Assign microphones directly to rooms (not map points)
- Manual noise sliders per microphone
- Randomize/simulate live noise values
- Heatmap overlay (green = quieter, red = louder)

## Run

Because this is a static app, you can either open `index.html` directly or serve it locally.

### Option A: Open directly

Open `index.html` in your browser.

### Option B: Local server (recommended)

From this folder:

```powershell
cd c:\Users\rossk\Downloads\PlanningHack\room-heatmap-prototype
python -m http.server 8765
```

Then open:

- http://127.0.0.1:8765

If `python` is not installed but the launcher is available:

```powershell
py -m http.server 8765
```

## Prototype flow

1. Upload floor plan image.
2. Choose **Draw Rectangle** and drag, or choose **Draw Polygon** and click vertices.
3. For polygon mode, click **Finish Shape** (or press `Enter`) when done.
4. Select a room and manage microphones in the room inspector.
5. Adjust mic sliders or start simulation to see heatmap updates.

## Notes

- Coordinates are stored relative to the canvas, so layout scales with viewport size.
- This is a UX/interaction prototype (no backend/audio ingest yet).
