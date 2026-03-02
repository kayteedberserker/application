import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import apiFetch from '../utils/apiFetch';
import { useClan } from './ClanContext';
import { useUser } from './UserContext';

const CoinContext = createContext();

const STORAGE_KEYS = {
    COINS: 'cached_user_coins',
    CLAN_COINS: 'cached_clan_coins'
};

export const CoinProvider = ({ children }) => {
    const { user } = useUser();
    const { userClan, cCoins } = useClan();
    const [clanCoins, setClanCoins] = useState(0);
    const [coins, setCoins] = useState(0);
    const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);

    // 🔹 Hydration: Load cached values immediately on mount
    useEffect(() => {
        const hydrateStorage = async () => {
            try {
                const [cachedCoins, cachedClanCoins] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.COINS),
                    AsyncStorage.getItem(STORAGE_KEYS.CLAN_COINS)
                ]);
                
                if (cachedCoins !== null) setCoins(Number(cachedCoins));
                if (cachedClanCoins !== null) setClanCoins(Number(cachedClanCoins));
            } catch (e) {
                console.error("Failed to hydrate coins from storage", e);
            }
        };
        hydrateStorage();
    }, []);

    const updateCoins = async (newVal) => {
        setCoins(newVal);
        await AsyncStorage.setItem(STORAGE_KEYS.COINS, String(newVal));
    };

    const updateClanCoins = async (newVal) => {
        setClanCoins(newVal);
        await AsyncStorage.setItem(STORAGE_KEYS.CLAN_COINS, String(newVal));
    };

    useEffect(() => {
        if (user?.coins !== undefined) {
            updateCoins(user.coins);
        }
    }, [user?.coins]);

    const fetchCoins = useCallback(async () => {
        const stored = await AsyncStorage.getItem("mobileUser");
        let parsedUser = JSON.parse(stored);
        if (!parsedUser?.deviceId) return;

        try {
            const response = await apiFetch(`/mobile/coins/transaction?deviceId=${parsedUser.deviceId}`);
            const data = await response.json();
            if (data.success) {
                await updateCoins(data.balance || 0);
            }
        } catch (error) {
            console.error("Failed to fetch coins:", error);
        }
    }, []);

    const fetchClanCoins = async () => {
        if (!userClan) return;
        await updateClanCoins(cCoins);
    };

    useEffect(() => {
        fetchClanCoins();
    }, [userClan, cCoins]);

    const processTransaction = async (action, type, extraData = null, clanTag = null) => {
        if (!user?.deviceId) return { success: false, error: 'No device ID' };

        setIsProcessingTransaction(true);

        // Determine currency
        const isClanCoin = extraData?.currency === 'CC' || extraData === 'CC';
        const endpoint = isClanCoin ? "/mobile/coins/clan" : "/mobile/coins/transaction";

        try {
            const requestBody = {
                deviceId: user.deviceId,
                action,
                type,
            };

            // Handle Item Purchases or Pack Rewards
            if (typeof extraData === 'object' && extraData !== null) {
                Object.assign(requestBody, {
                    itemId: extraData.itemId,
                    price: extraData.price,
                    name: extraData.name,
                    category: extraData.category,
                    visualConfig: extraData.visualData || extraData.visualConfig,
                    coinType: extraData.currency,
                    rewards: extraData.rewards // Added for vault packs
                });
            }

            if (isClanCoin || clanTag) {
                requestBody.clanTag = clanTag || userClan?.tag;
            }

            const response = await apiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (data.success) {
                if (isClanCoin) {
                    await updateClanCoins(data.newClanBalance ?? data.newBalance ?? 0);
                } else {
                    await updateCoins(data.newBalance || 0);
                }
                setIsProcessingTransaction(false);
                return { success: true, balance: data.newBalance, inventory: data.inventory };
            } else {
                throw new Error(data.error || "Transaction failed");
            }
        } catch (error) {
            console.error(`Failed to ${action}:`, error);
            setIsProcessingTransaction(false);
            return { success: false, error: error.message };
        }
    };

    useEffect(() => {
        if (user?.deviceId) fetchCoins();
    }, [user?.deviceId, fetchCoins]);

    return (
        <CoinContext.Provider value={{
            coins,
            clanCoins,
            processTransaction,
            isProcessingTransaction,
            fetchCoins
        }}>
            {children}
        </CoinContext.Provider>
    );
};

export const useCoins = () => useContext(CoinContext);