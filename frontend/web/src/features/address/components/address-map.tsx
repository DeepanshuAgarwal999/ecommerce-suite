'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export interface LatLng {
  lat: number;
  lng: number;
}

interface AddressMapProps {
  center: LatLng;
  zoom?: number;
  /** Fires when the map stops moving, with the point under the centre pin and the zoom. */
  onSettle: (center: LatLng, zoom: number) => void;
}

/** Re-centres when the parent supplies a new point (e.g. after "use my location"). */
function Recenter({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const current = map.getCenter();
    if (Math.abs(current.lat - center.lat) > 1e-6 || Math.abs(current.lng - center.lng) > 1e-6) {
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), zoom), { animate: true });
    }
  }, [center.lat, center.lng, zoom, map]);
  return null;
}

function SettleListener({ onSettle }: { onSettle: (center: LatLng, zoom: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const { lat, lng } = map.getCenter();
      onSettle({ lat, lng }, map.getZoom());
    },
  });
  return null;
}

/**
 * Flipkart/Swiggy-style pin picker: the pin is fixed at the centre and the shopper
 * drags the *map* under it - far easier on a phone than dragging a tiny marker.
 * OpenStreetMap tiles; swap the TileLayer URL for a commercial provider at scale.
 * Loaded with `next/dynamic({ ssr: false })` - Leaflet needs `window`.
 */
export default function AddressMap({ center, zoom = 17, onSettle }: AddressMapProps) {
  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom
        zoomControl
        attributionControl
        className="z-0 h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Recenter center={center} zoom={zoom} />
        <SettleListener onSettle={onSettle} />
      </MapContainer>

      {/* The fixed centre pin, tip exactly on the map's centre point. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-full">
        <svg width="36" height="46" viewBox="0 0 36 46" aria-hidden className="drop-shadow-[0_4px_6px_rgb(0_0_0/0.35)]">
          <path
            d="M18 0C8.06 0 0 7.9 0 17.65 0 30.9 18 46 18 46s18-15.1 18-28.35C36 7.9 27.94 0 18 0z"
            className="fill-primary"
          />
          <circle cx="18" cy="17.5" r="6.5" fill="white" />
        </svg>
      </div>
      {/* Ground shadow where the pin "touches". */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-[999] h-1.5 w-4 -translate-x-1/2 rounded-full bg-black/30 blur-[1px]" />
    </div>
  );
}
