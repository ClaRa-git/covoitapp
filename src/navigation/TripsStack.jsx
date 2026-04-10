import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TripsScreen from '../screens/TripsScreen';
import TripDetailScreen from '../screens/TripDetailScreen';
import CreateTripScreen from '../screens/CreateTripScreen';

const Stack = createNativeStackNavigator();

export default function TripsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#007AFF' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="TripsList"
        component={TripsScreen}
        options={{
          title: 'Trajets',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={({ navigation }) => ({
          title: 'Détail du trajet',
          headerLeft: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>← Retour</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => Alert.alert('Partage non disponible')} hitSlop={10}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Partager</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="CreateTrip"
        component={CreateTripScreen}
        options={{
          title: 'Créer un trajet',
          headerBackTitle: 'Retour',
        }}
      />
    </Stack.Navigator>
  );
}