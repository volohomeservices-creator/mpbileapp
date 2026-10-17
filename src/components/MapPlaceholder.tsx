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

  // Safe coordinates normalization: prevent Bangalore -> Hyderabad cross-country lines
  const dLat = destLat ?? 17.3850;
  const dLng = destLng ?? 78.4867;

  let wLat = workerLat;
  let wLng = workerLng;

  const rawDist = (wLat && wLng)
    ? Math.sqrt(Math.pow(dLat - wLat, 2) + Math.pow(dLng - wLng, 2)) * 111
    : 999;

  // If worker coords are missing or in a different city (> 30km away due to uninitialized simulator coords)
  // place worker in the local neighborhood (~1.2 km away)
  if (!wLat || !wLng || rawDist > 30) {
    wLat = Number((dLat - 0.0092).toFixed(6));
    wLng = Number((dLng - 0.0075).toFixed(6));
  }

  // Calculate local distance in km
  const distance = Math.max(0.3, Math.sqrt(Math.pow(dLat - wLat, 2) + Math.pow(dLng - wLng, 2)) * 111);
  const etaMins = Math.max(2, Math.round(distance * 3.5)); // ~3.5 mins per km in city traffic

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
    .leaflet-popup-content { margin: 10px 12px; font-size: 11px; font-family: inherit; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div style="position: absolute; top: 12px; left: 12px; z-index: 1000; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); border-radius: 999px; padding: 6px 14px; color: white; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 11px; box-shadow: 0 4px 14px rgba(0,0,0,0.35);">
    <span style="font-size: 13px;">🚗</span>
    <span>${etaMins} mins away</span>
    <span style="color: #64748B;">•</span>
    <span style="color: #C4B5FD;">${distance.toFixed(1)} km</span>
  </div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${wLat}, ${wLng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    var workerIcon = L.divIcon({
      html: '<div style="background: linear-gradient(135deg, #7C3AED, #3C01A7); color: white; width: 34px; height: 34px; border-radius: 50%; border: 2.5px solid white; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 10px rgba(60,1,167,0.45); font-size: 16px;">🚗</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -12]
    });
    L.marker([${wLat}, ${wLng}], {icon: workerIcon}).addTo(map).bindPopup("<b>${workerName}</b><br>Technician En Route").openPopup();

    var destIcon = L.divIcon({
      html: '<div style="background: linear-gradient(135deg, #10B981, #059669); color: white; width: 34px; height: 34px; border-radius: 50%; border: 2.5px solid white; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 10px rgba(16,185,129,0.45); font-size: 16px;">📍</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -12]
    });
    L.marker([${dLat}, ${dLng}], {icon: destIcon}).addTo(map).bindPopup("<b>Customer Address</b><br>Service Delivery");

    var route = L.polyline([[${wLat}, ${wLng}], [${dLat}, ${dLng}]], {color: '#7C3AED', weight: 4.5, opacity: 0.9, dashArray: '6, 8'}).addTo(map);
    map.fitBounds(route.getBounds(), {padding: [50, 50]});
  </script>
</body>
</html>
    `;

    return (
      <View className="w-full h-80 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-premium mb-2">
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
