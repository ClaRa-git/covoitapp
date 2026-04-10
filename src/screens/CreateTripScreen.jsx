import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function CreateTripScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [searchingDestination, setSearchingDestination] = useState(false);
  const [form, setForm] = useState({
    origin: '',
    origin_lat: null,
    origin_lng: null,
    destination: '',
    destination_lat: null,
    destination_lng: null,
    departure_at: new Date().toISOString().split('T')[0],
    seats: '1',
    price: '0',
    description: '',
  });

  const searchCity = async (cityName, isOrigin = true) => {
    if (!cityName.trim()) {
      setForm({
        ...form,
        [isOrigin ? 'origin_lat' : 'destination_lat']: null,
        [isOrigin ? 'origin_lng' : 'destination_lng']: null,
      });
      return;
    }

    try {
      if (isOrigin) setSearchingOrigin(true);
      else setSearchingDestination(true);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&type=municipality&limit=1&format=json&countrycodes=fr`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'CovoitApp/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.length > 0) {
        const result = data[0];
        setForm({
          ...form,
          [isOrigin ? 'origin_lat' : 'destination_lat']: parseFloat(result.lat),
          [isOrigin ? 'origin_lng' : 'destination_lng']: parseFloat(result.lon),
        });
      } else {
        Alert.alert('Ville non trouvée', `"${cityName}" n'a pas été trouvée`);
        setForm({
          ...form,
          [isOrigin ? 'origin_lat' : 'destination_lat']: null,
          [isOrigin ? 'origin_lng' : 'destination_lng']: null,
        });
      }
    } catch (err) {
      console.error('Erreur recherche:', err);
      Alert.alert('Erreur', 'Impossible de rechercher la ville. Vérifiez votre connexion internet.');
    } finally {
      if (isOrigin) setSearchingOrigin(false);
      else setSearchingDestination(false);
    }
  };

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleOriginBlur = () => {
    if (form.origin.trim() && !form.origin_lat) {
      searchCity(form.origin, true);
    }
  };

  const handleDestinationBlur = () => {
    if (form.destination.trim() && !form.destination_lat) {
      searchCity(form.destination, false);
    }
  };

  const validateForm = () => {
    if (!form.origin.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer la ville de départ');
      return false;
    }
    if (!form.destination.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer la ville d\'arrivée');
      return false;
    }
    if (!form.departure_at) {
      Alert.alert('Erreur', 'Veuillez entrer la date de départ');
      return false;
    }
    if (parseInt(form.seats) <= 0) {
      Alert.alert('Erreur', 'Le nombre de places doit être supérieur à 0');
      return false;
    }
    if (parseInt(form.price) < 0) {
      Alert.alert('Erreur', 'Le prix ne peut pas être négatif');
      return false;
    }
    if (!form.origin_lat || !form.origin_lng) {
      Alert.alert('Erreur', `Ville de départ "${form.origin}" non trouvée`);
      return false;
    }
    if (!form.destination_lat || !form.destination_lng) {
      Alert.alert('Erreur', `Ville d'arrivée "${form.destination}" non trouvée`);
      return false;
    }
    return true;
  };

  const handleCreateTrip = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Erreur', 'Vous devez être connecté');
        return;
      }

      const { data, error } = await supabase
        .from('trips')
        .insert([
          {
            origin: form.origin.trim(),
            origin_lat: form.origin_lat,
            origin_lng: form.origin_lng,
            destination: form.destination.trim(),
            destination_lat: form.destination_lat,
            destination_lng: form.destination_lng,
            departure_at: form.departure_at + 'T08:00:00',
            seats: parseInt(form.seats),
            price: parseInt(form.price),
            description: form.description.trim(),
            driver_id: user.id,
            status: 'active',
          },
        ])
        .select();

      if (error) throw error;

      Alert.alert('Succès', 'Trajet créé avec succès !', [
        {
          text: 'OK',
          onPress: () => {
            // Aller sur l'onglet Trips et déclencher un refresh
            navigation.navigate('Trips', {
              screen: 'TripsList',
              params: { refresh: true }
            });
          },
        },
      ]);
    } catch (err) {
      console.error('Erreur:', err);
      Alert.alert('Erreur', err.message || 'Impossible de créer le trajet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Créer un trajet</Text>

        <Text style={styles.label}>Ville de départ *</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ex: Paris, Lyon..."
            value={form.origin}
            onChangeText={(value) => handleChange('origin', value)}
            onBlur={handleOriginBlur}
            autoCapitalize="words"
            editable={!loading}
          />
          {searchingOrigin && <ActivityIndicator style={styles.inputLoader} color="#007AFF" />}
        </View>
        {form.origin_lat && (
          <Text style={styles.coordsHint}>
            📍 {form.origin_lat.toFixed(4)}, {form.origin_lng.toFixed(4)}
          </Text>
        )}

        <Text style={styles.label}>Ville d'arrivée *</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ex: Lyon, Marseille..."
            value={form.destination}
            onChangeText={(value) => handleChange('destination', value)}
            onBlur={handleDestinationBlur}
            autoCapitalize="words"
            editable={!loading}
          />
          {searchingDestination && <ActivityIndicator style={styles.inputLoader} color="#007AFF" />}
        </View>
        {form.destination_lat && (
          <Text style={styles.coordsHint}>
            📍 {form.destination_lat.toFixed(4)}, {form.destination_lng.toFixed(4)}
          </Text>
        )}

        <Text style={styles.label}>Date de départ *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={form.departure_at}
          onChangeText={(value) => handleChange('departure_at', value)}
          editable={!loading}
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Places disponibles *</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              value={form.seats}
              onChangeText={(value) => handleChange('seats', value)}
              keyboardType="number-pad"
              editable={!loading}
            />
          </View>

          <View style={styles.halfInput}>
            <Text style={styles.label}>Prix par personne (€) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={form.price}
              onChangeText={(value) => handleChange('price', value)}
              keyboardType="number-pad"
              editable={!loading}
            />
          </View>
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Décrivez votre trajet (arrêts possibles, conditions, etc.)"
          value={form.description}
          onChangeText={(value) => handleChange('description', value)}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreateTrip}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Créer le trajet</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.required}>* Champs obligatoires</Text>
        <Text style={styles.citiesHint}>Les villes sont recherchées via OpenStreetMap Nominatim</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  inputLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  coordsHint: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    marginBottom: 12,
    fontWeight: '500',
  },
  textarea: {
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  required: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  citiesHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

