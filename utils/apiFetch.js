import { Platform } from 'react-native';

const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey";

// 🔹 Store the user in blazing-fast memory (RAM).
let activeUser = null;

// 🔹 This function will be used by UserContext to feed data into this file
export const syncApiUser = (userData) => {
  activeUser = userData;
};

export const apiFetch = async (endpoint, options = {}) => {
  const baseUrl = !__DEV__ ? "https://oreblogda.com/api" : "http://10.98.168.121:3000/api";
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;

  let userCountry = "Unknown"
  let userAnimes = "";
  let userGenres = "";
  let userCharacter = "";
  let userId = "";

  // 🔹 Instantly read from the RAM variable
  if (activeUser) {
    userCountry = activeUser.country || "Unknown";
    userId = activeUser.deviceId;

    if (activeUser.preferences) {
      // ⚡️ Combine Anime and Games into the single userAnimes header
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
    ...options.headers,
  };

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    return response;
  } catch (error) {
    // 🛡️ SECURITY & VERSION CHECK
    // Android 7 is API level 24/25. If it fails here, it's almost certainly an SSL issue.
    if (
      error.message.includes("Network request failed") &&
      Platform.OS === 'android' &&
      Platform.Version <= 25
    ) {
      console.error("Detected Android 7 SSL Security Conflict");
      throw new Error(
        "NETWORK_SECURITY_OUTDATED: Your Android version (7.0/7.1) is missing modern security certificates. " +
        "Please update your system or use a newer device to connect to Oreblogda."
      );
    }

    // Rethrow the error for other cases
    throw error;
  }
};

export default apiFetch;