const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey";

// 🔹 Store the user in blazing-fast memory (RAM). No hooks, no , no MMKV needed here!
let activeUser = null;

// 🔹 This function will be used by UserContext to feed data into this file
export const syncApiUser = (userData) => {
  activeUser = userData;
};

export const apiFetch = async (endpoint, options = {}) => {
  const baseUrl = "https://oreblogda.com/api";
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;
  
  let userCountry = "Unknown";
  let userAnimes = ""; 
  let userGenres = ""; 
  let userCharacter = ""; 
  let userId = "";

  // 🔹 Instantly read from the RAM variable
  if (activeUser) {
    userCountry = activeUser.country || "Unknown";
    userId = activeUser.deviceId;
    
    if (activeUser.preferences) {
      if (Array.isArray(activeUser.preferences.favAnimes)) {
        userAnimes = activeUser.preferences.favAnimes.join(",");
      }
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

  return fetch(url, {
    ...options,
    headers,
  });
};

export default apiFetch;