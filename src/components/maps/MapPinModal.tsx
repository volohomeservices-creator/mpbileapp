import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { WARANGAL_CENTER, isLocationInWarangal } from '@/utils/warangal-geofence';

interface MapPinModalProps {
  visible: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (location: {
    lat: number;
    lng: number;
    address: string;
    isInWarangal: boolean;
  }) => void;
}

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyApmVER8aFKsry7OpTFJj8iCBE1XedX9gQ';

const WARANGAL_QUICK_HUBS = [
  { name: 'Hanamkonda', lat: 18.0073, lng: 79.5603 },
  { name: 'Kazipet', lat: 17.9818, lng: 79.5218 },
  { name: 'Warangal City', lat: 17.9689, lng: 79.5941 },
  { name: 'Naimnagar', lat: 18.0195, lng: 79.5532 },
];

export default function MapPinModal({
  visible,
  onClose,
  initialLat,
  initialLng,
  onConfirm,
}: MapPinModalProps) {
  const mapRef = useRef<MapView | null>(null);

  const defaultLat = initialLat || WARANGAL_CENTER.lat;
  const defaultLng = initialLng || WARANGAL_CENTER.lng;

  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: defaultLat,
    longitude: defaultLng,
  });

  const [resolvedAddress, setResolvedAddress] = useState<string>('Resolving location...');
  const [resolving, setResolving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResultsDropdown, setShowResultsDropdown] = useState<boolean>(false);

  // Sync coords when opened
  useEffect(() => {
    if (visible) {
      const lat = initialLat || WARANGAL_CENTER.lat;
      const lng = initialLng || WARANGAL_CENTER.lng;
      setCurrentCoords({ latitude: lat, longitude: lng });
      reverseGeocode(lat, lng);
    }
  }, [visible, initialLat, initialLng]);

  // Reverse Geocoding via Google API with fallback
  const reverseGeocode = async (lat: number, lng: number) => {
    setResolving(true);
    try {
      if (GOOGLE_API_KEY && !GOOGLE_API_KEY.includes('placeholder')) {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          setResolvedAddress(data.results[0].formatted_address);
          setResolving(false);
          return;
        }
      }

      // Fallback via Expo Location reverseGeocodeAsync
      const expoRes = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (expoRes && expoRes.length > 0) {
        const item = expoRes[0];
        const parts = [item.name, item.street, item.district, item.city, item.postalCode].filter(Boolean);
        setResolvedAddress(parts.join(', '));
      } else {
        setResolvedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setResolvedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setResolving(false);
    }
  };

  const jumpTo = (lat: number, lng: number) => {
    setCurrentCoords({ latitude: lat, longitude: lng });
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
    reverseGeocode(lat, lng);
  };

  // Google Places Search
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setShowResultsDropdown(false);

    try {
      // Try Google Places API (New) Text Search
      if (GOOGLE_API_KEY && !GOOGLE_API_KEY.includes('placeholder')) {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
          },
          body: JSON.stringify({
            textQuery: q,
            regionCode: 'in',
            languageCode: 'en',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.places && data.places.length > 0) {
            const mapped = data.places.map((p: any) => ({
              title: p.displayName?.text || p.formattedAddress,
              address: p.formattedAddress || '',
              lat: p.location.latitude,
              lng: p.location.longitude,
            }));
            setSearchResults(mapped);
            const top = mapped[0];
            jumpTo(top.lat, top.lng);
            if (mapped.length > 1) {
              setShowResultsDropdown(true);
            }
            setSearching(false);
            return;
          }
        }
      }

      // Fallback via Geocoding
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_API_KEY}`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      if (geoData.status === 'OK' && geoData.results && geoData.results.length > 0) {
        const top = geoData.results[0];
        jumpTo(top.geometry.location.lat, top.geometry.location.lng);
      } else {
        Alert.alert('Location Not Found', `No exact matches for "${q}". Try searching with colony or area name.`);
      }
    } catch (err: any) {
      Alert.alert('Search Notice', 'Could not complete search. Please try again or drag the pin on map.');
    } finally {
      setSearching(false);
    }
  };

  // Detect Device GPS
  const handleGpsDetect = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location permission to detect your current position.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        jumpTo(loc.coords.latitude, loc.coords.longitude);
      }
    } catch (err: any) {
      Alert.alert('GPS Notice', 'Could not acquire precise GPS. Please adjust on map.');
    } finally {
      setLocating(false);
    }
  };

  const handleConfirm = () => {
    const inWarangal = isLocationInWarangal(currentCoords.latitude, currentCoords.longitude);
    onConfirm({
      lat: currentCoords.latitude,
      lng: currentCoords.longitude,
      address: resolvedAddress,
      isInWarangal: inWarangal,
    });
    onClose();
  };

  const inZone = isLocationInWarangal(currentCoords.latitude, currentCoords.longitude);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.title}>Pinpoint Location</Text>
              <View style={styles.googleBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.googleBadgeText}>Google Maps</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Drag the red pin or tap anywhere to set exact spot</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#1E293B" />
          </TouchableOpacity>
        </View>

        {/* Search Toolbar */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchRow}>
            <View style={styles.inputWrapper}>
              <Ionicons name="search" size={16} color="#64748B" style={{ marginLeft: 10, marginRight: 6 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search colony, office, landmark..."
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                style={styles.input}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4, marginRight: 6 }}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={handleSearch} disabled={searching} style={styles.searchBtn}>
              {searching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.searchBtnText}>Search</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGpsDetect} disabled={locating} style={styles.gpsBtn}>
              {locating ? (
                <ActivityIndicator size="small" color="#45016E" />
              ) : (
                <Ionicons name="locate" size={18} color="#45016E" />
              )}
            </TouchableOpacity>
          </View>

          {/* Search Results Dropdown */}
          {showResultsDropdown && searchResults.length > 1 && (
            <View style={styles.dropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownHeaderText}>Matching Locations ({searchResults.length})</Text>
                <TouchableOpacity onPress={() => setShowResultsDropdown(false)}>
                  <Ionicons name="close" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>
              {searchResults.slice(0, 4).map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    jumpTo(item.lat, item.lng);
                    setShowResultsDropdown(false);
                  }}
                  style={styles.dropdownItem}
                >
                  <Ionicons name="location" size={14} color="#45016E" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownItemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.dropdownItemSub} numberOfLines={1}>{item.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Quick Warangal Hubs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubsScroll} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
            <Text style={styles.hubsLabel}>Warangal Hubs:</Text>
            {WARANGAL_QUICK_HUBS.map((hub) => (
              <TouchableOpacity
                key={hub.name}
                onPress={() => jumpTo(hub.lat, hub.lng)}
                style={styles.hubChip}
              >
                <Ionicons name="compass-outline" size={11} color="#45016E" style={{ marginRight: 3 }} />
                <Text style={styles.hubChipText}>{hub.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Interactive Map View */}
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            initialRegion={{
              latitude: defaultLat,
              longitude: defaultLng,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setCurrentCoords({ latitude, longitude });
              reverseGeocode(latitude, longitude);
            }}
          >
            <Marker
              coordinate={currentCoords}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setCurrentCoords({ latitude, longitude });
                reverseGeocode(latitude, longitude);
              }}
              title="Pinned Location"
              description="Drag to adjust exact address"
            />
          </MapView>

          {/* Floating Hint */}
          <View style={styles.dragHint}>
            <Ionicons name="hand-right" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.dragHintText}>Drag pin or tap map to set exact spot</Text>
          </View>
        </View>

        {/* Bottom Confirmation Bar */}
        <View style={styles.bottomBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={styles.coordsText}>
              {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}
            </Text>
            {inZone ? (
              <View style={styles.serviceBadgeOk}>
                <Ionicons name="checkmark-circle" size={10} color="#059669" style={{ marginRight: 3 }} />
                <Text style={styles.serviceBadgeOkText}>Warangal Serviceable</Text>
              </View>
            ) : (
              <View style={styles.serviceBadgeWarn}>
                <Ionicons name="alert-circle" size={10} color="#D97706" style={{ marginRight: 3 }} />
                <Text style={styles.serviceBadgeWarnText}>Outside Warangal Area</Text>
              </View>
            )}
          </View>

          <Text style={styles.addressText} numberOfLines={2}>
            {resolving ? 'Resolving street details...' : resolvedAddress}
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.confirmBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAF9',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E1535',
  },
  googleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  googleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    position: 'relative',
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    height: 40,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
  searchBtn: {
    height: 40,
    paddingHorizontal: 14,
    backgroundColor: '#45016E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  gpsBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 54,
    left: 14,
    right: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 100,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  dropdownHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  dropdownItemSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  hubsScroll: {
    marginTop: 8,
  },
  hubsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginRight: 2,
  },
  hubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hubChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#45016E',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  dragHint: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dragHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomBar: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  coordsText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  serviceBadgeOk: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  serviceBadgeOkText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
    textTransform: 'uppercase',
  },
  serviceBadgeWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  serviceBadgeWarnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1535',
    marginVertical: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  confirmBtn: {
    flex: 2,
    height: 44,
    backgroundColor: '#45016E',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
