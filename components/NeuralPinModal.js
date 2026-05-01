import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import THEME from '../components/useAppTheme';
import { useUser } from '../context/UserContext';
import apiFetch from '../utils/apiFetch';

const PIN_LENGTH = 6;
const BLACKLIST = ['123456', '654321', '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999'];

const NeuralPinModal = ({ visible, onSuccess, onClose, returnPinOnly = false }) => {
    const [pin, setPin] = useState('');
    const { user, setUser } = useUser();
    const shakeOffset = useSharedValue(0);

    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeOffset.value }],
    }));

    const triggerError = (reason = "Unauthorized") => {
        // 📳 Error Haptics
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shakeOffset.value = withSequence(
            withTiming(-10, { duration: 50 }),
            withRepeat(withTiming(10, { duration: 50 }), 3, true),
            withTiming(0, { duration: 50 })
        );
        setPin('');
    };

    const onPressKey = (val) => {
        // 📳 Typing Haptics
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (val === 'back') {
            setPin(prev => prev.slice(0, -1));
            return;
        }

        if (val === 'clear') {
            setPin('');
            return;
        }

        if (pin.length < PIN_LENGTH) {
            const newPin = pin + val;
            setPin(newPin);

            if (newPin.length === PIN_LENGTH) {
                handleVerify(newPin);
            }
        }
    };

    const handleVerify = async (submittedPin) => {
        if (BLACKLIST.includes(submittedPin)) {
            triggerError("Weak Pattern");
            return;
        }

        // ⚡️ NEW: If returnPinOnly is true, just return the PIN to parent without API call
        // This is used for recovery flow where parent handles the API call
        if (returnPinOnly) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (onSuccess) onSuccess(submittedPin);
            setPin('');
            return;
        }

        // Original behavior: call secure-uplink for logged-in users
        try {
            if (!user?.uid) {
                triggerError("No Identity");
                return;
            }

            const res = await apiFetch('/mobile/secure-uplink', {
                method: 'POST',
                body: JSON.stringify({ uid: user.uid, pin: submittedPin })
            });

            const data = await res.json();

            if (res.ok) {
                await SecureStore.setItemAsync('userToken', data.token);
                setUser({ ...user, securityLevel: data.securityLevel });

                // 📳 Success Haptics
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setPin('');

                // Trigger the callback to parent logic
                if (onSuccess) onSuccess();
            } else {
                triggerError(data.message);
            }
        } catch (err) {
            triggerError("Connection Lost");
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
                <Animated.View
                    style={[
                        shakeStyle,
                        { backgroundColor: THEME.card, borderColor: THEME.accent }
                    ]}
                    className="w-[90%] border-2 rounded-[40px] p-8 items-center shadow-2xl"
                >
                    {/* Header: Now using your Accent Blue */}
                    <View className="items-center mb-6">
                        <View style={{ backgroundColor: THEME.glowBlue }} className="p-3 rounded-full mb-3">
                            <Ionicons name="finger-print" size={32} color={THEME.accent} />
                        </View>
                        <Text style={{ color: THEME.text }} className="text-xl font-bold tracking-tighter">
                            DATA ENCRYPTION
                        </Text>
                        <Text style={{ color: THEME.textSecondary }} className="mt-2 text-center text-sm px-4">
                            Neural signature required to authorize system uplink.
                        </Text>
                    </View>

                    {/* PIN Dots: Blue themed */}
                    <View className="flex-row mb-12 justify-center items-center h-10">
                        {[...Array(PIN_LENGTH)].map((_, i) => (
                            <View
                                key={i}
                                style={{
                                    borderColor: pin.length > i ? THEME.accent : THEME.border,
                                    backgroundColor: pin.length > i ? THEME.accent : 'transparent',
                                    transform: [{ scale: pin.length > i ? 1.2 : 1 }]
                                }}
                                className="w-4 h-4 rounded-full border-2 mx-3"
                            />
                        ))}
                    </View>

                    {/* Keypad */}
                    <View className="flex-row flex-wrap justify-center w-full">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'back'].map((key) => (
                            <TouchableOpacity
                                key={key}
                                activeOpacity={0.7}
                                onPress={() => onPressKey(key)}
                                className="w-1/3 h-20 justify-center items-center"
                            >
                                {key === 'back' ? (
                                    <Ionicons name="backspace-outline" size={28} color={THEME.textSecondary} />
                                ) : key === 'clear' ? (
                                    <Text style={{ color: THEME.danger }} className="text-3xl font-semibold tracking-widest">C</Text>
                                ) : (
                                    <Text style={{ color: THEME.text }} className="text-3xl font-light">
                                        {key}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

export default NeuralPinModal;