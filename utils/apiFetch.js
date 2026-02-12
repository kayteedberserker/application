import AsyncStorage from "@react-native-async-storage/async-storage";

const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey" 

export const apiFetch = async (endpoint, options = {}) => {
  // 1. Fix URL construction
  const baseUrl = "https://oreblogda.com/api"; // Updated to your production URL
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;
  
  // 2. 🔹 GET USER DATA FROM STORAGE
  let userCountry = "Unknown";
  try {
    const stored = await AsyncStorage.getItem("mobileUser");
    if (stored) {
      const parsed = JSON.parse(stored);
      userCountry = parsed.country || "Unknown";
    }
  } catch (e) {
    console.error("apiFetch: Error reading storage", e);
  }

  // 3. Prepare headers
  const headers = {
    "x-oreblogda-secret": APP_SECRET,
    "x-user-country": userCountry, // 🔹 Pass the country globally in headers
    ...options.headers,
  };

  // 4. SMART CONTENT-TYPE
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

export default apiFetch;
