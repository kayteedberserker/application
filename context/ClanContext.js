import apiFetch from "@/utils/apiFetch";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useMMKV } from 'react-native-mmkv';
import { useUser } from "./UserContext";

const ClanContext = createContext();

export const ClanProvider = ({ children }) => {
    const storage = useMMKV();
    const { user } = useUser();

    // ⚡️ SYNCHRONOUS INITIALIZATION: Load from MMKV immediately to prevent layout shifts & context race conditions
    const [userClan, setUserClan] = useState(() => {
        try {
            const stored = storage.getString("userClan");
            return stored && stored !== "" ? JSON.parse(stored) : null;
        } catch (e) { return null; }
    });

    const [cCoins, setClanCoins] = useState(() => {
        try {
            const stored = storage.getString("userClan");
            return stored && stored !== "" ? (JSON.parse(stored).cCoins || 0) : 0;
        } catch (e) { return 0; }
    });

    const [clanRank, setClanRank] = useState(() => {
        try {
            const stored = storage.getString("userClan");
            return stored && stored !== "" ? (JSON.parse(stored).rank || 0) : 0;
        } catch (e) { return 0; }
    });

    const [warActionsCount, setWarActionsCount] = useState(() => {
        try {
            const stored = storage.getString("userClan");
            return stored && stored !== "" ? (JSON.parse(stored).totalWarActions || 0) : 0;
        } catch (e) { return 0; }
    });

    const [fullData, setFullData] = useState(() => {
        try {
            const stored = storage.getString("userClan");
            return stored && stored !== "" ? (JSON.parse(stored).fullData || 0) : 0;
        } catch (e) { return 0; }
    });

    const [allClans, setAllClans] = useState([]);
    const [isLoading, setIsLoading] = useState(!user?.deviceId);
    const [hasUnreadChat, setHasUnreadChat] = useState(false);

    const clearClanData = useCallback(() => {
        setUserClan(null);
        setWarActionsCount(0);
        setClanRank(0);
        setClanCoins(0);
        setFullData(0);
        setHasUnreadChat(false);
        storage.set("userClan", "");
    }, [storage]);

    const markChatAsRead = useCallback(() => {
        if (!userClan) return;
        const now = new Date().toISOString();
        storage.set(`lastReadChat_${userClan.tag}`, now);
        setHasUnreadChat(false);
    }, [userClan, storage]);

    // ⚡️ SINGLE UNIFIED FETCH: One call to rule them all
    const refreshClanStatus = useCallback(async (deviceId) => {
        if (!deviceId) return;
        setIsLoading(true);
        try {
            const response = await apiFetch(`/clans?fingerprint=${deviceId}`);
            const data = await response.json();

            if (data.userInClan && data.userClan) {
                const clanObj = data.userClan;

                setUserClan(clanObj);
                setClanRank(clanObj.rank || 0);
                setClanCoins(clanObj.cCoins || 0);
                setFullData(clanObj.fullData || 0);
                setWarActionsCount(clanObj.totalWarActions || 0);
                storage.set("userClan", JSON.stringify(clanObj));

                // Emit War Signal directly from the unified payload
                if (clanObj.totalWarActions > 0) DeviceEventEmitter.emit("CLAN_WAR_SIGNAL", { count: clanObj.totalWarActions, hasActions: true });

                // Process Chat Unread Status directly from the unified payload
                if (clanObj.latestMessageAt) {
                    const lastReadStr = storage.getString(`lastReadChat_${clanObj.tag}`);
                    const lastReadTime = lastReadStr ? new Date(lastReadStr).getTime() : 0;
                    const latestMsgTime = new Date(clanObj.latestMessageAt).getTime();
                    setHasUnreadChat(latestMsgTime > lastReadTime);
                } else {
                    setHasUnreadChat(false);
                }
            } else {
                clearClanData();
            }
            if (data.clans) setAllClans(data.clans);
        } catch (error) {
            console.error("Error syncing clan status:", error);
        } finally {
            setIsLoading(false);
        }
    }, [storage, clearClanData]);

    useEffect(() => {
        if (user?.deviceId) refreshClanStatus(user.deviceId);
        else { clearClanData(); setIsLoading(false); }
    }, [user?.deviceId, refreshClanStatus, clearClanData]);

    const refreshClanStatusExternal = useCallback(() => {
        return refreshClanStatus(user?.deviceId);
    }, [refreshClanStatus, user?.deviceId]);

    const userRole = userClan?.role || null;
    const isLeader = userRole === "leader";
    const isViceLeader = userRole === "viceleader";
    const canManageClan = isLeader || isViceLeader;
    const isInClan = !!userClan;

    const contextValue = useMemo(() => ({
        userClan, allClans, isLoading, clanRank, fullData, cCoins, warActionsCount, hasUnreadChat, markChatAsRead, refreshClanStatus: refreshClanStatusExternal, clearClanData, isInClan, userRole, isLeader, isViceLeader, canManageClan,
    }), [userClan, allClans, isLoading, clanRank, fullData, cCoins, warActionsCount, hasUnreadChat, markChatAsRead, refreshClanStatusExternal, clearClanData, isInClan, userRole, isLeader, isViceLeader, canManageClan]);

    return (
        <ClanContext.Provider value={contextValue}>
            {children}
        </ClanContext.Provider>
    );
};

export const useClan = () => useContext(ClanContext);