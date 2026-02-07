import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import apiFetch from "../utils/apiFetch"; // Ensure this path is correct

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("mobileUser");
        if (stored) {
          let parsedUser = JSON.parse(stored);

          // 🔹 Personalization Fix: If country is missing, sync with Backend
          if (!parsedUser.country && parsedUser.deviceId) {
            console.log("Personalization: Country missing for user, syncing...");
            
            try {
              const res = await apiFetch(`https://oreblogda.com/api/users/me?fingerprint=${parsedUser.deviceId}`);
              if (res.ok) {
                const dbUser = await res.json();
                
                // Merge backend data (including the newly detected country)
                const updatedUser = {
                  ...parsedUser,
                  country: dbUser.country || "Unknown",
                  username: dbUser.username || parsedUser.username // Keep names in sync too
                };
                
                // Save back to storage so we don't have to fetch again next time
                await AsyncStorage.setItem("mobileUser", JSON.stringify(updatedUser));
                parsedUser = updatedUser;
              }
            } catch (fetchErr) {
              console.error("Failed to sync user country:", fetchErr);
            }
          }

          setUser(parsedUser);
        }
      } catch (e) {
        console.error("Failed to load user", e);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
