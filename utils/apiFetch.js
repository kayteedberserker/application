import * as SecureStore from 'expo-secure-store';

const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET || "thisismyrandomsuperlongsecretkey";
let activeUser = null;
let requestPinCallback = null;
let onSessionExpired = null;

const PRODUCTION_SERVERS = [
    "https://oreblogda.vercel.app/api",
    "https://oreblogda.com/api"
];
let currentServerIndex = 0;

const initializeServerIndex = async () => {
    try {
        const savedIndex = await SecureStore.getItemAsync('activeServerIndex');
        if (savedIndex !== null) {
            const parsedIndex = parseInt(savedIndex, 10);
            if (parsedIndex >= 0 && parsedIndex < PRODUCTION_SERVERS.length) {
                currentServerIndex = parsedIndex;
                if (__DEV__) console.log(`💾 Loaded working server index from storage: [${currentServerIndex}] -> ${PRODUCTION_SERVERS[currentServerIndex]}`);
            }
        }
    } catch (e) { console.error("❌ Failed to read server index from SecureStore:", e); }
};
initializeServerIndex()

const getBaseUrl = () => {
    // "http://192.168.1.99:3000/api"
    if (__DEV__) { return "http://192.168.1.99:3000/api" }
    return PRODUCTION_SERVERS[currentServerIndex]
}

const handleServerFailover = async () => {
    if (__DEV__) return
    const oldUrl = PRODUCTION_SERVERS[currentServerIndex];
    currentServerIndex = (currentServerIndex + 1) % PRODUCTION_SERVERS.length;
    const newUrl = PRODUCTION_SERVERS[currentServerIndex];
    try { await SecureStore.setItemAsync('activeServerIndex', currentServerIndex.toString()); } catch (e) { console.error("❌ Failed to save server index to SecureStore:", e); }
};

const isVercelLimitError = (status) => { return status === 402 || status === 503 || status === 502 || status === 444; };

let refreshPromise = null;
let isLoggingOut = false;

export const syncApiUser = (userData) => { activeUser = userData; };
export const setPinHandler = (handler) => { requestPinCallback = handler; };
export const setSessionExpiredHandler = (handler) => { onSessionExpired = handler; };

