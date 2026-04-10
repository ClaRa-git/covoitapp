import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

function TripCard({ trip, onPress }) {
  const date = new Date(trip.departure_at);

  const formattedDate =
    date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) +
    ' à ' +
    date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const getPriceColor = (price) => {
    if (price < 10) return 'green';
    if (price <= 20) return 'orange';
    return 'red';
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.route}>
        <Text style={styles.city}>{trip.origin}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.city}>{trip.destination}</Text>
      </View>

      <View style={styles.date}>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <Text style={styles.dateText}>{trip.driver_name}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.seats}>{trip.seats} places</Text>
        <Text style={[
          styles.price,
          {color: getPriceColor(trip.price)}
        ]}>{trip.price} €</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  city: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  arrow: {
    fontSize: 18,
    color: '#007AFF',
    marginHorizontal: 8,
  },
  date: {
    marginBottom: 8,
    color: '#555',
  },
  dateText: {
    fontSize: 14,
    color: '#555',
  },
  seats: {
    fontSize: 14,
    color: '#666',
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  }
});

export default TripCard;