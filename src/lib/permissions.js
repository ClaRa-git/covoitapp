import { PermissionsAndroid, Platform } from 'react-native';

export async function requestCameraPermission() {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'CovoitApp — Accès à la caméra',
      message: 'CovoitApp a besoin d\'accéder à votre caméra pour prendre une photo de profil.',
      buttonNeutral: 'Me demander plus tard',
      buttonNegative: 'Refuser',
      buttonPositive: 'Autoriser',
    }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestGalleryPermission() {
  if (Platform.OS !== 'android') return true;

  const permission = parseInt(Platform.Version, 10) >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const granted = await PermissionsAndroid.request(permission, {
    title: 'CovoitApp — Accès à la galerie',
    message: 'CovoitApp a besoin d\'accéder à votre galerie photos.',
    buttonNegative: 'Refuser',
    buttonPositive: 'Autoriser',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'CovoitApp — Accès à la localisation',
          message: 'CovoitApp utilise votre position pour afficher les trajets proches.',
          buttonNegative: 'Refuser',
          buttonPositive: 'Autoriser',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Erreur permission localisation:', err);
      return false;
    }
  }
  // Pour iOS, les permissions sont gérées via Info.plist
  return true;
}