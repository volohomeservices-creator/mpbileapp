import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface MapPlaceholderProps {
  workerLat?: number | null;
  workerLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  workerName?: string;
  statusText?: string;
}

function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function escapeHtml(str: string): string {
  return (str || '').replace(/["'<>]/g, '');
}

export function MapPlaceholder({
  workerLat,
  workerLng,
  destLat,
  destLng,
  workerName = 'Worker',
  statusText = 'En Route',
}: MapPlaceholderProps) {
  // Validate real coordinates strictly - no mock fallbacks
  const hasValidDest =
    typeof destLat === 'number' &&
    typeof destLng === 'number' &&
    !isNaN(destLat) &&
    !isNaN(destLng) &&
    destLat !== 0 &&
    destLng !== 0;

  const hasValidWorker =
    typeof workerLat === 'number' &&
    typeof workerLng === 'number' &&
    !isNaN(workerLat) &&
    !isNaN(workerLng) &&
    workerLat !== 0 &&
    workerLng !== 0;

  // If destination coordinates do not exist, do not display fake location
  if (!hasValidDest) {
    return (
      <View className="w-full h-64 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 items-center justify-center p-6 mb-2">
        <View className="w-14 h-14 rounded-2xl bg-slate-800/80 items-center justify-center mb-3 border border-slate-700/60">
          <Ionicons name="location-outline" size={28} color="#94A3B8" />
        </View>
        <Text className="text-white text-sm font-bold text-center mb-1">
          Service Location Coordinates Unavailable
        </Text>
        <Text className="text-slate-400 text-xs text-center max-w-[260px]">
          GPS coordinates were not provided for this booking address.
        </Text>
      </View>
    );
  }

  // Calculate real distance and ETA only if both real worker and destination coordinates exist
  let distanceKm: number | null = null;
  let etaMinutes: number | null = null;
  let distanceDisplay = '';

  if (hasValidWorker) {
    distanceKm = calculateHaversineDistanceKm(workerLat, workerLng, destLat, destLng);
    etaMinutes = Math.max(1, Math.round((distanceKm / 25) * 60)); // ~25 km/h urban traffic speed
    distanceDisplay =
      distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`;
  }

  // Generate Interactive Live Leaflet Map HTML (OpenStreetMap) using strictly real coordinates
  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .leaflet-popup-content { margin: 8px 10px; font-size: 11px; font-family: inherit; font-weight: 600; }
    .pulse-ring {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 3px solid #7C3AED;
      animation: pulsate 1.8s infinite ease-out;
      top: -5px;
      left: -5px;
      pointer-events: none;
    }
    @keyframes pulsate {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a','b','c']
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    var destIcon = L.divIcon({
      className: '',
      html: '<svg width="32" height="40" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));"><path d="M17 0C7.61 0 0 7.61 0 17C0 29.75 17 42 17 42C17 42 34 29.75 34 17C34 7.61 26.39 0 17 0Z" fill="#DC2626"/><circle cx="17" cy="16" r="6" fill="#FFFFFF"/><circle cx="17" cy="16" r="2.8" fill="#DC2626"/></svg>',
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -36]
    });
    L.marker([${destLat}, ${destLng}], {icon: destIcon}).addTo(map).bindPopup("<b>Service Destination</b><br>Customer Location");

    ${
      hasValidWorker
        ? `
    var workerIcon = L.divIcon({
      className: '',
      html: '<div style="position:relative;"><div class="pulse-ring"></div><div style="background: linear-gradient(135deg, #7C3AED, #3C01A7); width: 38px; height: 38px; border-radius: 50%; border: 2.5px solid #FFFFFF; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 14px rgba(60,1,167,0.5);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2" fill="#FFFFFF"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2" fill="#FFFFFF"/></svg></div></div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -18]
    });
    L.marker([${workerLat}, ${workerLng}], {icon: workerIcon}).addTo(map).bindPopup("<b>${escapeHtml(workerName)}</b><br>${escapeHtml(statusText)}");

    var route = L.polyline([[${workerLat}, ${workerLng}], [${destLat}, ${destLng}]], {
      color: '#7C3AED',
      weight: 4.5,
      opacity: 0.9,
      dashArray: '8, 8'
    }).addTo(map);

    map.fitBounds(route.getBounds(), {padding: [45, 45]});
    `
        : `
    map.setView([${destLat}, ${destLng}], 15);
    `
    }
  </script>
</body>
</html>
`;

  return (
    <View className="w-full h-80 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-premium mb-2 relative">
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={leafletHtml}
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      ) : (
        <WebView
          source={{ html: leafletHtml }}
          style={styles.webView}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          nestedScrollEnabled={true}
          scrollEnabled={false}
        />
      )}

      {/* Floating Top Real-time Status Badge */}
      <View className="absolute top-3 left-3 bg-slate-950/90 px-3.5 py-2 rounded-2xl border border-slate-800/80 flex-row items-center gap-2 z-10 pointer-events-none">
        {hasValidWorker && etaMinutes !== null ? (
          <>
            <Ionicons name="car-sport" size={15} color="#A78BFA" />
            <Text className="text-white text-xs font-bold">{etaMinutes} mins away</Text>
            <Text className="text-slate-500">•</Text>
            <Text className="text-purple-300 text-xs font-bold">{distanceDisplay}</Text>
          </>
        ) : (
          <>
            <View className="w-2 h-2 rounded-full bg-amber-400" />
            <Text className="text-white text-xs font-bold">Awaiting Worker Live GPS</Text>
          </>
        )}
      </View>

      {/* Floating Bottom Real Coordinates Pill */}
      <View className="absolute bottom-3 left-3 right-3 bg-slate-950/90 px-3.5 py-2 rounded-2xl border border-slate-800/80 flex-row justify-between items-center z-10 pointer-events-none">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="location" size={13} color="#A78BFA" />
          <Text className="text-slate-300 text-[10px] font-semibold">
            {hasValidWorker ? 'Live Worker GPS:' : 'Destination GPS:'}
          </Text>
        </View>
        <Text className="text-white text-[10px] font-mono font-bold">
          {hasValidWorker
            ? `${workerLat!.toFixed(5)}, ${workerLng!.toFixed(5)}`
            : `${destLat.toFixed(5)}, ${destLng.toFixed(5)}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
});
