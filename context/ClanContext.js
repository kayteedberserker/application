import apiFetch from "@/utils/apiFetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native"; // 🔹 Added for signaling
import { useUser } from "./UserContext";

const ClanContext = createContext();

export const ClanProvider = ({ children }) => {
    const { user } = useUser();
    const [userClan, setUserClan] = useState(null);
    const [allClans, setAllClans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [warActionsCount, setWarActionsCount] = useState(0); // 🔹 Tracks total pending/negotiations
    const hasSynced = useRef(false);
    const [fullData, setFullData] = useState()
    const [cCoins, setClanCoins] = useState(0)
    const [clanRank, setClanRank] = useState(0)
    // 1. Initial Load from AsyncStorage
    useEffect(() => {
        const loadStoredClan = async () => {
            try {
                const stored = await AsyncStorage.getItem("userClan");
                if (stored) {
                    setUserClan(JSON.parse(stored));
                }
            } catch (e) {
                console.error("Failed to load clan from storage", e);
            } finally {
                if (!user?.deviceId) {
                    setIsLoading(false);
                }
            }
        };
        loadStoredClan();
    }, []);

    // 2. Sync with Backend ONLY ONCE when deviceId is found
    useEffect(() => {
        if (user?.deviceId && !hasSynced.current) {
            hasSynced.current = true;
            refreshClanStatus(user.deviceId);
        } else if (user?.deviceId) {
            setIsLoading(false);
        }
    }, [user?.deviceId]);
    // 3. 🛡️ Check for War Notifications periodically or on refresh
    const checkWarNotifications = async (clanTag) => {
        if (!clanTag) return;
        try {
            const [pRes, nRes] = await Promise.all([
                apiFetch(`/clans/wars?status=PENDING&tag=${clanTag}&limit=1`),
                apiFetch(`/clans/wars?status=NEGOTIATING&tag=${clanTag}&limit=1`)
            ]);

            let totalActions = 0;
            if (pRes.ok) {
                const d = await pRes.json();
                totalActions += (d.totalWars || 0);
            }
            if (nRes.ok) {
                const d = await nRes.json();
                totalActions += (d.totalWars || 0);
            }

            setWarActionsCount(totalActions);

            // 📡 Emit signal for any listeners (like Tab Bars or Sidebars)
            DeviceEventEmitter.emit("CLAN_WAR_SIGNAL", {
                count: totalActions,
                hasActions: totalActions > 0
            });

            return totalActions;
        } catch (e) {
            console.error("Notification Check Error:", e);
            return 0;
        }
    };

    const fetchFullDetails = async () => {

        if (!userClan) {
            return
        }
        try {
            const res = await apiFetch(`/clans/${userClan.tag}?deviceId=${user.deviceId}`);
            const data = await res.json();
            setFullData(data?.joinRequests.length);
            setClanCoins(data?.spendablePoints || 0)
            setClanRank(data?.rank)
        } catch (err) {
            console.error("Fetch Details Error:", err);
        }
    };
    useEffect(() => {
        if (userClan) {
            fetchFullDetails();
        }
        }, [userClan]);

    const refreshClanStatus = async (deviceId) => {
        if (!deviceId) return;
        setIsLoading(true);
        try {
            const response = await apiFetch(`/clans?fingerprint=${deviceId}`);
            const data = await response.json();

            if (data.userInClan) {
                setUserClan(data.userClan);
                setClanRank(data.rank)
                await AsyncStorage.setItem("userClan", JSON.stringify(data.userClan));
                // 🔹 Trigger notification check once clan is confirmed
                checkWarNotifications(data.userClan.tag);
            } else {
                setUserClan(null);
                setWarActionsCount(0);
                await AsyncStorage.removeItem("userClan");
            }

            if (data.clans) {
                setAllClans(data.clans);
            }
        } catch (error) {
            console.error("Error syncing clan status:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const clearClanData = async () => {
        setUserClan(null);
        setWarActionsCount(0);
        await AsyncStorage.removeItem("userClan");
    };

    // Helper values
    const userRole = userClan?.role || null;
    const isLeader = userRole === "leader";
    const isViceLeader = userRole === "viceleader";
    const canManageClan = isLeader || isViceLeader;

    return (
        <ClanContext.Provider
            value={{
                userClan,
                allClans,
                isLoading,
                clanRank,
                fullData,
                cCoins,
                warActionsCount, // 🔴 Exported for global Red Dot
                checkWarNotifications: () => checkWarNotifications(userClan?.tag), // 🔄 Manual trigger
                refreshClanStatus: () => refreshClanStatus(user?.deviceId),
                clearClanData,
                isInClan: !!userClan,
                userRole,
                isLeader,
                isViceLeader,
                canManageClan,
            }}
        >
            {children}
        </ClanContext.Provider>
    );
};

export const useClan = () => useContext(ClanContext);