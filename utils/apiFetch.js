import AsyncStorage from "@react-native-async-storage/async-storage";

const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey";

export const apiFetch = async (endpoint, options = {}) => {
  const baseUrl = "https://oreblogda.com/api";
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;
  
  let userCountry = "Unknown";
  let userAnimes = ""; // Comma-separated list for backend $in check
  let userGenres = ""; // Comma-separated list for backend $in check

  try {
    const stored = await AsyncStorage.getItem("mobileUser");
    if (stored) {
      const parsed = JSON.parse(stored);
      userCountry = parsed.country || "Unknown";
      
      // 🔹 Extract and format preferences for the backend algorithm
      if (parsed.preferences) {
        if (Array.isArray(parsed.preferences.favAnimes)) {
          userAnimes = parsed.preferences.favAnimes.join(",");
        }
        if (Array.isArray(parsed.preferences.favGenres)) {
          userGenres = parsed.preferences.favGenres.join(",");
        }
      }
    }
    
  } catch (e) {
    console.error("apiFetch: Error reading storage", e);
  }

  const headers = {
    "x-oreblogda-secret": APP_SECRET,
    "x-user-country": userCountry,
    // 🔹 Specific headers the backend algorithm is now looking for
    "x-user-animes": userAnimes,
    "x-user-genres": userGenres,
    ...options.headers,
  };

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

export default apiFetch;