import { useState } from 'react';
import { View, Text, StyleSheet, Platform, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';

// react-native-maps is native-only — lazy-load to prevent web crashes
let MapView: any = View;
let Marker: any = View;
let Polyline: any = View;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
}

interface MapPlaceholderProps {
  workerLat?: number | null;
  workerLng?: number | null;
  destLat?: number;
  destLng?: number;
  workerName?: string;
  statusText?: string;
}

export function MapPlaceholder({
  workerLat,
  workerLng,
  destLat,
  destLng,
  workerName = 'Worker',
  statusText = 'En Route',
}: MapPlaceholderProps) {
  const [showLiveMap, setShowLiveMap] = useState(false);

  // Retrieve Google Maps API key from environment
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Generate mock coordinates if none exist
  const wLat = workerLat ?? 12.971598;
  const wLng = workerLng ?? 77.594566;
  const dLat = destLat ?? 12.980123;
  const dLng = destLng ?? 77.603456;

  // Calculate simulated distance in km (simple estimation)
  const distance = Math.sqrt(Math.pow(dLat - wLat, 2) + Math.pow(dLng - wLng, 2)) * 111;
  const etaMins = Math.max(1, Math.round(distance * 3)); // ~3 mins per km

  // RENDER INTERACTIVE LIVE MAP FOR WEB (Leaflet + OpenStreetMap - API key free & robust)
  if ((Platform.OS as string) === 'web') {
    const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .leaflet-popup-content { margin: 12px 14px 8px 14px; font-size: 11px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${wLat}, ${wLng}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    var workerIcon = L.divIcon({
      html: '<div style="background-color: #ff7a00; color: white; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 16px; transform: scale(1.05);">🚗</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -10]
    });
    L.marker([${wLat}, ${wLng}], {icon: workerIcon}).addTo(map).bindPopup("<b>${workerName}</b><br>Service Partner").openPopup();

    var destIcon = L.divIcon({
      html: '<div style="background-color: #10b981; color: white; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 16px; transform: scale(1.05);">📍</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -10]
    });
    L.marker([${dLat}, ${dLng}], {icon: destIcon}).addTo(map).bindPopup("<b>Customer</b><br>Service Destination");

    var route = L.polyline([[${wLat}, ${wLng}], [${dLat}, ${dLng}]], {color: '#6366f1', weight: 4, opacity: 0.85}).addTo(map);
    map.fitBounds(route.getBounds(), {padding: [40, 40]});
  </script>
</body>
</html>
    `;

    return (
      <View className="w-full h-80 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm shadow-slate-100 mb-2">
        <iframe
          srcDoc={leafletHtml}
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      </View>
    );
  }

  // Generate Static Maps URL if key is active
  const staticMapUrl = workerLat !== null && workerLng !== null
    ? `https://maps.googleapis.com/maps/api/staticmap?size=600x320&scale=2&maptype=roadmap&markers=color:red%7Clabel:C%7C${dLat},${dLng}&markers=color:blue%7Clabel:W%7C${wLat},${wLng}&path=color:0x2563eb%7Cweight:4%7C${wLat},${wLng}%7C${dLat},${dLng}&key=${mapsKey}`
    : `https://maps.googleapis.com/maps/api/staticmap?size=600x320&scale=2&zoom=14&maptype=roadmap&markers=color:red%7Clabel:C%7C${dLat},${dLng}&key=${mapsKey}`;

  // RENDER STATIC PREVIEW CARD (Default for Native platforms with key)
  if (mapsKey && !showLiveMap) {
    return (
      <View className="w-full h-80 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 relative justify-center items-center">
        {/* Google Static Map Image */}
        <Image
          source={{ uri: staticMapUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => {
            console.warn('Mobile static map image failed to load, falling back to interactive map view.');
            setShowLiveMap(true);
          }}
        />

        {/* Floating Action Button */}
        <TouchableOpacity
          onPress={() => setShowLiveMap(true)}
          activeOpacity={0.9}
          className="absolute bg-primary px-5 py-3 rounded-full shadow-lg active:scale-95 flex-row items-center justify-center z-20"
        >
          <Ionicons name="car-outline" size={16} color="white" style={{ marginRight: 6 }} />
          <Text className="text-white text-xs font-bold font-sans">Track Live Map</Text>
        </TouchableOpacity>

        {/* Top HUD Overlay */}
        <View className="absolute top-4 left-4 right-4 flex-row justify-between items-center bg-slate-950/95 px-4 py-3 rounded-2xl border border-slate-800/80 z-10">
          <View>
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</Text>
            <Text className="text-white text-sm font-semibold">{statusText}</Text>
          </View>
          <View className="items-end">
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ETA</Text>
            <Text className="text-brand-orange text-sm font-semibold">{etaMins} mins ({distance.toFixed(1)} km)</Text>
          </View>
        </View>

        {/* Bottom Coordinates Overlay */}
        <View className="absolute bottom-4 left-4 right-4 bg-slate-950/95 px-4 py-2.5 rounded-xl border border-slate-800/80 flex-row justify-between items-center z-10">
          <View className="flex-row items-center">
            <Ionicons name="compass-outline" size={14} color="rgb(var(--primary))" />
            <Text className="text-slate-300 text-[10px] ml-1.5 font-medium">Worker Position:</Text>
          </View>
          <Text className="text-slate-100 text-[10px] font-mono">
            {wLat.toFixed(5)}, {wLng.toFixed(5)}
          </Text>
        </View>
      </View>
    );
  }

  // RENDER INTERACTIVE LIVE TRACKER (On Demand / Native Fallback)
  if (showLiveMap) {
    if ((Platform.OS as string) === 'web') {
      return (
        <View className="w-full h-80 rounded-3xl overflow-hidden bg-slate-105 border border-slate-200">
          <iframe
            src={`https://www.google.com/maps/embed/v1/directions?key=${mapsKey}&origin=${wLat},${wLng}&destination=${dLat},${dLng}`}
            style={{ width: '100%', height: '100%', border: 0 }}
            allowFullScreen
          />
        </View>
      );
    }

    return (
      <View className="w-full h-80 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: (wLat + dLat) / 2,
            longitude: (wLng + dLng) / 2,
            latitudeDelta: Math.abs(wLat - dLat) * 1.5 || 0.04,
            longitudeDelta: Math.abs(wLng - dLng) * 1.5 || 0.04,
          }}
        >
          <Marker
            coordinate={{ latitude: wLat, longitude: wLng }}
            title={workerName}
            description="Service Partner"
          >
            <View style={styles.workerMarker}>
              <Text style={{ fontSize: 14 }}>🚗</Text>
            </View>
          </Marker>

          <Marker
            coordinate={{ latitude: dLat, longitude: dLng }}
            title="Customer"
            description="Service Destination"
          >
            <View style={styles.destMarker}>
              <Text style={{ fontSize: 14 }}>📍</Text>
            </View>
          </Marker>

          <Polyline
            coordinates={[
              { latitude: wLat, longitude: wLng },
              { latitude: dLat, longitude: dLng }
            ]}
            strokeColor="#4338ca"
            strokeWidth={4}
          />
        </MapView>
      </View>
    );
  }

  // Fallback radar grid simulator for native or missing-key previews
  return (
    <View className="w-full h-80 rounded-3xl overflow-hidden bg-slate-950 border border-slate-850 relative justify-center items-center">
      {/* Abstract Map Background grid */}
      <View className="absolute inset-0 opacity-10 flex-col justify-between p-4">
        {[...Array(8)].map((_, i) => (
          <View key={i} className="h-[1px] w-full bg-slate-450" />
        ))}
      </View>
      <View className="absolute inset-0 opacity-10 flex-row justify-between p-4">
        {[...Array(8)].map((_, i) => (
          <View key={i} className="w-[1px] h-full bg-slate-450" />
        ))}
      </View>

      {/* Simulated Route Line */}
      <View className="absolute w-[180px] h-[2px] bg-brand-orange/30 rotate-45 flex-row justify-between">
        <View className="w-3 h-3 rounded-full bg-brand-orange -mt-1.5 -ml-1.5 shadow-lg shadow-brand-orange" />
        <View className="w-3 h-3 rounded-full bg-success -mt-1.5 -mr-1.5 shadow-lg shadow-success" />
      </View>

      {/* Pulsing radar circle */}
      <View className="absolute border border-brand-orange/10 rounded-full w-48 h-48 justify-center items-center">
        <View className="border border-brand-orange/20 rounded-full w-32 h-32 justify-center items-center">
          <View className="border border-brand-orange/40 rounded-full w-16 h-16" />
        </View>
      </View>

      {/* Worker Marker */}
      <View className="absolute top-24 left-24 items-center">
        <View className="bg-brand-orange p-2 rounded-full border-2 border-white shadow-xl">
          <Ionicons name="car" size={16} color="white" />
        </View>
        <View className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 mt-1">
          <Text className="text-[10px] text-white font-medium">{workerName}</Text>
        </View>
      </View>

      {/* Destination Marker */}
      <View className="absolute bottom-20 right-20 items-center">
        <View className="bg-success p-2 rounded-full border-2 border-white shadow-xl">
          <Ionicons name="pin" size={16} color="white" />
        </View>
        <View className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 mt-1">
          <Text className="text-[10px] text-white font-medium">Home</Text>
        </View>
      </View>

      {/* Top HUD Overlay */}
      <View className="absolute top-4 left-4 right-4 flex-row justify-between items-center bg-slate-950/95 px-4 py-3 rounded-2xl border border-slate-800/80">
        <View>
          <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</Text>
          <Text className="text-white text-sm font-semibold">{statusText}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ETA</Text>
          <Text className="text-brand-orange text-sm font-semibold">{etaMins} mins ({distance.toFixed(1)} km)</Text>
        </View>
      </View>

      {/* Bottom Coordinates Overlay */}
      <View className="absolute bottom-4 left-4 right-4 bg-slate-950/95 px-4 py-2.5 rounded-xl border border-slate-800/80 flex-row justify-between items-center">
        <View className="flex-row items-center">
          <Ionicons name="compass-outline" size={16} color="rgb(var(--primary))" />
          <Text className="text-slate-350 text-xs ml-1.5 font-medium">Worker Location:</Text>
        </View>
        <Text className="text-slate-200 text-xs font-mono">
          {wLat.toFixed(5)}, {wLng.toFixed(5)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  workerMarker: {
    backgroundColor: '#ff7a00',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: 'black',
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    shadowOffset: { width: 0, height: 2 },
  },
  destMarker: {
    backgroundColor: '#10b981',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: 'black',
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    shadowOffset: { width: 0, height: 2 },
  }
});
