import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Compass, MapPin } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

const FALLBACK_LOCATION = { lat: 12.9716, lng: 77.5946 };

function toCoordinate(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function LocationPickerMap({
  lat,
  lng,
  onLocationChange,
  fetchLiveLocation,
  geoLoading,
  geoError
}) {
  const { t } = useLanguage();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const [leafletStatus, setLeafletStatus] = useState(() => window.L ? "ready" : "loading");
  const [tileError, setTileError] = useState("");

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  // Load Leaflet once and give the user a clear recovery state if the network asset fails.
  useEffect(() => {
    if (window.L) {
      setLeafletStatus("ready");
      return undefined;
    }

    let cancelled = false;
    const cssId = "leaflet-css";
    const scriptId = "leaflet-js";
    let stylesheet = document.getElementById(cssId);
    let script = document.getElementById(scriptId);

    if (!stylesheet) {
      stylesheet = document.createElement("link");
      stylesheet.id = cssId;
      stylesheet.rel = "stylesheet";
      stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(stylesheet);
    }

    const markReady = () => {
      if (!cancelled && window.L) setLeafletStatus("ready");
    };
    const markFailed = () => {
      if (!cancelled) setLeafletStatus("error");
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", markReady);
    script.addEventListener("error", markFailed);

    // A script can finish loading just before its listeners are attached.
    if (window.L) markReady();

    return () => {
      cancelled = true;
      script?.removeEventListener("load", markReady);
      script?.removeEventListener("error", markFailed);
    };
  }, []);

  // Create and fully clean up the Leaflet instance. Cleanup prevents the
  // "Map container is already initialized" failure after a profile rerender.
  useEffect(() => {
    if (leafletStatus !== "ready" || !mapContainerRef.current || mapInstanceRef.current) return undefined;

    const L = window.L;
    if (!L) return undefined;

    const initialLat = toCoordinate(lat, FALLBACK_LOCATION.lat);
    const initialLng = toCoordinate(lng, FALLBACK_LOCATION.lng);
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([initialLat, initialLng], 13);

    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    const customIcon = L.divIcon({
      className: "custom-leaflet-pin",
      html: `<div style="background-color:#4f46e5; width:28px; height:28px; border-radius:50%; border:3px solid white; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; color:white;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: customIcon
    }).addTo(map);

    marker.on("dragend", () => {
      const position = marker.getLatLng();
      if (onLocationChangeRef.current) {
        onLocationChangeRef.current(position.lat.toFixed(4), position.lng.toFixed(4));
      }
    });

    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      if (onLocationChangeRef.current) {
        onLocationChangeRef.current(e.latlng.lat.toFixed(4), e.latlng.lng.toFixed(4));
      }
    });

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    };
  }, [leafletStatus]);

  // Keep the marker in sync with typed/live coordinates without snapping the
  // map back while someone is clicking or dragging it.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerInstanceRef.current;
    if (!map || !marker) return;

    const nextLat = toCoordinate(lat, FALLBACK_LOCATION.lat);
    const nextLng = toCoordinate(lng, FALLBACK_LOCATION.lng);
    const markerPosition = marker.getLatLng();
    const isExternalCoordinateChange = Math.abs(markerPosition.lat - nextLat) > 0.00001 || Math.abs(markerPosition.lng - nextLng) > 0.00001;

    if (isExternalCoordinateChange) {
      marker.setLatLng([nextLat, nextLng]);
      map.panTo([nextLat, nextLng], { animate: true, duration: 0.45 });
    }
  }, [lat, lng]);

  const isMapUnavailable = leafletStatus === "error";

  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200/80 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin size={16} className="text-indigo-600" />
            {t("selectLocationOnMap")}
          </span>
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1">
            📍 {lat}° N, {lng}° E
          </span>
        </div>

        <button
          type="button"
          onClick={fetchLiveLocation}
          disabled={geoLoading}
          className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 shadow-2xs"
        >
          <Compass size={14} />
          {geoLoading ? "..." : t("currentLocation")}
        </button>
      </div>

      {geoError && (
        <p className="text-[10px] text-amber-700 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
          ⚠️ {geoError}
        </p>
      )}

      <div className="relative w-full h-56 rounded-xl overflow-hidden border border-indigo-200 shadow-sm bg-gray-100">
        {leafletStatus !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-indigo-50/85 backdrop-blur-xs text-xs font-bold text-indigo-700 gap-2 z-10 px-5 text-center">
            {isMapUnavailable ? <AlertCircle size={17} /> : <span className="animate-spin text-base">🌐</span>}
            {isMapUnavailable ? "Map unavailable." : "Loading map..."}
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full z-0" role="application" aria-label="Location map" />
      </div>

      <p className="text-[11px] font-medium text-gray-500 text-center">
        💡 {t("selectLocationOnMap")}
      </p>
    </div>
  );
}
