import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Compass, LocateFixed, MapPin } from "lucide-react";
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
  const [liveCoords, setLiveCoords] = useState({
    lat: String(toCoordinate(lat, FALLBACK_LOCATION.lat)),
    lng: String(toCoordinate(lng, FALLBACK_LOCATION.lng))
  });

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    setLiveCoords({
      lat: String(toCoordinate(lat, FALLBACK_LOCATION.lat)),
      lng: String(toCoordinate(lng, FALLBACK_LOCATION.lng))
    });
  }, [lat, lng]);

  // Load Leaflet library dynamically if not present
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

    if (window.L) markReady();

    return () => {
      cancelled = true;
      script?.removeEventListener("load", markReady);
      script?.removeEventListener("error", markFailed);
    };
  }, []);

  // Initialize Map with Google Maps Tile Layer & Draggable Marker Pin
  useEffect(() => {
    if (leafletStatus !== "ready" || !mapContainerRef.current || mapInstanceRef.current) return undefined;

    const L = window.L;
    if (!L) return undefined;

    const initialLat = toCoordinate(lat, FALLBACK_LOCATION.lat);
    const initialLng = toCoordinate(lng, FALLBACK_LOCATION.lng);

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false
    }).setView([initialLat, initialLng], 15);

    // Google Maps Tile Layer (Official Google Roadmap view)
    L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "&copy; <a href='https://maps.google.com'>Google Maps</a>"
    }).addTo(map);

    // Google Maps Red Pin Icon
    const googlePinIcon = L.divIcon({
      className: "google-maps-pin-marker",
      html: `
        <div style="position:relative; width:34px; height:44px; display:flex; justify-content:center; align-items:center; filter:drop-shadow(0 4px 8px rgba(0,0,0,0.35)); cursor:grab;">
          <svg width="34" height="44" viewBox="0 0 38 50" fill="none">
            <path d="M19 0C8.5 0 0 8.5 0 19C0 33.25 19 50 19 50C19 50 38 33.25 38 19C38 8.5 29.5 0 19 0Z" fill="#EA4335"/>
            <circle cx="19" cy="19" r="7" fill="white"/>
          </svg>
        </div>
      `,
      iconSize: [34, 44],
      iconAnchor: [17, 44]
    });

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: googlePinIcon,
      autoPan: true
    }).addTo(map);

    // Update coordinates while dragging pointer
    marker.on("drag", () => {
      const pos = marker.getLatLng();
      setLiveCoords({ lat: pos.lat.toFixed(4), lng: pos.lng.toFixed(4) });
    });

    // Update final coordinates when drag stops
    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      const newLat = pos.lat.toFixed(4);
      const newLng = pos.lng.toFixed(4);
      setLiveCoords({ lat: newLat, lng: newLng });
      if (onLocationChangeRef.current) {
        onLocationChangeRef.current(newLat, newLng);
      }
    });

    // Move marker and update coordinates on map click
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      const newLat = e.latlng.lat.toFixed(4);
      const newLng = e.latlng.lng.toFixed(4);
      setLiveCoords({ lat: newLat, lng: newLng });
      if (onLocationChangeRef.current) {
        onLocationChangeRef.current(newLat, newLng);
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

  // Automatically fetch current location on mount
  useEffect(() => {
    if (leafletStatus !== "ready") return;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude.toFixed(4);
          const userLng = position.coords.longitude.toFixed(4);
          setLiveCoords({ lat: userLat, lng: userLng });

          if (onLocationChangeRef.current) {
            onLocationChangeRef.current(userLat, userLng);
          }

          if (mapInstanceRef.current && markerInstanceRef.current) {
            const newLatLng = [position.coords.latitude, position.coords.longitude];
            markerInstanceRef.current.setLatLng(newLatLng);
            mapInstanceRef.current.setView(newLatLng, 16, { animate: true });
          }
        },
        (err) => {
          console.log("Automatic location permission or lookup skipped.", err);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    }
  }, [leafletStatus]);

  // Keep marker & map view synced when lat/lng props change externally
  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerInstanceRef.current;
    if (!map || !marker) return;

    const nextLat = toCoordinate(lat, FALLBACK_LOCATION.lat);
    const nextLng = toCoordinate(lng, FALLBACK_LOCATION.lng);
    const markerPosition = marker.getLatLng();
    const isExternalCoordinateChange =
      Math.abs(markerPosition.lat - nextLat) > 0.00001 ||
      Math.abs(markerPosition.lng - nextLng) > 0.00001;

    if (isExternalCoordinateChange) {
      marker.setLatLng([nextLat, nextLng]);
      map.panTo([nextLat, nextLng], { animate: true, duration: 0.45 });
    }
  }, [lat, lng]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    const marker = markerInstanceRef.current;
    if (map && marker) {
      const pos = marker.getLatLng();
      map.setView(pos, 16, { animate: true });
    }
  };

  const isMapUnavailable = leafletStatus === "error";

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-200/80 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin size={16} className="text-[#263c2e]" />
            {t("selectLocationOnMap")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRecenter}
            className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <LocateFixed size={15} className="text-[#263c2e]" />
            <span>Recenter Pin</span>
          </button>

          <button
            type="button"
            onClick={fetchLiveLocation}
            disabled={geoLoading}
            className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-[#263c2e] hover:bg-emerald-100/70 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Compass size={15} />
            <span>{geoLoading ? "Locating..." : t("currentLocation")}</span>
          </button>
        </div>
      </div>

      {geoError && (
        <p className="text-xs text-amber-800 font-bold bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center gap-1.5">
          <span>⚠️</span>
          <span>{geoError}</span>
        </p>
      )}

      <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-gray-300 shadow-xs bg-slate-100">
        {leafletStatus !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-xs text-xs font-bold text-[#263c2e] gap-2 z-10 px-5 text-center">
            {isMapUnavailable ? <AlertCircle size={17} className="text-red-500" /> : <span className="animate-spin text-base">🌐</span>}
            <span>{isMapUnavailable ? "Map unavailable." : "Loading Google Maps..."}</span>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full z-0" role="application" aria-label="Google Maps Location Picker" />
      </div>

      <p className="text-xs font-semibold text-gray-500 text-center flex items-center justify-center gap-1.5">
        <span>📍</span>
        <span>Drag map pointer or click anywhere on Google Maps to fine-tune your location.</span>
      </p>
    </div>
  );
}
