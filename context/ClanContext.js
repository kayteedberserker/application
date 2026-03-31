import apiFetch from "@/utils/apiFetch";
import { createContext, useContext, useEffect, useState } from "react";
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
    const clearClanData = () => {
        setUserClan(null);
        setWarActionsCount(0);
        setClanRank(0);
        setClanCoins(0);
        setFullData(0);
        setHasUnreadChat(false);
        storage.set("userClan", "");
    };

    useEffect(() => {
        if (user?.deviceId) {
            refreshClanStatus(user.deviceId);
        } else {
            clearClanData();
            setIsLoading(false);
        }
    }, [user?.deviceId]);

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
    };

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
                hasUnreadChat,
                markChatAsRead,
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