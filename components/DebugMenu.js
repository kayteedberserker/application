import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
// import { MobileAds } from 'react-native-google-mobile-ads';

const SECRET_PIN = "1807"; // 👈 Set your secret PIN here
const BAN_KEY = "@debug_access_banned";

const DebugMenu = ({ visible, onClose }) => {
    const [pin, setPin] = useState("");
    const [isBanned, setIsBanned] = useState(false);

    useEffect(() => {
        checkBanStatus();
    }, []);

    const checkBanStatus = async () => {
        const banned = await AsyncStorage.getItem(BAN_KEY);
        if (banned === "true") setIsBanned(true);
    };

    const handleVerify = async () => {
        if (pin === SECRET_PIN) {
            // Success! Open Google Ad Inspector
            try {
                await MobileAds().openAdInspector();
                onClose();
            } catch (error) {
                Alert.alert("Error", "Could not open Ad Inspector. Make sure ads are initialized.");
            }
        } else {
            // Failure! Ban this device from seeing the debug menu again
            await AsyncStorage.setItem(BAN_KEY, "true");
            setIsBanned(true);
            Alert.alert("Access Denied", "Security protocol activated. Debug access removed.");
            onClose();
        }
    };

    if (isBanned) return null; // Don't even show the UI if banned

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View className="flex-1 justify-center items-center bg-black/80 p-6">
                <View className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-sm">
                    <Text className="text-xl font-bold mb-4 dark:text-white">Admin Authentication</Text>
                    <TextInput
                        className="border border-gray-300 dark:border-gray-600 p-3 rounded-lg mb-4 dark:text-white"
                        placeholder="Enter PIN"
                        placeholderTextColor="#999"
                        secureTextEntry
                        keyboardType="numeric"
                        value={pin}
                        onChangeText={setPin}
                    />
                    <View className="flex-row justify-end space-x-3">
                        <TouchableOpacity onPress={onClose} className="px-4 py-2">
                            <Text className="text-gray-500">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={handleVerify}
                            className="bg-blue-600 px-6 py-2 rounded-lg"
                        >
                            <Text className="text-white font-bold">Verify</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default DebugMenu;

