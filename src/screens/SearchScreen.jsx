import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, StyleSheet, ScrollView,
  FlatList, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import TripCard from '../components/TripCard';
import { useNavigation } from '@react-navigation/native';

const SEARCH_STORAGE_KEY = 'covoitapp_last_search';

export default function SearchScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    async function loadLastSearch() {
      try {
        const saved = await AsyncStorage.getItem(SEARCH_STORAGE_KEY);
        if (saved) {
          const { origin: savedOrigin, destination: savedDestination } = JSON.parse(saved);
          setOrigin(savedOrigin || '');
          setDestination(savedDestination || '');
        }
      } catch (err) {
        console.error('AsyncStorage read error:', err);
      }
    }
    loadLastSearch();
  }, []);

  async function handleSearch() {
    if (!origin && !destination) {
      Alert.alert('Champs manquants', 'Veuillez entrer au moins une ville');
      return;
    }

    try {
      setLoading(true);
      setHasSearched(true);

      const cleanOrigin = origin.trim();
      const cleanDestination = destination.trim();

      let query = supabase
        .from('trips')
        .select(`
          *,
          driver:users(id, full_name, email)
        `);

      if (cleanOrigin) {
        query = query.ilike('origin', `%${cleanOrigin}%`);
      }

      if (cleanDestination) {
        query = query.ilike('destination', `%${cleanDestination}%`);
      }

      const { data, error } = await query.order('departure_at', { ascending: true });

      if (error) throw error;

      const tripIds = (data || []).map((trip) => trip.id);
      let confirmedByTripId = {};

      if (tripIds.length > 0) {
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('trip_id')
          .in('trip_id', tripIds)
          .eq('status', 'confirmed');

        if (bookingsError) throw bookingsError;

        confirmedByTripId = (bookingsData || []).reduce((acc, booking) => {
          acc[booking.trip_id] = (acc[booking.trip_id] || 0) + 1;
          return acc;
        }, {});
      }

      console.log('Recherche pour', origin || '(aucune)', '→', destination || '(aucune)', ':', data?.length || 0, 'résultats');

      const transformedData = (data || []).map(trip => ({
        ...trip,
        driver_name: trip.driver?.full_name || 'Conducteur inconnu',
        available_seats: Math.max((trip.seats || 0) - (confirmedByTripId[trip.id] || 0), 0),
      }));

      setResults(transformedData);

      if (transformedData.length === 0) {
        const searchText = cleanOrigin && cleanDestination
          ? `${origin} → ${destination}`
          : cleanOrigin
          ? `depuis ${origin}`
          : `vers ${destination}`;
        Alert.alert('Aucun résultat', `Aucun trajet trouvé ${searchText}`);
      }
    } catch (err) {
      console.error('Erreur de recherche:', err);
      Alert.alert('Erreur', 'Impossible d\'effectuer la recherche');
    } finally {
      setLoading(false);
      await AsyncStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify({ origin, destination }));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.searchHeader}>
          <Text style={styles.title}>Rechercher un trajet</Text>

          <Text style={styles.label}>Ville de départ (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={origin}
            onChangeText={setOrigin}
            placeholder="Ex : Paris"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Ville d'arrivée (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
            placeholder="Ex : Lyon"
            autoCapitalize="words"
          />

          <TouchableOpacity style={styles.button} onPress={handleSearch}>
            <Text style={styles.buttonText}>Rechercher</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}

        {hasSearched && !loading && results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TripCard
                trip={item}
                onPress={() => navigation.navigate('Trips', {
                  screen: 'TripDetail',
                  params: { tripId: item.id }
                })}
              />
            )}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsContent}
          />
        )}

        {hasSearched && !loading && results.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Aucun trajet trouvé pour {origin} → {destination}
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#1a1a2e' },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 15, marginBottom: 12, backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  resultsList: { flex: 1 },
  resultsContent: { padding: 12, backgroundColor: '#f5f5f5' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { color: '#999', fontSize: 16, textAlign: 'center' },
});