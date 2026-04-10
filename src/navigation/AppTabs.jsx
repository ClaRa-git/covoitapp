import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import TripsStack from './TripsStack';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MapScreen from '../screens/MapScreen';
import { supabase } from '../lib/supabase';

const Tab = createBottomTabNavigator();

export default function AppTabs() {
  const [tripsBadgeCount, setTripsBadgeCount] = useState(0);

  const loadTripsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .gt('departure_at', new Date().toISOString());

      if (error) throw error;
      setTripsBadgeCount(count || 0);
    } catch (err) {
      console.error('Erreur:', err);
      setTripsBadgeCount(0);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadTripsCount();

      const interval = setInterval(loadTripsCount, 5000);

      return () => clearInterval(interval);
    }, [])
  );

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { paddingBottom: 8, height: 60 },
        headerStyle: { backgroundColor: '#007AFF' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Trips"
        component={TripsStack}
        options={{
          title: 'Trajets',
          headerShown: false,
          tabBarBadge: tripsBadgeCount > 0 ? tripsBadgeCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>🚗</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Rechercher',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>🔍</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Mon profil',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>👤</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Carte"
        component={MapScreen}
        options={{
          title: 'Carte',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>🗺️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
