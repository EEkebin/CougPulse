"use client";

import { MapContainer, ImageOverlay, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Simplified icon fix
if (typeof window !== "undefined") {
  console.log("Leaflet component script loading...");
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export default function CampusMap() {
  console.log("CampusMap component rendering...");
  
  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [770, 1386],
  ];

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative', background: '#18181b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #27272a' }}>
      <MapContainer
        crs={L.CRS.Simple}
        bounds={bounds}
        maxZoom={2}
        minZoom={-1}
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
      >
        <ImageOverlay
          url="/map.png"
          bounds={bounds}
        />
        <Marker position={[400, 700]}>
          <Popup>Security Hub</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
