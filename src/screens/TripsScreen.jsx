import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import TripCard from '../components/TripCard';
import { supabase } from '../lib/supabase';

export default function TripsScreen({ route }) {
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTrips = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('trips')
        .select(`
          *,
          driver:users(id, full_name, email)
        `)
        .gt('departure_at', new Date().toISOString())
        .order('departure_at', { ascending: true });

      if (fetchError) throw fetchError;

      const transformedData = (data || []).map(trip => ({
        ...trip,
        driver_name: trip.driver?.full_name || 'Conducteur inconnu',
      }));

      setTrips(transformedData);
    } catch (err) {
      console.error('Erreur lors du chargement des trajets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadTrips();
    }, [])
  );

  useEffect(() => {
    if (route?.params?.refresh) {
      loadTrips();
    }
  }, [route?.params?.refresh]);

  if (loading) {
    return (
      <View style={[styles.list, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.list, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#e74c3c', marginBottom: 16, textAlign: 'center' }}>
          Erreur: {error}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8 }}
          onPress={loadTrips}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={trips}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <TripCard
          trip={item}
          onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
        />
      )}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateTrip')}
        >
          <Text style={styles.createButtonText}>+ Créer un trajet</Text>
        </TouchableOpacity>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ color: '#999', fontSize: 16 }}>Aucun trajet disponible</Text>
        </View>
      }
      refreshing={loading}
      onRefresh={loadTrips}
    />
  );
}


const styles = StyleSheet.create({
  list: { padding: 16, backgroundColor: '#f5f5f5', flexGrow: 1 },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});