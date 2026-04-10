import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, SectionList,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { supabase } from '../lib/supabase';
import TripCard from '../components/TripCard';
import { uploadAvatar, updateUserProfile } from '../services/storageService';
import { requestCameraPermission, requestGalleryPermission } from '../lib/permissions';
export default function ProfileScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
   const [myTrips, setMyTrips] = useState([]);
   const [myReservations, setMyReservations] = useState([]);
   const [myPastTrips, setMyPastTrips] = useState([]);
   const [averageRating, setAverageRating] = useState('Aucune note');
  const isPastTrip = (departureDate) => {
    return new Date(departureDate) < new Date();
  };
  useFocusEffect(
    React.useCallback(() => {
      loadUserProfile();
    }, [])
  );
  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
      if (!authUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      if (!error) {
        setProfile(profileData);
      }
      // Charger les trajets proposés FUTURS
      const { data: tripsData } = await supabase
        .from('trips')
        .select('*, driver:users(id, full_name, email)')
        .eq('driver_id', authUser.id)
        .gt('departure_at', new Date().toISOString())
        .order('departure_at', { ascending: true });
      const futureTrips = (tripsData || []).map(trip => ({
        ...trip,
        driver_name: trip.driver?.full_name || 'Conducteur inconnu',
      }));
      setMyTrips(futureTrips);
      // Charger les trajets proposés PASSÉS
      const { data: pastTripsData } = await supabase
        .from('trips')
        .select('*, driver:users(id, full_name, email)')
        .eq('driver_id', authUser.id)
        .lte('departure_at', new Date().toISOString())
        .order('departure_at', { ascending: false });
      const pastTrips = (pastTripsData || []).map(trip => ({
        ...trip,
        driver_name: trip.driver?.full_name || 'Conducteur inconnu',
      }));
       setMyPastTrips(pastTrips);
       // Calculer la note moyenne basée sur les trajets passés proposés
       if (pastTripsData && pastTripsData.length > 0) {
         const tripIds = pastTripsData.map(trip => trip.id);
         const { data: ratingsData } = await supabase
           .from('ratings')
           .select('score')
           .in('trip_id', tripIds);
         if (ratingsData && ratingsData.length > 0) {
           const avgScore = (ratingsData.reduce((sum, r) => sum + r.score, 0) / ratingsData.length).toFixed(1);
           setAverageRating(`${avgScore}/5`);
         } else {
           // Pas de notes reçues
           setAverageRating('Aucune note');
         }
       } else {
         // Pas de trajets passés
         setAverageRating('Aucune note');
       }
      // Charger les réservations FUTURES
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, trip:trips(*, driver:users(id, full_name, email))')
        .eq('passenger_id', authUser.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });
      const futureReservations = (bookingsData || [])
        .map(booking => ({
          ...booking.trip,
          driver_name: booking.trip?.driver?.full_name || 'Conducteur inconnu',
          booking_id: booking.id,
        }))
        .filter(trip => trip && trip.id && !isPastTrip(trip.departure_at));
      setMyReservations(futureReservations);
    } catch (err) {
      console.error('Profile loading error:', err);
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };
  const handleChangePhoto = () => {
    Alert.alert('Photo de profil', 'Comment voulez-vous choisir votre photo ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Prendre une photo', onPress: () => pickImage('camera') },
      { text: 'Depuis la galerie', onPress: () => pickImage('gallery') },
    ]);
  };
  const pickImage = (source) => {
    const options = { mediaType: 'photo', quality: 0.8, maxWidth: 800, maxHeight: 800 };
    if (source === 'camera') {
      requestCameraPermission().then((hasPermission) => {
        if (!hasPermission) {
          Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire.');
          return;
        }
        launchCamera(options, (response) => {
          if (!response.didCancel && !response.errorCode) {
            handlePhotoUpload(response.assets[0].uri);
          }
        });
      });
    } else {
      requestGalleryPermission().then((hasPermission) => {
        if (!hasPermission) {
          Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire.');
          return;
        }
        launchImageLibrary(options, (response) => {
          if (!response.didCancel && !response.errorCode) {
            handlePhotoUpload(response.assets[0].uri);
          }
        });
      });
    }
  };
  const handlePhotoUpload = async (photoUri) => {
    try {
      setUploadingPhoto(true);
      const publicUrl = await uploadAvatar(user.id, photoUri);
      await updateUserProfile(user.id, { avatar_url: publicUrl });
      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
      Alert.alert('Succès', 'Photo mise à jour !');
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploadingPhoto(false);
    }
  };
  const handleDeleteTrip = async (tripId) => {
    Alert.alert(
      'Supprimer le trajet',
      'Êtes-vous sûr de vouloir supprimer ce trajet ? Les réservations seront annulées.',
      [
        { text: 'Annuler', onPress: () => { } },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              const { error: bookingsError } = await supabase
                .from('bookings')
                .delete()
                .eq('trip_id', tripId);
              if (bookingsError) throw bookingsError;
              const { error: tripError } = await supabase
                .from('trips')
                .delete()
                .eq('id', tripId);
              if (tripError) throw tripError;
              Alert.alert('Succès', 'Le trajet a été supprimé');
              loadUserProfile();
            } catch (err) {
              console.error('Erreur suppression:', err);
              Alert.alert('Erreur', err.message || 'Impossible de supprimer le trajet');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.name}>Non connecté</Text>
          <Text style={styles.subtitle}>Veuillez vous connecter pour voir votre profil</Text>
        </View>
      </View>
    );
  }
  const sections = [
    {
      title: '👤 Profil',
      data: [{ type: 'profile' }],
    },
    ...(myReservations.length > 0 ? [{
      title: '📝 Mes réservations',
      data: myReservations,
    }] : []),
    ...(myTrips.length > 0 ? [{
      title: '🚗 Mes trajets proposés',
      data: myTrips,
    }] : []),
    ...(myPastTrips.length > 0 ? [{
      title: '📋 Mes trajets passés',
      data: myPastTrips,
    }] : []),
  ];
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => item.id?.toString() || index.toString()}
      renderItem={({ item, section }) => {
        if (section.title === '👤 Profil') {
          return (
            <View style={styles.profileContent}>
              <View style={styles.avatarSection}>
                <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitial}>
                        {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                  )}
                  {uploadingPhoto && (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.changePhotoText}>Appuyer pour changer la photo</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.label}>Nom</Text>
                <Text style={styles.value}>{profile?.full_name ?? '—'}</Text>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{user?.email}</Text>
                <Text style={styles.label}>Note moyenne</Text>
                <Text style={styles.value}>{averageRating}</Text>
              </View>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={async () => {
                  Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Se déconnecter',
                      style: 'destructive',
                      onPress: async () => {
                        await supabase.auth.signOut();
                        setUser(null);
                      },
                    },
                  ]);
                }}
              >
                <Text style={styles.logoutText}>Se déconnecter</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <View style={styles.tripCardContainer}>
            <TripCard
              trip={item}
              onPress={() => navigation.navigate('Trips', {
                screen: 'TripDetail',
                params: { tripId: item.id }
              })}
            />
            {!isPastTrip(item.departure_at) && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteTrip(item.id)}
              >
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.sectionHeader}>{title}</Text>
      )}
      contentContainerStyle={styles.listContent}
      scrollEnabled
    />
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
  profileContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#e7f2ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  uploadOverlay: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    marginTop: 12,
    color: '#007AFF',
    fontSize: 14,
  },
  infoBlock: {
    padding: 24,
  },
  label: {
    fontSize: 12,
    color: '#8a8f98',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 16,
  },
  tripCardContainer: {
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    margin: 24,
    padding: 16,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 18,
    fontSize: 14,
  },
});
