import * as SecureStore from 'expo-secure-store';

const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey";

export const apiFetch = async (endpoint, options = {}) => {
  // 1. Fix URL construction
  const baseUrl = "https://oreblogda.com/api"; // Updated to your production URL
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;
  
  // 2. 🔹 GET USER DATA FROM STORAGE
  let userCountry = "Unknown";
  try {
    const savedIndex = await SecureStore.getItemAsync('activeServerIndex');
    if (savedIndex !== null) {
      const parsedIndex = parseInt(savedIndex, 10);
      if (parsedIndex >= 0 && parsedIndex < PRODUCTION_SERVERS.length) {
        currentServerIndex = parsedIndex;
        if (__DEV__) console.log(`💾 Loaded working server index from storage: [${currentServerIndex}] -> ${PRODUCTION_SERVERS[currentServerIndex]}`);
      }
    }
  } catch (e) {
    console.error("❌ Failed to read server index from SecureStore:", e);
  }
};
initializeServerIndex();

// Returns the live dynamic base context route path mapping
const getBaseUrl = () => {
  if (__DEV__) {
    return "http://10.103.92.121:3000/api";
  }
  return PRODUCTION_SERVERS[currentServerIndex]
};

/**
* 🔄 Rotates the fallback servers and commits the working index to storage
*/
const handleServerFailover = async () => {
  if (__DEV__) return; // Skip failover mechanisms during local development environments

  const oldUrl = PRODUCTION_SERVERS[currentServerIndex];
  currentServerIndex = (currentServerIndex + 1) % PRODUCTION_SERVERS.length;
  const newUrl = PRODUCTION_SERVERS[currentServerIndex];

  if (__DEV__ || console.log) {
    console.log(`🚨 Server limit reached or connection failed at: ${oldUrl}. Automatically shifting traffic engine down to: ${newUrl}`);
  }

  // Save the new working server configuration to storage so next launch is instant
  try {
    await SecureStore.setItemAsync('activeServerIndex', currentServerIndex.toString());
  } catch (e) {
    console.error("❌ Failed to save server index to SecureStore:", e);
  }
};

/**
* 🛠️ Utility to identify if an incoming HTTP payload represents a Vercel threshold block
*/
const isVercelLimitError = (status) => {
  // 402 = Payment Required (Vercel uses this explicitly for tier limit errors)
  // 503 / 444 / 502 = Generic Vercel gateway drop downs or usage exclusions
  return status === 402 || status === 503 || status === 502 || status === 444;
};

// --- NEW LOCKING VARIABLES ---
let refreshPromise = null; // Holds the active refresh promise
let isLoggingOut = false;  // Prevents multiple logout triggers/alerts

export const syncApiUser = (userData) => { activeUser = userData; };
export const setPinHandler = (handler) => { requestPinCallback = handler; }
export const setSessionExpiredHandler = (handler) => { onSessionExpired = handler; }

