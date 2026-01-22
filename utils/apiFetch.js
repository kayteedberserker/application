// utils/api.js
const APP_SECRET = "thisismyrandomsuperlongsecretkey";

export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `https://oreblogda.com/api${endpoint}`;
  
  const defaultHeaders = {
    "x-oreblogda-secret": APP_SECRET,
    "Content-Type": "application/json",
  };

  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers, // This lets you override headers if needed (like for FormData)
    },
  });
};

