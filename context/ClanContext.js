import apiFetch from "@/utils/apiFetch";
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { DeviceEventEmitter } from "react-native";
import { useMMKV } from 'react-native-mmkv';
import { useUser } from "./UserContext";

const ClanContext = createContext();

export const ClanProvider = ({ children }) => {
    const storage = useMMKV();

    const { user } = useUser();
    const [userClan, setUserClan] = useState(null);
    const [allClans, setAllClans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [warActionsCount, setWarActionsCount] = useState(0);
    const [fullData, setFullData] = useState();
    const [cCoins, setClanCoins] = useState(0);
    const [clanRank, setClanRank] = useState(0);
    const [hasUnreadChat, setHasUnreadChat] = useState(false);

    // 1. Initial Load from MMKV (Synchronous)
    useEffect(() => {
        try {
            const stored = storage.getString("userClan");
            if (stored && stored !== "") {
                setUserClan(JSON.parse(stored));
            } else {
                setUserClan(null);
            }
        } catch (e) {
            console.error("Failed to load clan from MMKV", e);
        } finally {
            if (!user?.deviceId) {
                setIsLoading(false);
            }
        }
    }, [storage, user?.deviceId]);

    // ⚡️ FIXED: Reverted back to using .set("", "") instead of .delete()
    const clearClanData = useCallback(() => {
        setUserClan(null);
        setWarActionsCount(0);
        setClanRank(0);
        setClanCoins(0);
        setFullData(0);
        setHasUnreadChat(false);
        storage.set("userClan", "");
    }, [storage]);

    const checkWarNotifications = useCallback(async (clanTag) => {
        if (!clanTag) return 0;
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

            DeviceEventEmitter.emit("CLAN_WAR_SIGNAL", {
                count: totalActions,
                hasActions: totalActions > 0
            });

            return totalActions;
        } catch (e) {
            console.error("Notification Check Error:", e);
            return 0;
        }
    }, []);

    const fetchFullDetails = useCallback(async () => {
        if (!userClan || !user?.deviceId) return;

        try {
            const res = await apiFetch(`/clans/${userClan.tag}?deviceId=${user.deviceId}`);
            const data = await res.json();

            setFullData(data?.joinRequests?.length || 0);
            setClanCoins(data?.spendablePoints || 0);
            setClanRank(data?.rank);

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
    }, [userClan, user?.deviceId, storage]);

    const markChatAsRead = useCallback(() => {
        if (!userClan) return;
        const now = new Date().toISOString();
        storage.set(`lastReadChat_${userClan.tag}`, now);
        setHasUnreadChat(false);
    }, [userClan, storage]);

    const refreshClanStatus = useCallback(async (deviceId) => {
        if (!deviceId) return;

        setIsLoading(true);
        try {
            const response = await apiFetch(`/clans?fingerprint=${deviceId}`);
            const data = await response.json();

            if (data.userInClan) {
                setUserClan(data.userClan);
                setClanRank(data.rank);
                storage.set("userClan", JSON.stringify(data.userClan));
                checkWarNotifications(data.userClan.tag);
            } else {
                clearClanData();
            }

            if (data.clans) {
                setAllClans(data.clans);
            }
        } catch (error) {
            console.error("Error syncing clan status:", error);
        } finally {
            setIsLoading(false);
        }
    }, [storage, checkWarNotifications, clearClanData]);

    useEffect(() => {
        if (userClan) {
            fetchFullDetails();
        }
    }, [userClan, fetchFullDetails]);

    useEffect(() => {
        if (user?.deviceId) {
            refreshClanStatus(user.deviceId);
        } else {
            clearClanData();
            setIsLoading(false);
        }
    }, [user?.deviceId, refreshClanStatus, clearClanData]);

    // External consumers wrapped safely to lock baseline references down
    const checkWarNotificationsExternal = useCallback(() => {
        return checkWarNotifications(userClan?.tag);
    }, [checkWarNotifications, userClan?.tag]);

    const refreshClanStatusExternal = useCallback(() => {
        return refreshClanStatus(user?.deviceId);
    }, [refreshClanStatus, user?.deviceId]);

    // Computed Properties Matrix
    const userRole = userClan?.role || null;
    const isLeader = userRole === "leader";
    const isViceLeader = userRole === "viceleader";
    const canManageClan = isLeader || isViceLeader;
    const isInClan = !!userClan;

    // 🧠 MEMOIZED CONTEXT VALUE TO PREVENT UNNECESSARY CONSUMER RERENDERS
    const contextValue = useMemo(() => ({
        userClan,
        allClans,
        isLoading,
        clanRank,
        fullData,
        cCoins,
        warActionsCount,
        hasUnreadChat,
        markChatAsRead,
        checkWarNotifications: checkWarNotificationsExternal,
        refreshClanStatus: refreshClanStatusExternal,
        clearClanData,
        isInClan,
        userRole,
        isLeader,
        isViceLeader,
        canManageClan,
    }), [
        userClan,
        allClans,
        isLoading,
        clanRank,
        fullData,
        cCoins,
        warActionsCount,
        hasUnreadChat,
        markChatAsRead,
        checkWarNotificationsExternal,
        refreshClanStatusExternal,
        clearClanData,
        isInClan,
        userRole,
        isLeader,
        isViceLeader,
        canManageClan,
    ]);

    return (
        <ClanContext.Provider value={contextValue}>
            {children}
        </ClanContext.Provider>
    );
};

export const useClan = () => useContext(ClanContext);