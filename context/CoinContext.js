import { useMMKV } from 'react-native-mmkv';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import apiFetch from '../utils/apiFetch';
import { useClan } from './ClanContext';
import { useUser } from './UserContext';

const CoinContext = createContext();

const STORAGE_KEYS = {
    COINS: 'cached_user_coins',
    CLAN_COINS: 'cached_clan_coins',
    TOTAL_PURCHASED: 'cached_total_purchased',
    PEAK_LEVEL: 'cached_peak_level'
};

// ⚡️ Define the thresholds for Peak Levels based on total purchased coins
const calculatePeakLevel = (totalPurchased) => {
    if (totalPurchased < 1000) return 1;
    if (totalPurchased < 5000) return 2;
    if (totalPurchased < 10000) return 3;
    if (totalPurchased < 25000) return 4;
    if (totalPurchased < 50000) return 5;
    if (totalPurchased < 100000) return 6;
    if (totalPurchased < 250000) return 7;
    if (totalPurchased < 500000) return 8;
    if (totalPurchased < 1000000) return 9;
    return 10; // Max level
};

export const CoinProvider = ({ children }) => {
    // 🔹 useMMKV hook for synchronous storage instance
    const storage = useMMKV();

    const { user } = useUser();
    const { userClan, cCoins } = useClan();
    
    const [clanCoins, setClanCoins] = useState(0);
    const [coins, setCoins] = useState(0);
    const [totalPurchasedCoins, setTotalPurchasedCoins] = useState(0);
    const [peakLevel, setPeakLevel] = useState(0);
    
    const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);

    // 🔹 Hydration: Synchronous load from MMKV immediately on mount
    useEffect(() => {
        try {
            const cachedCoins = storage.getString(STORAGE_KEYS.COINS);
            const cachedClanCoins = storage.getString(STORAGE_KEYS.CLAN_COINS);
            const cachedTotalPurchased = storage.getString(STORAGE_KEYS.TOTAL_PURCHASED);
            const cachedPeakLevel = storage.getString(STORAGE_KEYS.PEAK_LEVEL);
            
            if (cachedCoins !== undefined && cachedCoins !== null) {
                setCoins(Number(cachedCoins));
            }
            if (cachedClanCoins !== undefined && cachedClanCoins !== null) {
                setClanCoins(Number(cachedClanCoins));
            }
            if (cachedTotalPurchased !== undefined && cachedTotalPurchased !== null) {
                setTotalPurchasedCoins(Number(cachedTotalPurchased));
            }
            if (cachedPeakLevel !== undefined && cachedPeakLevel !== null) {
                setPeakLevel(Number(cachedPeakLevel));
            }
        } catch (e) {
            console.error("Failed to hydrate coins from MMKV", e);
        }
    }, [storage]);

    const updateCoins = (newVal) => {
        setCoins(newVal);
        storage.set(STORAGE_KEYS.COINS, String(newVal));
    };

    const updateClanCoins = (newVal) => {
        setClanCoins(newVal);
        storage.set(STORAGE_KEYS.CLAN_COINS, String(newVal));
    };

    const updateTotalPurchased = (newTotal) => {
        setTotalPurchasedCoins(newTotal);
        storage.set(STORAGE_KEYS.TOTAL_PURCHASED, String(newTotal));

        // ⚡️ Automatically calculate and cache the new Peak Level
        const newPeakLevel = calculatePeakLevel(newTotal);
        setPeakLevel(newPeakLevel);
        storage.set(STORAGE_KEYS.PEAK_LEVEL, String(newPeakLevel));
    };

    useEffect(() => {
        if (user?.coins !== undefined) {
            updateCoins(user.coins);
        }
        if (user?.totalPurchasedCoins !== undefined) {
            updateTotalPurchased(user.totalPurchasedCoins);
        }
    }, [user?.coins, user?.totalPurchasedCoins]);

    const fetchCoins = useCallback(async () => {
        // Use the hook instance to get user data
        const stored = storage.getString("mobileUser");
        if (!stored) return;
        
        let parsedUser = JSON.parse(stored);
        if (!parsedUser?.deviceId) return;

        try {
            // Loading animation should be active while this fetch is pending
            const response = await apiFetch(`/mobile/coins/transaction?deviceId=${parsedUser.deviceId}`);
            const data = await response.json();
            if (data.success) {
                updateCoins(data.balance || 0);
                if (data.totalPurchasedCoins !== undefined) {
                    updateTotalPurchased(data.totalPurchasedCoins);
                }
            }
        } catch (error) {
            console.error("Failed to fetch coins:", error);
        }
    }, [storage]);

    const fetchClanCoins = async () => {
        if (!userClan) return;
        updateClanCoins(cCoins);
    };

    useEffect(() => {
        fetchClanCoins();
    }, [userClan, cCoins]);

    const processTransaction = async (action, type, extraData = null, clanTag = null) => {
        if (!user?.deviceId) return { success: false, error: 'No device ID' };

        setIsProcessingTransaction(true);

        const isClanCoin = extraData?.currency === 'CC' || extraData === 'CC';
        const endpoint = isClanCoin ? "/mobile/coins/clan" : "/mobile/coins/transaction";

        try {
            const requestBody = {
                deviceId: user.deviceId,
                action,
                type,
            };

            if (typeof extraData === 'object' && extraData !== null) {
                // 🔹 FIX: We add a 'payload' key so the backend can find recipientId/amount
                requestBody.payload = extraData; 

                Object.assign(requestBody, {
                    itemId: extraData.itemId,
                    price: extraData.price,
                    name: extraData.name,
                    category: extraData.category,
                    visualConfig: extraData.visualData || extraData.visualConfig,
                    coinType: extraData.currency,
                    rewards: extraData.rewards 
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
                    updateClanCoins(data.newClanBalance ?? data.newBalance ?? 0);
                } else {
                    updateCoins(data.newBalance || 0);
                }

                // Update Total Purchased if returned
                if (data.totalPurchasedCoins !== undefined) {
                    updateTotalPurchased(data.totalPurchasedCoins);
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
            totalPurchasedCoins, // Exported for use
            peakLevel,           // Exported for use
            processTransaction,
            isProcessingTransaction,
            fetchCoins
        }}>
            {children}
        </CoinContext.Provider>
    );
};

export const useCoins = () => useContext(CoinContext);