import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMMKV } from "react-native-mmkv";
import apiFetch, { syncApiUser } from "../utils/apiFetch";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const storage = useMMKV();
  
  // ⚡️ 1. SYNCHRONOUS INIT: Instantly load user from cache on Frame 1
  const [user, setUser] = useState(() => {
    try {
      const stored = storage.getString("mobileUser");
      if (stored) {
        const parsedUser = JSON.parse(stored);
        syncApiUser(parsedUser); // ⚡️ Instantly feed headers to apiFetch!
        return parsedUser;
      }
    } catch (e) {
      console.error("Failed to parse user from MMKV", e);
    }
    return null;
  });

  // ⚡️ 2. NO INITIAL FREEZE: Only show loading if there is literally NO user cached
  const [loading, setLoading] = useState(() => {
    const stored = storage.getString("mobileUser");
    return !stored; // Returns false if user exists, true if brand new user
  });

  const hasFetched = useRef(false); 

  const updateUserData = (newData) => {
    setUser(newData);
    storage.set("mobileUser", JSON.stringify(newData));
    syncApiUser(newData); 
  };

  useEffect(() => {
    const backgroundSyncUser = async () => {
      // Exit if already done or no deviceId to sync with
      if (hasFetched.current || !user?.deviceId) {
        
        setLoading(false);
        return;
      }

      // ⚡️ 3. SILENT BACKGROUND SYNC: Fetch missing data without blocking the UI
      if (!user.referralCode) {
        hasFetched.current = true; 
        
        // 🚨 Notice we removed setLoading(true) from here! It runs invisibly now.
        try {
          const res = await apiFetch(`/users/me?fingerprint=${user.deviceId}`);
          
          if (res.ok) {
            const dbUser = await res.json();
            
            const updatedUser = {
              ...user,
              country: dbUser.country || "Unknown",
              username: dbUser.username || user.username,
              referralCode: dbUser.referralCode || user.referralCode,
              invitedUsers: dbUser.invitedUsers || user.invitedUsers || [],
            };

            // Update state and MMKV silently
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

    backgroundSyncUser();
  }, [user?.deviceId]); // Only re-run if deviceId changes

  return (
    <UserContext.Provider value={{ user, setUser: updateUserData, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
