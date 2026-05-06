import * as SecureStore from 'expo-secure-store';

const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey";

let activeUser = null;
let requestPinCallback = null;
let onSessionExpired = null;

// --- NEW LOCKING VARIABLES ---
let refreshPromise = null; // Holds the active refresh promise
let isLoggingOut = false;  // Prevents multiple logout triggers/alerts

export const syncApiUser = (userData) => { activeUser = userData; };
export const setPinHandler = (handler) => { requestPinCallback = handler; };
export const setSessionExpiredHandler = (handler) => { onSessionExpired = handler; };

/**
 * 🔄 Silent Refresh Logic (With Promise Locking)
 */
const attemptTokenRefresh = async () => {
  const baseUrl = !__DEV__ ? "https://oreblogda.com/api" : "http://10.180.162.121:3000/api";

  // 🛡️ LOCK: If a refresh is already happening, return the existing promise
  if (refreshPromise) {
    if (__DEV__) console.log("🔄 Refresh already in progress, waiting...")
    return refreshPromise;
  }

  // Create a new promise and store it in the variable
  refreshPromise = (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const deviceId = activeUser?.deviceId || "unknown_device";

      if (__DEV__) console.log("🚀 Starting Token Refresh...");

      if (!refreshToken) return false;

      const response = await fetch(`${baseUrl}/mobile/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-oreblogda-secret': APP_SECRET
        },
        body: JSON.stringify({ refreshToken, deviceId }),
      });

      if (__DEV__) console.log("Refresh response status: ", response.status);

      // Handle Compromised Session
      if (response.status === 405) {
        if (__DEV__) console.log("🛑 Session Compromised - Forcing Logout")
        if (!isLoggingOut && onSessionExpired) {
          isLoggingOut = true;
          onSessionExpired();
        }
        throw new Error("SESSION_COMPROMISED");
      }

      if (response.status === 200) {
        const data = await response.json();
        await SecureStore.setItemAsync('userToken', data.accessToken);
        await SecureStore.setItemAsync('refreshToken', data.refreshToken);
        if (__DEV__) console.log("✅ Token Refresh Successful");
        return true;
      }

      return false;
    } catch (err) {
      console.error("❌ Refresh Error:", err.message);
      return false;
    } finally {
      // 🔓 UNLOCK: Clear the promise when done so future refreshes can run
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * 🛡️ THE SYSTEM - SECURE API UPLINK
 */
export const apiFetch = async (endpoint, options = {}) => {
  const baseUrl = !__DEV__ ? "https://oreblogda.com/api" : "http://10.180.162.121:3000/api";
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;

  const method = (options.method || 'GET').toUpperCase();
  const token = await SecureStore.getItemAsync('userToken');

  // Build Metadata Headers
  const headers = {
    "x-the-system-debug": 'true',
    "x-oreblogda-secret": APP_SECRET,
    "x-user-country": activeUser?.country || "Unknown",
    "x-user-deviceId": activeUser?.deviceId || "",
    "Authorization": token ? `Bearer ${token}` : "",
    ...options.headers,
  };

  // Prevent application/json for FormData
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // ✅ CRITICAL FIX: Only stringify if it's a plain object and NOT FormData
  const isObject = options.body && typeof options.body === 'object';
  const isFormData = options.body instanceof FormData;

  const fetchOptions = {
    ...options,
    method,
    headers,
    body: (isObject && !isFormData) ? JSON.stringify(options.body) : options.body
  };

  try {
    const response = await fetch(url, fetchOptions);

    // Bypass Interception for GET requests
    if (method === 'GET') {
      return response;
    }

    const clonedResponse = response.clone();
    const data = await clonedResponse.json();

    // 1. Handle Single-Session "Kicks"
    if (response.status === 421 && data.message === "SESSION_INVALID") {
      if (!isLoggingOut && onSessionExpired) {
        isLoggingOut = true;
        onSessionExpired();
      }
      throw new Error("SESSION_TERMINATED");
    }

    // 2. Handle Token Expiry
    if (response.status === 421 && data.message?.includes("TOKEN_EXPIRED")) {
      const refreshSuccess = await attemptTokenRefresh();

      if (refreshSuccess) {
        const newToken = await SecureStore.getItemAsync('userToken');
        const retryHeaders = { ...headers, "Authorization": `Bearer ${newToken}` };
        return await apiFetch(url, { ...options, headers: retryHeaders });
      }

      if (requestPinCallback) {
        const pinSuccess = await requestPinCallback();
        if (pinSuccess) {
          const newToken = await SecureStore.getItemAsync('userToken');
          const retryHeaders = { ...headers, "Authorization": `Bearer ${newToken}` };
          return await apiFetch(url, { ...options, headers: retryHeaders });
        }
      }
    }

    return response;

  } catch (error) {
    if (error.message?.includes("Network request failed")) {
      console.error("Security Block or Network Issue:", error);
    }
    throw error;
  }
};

export default apiFetch;