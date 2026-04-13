import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinned } from 'lucide-react';
import { parseCoordinatesFromMapInput } from '../../lib/delivery';

const DEFAULT_CENTER = {
  lat: -25.2637,
  lng: -57.5759,
};

function getLeaflet() {
  if (typeof window === 'undefined') return null;
  return window.L || null;
}

export default function OpenStreetMapPicker({ value, onChange }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [leafletReady, setLeafletReady] = useState(Boolean(getLeaflet()));
  const [ready, setReady] = useState(false);

  const selectedPoint = useMemo(
    () => parseCoordinatesFromMapInput(value),
    [value]
  );

  useEffect(() => {
    if (leafletReady) return undefined;

    const timer = setInterval(() => {
      if (getLeaflet()) {
        setLeafletReady(true);
        clearInterval(timer);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [leafletReady]);

  useEffect(() => {
    const leaflet = getLeaflet();
    if (!leaflet || !mapRef.current || mapInstanceRef.current) return undefined;

    const initialCenter = selectedPoint || DEFAULT_CENTER;
    const initialZoom = selectedPoint ? 16 : 6;

    const map = leaflet.map(mapRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: initialZoom,
      zoomControl: true,
    });

    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(map);

    if (selectedPoint) {
      markerRef.current = leaflet.marker([selectedPoint.lat, selectedPoint.lng]).addTo(map);
    }

    map.on('click', (event) => {
      const nextLat = Number(event.latlng.lat.toFixed(6));
      const nextLng = Number(event.latlng.lng.toFixed(6));

      if (!markerRef.current) {
        markerRef.current = leaflet.marker([nextLat, nextLng]).addTo(map);
      } else {
        markerRef.current.setLatLng([nextLat, nextLng]);
      }

      onChange(`${nextLat},${nextLng}`);
    });

    mapInstanceRef.current = map;
    setReady(true);

    // Force a size recalculation once the modal finishes painting.
    setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
  }, [onChange, selectedPoint]);

  useEffect(() => {
    const leaflet = getLeaflet();
    const map = mapInstanceRef.current;

    if (!leaflet || !map || !selectedPoint) return;

    if (!markerRef.current) {
      markerRef.current = leaflet.marker([selectedPoint.lat, selectedPoint.lng]).addTo(map);
    } else {
      markerRef.current.setLatLng([selectedPoint.lat, selectedPoint.lng]);
    }

    map.setView([selectedPoint.lat, selectedPoint.lng], Math.max(map.getZoom(), 16));
  }, [selectedPoint]);

  if (!leafletReady) {
    return (
      <div className="map-picker-placeholder">
        <MapPinned size={18} />
        <span>Cargando mapa...</span>
      </div>
    );
  }

  return (
    <div className="map-picker-shell">
      <div className="map-picker-toolbar">
        <div>
          <strong>Marca tu casa en el mapa</strong>
          <div style={{ fontSize: 12, color: 'var(--txt-muted)' }}>
            Toca una vez para fijar el punto exacto de entrega.
          </div>
        </div>
        {selectedPoint && (
          <span className="badge badge-blue">
            {selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)}
          </span>
        )}
      </div>

      <div ref={mapRef} className="map-picker-canvas" />

      <div className="map-picker-help">
        {ready
          ? 'Puedes mover el mapa con el dedo y tocar tu casa para guardar la ubicacion.'
          : 'Preparando el mapa...'}
      </div>
    </div>
  );
}
