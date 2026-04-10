import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://cphqfwjeodygzkdeamfx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwaHFmd2plb2R5Z3prZGVhbWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTU1MDksImV4cCI6MjA5MTI5MTUwOX0.BVJ8S5H7CE0CvGqpOidKu3wR_9tOpsRlvi7UykqbepE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const getSupabaseClient = () => supabase;
