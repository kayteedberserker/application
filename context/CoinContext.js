import { createContext, useContext, useEffect, useState } from 'react';
import apiFetch from '../utils/apiFetch';
import { useUser } from './UserContext';

const CoinContext = createContext();

export const CoinProvider = ({ children }) => {
    const { user } = useUser();
    const [coins, setCoins] = useState(0);
    const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);

    useEffect(() => {
        if (user && user.coins !== undefined) {
            setCoins(user.coins);
        }
    }, [user]);

    const processTransaction = async (action, type) => {
        if (!user?.deviceId) return { success: false, error: 'No device ID' };
        
        setIsProcessingTransaction(true);
        try {
            const response = await apiFetch("http://10.168.113.121:3000/api/mobile/coins/transaction", {
                method: "POST",
                body: JSON.stringify({ 
                    deviceId: user.deviceId, 
                    action, 
                    type 
                }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                setCoins(data.newBalance);
                setIsProcessingTransaction(false);
                return { success: true, balance: data.newBalance };
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error(`Failed to ${action} coins:`, error);
            setIsProcessingTransaction(false);
            return { success: false, error };
        }
    };

    return (
        <CoinContext.Provider value={{ coins, processTransaction, isProcessingTransaction }}>
            {children}
        </CoinContext.Provider>
    );
};

export const useCoins = () => useContext(CoinContext);