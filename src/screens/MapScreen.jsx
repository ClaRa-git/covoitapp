import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, Modal, SectionList } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import TripCard from '../components/TripCard';
import Geolocation from '@react-native-community/geolocation';

const getMapHTML = (trips, userLocation) => `
<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8' />
<meta name='viewport' content='width=device-width, initial-scale=1.0'>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #map { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id='map'></div>
<script>
var userLocation = ${JSON.stringify(userLocation)};
var initialLat = userLocation ? userLocation.latitude : 46.603354;
var initialLng = userLocation ? userLocation.longitude : 1.888334;
var initialZoom = userLocation ? 10 : 6;

var map = L.map('map').setView([initialLat, initialLng], initialZoom);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap', maxZoom: 19
}).addTo(map);

if (userLocation) {
  L.marker([userLocation.latitude, userLocation.longitude])
    .bindPopup('Votre position')
    .addTo(map);
}

var trips = ${JSON.stringify(trips || [])};
var cities = {};

trips.forEach(function(trip) {
  if (trip.origin_lat && trip.origin_lng && !cities[trip.origin]) {
    cities[trip.origin] = { lat: trip.origin_lat, lng: trip.origin_lng };
  }
  if (trip.destination_lat && trip.destination_lng && !cities[trip.destination]) {
    cities[trip.destination] = { lat: trip.destination_lat, lng: trip.destination_lng };
  }
});

Object.keys(cities).forEach(function(cityName) {
  var city = cities[cityName];
  L.marker([city.lat, city.lng])
    .bindPopup(cityName)
    .on('click', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'selectCity', city: cityName
      }));
    })
    .addTo(map);
});
<\/script>
</body>
</html>
`;

export default function MapScreen() {
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    Geolocation.requestAuthorization(); // gère les permissions automatiquement
    Geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => console.log(error),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  const loadTrips = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trips')
        .select(`*, driver:users(id, full_name, email)`)
        .gt('departure_at', new Date().toISOString())
        .order('departure_at', { ascending: true });

      if (error) throw error;

      const transformedData = (data || []).map(trip => ({
        ...trip,
        driver_name: trip.driver?.full_name || 'Conducteur inconnu',
      }));

      setTrips(transformedData);
    } catch (err) {
      console.error('Erreur:', err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = useMemo(() => {
    if (!selectedCity) return [];
    return trips.filter(trip =>
      trip.origin === selectedCity || trip.destination === selectedCity
    );
  }, [selectedCity, trips]);

  const departingTrips = filteredTrips.filter(t => t.origin === selectedCity);
  const arrivingTrips = filteredTrips.filter(t => t.destination === selectedCity);

  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'selectCity') {
        setSelectedCity(message.city);
        setShowModal(true);
      }
    } catch (err) {
      console.error('Erreur parsing:', err);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loaderText}>Chargement de la carte...</Text>
        </View>
      ) : (
        <>
          <WebView
            source={{ html: getMapHTML(trips, userLocation) }}
            style={styles.webview}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
          />

          <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedCity}</Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>

                {filteredTrips.length > 0 ? (
                  <SectionList
                    sections={[
                      { title: `📤 Départs depuis ${selectedCity}`, data: departingTrips },
                      ...(arrivingTrips.length > 0 ? [{ title: `📥 Arrivées à ${selectedCity}`, data: arrivingTrips }] : [])
                    ]}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <TripCard
                        trip={item}
                        onPress={() => {
                          setShowModal(false);
                          navigation.navigate('Trips', { screen: 'TripDetail', params: { tripId: item.id } });
                        }}
                      />
                    )}
                    renderSectionHeader={({ section: { title, data } }) =>
                      data.length > 0 ? (
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionTitle}>{title}</Text>
                          <Text style={styles.sectionCount}>{data.length}</Text>
                        </View>
                      ) : null
                    }
                    scrollEnabled
                    nestedScrollEnabled
                  />
                ) : (
                  <View style={styles.noResults}>
                    <Text style={styles.noResultsText}>Aucun trajet trouvé</Text>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loaderText: { marginTop: 10, fontSize: 14, color: '#666' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  closeButton: { fontSize: 24, color: '#999', fontWeight: 'bold' },
  noResults: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  noResultsText: { color: '#999', fontSize: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5', paddingVertical: 10, paddingHorizontal: 16, marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  sectionCount: { fontSize: 12, fontWeight: '600', color: '#999', backgroundColor: '#e7f2ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
});