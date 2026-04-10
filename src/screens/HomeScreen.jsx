import React, { useState, useEffect } from 'react';
import { View, Text, SectionList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import TripCard from '../components/TripCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [currentUser, setCurrentUser] = useState(null);
  const [allTrips, setAllTrips] = useState([]);
  const [myReservations, setMyReservations] = useState([]);
  const [myProposedTrips, setMyProposedTrips] = useState([]);
  const [myPastTrips, setMyPastTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fonction pour vérifier si un trajet est passé
  const isPastTrip = (departureDate) => {
    return new Date(departureDate) < new Date();
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Récupérer l'utilisateur courant
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Charger tous les trajets FUTURS (sauf ceux proposés par l'utilisateur)
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select(`
          *,
          driver:users(id, full_name, email)
        `)
        .neq('driver_id', user?.id || '')
        .gt('departure_at', new Date().toISOString())
        .order('departure_at', { ascending: true })
        .limit(20);

      if (tripsError) throw tripsError;

      const allTripIds = [
        ...(tripsData || []).map((trip) => trip.id),
      ];

      let confirmedByTripId = {};

      if (allTripIds.length > 0) {
        const { data: bookingsCountData, error: bookingsCountError } = await supabase
          .from('bookings')
          .select('trip_id')
          .in('trip_id', allTripIds)
          .eq('status', 'confirmed');

        if (bookingsCountError) throw bookingsCountError;

        confirmedByTripId = (bookingsCountData || []).reduce((acc, booking) => {
          acc[booking.trip_id] = (acc[booking.trip_id] || 0) + 1;
          return acc;
        }, {});
      }

      const transformedTrips = (tripsData || []).map(trip => ({
        ...trip,
        driver_name: trip.driver?.full_name || 'Conducteur inconnu',
        available_seats: Math.max((trip.seats || 0) - (confirmedByTripId[trip.id] || 0), 0),
      }));

      setAllTrips(transformedTrips);

      // Charger les réservations de l'utilisateur (FUTURS)
      if (user) {
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,
            trip:trips(*, driver:users(id, full_name, email))
          `)
          .eq('passenger_id', user.id)
          .eq('status', 'confirmed');

        if (!bookingsError && bookingsData) {
          const reservations = bookingsData
            .map(booking => ({
              ...booking.trip,
              driver_name: booking.trip.driver?.full_name || 'Conducteur inconnu',
              booking_id: booking.id,
              available_seats: Math.max((booking.trip?.seats || 0) - (confirmedByTripId[booking.trip?.id] || 0), 0),
            }))
            .filter(trip => trip && trip.id && !isPastTrip(trip.departure_at));

          setMyReservations(reservations);
        }

        // Charger les trajets proposés par l'utilisateur (FUTURS)
        const { data: myTripsData, error: myTripsError } = await supabase
          .from('trips')
          .select(`
            *,
            driver:users(id, full_name, email)
          `)
          .eq('driver_id', user.id)
          .gt('departure_at', new Date().toISOString())
          .order('departure_at', { ascending: true });

        if (!myTripsError && myTripsData) {
          const myTripIds = (myTripsData || []).map((trip) => trip.id);
          if (myTripIds.length > 0) {
            const { data: myBookingsCountData } = await supabase
              .from('bookings')
              .select('trip_id')
              .in('trip_id', myTripIds)
              .eq('status', 'confirmed');

            confirmedByTripId = {
              ...confirmedByTripId,
              ...(myBookingsCountData || []).reduce((acc, booking) => {
                acc[booking.trip_id] = (acc[booking.trip_id] || 0) + 1;
                return acc;
              }, {}),
            };
          }

          const proposedTrips = (myTripsData || []).map(trip => ({
            ...trip,
            driver_name: trip.driver?.full_name || 'Conducteur inconnu',
            available_seats: Math.max((trip.seats || 0) - (confirmedByTripId[trip.id] || 0), 0),
          }));

          setMyProposedTrips(proposedTrips);
        }

        // Charger les trajets passés proposés par l'utilisateur
        const { data: pastTripsData, error: pastTripsError } = await supabase
          .from('trips')
          .select(`
            *,
            driver:users(id, full_name, email)
          `)
          .eq('driver_id', user.id)
          .lte('departure_at', new Date().toISOString())
          .order('departure_at', { ascending: false });

        if (!pastTripsError && pastTripsData) {
          const pastTripIds = (pastTripsData || []).map((trip) => trip.id);
          if (pastTripIds.length > 0) {
            const { data: pastBookingsCountData } = await supabase
              .from('bookings')
              .select('trip_id')
              .in('trip_id', pastTripIds)
              .eq('status', 'confirmed');

            confirmedByTripId = {
              ...confirmedByTripId,
              ...(pastBookingsCountData || []).reduce((acc, booking) => {
                acc[booking.trip_id] = (acc[booking.trip_id] || 0) + 1;
                return acc;
              }, {}),
            };
          }

          const pastTrips = (pastTripsData || []).map(trip => ({
            ...trip,
            driver_name: trip.driver?.full_name || 'Conducteur inconnu',
            available_seats: Math.max((trip.seats || 0) - (confirmedByTripId[trip.id] || 0), 0),
          }));

          setMyPastTrips(pastTrips);
        }
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const sections = [
    {
      title: '📝 Mes réservations',
      data: myReservations.length > 0 ? myReservations : [{ type: 'empty' }],
      type: 'reservations',
    },
    {
      title: '🚗 Mes trajets proposés',
      data: myProposedTrips.length > 0 ? myProposedTrips : [{ type: 'empty' }],
      type: 'proposed',
    },
    {
      title: '🚙 Trajets disponibles',
      data: allTrips.length > 0 ? allTrips : [{ type: 'empty' }],
      type: 'available',
    },
    ...(myPastTrips.length > 0 ? [{
      title: '📋 Mes trajets passés',
      data: myPastTrips,
      type: 'past',
    }] : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            renderItem={({ item, section }) => {
              // Afficher un message vide pour les sections sans trajet
              if (item.type === 'empty') {
                let emptyMessage = '';
                if (section.type === 'reservations') {
                  emptyMessage = 'Vous n\'avez pas encore de réservation';
                } else if (section.type === 'proposed') {
                  emptyMessage = 'Vous n\'avez pas encore proposé de trajet';
                } else if (section.type === 'available') {
                  emptyMessage = 'Aucun trajet disponible pour le moment';
                }
                return (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptyMessage}>{emptyMessage}</Text>
                  </View>
                );
              }

              return (
                <TripCard
                  trip={item}
                  onPress={() => navigation.navigate('Trips', {
                    screen: 'TripDetail',
                    params: { tripId: item.id }
                  })}
                />
              );
            }}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  sectionBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptySection: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
});