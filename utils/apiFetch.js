import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Create the storage instance outside the function
// export const storage = new MMKV(); 

const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey";

let activeUser = null;
let requestPinCallback = null;

export const syncApiUser = (userData) => {
  activeUser = userData;
};

export const setPinHandler = (handler) => {
  requestPinCallback = handler
};

export const apiFetch = async (endpoint, options = {}) => {
  const baseUrl = !__DEV__ ? "https://oreblogda.com/api" : "http://10.179.101.121:3000/api";
  console.log(baseUrl);

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;

  // 🛡️ SECURE RETRIEVAL (No hooks allowed here)
  const token = await SecureStore.getItemAsync('userToken');

  let userCountry = "Unknown";
  let userAnimes = "";
  let userGenres = "";
  let userCharacter = "";
  let userId = "";

  if (activeUser) {
    userCountry = activeUser.country || "Unknown";
    userId = activeUser.deviceId;

    if (activeUser.preferences) {
      const animes = Array.isArray(activeUser.preferences.favAnimes) ? activeUser.preferences.favAnimes : [];
      const games = Array.isArray(activeUser.preferences.favGames) ? activeUser.preferences.favGames : [];
      userAnimes = [...animes, ...games].join(",");

      if (Array.isArray(activeUser.preferences.favGenres)) {
        userGenres = activeUser.preferences.favGenres.join(",");
      }
      if (activeUser.preferences.favCharacter) {
        userCharacter = activeUser.preferences.favCharacter;
      }
    }
  }

  const headers = {
    "x-oreblogda-secret": APP_SECRET,
    "x-user-country": userCountry,
    "x-user-animes": userAnimes,
    "x-user-deviceId": userId,
    "x-user-genres": userGenres,
    "x-user-character": userCharacter,
    "Authorization": token ? `Bearer ${token}` : "",
    ...options.headers,
  };

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    let response = await fetch(url, { ...options, headers });

    // Handle 401: Neural Link Locked
    if (response.status === 401) {
      // Use clone() so we don't consume the stream if we need to return the response later
      const data = await response.clone().json();

      if (data.message?.includes("NEURAL") || data.message?.includes("ENCRYPTION") || data.message?.includes("SESSION")) {
        if (requestPinCallback) {
          const success = await requestPinCallback();
          if (success) {
            const newToken = await SecureStore.getItemAsync('userToken');
            headers["Authorization"] = `Bearer ${newToken}`;
            response = await fetch(url, { ...options, headers });
          }
        }
      }
    }

    return response;

  } catch (error) {
    if (
      error.message.includes("Network request failed") &&
      Platform.OS === 'android' &&
      Platform.Version <= 25
    ) {
      throw new Error("NETWORK_SECURITY_OUTDATED: Android 7 missing certificates.");
    }
    throw error;
  }
};

export default apiFetch;