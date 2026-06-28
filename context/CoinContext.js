import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMMKV } from 'react-native-mmkv';
import apiFetch from '../utils/apiFetch';
import { useClan } from './ClanContext';
import { useUser } from './UserContext';

const CoinContext = createContext();

const STORAGE_KEYS = {
    COINS: 'cached_user_coins',
    TOKENS: 'cached_user_tokens',
    CLAN_COINS: 'cached_clan_coins',
    TOTAL_PURCHASED: 'cached_total_purchased',
    PEAK_LEVEL: 'cached_peak_level'
};

const calculatePeakLevel = (totalPurchased) => {
    if (totalPurchased == 0) return 0;
    if (totalPurchased < 1000) return 1;
    if (totalPurchased < 5000) return 2;
    if (totalPurchased < 10000) return 3;
    if (totalPurchased < 25000) return 4;
    if (totalPurchased < 50000) return 5;
    if (totalPurchased < 100000) return 6;
    if (totalPurchased < 250000) return 7;
    if (totalPurchased < 500000) return 8;
    if (totalPurchased < 1000000) return 9;
    return 10;
};

export const CoinProvider = ({ children }) => {
    const storage = useMMKV();
    const { user } = useUser();
    const { userClan, cCoins } = useClan();

    // ⚡️ SYNCHRONOUS INITIALIZATION: No more loading flicker or accidental `0` overwrites
    const [coins, setCoins] = useState(() => Number(storage.getString(STORAGE_KEYS.COINS)) || 0);
    const [tokens, setTokens] = useState(() => Number(storage.getString(STORAGE_KEYS.TOKENS)) || 0);
    const [clanCoins, setClanCoins] = useState(() => Number(storage.getString(STORAGE_KEYS.CLAN_COINS)) || 0);
    const [totalPurchasedCoins, setTotalPurchasedCoins] = useState(() => Number(storage.getString(STORAGE_KEYS.TOTAL_PURCHASED)) || 0);
    const [peakLevel, setPeakLevel] = useState(() => Number(storage.getString(STORAGE_KEYS.PEAK_LEVEL)) || 0);

    const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);

    const updateCoins = useCallback((newVal) => {
        setCoins(newVal);
        storage.set(STORAGE_KEYS.COINS, String(newVal));
    }, [storage]);

    const updateTokens = useCallback((newVal) => {
        setTokens(newVal);
        storage.set(STORAGE_KEYS.TOKENS, String(newVal));
    }, [storage])

    const updateClanCoins = useCallback((newVal) => {
        setClanCoins(newVal);
        storage.set(STORAGE_KEYS.CLAN_COINS, String(newVal));
    }, [storage]);

    const updateTotalPurchased = useCallback((newTotal) => {
        setTotalPurchasedCoins(newTotal);
        storage.set(STORAGE_KEYS.TOTAL_PURCHASED, String(newTotal));
        const newPeakLevel = calculatePeakLevel(newTotal);
        setPeakLevel(newPeakLevel);
        storage.set(STORAGE_KEYS.PEAK_LEVEL, String(newPeakLevel));
    }, [storage]);

    // ⚡️ SINGLE INJECTION POINT FOR BOOTSTRAP
    const injectCoinData = useCallback((data) => {
        if (!data) return;
        if (data.balance !== undefined) updateCoins(data.balance);
        if (data.tokens !== undefined) updateTokens(data.tokens);
        if (data.totalPurchasedCoins !== undefined) updateTotalPurchased(data.totalPurchasedCoins);
    }, [updateCoins, updateTokens, updateClanCoins, updateTotalPurchased]);

    useEffect(() => {
        if (user?.coins !== undefined) updateCoins(user.coins);
        if (user?.totalPurchasedCoins !== undefined) updateTotalPurchased(user.totalPurchasedCoins);
    }, [user?.coins, user?.totalPurchasedCoins, updateCoins, updateTotalPurchased]);

    const fetchCoins = useCallback(async () => {
        const stored = storage.getString("mobileUser");
        if (!stored) return;
        let parsedUser = JSON.parse(stored);
        if (!parsedUser?.deviceId) return;
        try {
            const response = await apiFetch(`/mobile/coins/transaction?deviceId=${parsedUser.deviceId}`);
            const data = await response.json();
            if (data.success) {
                updateCoins(data.balance || 0);
                updateTokens(data.tokens || 0);
                if (data.totalPurchasedCoins !== undefined) updateTotalPurchased(data.totalPurchasedCoins);
            }
        } catch (error) {
            console.error("Failed to fetch coins:", error);
        }
    }, [storage, updateCoins, updateTokens, updateTotalPurchased]);

    useEffect(() => {

        // Because `userClan` is synchronously initialized now, this safely locks the coins without erasing them!
        if (!userClan) {
            setClanCoins(0);
            storage.set(STORAGE_KEYS.CLAN_COINS, "");
        } else {
            updateClanCoins(cCoins)
        }
    }, [userClan, cCoins, storage, updateClanCoins]);

    const processTransaction = useCallback(async (action, type, extraData = null, clanTag = null) => {
        if (!user?.deviceId) return { success: false, error: 'No device ID' };
        setIsProcessingTransaction(true);

        const isClanCoin = extraData?.currency === 'CC' || extraData === 'CC';
        const endpoint = isClanCoin ? "/mobile/coins/clan" : "/mobile/coins/transaction";

        try {
            const requestBody = { deviceId: user.deviceId, action, type };
            if (typeof extraData === 'object' && extraData !== null) {
                requestBody.payload = extraData;
                Object.assign(requestBody, {
                    itemId: extraData.itemId,
                    price: extraData.price,
                    name: extraData.name,
                    category: extraData.category,
                    rarity: extraData.rarity,
                    visualConfig: extraData.visualData || extraData.visualConfig,
                    coinType: extraData.currency,
                    rewards: extraData.rewards,
                    appUserId: extraData.appUserId,
                    transactionId: extraData.transactionId,
                    expiresInDays: extraData.expiresInDays,
                    description: extraData.description,
                    url: extraData.url,
                })
            }
            if (isClanCoin || clanTag) requestBody.clanTag = clanTag || userClan?.tag;

            const response = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(requestBody) });
            const data = await response.json();

            if (data.success) {
                // FALLBACK FIX: Check for both newClanBalance/newBalance and clanBalance/balance
                if (isClanCoin) {
                    updateClanCoins(data.newClanBalance ?? data.clanBalance ?? data.newBalance ?? data.balance ?? 0);
                } else {
                    updateCoins(data.newBalance ?? data.balance ?? 0);
                }

                if (data.totalPurchasedCoins !== undefined) updateTotalPurchased(data.totalPurchasedCoins);
                setIsProcessingTransaction(false);

                // Return the resolved balance here as well
                return {
                    success: true,
                    balance: data.newBalance ?? data.balance,
                    inventory: data.inventory
                };
            } else {
                throw new Error(data.error || "Transaction failed");
            }
        } catch (error) {
            console.error(`Failed to ${action}:`, error);
            setIsProcessingTransaction(false);
            return { success: false, error: error.message };
        }
    }, [user?.deviceId, userClan?.tag, updateClanCoins, updateCoins, updateTotalPurchased]);

    const contextValue = useMemo(() => ({
        coins, tokens, setCoins: updateCoins, clanCoins, totalPurchasedCoins, peakLevel, processTransaction, isProcessingTransaction, fetchCoins, setCoinData: injectCoinData
    }), [coins, tokens, updateCoins, clanCoins, totalPurchasedCoins, peakLevel, processTransaction, isProcessingTransaction, fetchCoins, injectCoinData]);

    return (
        <CoinContext.Provider value={contextValue}>
            {children}
        </CoinContext.Provider>
    );
};

export const useCoins = () => useContext(CoinContext);