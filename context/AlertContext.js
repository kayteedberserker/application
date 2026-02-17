import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState({
        title: '',
        message: '',
        buttons: [],
        type: 'info' // 'info', 'error', 'success'
    });

    const showAlert = useCallback((title, message, buttons = []) => {
        // Default button if none provided (Matches native behavior)
        const finalButtons = buttons.length > 0 
            ? buttons 
            : [{ text: "OK", onPress: () => {} }];

        // Determine type based on title or style
        let type = 'info';
        if (title?.toLowerCase().includes('error')) type = 'error';
        if (title?.toLowerCase().includes('success') || title?.toLowerCase().includes('declined')) type = 'success';

        setConfig({ title, message, buttons: finalButtons, type });
        setVisible(true);
    }, []);

    const hideAlert = () => setVisible(false);

    const handleButtonPress = (onPress) => {
        hideAlert();
        if (onPress) {
            // Give the modal time to start closing before executing logic
            setTimeout(() => onPress(), 100);
        }
    };

    return (
        <AlertContext.Provider value={showAlert}>
            {children}
            <Modal transparent visible={visible} animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/60 px-8">
                    <View className={`w-full p-6 rounded-[30px] border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-100 shadow-xl"}`}>
                        
                        {/* Icon Header */}
                        <View className="items-center mb-4">
                            <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${
                                config.type === 'error' ? 'bg-red-500/10' : 
                                config.type === 'success' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
                            }`}>
                                <Ionicons 
                                    name={config.type === 'error' ? "alert-circle" : config.type === 'success' ? "checkmark-circle" : "information-circle"} 
                                    size={28} 
                                    color={config.type === 'error' ? "#ef4444" : config.type === 'success' ? "#10b981" : "#3b82f6"} 
                                />
                            </View>
                            <Text className={`text-lg font-black text-center ${isDark ? "text-white" : "text-zinc-900"}`}>{config.title}</Text>
                            {config.message ? (
                                <Text className={`text-sm font-medium text-center mt-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{config.message}</Text>
                            ) : null}
                        </View>

                        {/* Buttons Container */}
                        <View className={`flex-row gap-3 ${config.buttons.length > 2 ? 'flex-col' : ''}`}>
                            {config.buttons.map((btn, index) => {
                                const isDestructive = btn.style === 'destructive';
                                const isCancel = btn.style === 'cancel';

                                return (
                                    <TouchableOpacity 
                                        key={index}
                                        onPress={() => handleButtonPress(btn.onPress)}
                                        className={`flex-1 p-4 rounded-2xl items-center ${
                                            isDestructive ? 'bg-red-500' : 
                                            isCancel ? (isDark ? 'bg-zinc-800' : 'bg-zinc-100') : 
                                            'bg-blue-600'
                                        }`}
                                    >
                                        <Text className={`font-bold text-[13px] uppercase tracking-wider ${
                                            isCancel ? (isDark ? 'text-zinc-300' : 'text-zinc-600') : 'text-white'
                                        }`}>
                                            {btn.text}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>
        </AlertContext.Provider>
    );
};

export const useAlert = () => useContext(AlertContext);