import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function TripDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRating, setUserRating] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  useEffect(() => {
    loadCurrentUser();
    loadTrip();
    checkUserBooking();
  }, [tripId]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const loadTrip = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          driver:users(id, full_name, email)
        `)
        .eq('id', tripId)
        .single();

      if (error) throw error;

      const transformedTrip = {
        ...data,
        driver_name: data.driver?.full_name || 'Conducteur inconnu',
      };

      setTrip(transformedTrip);
    } catch (err) {
      console.error('Erreur:', err);
      Alert.alert('Erreur', 'Impossible de charger le trajet');
    } finally {
      setLoading(false);
    }
  };

  const checkUserBooking = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('trip_id', tripId)
        .eq('passenger_id', user.id)
        .eq('status', 'confirmed')
        .single();

      if (!error && data) {
        setBooking(data);
      }

      // Vérifier si l'utilisateur a déjà noté ce trajet
      const { data: ratingData } = await supabase
        .from('ratings')
        .select('*')
        .eq('trip_id', tripId)
        .eq('rater_id', user.id)
        .single();

      if (ratingData) {
        setUserRating(ratingData);
      }
    } catch (err) {
      // Pas de réservation confirmée ou pas de note existante
      console.log('Pas de réservation confirmée trouvée');
    }
  };

  const handleSubmitRating = async () => {
    try {
      if (!currentUser || !trip) return;

      // Vérifier si on ne note pas son propre trajet
      if (trip.driver_id === currentUser.id) {
        Alert.alert('Erreur', 'Vous ne pouvez pas noter votre propre trajet');
        return;
      }

      if (userRating) {
        // Mettre à jour la note existante
        const { error } = await supabase
          .from('ratings')
          .update({
            score: ratingScore,
            comment: ratingComment,
          })
          .eq('id', userRating.id);

        if (error) throw error;

        setUserRating({ ...userRating, score: ratingScore, comment: ratingComment });
        Alert.alert('Succès', 'Votre note a été mise à jour');
      } else {
        // Créer une nouvelle note
        const { data, error } = await supabase
          .from('ratings')
          .insert([
            {
              trip_id: tripId,
              rated_user_id: trip.driver_id,
              rater_id: currentUser.id,
              score: ratingScore,
              comment: ratingComment,
            }
          ])
          .select()
          .single();

        if (error) throw error;

        setUserRating(data);
        Alert.alert('Succès', 'Votre note a été enregistrée');
      }

      setShowRatingModal(false);
      setRatingComment('');
      setRatingScore(5);
    } catch (err) {
      console.error('Erreur notation:', err);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la note');
    }
  };

  const cancelReservation = async () => {
    if (!booking) {
      console.log('Pas de réservation à annuler');
      return;
    }

    try {
      setReserving(true);
      console.log('Annulation de la réservation:', booking.id);

      // Mettre le statut à 'cancelled' au lieu de supprimer
      const { error: updateStatusError, data: updateStatusData } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      console.log('Résultat mise à jour statut:', { updateStatusError, updateStatusData });

      if (updateStatusError) {
        console.error('Erreur lors de la mise à jour du statut:', updateStatusError);
        throw updateStatusError;
      }

      console.log('Statut changé en cancelled');

      // Restaurer les places du trajet
      const newSeats = trip.seats + 1;
      console.log('Mise à jour des places:', { tripId, currentSeats: trip.seats, newSeats });

      const { error: updateError, data: updateData } = await supabase
        .from('trips')
        .update({ seats: newSeats })
        .eq('id', tripId);

      console.log('Résultat mise à jour:', { updateError, updateData });

      if (updateError) {
        console.error('Erreur lors de la mise à jour:', updateError);
        throw updateError;
      }

      // Recharger le trajet et les données de réservation
      await loadTrip();
      await checkUserBooking();
      setBooking(null);

      Alert.alert(
        'Succès',
        'Votre réservation a été annulée avec succès.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Erreur annulation complète:', err);
      Alert.alert('Erreur', err.message || 'Impossible d\'annuler la réservation');
    } finally {
      setReserving(false);
    }
  };

  const handleReservation = async () => {
    try {
      setReserving(true);

      // Vérifier l'authentification
      if (!currentUser) {
        Alert.alert('Erreur', 'Vous devez être connecté pour réserver');
        return;
      }

      // Vérifier que ce n'est pas le conducteur
      if (trip.driver_id === currentUser.id) {
        Alert.alert('Erreur', 'Vous ne pouvez pas réserver votre propre trajet');
        return;
      }

      // Vérifier que le trajet n'est pas dans le passé
      if (new Date(trip.departure_at) < new Date()) {
        Alert.alert('Erreur', 'Impossible de réserver un trajet qui a déjà eu lieu');
        return;
      }

      // Vérifier les places disponibles
      if (trip.seats <= 0) {
        Alert.alert('Erreur', 'Aucune place disponible pour ce trajet');
        return;
      }

      // Créer la réservation
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            trip_id: tripId,
            passenger_id: currentUser.id,
            status: 'confirmed',
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setBooking(data);

      // Mettre à jour les places du trajet
      await supabase
        .from('trips')
        .update({ seats: trip.seats - 1 })
        .eq('id', tripId);

      // Recharger le trajet
      await loadTrip();

      Alert.alert(
        'Succès',
        `Votre réservation sur le trajet ${trip.origin} → ${trip.destination} a été confirmée !`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          }
        ]
      );
    } catch (err) {
      console.error('Erreur réservation:', err);
      Alert.alert('Erreur', err.message || 'Impossible de réserver ce trajet');
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <Text>Trajet introuvable</Text>
      </View>
    );
  }

  const formattedDate = new Date(trip.departure_at).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const isBooked = !!booking;
  const seatsAvailable = trip.seats > 0;
  const isOwnTrip = currentUser && trip.driver_id === currentUser.id;
  const isPastTrip = new Date(trip.departure_at) < new Date();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.routeRow}>
          <Text style={styles.city}>{trip.origin}</Text>
          <Text style={styles.arrow}>→</Text>
          <Text style={styles.city}>{trip.destination}</Text>
        </View>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Places disponibles</Text>
            <Text style={[styles.infoValue, !seatsAvailable && { color: '#e74c3c' }]}>
              {trip.seats}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Prix par passager</Text>
            <Text style={[styles.infoValue, styles.price]}>{trip.price} €</Text>
          </View>
        </View>

        {trip.description ? (
          <View style={styles.descSection}>
            <Text style={styles.descLabel}>Description</Text>
            <Text style={styles.descText}>{trip.description}</Text>
          </View>
        ) : null}

        {trip.driver_name ? (
          <View style={styles.descSection}>
            <Text style={styles.descLabel}>Conducteur</Text>
            <Text style={styles.descText}>{trip.driver_name}</Text>
          </View>
        ) : null}

        {isOwnTrip && (
          <View style={[styles.descSection, styles.ownTripSection]}>
            <Text style={styles.ownTripLabel}>ℹ️ C'est votre trajet</Text>
            <Text style={styles.ownTripText}>
              Vous ne pouvez pas réserver vos propres trajets
            </Text>
          </View>
        )}

        {isPastTrip && (
          <View style={[styles.descSection, styles.pastTripSection]}>
            <Text style={styles.pastTripLabel}>📋 Trajet passé</Text>
            <Text style={styles.pastTripText}>
              Ce trajet a déjà eu lieu
            </Text>
          </View>
        )}

        {isBooked && (
          <View style={[styles.descSection, styles.bookedSection]}>
            <Text style={styles.bookedLabel}>✓ Réservation confirmée</Text>
            <Text style={styles.bookedText}>
              Vous avez réservé une place sur ce trajet
            </Text>
          </View>
        )}

        {isBooked && booking && !isOwnTrip && (
          <TouchableOpacity
            style={styles.ratingButton}
            onPress={() => {
              if (userRating) {
                setRatingScore(userRating.score);
                setRatingComment(userRating.comment || '');
              }
              setShowRatingModal(true);
            }}
          >
            <Text style={styles.ratingButtonText}>
              {userRating ? '⭐ Modifier ma note' : '⭐ Noter ce trajet'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isBooked ? (
        <TouchableOpacity
          style={[styles.bookButton, styles.cancelButton]}
          onPress={cancelReservation}
          disabled={reserving}
        >
          {reserving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>Annuler ma réservation</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.bookButton,
            (isOwnTrip || !seatsAvailable || reserving || isPastTrip) && styles.bookButtonDisabled
          ]}
          onPress={handleReservation}
          disabled={isOwnTrip || !seatsAvailable || reserving || isPastTrip}
        >
          {reserving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>
              {isPastTrip ? 'Trajet passé' : isOwnTrip ? 'C\'est votre trajet' : !seatsAvailable ? 'Aucune place' : 'Réserver ma place'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {showRatingModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModal}>
            <Text style={styles.ratingModalTitle}>Noter ce trajet</Text>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRatingScore(star)}
                  style={styles.starButton}
                >
                  <Text style={[styles.star, star <= ratingScore && styles.starActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.scoreText}>Note: {ratingScore}/5</Text>

            <TextInput
              style={styles.ratingInput}
              placeholder="Ajouter un commentaire (optionnel)"
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.ratingButtonsContainer}>
              <TouchableOpacity
                style={[styles.ratingModalButton, styles.cancelButtonModal]}
                onPress={() => {
                  setShowRatingModal(false);
                  setRatingComment('');
                  setRatingScore(5);
                }}
              >
                <Text style={styles.cancelButtonTextModal}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ratingModalButton, styles.submitButtonModal]}
                onPress={handleSubmitRating}
              >
                <Text style={styles.submitButtonTextModal}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { backgroundColor: '#007AFF', padding: 24 },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  city: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  arrow: { fontSize: 24, color: 'rgba(255,255,255,0.7)', marginHorizontal: 12 },
  date: { color: 'rgba(255,255,255,0.9)', fontSize: 15 },
  infoSection: { padding: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  infoItem: { alignItems: 'center' },
  infoLabel: { fontSize: 13, color: '#999', marginBottom: 4 },
  infoValue: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  price: { color: '#007AFF' },
  descSection: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 16 },
  descLabel: { fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 8 },
  descText: { fontSize: 15, color: '#333', lineHeight: 22 },
  bookedSection: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    borderTopWidth: 1,
  },
  bookedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  bookedText: {
    fontSize: 13,
    color: '#558b2f',
  },
  ownTripSection: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196f3',
    borderTopWidth: 1,
  },
  ownTripLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565c0',
    marginBottom: 4,
  },
  ownTripText: {
    fontSize: 13,
    color: '#0d47a1',
  },
  pastTripSection: {
    backgroundColor: '#f3e5f5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ce93d8',
    borderTopWidth: 1,
  },
  pastTripLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6a1b9a',
    marginBottom: 4,
  },
  pastTripText: {
    fontSize: 13,
    color: '#4527a0',
  },
  bookButton: {
    margin: 24,
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  bookButtonDisabled: {
    backgroundColor: '#bdc3c7',
    opacity: 0.6,
  },
  bookButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ratingButton: {
    margin: 24,
    backgroundColor: '#f39c12',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ratingButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  ratingModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  ratingModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starButton: {
    marginHorizontal: 8,
  },
  star: {
    fontSize: 36,
    color: '#ddd',
  },
  starActive: {
    color: '#f39c12',
  },
  scoreText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  ratingInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
    maxHeight: 100,
  },
  ratingButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonModal: {
    backgroundColor: '#bdc3c7',
  },
  submitButtonModal: {
    backgroundColor: '#007AFF',
  },
  cancelButtonTextModal: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButtonTextModal: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});