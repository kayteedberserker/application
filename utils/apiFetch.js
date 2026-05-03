import * as SecureStore from 'expo-secure-store';

const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey";

let activeUser = null;
let requestPinCallback = null;
let onSessionExpired = null; // Callback to handle "kicks"

export const syncApiUser = (userData) => { activeUser = userData; };
export const setPinHandler = (handler) => { requestPinCallback = handler; };
export const setSessionExpiredHandler = (handler) => { onSessionExpired = handler; };

/**
 * 🔄 Silent Refresh Logic
 */
const attemptTokenRefresh = async () => {
  const baseUrl = !__DEV__ ? "https://oreblogda.com/api" : "http://10.179.96.121:3000/api";
  try {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    const deviceId = activeUser?.deviceId || "unknown_device";

    if (!refreshToken) return false;

    const response = await fetch(`${baseUrl}/mobile/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-oreblogda-secret': APP_SECRET
      },
      body: JSON.stringify({ refreshToken, deviceId }),
    });

    if (response.status === 200) {
      const data = await response.json();
      await SecureStore.setItemAsync('userToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken)
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
};

/**
 * 🛡️ The System - Secure API Uplink
 */
export const apiFetch = async (endpoint, options = {}) => {
  const baseUrl = !__DEV__ ? "https://oreblogda.com/api" : "http://10.179.96.121:3000/api";
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`

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

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const fetchOptions = {
    ...options,
    method: options.method || 'GET',
    headers,
    body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body
  }

  try {
    const response = await fetch(url, fetchOptions)
    const clonedResponse = response.clone()
    const data = await clonedResponse.json()

    // 1. Handle Single-Session "Kicks" (Forbidden)
    if (response.status === 403) {
      if (data.message === "SESSION_EXPIRED" && onSessionExpired) {
        onSessionExpired(); // Triggers global logout
        throw new Error("SESSION_TERMINATED");
      }
    }

    // 2. Handle Token Expiry (Unauthorized)
    // Clone response to prevent "Already read" error
    if (response.status === 401 && data.message?.includes("TOKEN_EXPIRED")) {
      console.log("api data is", data);

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
    // If the Network Security Config blocks the connection, it will throw a TypeError: Network request failed
    if (error.message?.includes("Network request failed")) {
      // In a real MITM attack, the OS kills the connection here
      console.error("Security Block or Network Issue:", error);
    }
    throw error;
  }
};

export default apiFetch;