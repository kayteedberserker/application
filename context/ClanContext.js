import apiFetch from "@/utils/apiFetch";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useMMKV } from 'react-native-mmkv';
import { useUser } from "./UserContext";

const ClanContext = createContext();

export const ClanProvider = ({ children }) => {
    // 🔹 Strictly use the useMMKV hook for the storage instance
    const storage = useMMKV();

    const { user } = useUser();
    const [userClan, setUserClan] = useState(null);
    const [allClans, setAllClans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [warActionsCount, setWarActionsCount] = useState(0);
    const hasSynced = useRef(false);
    const [fullData, setFullData] = useState();
    const [cCoins, setClanCoins] = useState(0);
    const [clanRank, setClanRank] = useState(0);

    // 🔹 NEW: Track if there is an unread chat message
    const [hasUnreadChat, setHasUnreadChat] = useState(false);

    // 1. Initial Load from MMKV (Synchronous)
    useEffect(() => {
        try {
            const stored = storage.getString("userClan");
            if (stored && stored !== "") {
                setUserClan(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load clan from MMKV", e);
        } finally {
            if (!user?.deviceId) {
                setIsLoading(false);
            }
        }
    }, [storage]);

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
        if (!userClan || !user?.deviceId) return;

        try {
            const res = await apiFetch(`/clans/${userClan.tag}?deviceId=${user.deviceId}`);
            const data = await res.json();

            setFullData(data?.joinRequests?.length || 0);
            setClanCoins(data?.spendablePoints || 0);
            setClanRank(data?.rank);

            // 🔹 NEW: Check for unread messages
            // Note: Adjust the path to the timestamp based on how your backend returns the chat!
            // E.g., data?.latestMessage?.createdAt OR data?.chat?.[data.chat.length - 1]?.createdAt
            const latestMessageAt = data?.latestMessage?.createdAt || data?.messages?.[data?.messages?.length - 1]?.date;
            if (latestMessageAt) {
                const lastReadStr = storage.getString(`lastReadChat_${userClan.tag}`);
                const lastReadTime = lastReadStr ? new Date(lastReadStr).getTime() : 0;
                const latestMsgTime = new Date(latestMessageAt).getTime();
                if (latestMsgTime > lastReadTime) {
                    setHasUnreadChat(true);
                } else {
                    setHasUnreadChat(false);
                }
            }

        } catch (err) {
            console.error("Fetch Details Error:", err);
        }
    };

    // 🔹 NEW: Call this function when the user mounts/opens the clan chat page
    const markChatAsRead = () => {
        if (!userClan) return;
        const now = new Date().toISOString();
        storage.set(`lastReadChat_${userClan.tag}`, now);
        setHasUnreadChat(false);
    };

    useEffect(() => {
        if (userClan) {
            fetchFullDetails();
        }
    }, [userClan]);

    const refreshClanStatus = async (deviceId) => {
        if (!deviceId) return;

        // 🔹 Triggering loading animation for the sync process
        setIsLoading(true);
        try {
            const response = await apiFetch(`/clans?fingerprint=${deviceId}`);
            const data = await response.json();

            if (data.userInClan) {
                setUserClan(data.userClan);
                setClanRank(data.rank);

                // 🔹 MMKV storage update
                storage.set("userClan", JSON.stringify(data.userClan));

                checkWarNotifications(data.userClan.tag);
            } else {
                setUserClan(null);
                setWarActionsCount(0);

                // 🔹 MMKV storage removal
                storage.set("userClan", "");
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

    const clearClanData = () => {
        setUserClan(null);
        setWarActionsCount(0);
        storage.set("userClan", "");
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
                warActionsCount,
                hasUnreadChat, // Exported here for your UI indicators
                markChatAsRead, // Exported here to trigger when opening chat
                checkWarNotifications: () => checkWarNotifications(userClan?.tag),
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