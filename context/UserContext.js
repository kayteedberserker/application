import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import apiFetch from "../utils/apiFetch";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false); // 🔹 Prevents repeated fetching

  useEffect(() => {
    
    const loadUser = async () => {
      if (hasFetched.current) return; // 🔹 Exit if already done

      try {
        const stored = await AsyncStorage.getItem("mobileUser");
        if (stored) {
          let parsedUser = JSON.parse(stored);
          
          // Only sync if data is missing AND we haven't fetched this session
          if (parsedUser.deviceId && !hasFetched.current && !parsedUser.referralCode) {
            hasFetched.current = true; // 🔹 Mark as fetched immediately
            
            try {
              const res = await apiFetch(`https://oreblogda.com/api/users/me?fingerprint=${parsedUser.deviceId}`);
              if (res.ok) {
                const dbUser = await res.json();
                
                const updatedUser = {
                  ...parsedUser,
                  country: dbUser.country || "Unknown",
                  username: dbUser.username || parsedUser.username,
                  referralCode: dbUser.referralCode || parsedUser.referralCode,
                  invitedUsers: dbUser.invitedUsers || parsedUser.invitedUsers || [], 
                };
                
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