const attemptTokenRefresh = async (retryCount = 0) => {
    const baseUrl = getBaseUrl();
    if (refreshPromise) {
        if (__DEV__) console.log("🔄 Refresh already in progress, waiting...");
        return refreshPromise;
    }

    refreshPromise = (async () => {
        let response; // Pulled out of try scope to protect catch block evaluations
        try {
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            const deviceId = activeUser?.deviceId || "unknown_device";
            if (__DEV__) console.log("🚀 Starting Token Refresh...");
            if (!refreshToken) {
                if (__DEV__) console.log("🛑 Session Compromised - Forcing Logout");
                if (!isLoggingOut && onSessionExpired) { isLoggingOut = true; onSessionExpired(); }
                throw new Error("You are on a older version of the app. Please relogin to continue.");
            }

            response = await fetch(`${baseUrl}/mobile/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-oreblogda-secret': APP_SECRET },
                body: JSON.stringify({ refreshToken, deviceId }),
            });

            if (__DEV__) console.log("Refresh response status: ", response.status);

            if (isVercelLimitError(response.status) && retryCount < PRODUCTION_SERVERS.length) {
                await handleServerFailover();
                refreshPromise = null;
                return await attemptTokenRefresh(retryCount + 1);
            }

            if (response.status === 405 || response.status === 440) {
                if (__DEV__) console.log("🛑 Session Compromised - Forcing Logout");
                if (!isLoggingOut && onSessionExpired) { isLoggingOut = true; onSessionExpired(); }
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
            // Fixed potential response undefined reference crash condition
            if (response && isVercelLimitError(response.status) && retryCount < PRODUCTION_SERVERS.length) {
                await handleServerFailover();
                refreshPromise = null;
                return await attemptTokenRefresh(retryCount + 1);
            }
            return false;
        } finally { refreshPromise = null; }
    })();

    return refreshPromise;
};

export const uploadWithProgress = async (method, url, formData, headers, onProgress) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress({ totalBytesWritten: e.loaded, totalBytesExpectedToWrite: e.total, percentage: percentComplete });
                }
            });
        }
        xhr.addEventListener('load', () => {
            const responseText = xhr.responseText || "";
            const responseProperties = {
                status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, headers: new Headers(),
                json: async () => { try { return responseText.trim() ? JSON.parse(responseText) : {}; } catch (e) { return {}; } },
                text: async () => responseText,
                clone: () => ({ json: async () => { try { return responseText.trim() ? JSON.parse(responseText) : {}; } catch (e) { return {}; } }, text: async () => responseText })
            };
            resolve(responseProperties);
        });
        xhr.addEventListener('error', () => reject(new Error('Upload network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
        xhr.open(method.toUpperCase(), url);
        Object.keys(headers).forEach(key => { if (headers[key] !== undefined && headers[key] !== null) { xhr.setRequestHeader(key, headers[key]); } });
        xhr.send(formData);
    });
};

export const apiFetch = async (endpoint, options = {}, retryCount = 0) => {
    const baseUrl = getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;
    if (retryCount > 0 && !endpoint.startsWith('http')) { url = `${baseUrl}${cleanEndpoint}`; }
    const method = (options.method || 'GET').toUpperCase();
    const token = await SecureStore.getItemAsync('userToken');
    const onProgress = options.onProgress;

    // ⚡️ DETECT AUTHENTICATION OVERRIDE BYPASS FLAG
    const shouldBypassAuth = options.headers?.["x-bypass-auth"] === "true";

    const headers = {
        "x-the-system-debug": 'true',
        "x-oreblogda-secret": APP_SECRET,
        "x-user-country": activeUser?.country || "Unknown",
        "x-user-deviceId": activeUser?.deviceId || "",
        "Authorization": token ? `Bearer ${token}` : "",
        ...options.headers,
    };

    const isFormData = options.body instanceof FormData;
    if (options.body && !isFormData && !headers["Content-Type"]) { headers["Content-Type"] = "application/json"; }
    const isObject = options.body && typeof options.body === 'object';
    const fetchOptions = { ...options, method, headers, body: (isObject && !isFormData) ? JSON.stringify(options.body) : options.body };
    delete fetchOptions.onProgress;

    let response; // Allocated outside to make accessible to catch/finally structures safely
    try {
        if (isFormData) { response = await uploadWithProgress(method, url, fetchOptions.body, headers, onProgress || (() => { })); }
        else { response = await fetch(url, fetchOptions); }

        if (isVercelLimitError(response.status) && retryCount < PRODUCTION_SERVERS.length) {
            if (__DEV__) console.warn(`⚠️ [THE SYSTEM] Vercel limit detected (${response.status}). Attempting failover...`);
            await handleServerFailover(); return await apiFetch(endpoint, options, retryCount + 1);
        }
        if (method === 'GET') { return response; }

        const clonedResponse = response.clone();
        let data = {};
        try {
            const responseText = await clonedResponse.text();
            if (responseText && responseText.trim() !== "") { data = JSON.parse(responseText); }
        } catch (parseError) { console.warn("Could not handle body parsing implicitly:", parseError); }

        // ⚡️ CHECK BYPASS BEFORE FORCE-LOGGING OUT AN UNAUTHENTICATED OPERATOR
        if (response.status === 421 && data.message === "SESSION_INVALID") {
            if (shouldBypassAuth) return response;
            if (__DEV__) console.log(`🛑 [THE SYSTEM] Session invalid kick rule matched.`);
            if (!isLoggingOut && onSessionExpired) { isLoggingOut = true; onSessionExpired(); }
            throw new Error("SESSION_TERMINATED");
        }

        if (response.status === 421 || response.status === 455) {
            if (shouldBypassAuth) return response;
            if (__DEV__) console.log(`🔑 [THE SYSTEM] Token expired (${response.status}). Triggering silent refresh chain...`);
            const refreshSuccess = await attemptTokenRefresh();
            if (refreshSuccess) {
                const newToken = await SecureStore.getItemAsync('userToken');
                const retryHeaders = { ...headers, "Authorization": `Bearer ${newToken}` };
                if (__DEV__) console.log(`🔄 [THE SYSTEM] Token refresh successful. Retrying original payload...`);
                return await apiFetch(endpoint, { ...options, headers: retryHeaders }, retryCount);
            }
            if (requestPinCallback) {
                if (__DEV__) console.log(`📌 [THE SYSTEM] Refresh failed. Prompting user security PIN backup fallback verification...`);
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
        if (__DEV__) { console.error(`💥 [THE SYSTEM] FATAL FETCH EXCEPTION CAUGHT:`, error); }
        if (error.message?.includes("Network request failed") || error.message?.includes("Upload error")) { console.error("Security Block, limit drop, or Network Issue encountered:", error); }
        // Protected against crashing if response is uninstantiated
        if (response && isVercelLimitError(response.status) && retryCount < PRODUCTION_SERVERS.length) {
            if (__DEV__) console.warn(`🔄 [THE SYSTEM] Retrying target sequence context via failover loops...`);
            await handleServerFailover();
            return await apiFetch(endpoint, options, retryCount + 1);
        }
        throw error;
    }
};

export const getActiveBaseUrl = () => {
    const activeUrl = getBaseUrl();
    if (__DEV__ || activeUrl.includes("10.103") || activeUrl.includes("localhost")) { return "https://oreblogda.vercel.app/api"; }
    return activeUrl;
};

export default apiFetch;