import { supabase } from '../lib/supabase';

export async function uploadAvatar(userId, photoUri) {
  const response = await fetch(photoUri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const fileName = `${userId}/profile.jpg`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(fileName, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  return publicUrl;
}

export async function updateUserProfile(userId, updates) {
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
}