import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMMKV } from "react-native-mmkv";
import apiFetch, { syncApiUser } from "../utils/apiFetch";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  // 🔹 Use ONLY useMMKV hook to get the storage instance
  const storage = useMMKV();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false); // 🔹 Prevents repeated fetching

  // Helper to update both state and MMKV storage
  const updateUserData = (newData) => {
    setUser(newData);
    storage.set("mobileUser", JSON.stringify(newData));
    syncApiUser(newData); // 2. ADD THIS LINE HERE!
  };

  useEffect(() => {
    const loadAndSyncUser = async () => {
      let currentUser = null;

      try {
        // 🔹 Manually get and parse using the useMMKV instance
        const stored = storage.getString("mobileUser");
        if (stored) {
          currentUser = JSON.parse(stored);
          setUser(currentUser);
        }
      } catch (e) {
        console.error("Failed to parse user from MMKV", e);
      }

      // 🔹 Exit if already done or no deviceId to sync with
      if (hasFetched.current || !currentUser?.deviceId) {
        setLoading(false);
        return;
      }

      // Only sync if data is missing (like referralCode)
      if (!currentUser.referralCode) {
        hasFetched.current = true; // 🔹 Mark as fetched immediately
        setLoading(true);

        try {
          // Trigger the network request - anything including loading should have the animation
          const res = await apiFetch(`https://oreblogda.com/api/users/me?fingerprint=${currentUser.deviceId}`);
          
          if (res.ok) {
            const dbUser = await res.json();
            const updatedUser = {
              ...currentUser,
              country: dbUser.country || "Unknown",
              username: dbUser.username || currentUser.username,
              referralCode: dbUser.referralCode || currentUser.referralCode,
              invitedUsers: dbUser.invitedUsers || currentUser.invitedUsers || [],
            };

            // 🔹 Update state and MMKV manually
            updateUserData(updatedUser);
          }
        } catch (fetchErr) {
          console.error("Failed to sync user data:", fetchErr);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadAndSyncUser();
  }, [storage]); // Depend on storage instance from useMMKV

  return (
    <UserContext.Provider value={{ user, setUser: updateUserData, loading }}>
      {/* Note: Since loading is managed here, ensure your UI 
          displays the loading animation when 'loading' is true. 
      */}
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);