/**
* 🔄 Silent Refresh Logic (With Promise Locking & Failover Capability)
*/
const attemptTokenRefresh = async (retryCount = 0) => {
  const baseUrl = getBaseUrl();

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

      if (!refreshToken) {
        if (__DEV__) console.log("🛑 Session Compromised - Forcing Logout")
        if (!isLoggingOut && onSessionExpired) {
          isLoggingOut = true;
          onSessionExpired();
        }
        throw new Error("You are on a older version of the app. Please relogin to continue.") // This will be caught and trigger logout
      };

      const response = await fetch(`${baseUrl}/mobile/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-oreblogda-secret': APP_SECRET
        },
        body: JSON.stringify({ refreshToken, deviceId }),
      });

      if (__DEV__) console.log("Refresh response status: ", response.status);

      // Handle Vercel tier limits hit during refresh operation routines
      if (isVercelLimitError(response.status) && retryCount < PRODUCTION_SERVERS.length) {
        await handleServerFailover();
        refreshPromise = null; // Unlock current item stack state to let recursive retry pass down smoothly
        return await attemptTokenRefresh(retryCount + 1);
      }

      // Handle Compromised Session
      if (response.status === 405) {
        if (__DEV__) console.log("🛑 Session Compromised - Forcing Logout")
        if (!isLoggingOut && onSessionExpired) {
          isLoggingOut = true;
          onSessionExpired();
        }
        throw new Error("SESSION_COMPROMISED");
      }

      if (response.status === 440) {
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

      // Attempt failover on hard network error context tracking down inside token refreshes
      if (retryCount < PRODUCTION_SERVERS.length) {
        await handleServerFailover();
        refreshPromise = null;
        return await attemptTokenRefresh(retryCount + 1);
      }
      return false;
    } finally {
      // 🔓 UNLOCK: Clear the promise when done so future refreshes can run
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
* 📤 UPLOAD PROGRESS WRAPPER
* Wraps FormData with progress tracking capability
*/
export const uploadWithProgress = async (method, url, formData, headers, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress({
            totalBytesWritten: e.loaded,
            totalBytesExpectedToWrite: e.total,
            percentage: percentComplete,
          });
        }
      });
    }

    xhr.addEventListener('load', () => {
      // 🛡️ HARDENED RESPONSE HANDLING
      const responseText = xhr.responseText || "";

      const responseProperties = {
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        headers: new Headers(),
        // Safely parse JSON from response text without throwing exceptions on empty values
        json: async () => {
          try {
            return responseText.trim() ? JSON.parse(responseText) : {};
          } catch (e) {
            console.error("Parse Fail, raw text:", responseText);
            return {};
          }
        },
        text: async () => responseText,
        clone: () => ({
          json: async () => {
            try {
              return responseText.trim() ? JSON.parse(responseText) : {};
            } catch (e) {
              return {};
            }
          },
          text: async () => responseText
        })
      };
      resolve(responseProperties);
    });

    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    // ✅ FIXED: Now dynamically handles POST, PUT, etc., based on call parameters instead of hardcoding 'PUT'
    xhr.open(method.toUpperCase(), url);

    Object.keys(headers).forEach(key => {
      if (headers[key] !== undefined && headers[key] !== null) {
        xhr.setRequestHeader(key, headers[key]);
      }
    });

    xhr.send(formData);
  });
};

/**
* 🛡️ THE SYSTEM - SECURE API UPLINK WITH SERVERLESS AUTO-FAILOVER SWITCHER
*/
export const apiFetch = async (endpoint, options = {}, retryCount = 0) => {
  const baseUrl = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  let url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;

  if (retryCount > 0 && !endpoint.startsWith('http')) {
    url = `${baseUrl}${cleanEndpoint}`;
  }

  const method = (options.method || 'GET').toUpperCase();
  const token = await SecureStore.getItemAsync('userToken');
  const onProgress = options.onProgress;

  // Build Metadata Headers
  const headers = {
    "x-the-system-debug": 'true',
    "x-oreblogda-secret": APP_SECRET,
    "x-user-country": activeUser?.country || "Unknown",
    "x-user-deviceId": activeUser?.deviceId || "",
    "Authorization": token ? `Bearer ${token}` : "",
    ...options.headers,
  };

  // Prevent overriding Content-Type for FormData
  const isFormData = options.body instanceof FormData;
  if (options.body && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Only stringify if it's a plain object and NOT FormData
  const isObject = options.body && typeof options.body === 'object';
  const fetchOptions = {
    ...options,
    method,
    headers,
    body: (isObject && !isFormData) ? JSON.stringify(options.body) : options.body
  };

  delete fetchOptions.onProgress;

  try {
    let response;

    // ✅ THE FIX: Always use XHR for FormData. Passes the method parameter seamlessly down.
    if (isFormData) {
      response = await uploadWithProgress(method, url, fetchOptions.body, headers, onProgress || (() => { }));
    } else {
      response = await fetch(url, fetchOptions);
    }

    // Intercept response status codes to intercept Vercel execution rate threshold exhaustion
    if (isVercelLimitError(response.status) && retryCount < PRODUCTION_SERVERS.length) {
      await handleServerFailover();
      return await apiFetch(endpoint, options, retryCount + 1);
    }

    if (method === 'GET') {
      return response;
    }

    const clonedResponse = response.clone();
    let data = {};

    // ✅ FIXED: Safely intercept empty response bodies on standard fetch contexts 
    // to block "Unexpected end of input" exceptions before they manifest.
    try {
      const responseText = await clonedResponse.text();
      if (responseText && responseText.trim() !== "") {
        data = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.warn("Could not handle body parsing implicitly:", parseError);
    }

    // 1. Handle Single-Session "Kicks"
    if (response.status === 421 && data.message === "SESSION_INVALID") {
      if (!isLoggingOut && onSessionExpired) {
        isLoggingOut = true;
        onSessionExpired();
      }
      throw new Error("SESSION_TERMINATED");
    }

    // 2. Handle Token Expiry
    if (response.status === 421 || response.status === 455) {
      const refreshSuccess = await attemptTokenRefresh();
      if (refreshSuccess) {
        const newToken = await SecureStore.getItemAsync('userToken');
        const retryHeaders = { ...headers, "Authorization": `Bearer ${newToken}` };
        return await apiFetch(endpoint, { ...options, headers: retryHeaders }, retryCount);
      }

      if (requestPinCallback) {
        const pinSuccess = await requestPinCallback();
        if (pinSuccess) {
          const newToken = await SecureStore.getItemAsync('userToken');
          const retryHeaders = { ...headers, "Authorization": `Bearer ${newToken}` };
          return await apiFetch(endpoint, { ...options, headers: retryHeaders }, retryCount);
        }
      }
    }

    return response;

  } catch (error) {
    if (error.message?.includes("Network request failed") || error.message?.includes("Upload error")) {
      console.error("Security Block, limit drop, or Network Issue encountered:", error);
    }

    if (retryCount < PRODUCTION_SERVERS.length) {
      await handleServerFailover();
      return await apiFetch(endpoint, options, retryCount + 1);
    }
    throw error;
  }
};

/**
 * 🛰️ Returns the live active base URL for webhook bindings
 * Safeguards against local private IPs which Cloudinary cannot route to.
 */
export const getActiveBaseUrl = () => {
  const activeUrl = getBaseUrl();

  // 🚨 DEVELOPMENT EDGE CASE: Cloudinary cannot send POST requests to local private network IPs.
  // If we are on local dev, fallback to your primary production url for webhook tracking.
  if (__DEV__ || activeUrl.includes("10.103") || activeUrl.includes("localhost")) {
    return "https://oreblogda.vercel.app/api";
  }

  return activeUrl;
};

export default apiFetch;
