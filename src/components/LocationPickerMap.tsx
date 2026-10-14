import { useEffect, useRef } from 'react';
import L, { type CircleMarker, type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type LocationPickerMapProps = {
  latitude: string;
  longitude: string;
  ariaLabel: string;
  onChange: (latitude: number, longitude: number) => void;
};

function parseCoordinate(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinatesAreValid(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export default function LocationPickerMap({ latitude, longitude, ariaLabel, onChange }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 19,
      scrollWheelZoom: true,
      zoomControl: true,
      attributionControl: true,
    });

    const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; OpenStreetMap contributors';

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution,
    }).addTo(map);

    const marker = L.circleMarker([20, 0], {
      radius: 9,
      weight: 3,
      fillOpacity: 0.9,
    });

    map.on('click', (event) => {
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));
      marker.setLatLng([lat, lng]);
      if (!map.hasLayer(marker)) marker.addTo(map);
      onChangeRef.current(lat, lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    const timer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const lat = parseCoordinate(latitude);
    const lng = parseCoordinate(longitude);
    if (!coordinatesAreValid(lat, lng)) {
      if (map.hasLayer(marker)) marker.removeFrom(map);
      return;
    }

    marker.setLatLng([lat!, lng!]);
    if (!map.hasLayer(marker)) marker.addTo(map);

    const currentCenter = map.getCenter();
    const farAway = Math.abs(currentCenter.lat - lat!) > 1 || Math.abs(currentCenter.lng - lng!) > 1;
    if (farAway || map.getZoom() < 10) map.flyTo([lat!, lng!], Math.max(map.getZoom(), 14), { duration: 0.45 });
  }, [latitude, longitude]);

  return <div ref={containerRef} className="location-picker-map" role="region" aria-label={ariaLabel} />;
}
