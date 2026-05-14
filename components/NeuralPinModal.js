import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import THEME from '../components/useAppTheme';
import { useUser } from '../context/UserContext';
import apiFetch from '../utils/apiFetch';

const PIN_LENGTH = 6;
const BLACKLIST = ['123456', '654321', '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999'];

const NeuralPinModal = ({ visible, onSuccess, onClose, returnPinOnly = false, changePin = false }) => {
    const [pin, setPin] = useState('');
    const [message, setMessage] = useState('');
    const [step, setStep] = useState('old');
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const { user, setUser } = useUser();

    const shakeOffset = useSharedValue(0);

    useEffect(() => {
        if (!visible) {
            setPin('');
            setMessage('');
            setStep('old');
            setOldPin('');
            setNewPin('');
            setConfirmPin('');
        }
    }, [visible, changePin]);

    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeOffset.value }],
    }));

    const triggerError = (reason = "Unauthorized") => {
        setMessage(reason);
        // 📳 Error Haptics
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shakeOffset.value = withSequence(
            withTiming(-10, { duration: 50 }),
            withRepeat(withTiming(10, { duration: 50 }), 3, true),
            withTiming(0, { duration: 50 })
        );
        setPin('');
        setTimeout(() => {
            setMessage("");
        }, 5000);
    };

    const onPressKey = (val) => {
        // 📳 Typing Haptics
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (val === 'back') {
            setPin(prev => prev.slice(0, -1));
            return;
        }

        if (val === "clear") {
            onClose();
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

    const handleSuccess = async (payload) => {
        if (onSuccess) await onSuccess(payload);
        setPin('');
        onClose();
    };

    const handleVerify = async (submittedPin) => {
        console.log("changePin is?", changePin);

        if (changePin) {
            console.log("Current step:", step);
            if (step === 'old') {
                setOldPin(submittedPin)
                setPin('');
                setStep('new');
                setMessage('Enter your new 6-digit PIN');
                return;
            }

            if (step === 'new') {
                setNewPin(submittedPin);
                setPin('');
                setStep('confirm');
                setMessage('Confirm your new 6-digit PIN');
                return;
            }

            if (step === 'confirm') {
                if (submittedPin !== newPin) {
                    triggerError('PINs do not match. Try again.');
                    setStep('new');
                    setPin('');
                    setNewPin('');
                    return;
                }

                await handleSuccess({ oldPin, newPin: submittedPin });
                return;
            }
        }

        if (returnPinOnly) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await handleSuccess(submittedPin);
            return;
        }

        if (BLACKLIST.includes(submittedPin)) {
            triggerError("Weak Signature");
            return;
        }

        if (__DEV__) console.log(returnPinOnly, "is returnPinOnly");

        try {
            if (!user?.uid) {
                triggerError("No Identity")
                return;
            }

            const res = await apiFetch('/mobile/secure-uplink', {
                method: 'POST',
                body: JSON.stringify({ uid: user.uid, pin: submittedPin })
            });

            const data = await res.json();

            if (res.ok) {
                await SecureStore.setItemAsync('userToken', data.accessToken);
                await SecureStore.setItemAsync('refreshToken', data.refreshToken);
                setUser({ ...user, securityLevel: data.securityLevel });

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await handleSuccess(submittedPin);
            } else {
                triggerError(data.message);
            }
        } catch (err) {
            triggerError("Connection Lost");
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View className="flex-1 justify-center items-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
                <Animated.View
                    style={[
                        shakeStyle,
                        { backgroundColor: THEME.card, borderColor: returnPinOnly ? THEME.success : THEME.accent }
                    ]}
                    className="w-[90%] border-2 rounded-[40px] p-8 items-center shadow-2xl"
                >
                    {/* Header: Now using your Accent Blue */}
                    <View className="items-center mb-6">
                        <View style={{ backgroundColor: returnPinOnly ? THEME.glowGreen : THEME.glowBlue }} className="p-3 rounded-full mb-3">
                            <Ionicons name="finger-print" size={32} color={returnPinOnly ? THEME.success : THEME.accent} />
                        </View>
                        <Text style={{ color: THEME.text }} className="text-xl font-bold tracking-tighter">
                            {changePin ? (step === 'confirm' ? "CONFIRM NEW PIN" : step === 'new' ? "NEW PIN" : "CURRENT PIN") : returnPinOnly ? "DATA DECRYPTION" : "DATA ENCRYPTION"}
                        </Text>
                        <Text style={{ color: message ? THEME.danger : THEME.textSecondary }} className="mt-2 text-center text-sm px-4">
                            {message ? message : changePin ? (step === 'old' ? 'Enter your current PIN first.' : step === 'new' ? 'Now enter your new 6-digit PIN.' : 'Confirm your new PIN to finish.') : returnPinOnly ? "Your data was encrypted, input PIN to decrypt info" : "Input PIN, to enable data encryption and secure your info."}
                        </Text>
                    </View>

                    {/* PIN Dots: Blue themed */}
                    <View className="flex-row mb-12 justify-center items-center h-10">
                        {[...Array(PIN_LENGTH)].map((_, i) => (
                            <View
                                key={i}
                                style={{
                                    borderColor: pin.length > i ? returnPinOnly ? THEME.success : THEME.accent : THEME.border,
                                    backgroundColor: pin.length > i ? returnPinOnly ? THEME.success : THEME.accent : 'transparent',
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
                                    <Text style={{ color: THEME.danger }} className="text-3xl font-semibold tracking-widest">X</Text>
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