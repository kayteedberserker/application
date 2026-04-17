import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    DeviceEventEmitter,
    TouchableOpacity,
    View
} from "react-native";
import { useMMKV } from "react-native-mmkv";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from "react-native-reanimated";
import { useAlert } from "../context/AlertContext";
import { useCoins } from "../context/CoinContext";
import { useStreak } from "../context/StreakContext";
import { useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import CoinIcon from "./ClanIcon";
import PeakBadge from "./PeakBadge";
import { Text } from "./Text";

// ⚡️ Global session flag: Resets to false only when the app is completely restarted.
let hasShownThisSession = false;

export default function TopBar({ isDark }) {
    const storage = useMMKV();
    const CustomAlert = useAlert();
    const { streak, loading, refreshStreak } = useStreak();
    const { user, refreshUser } = useUser();
    const { coins, clanCoins, peakLevel, processTransaction, isProcessingTransaction } = useCoins();
    const pathName = usePathname();

    const pulse = useSharedValue(1);
    const hasActiveStreak = streak?.streak > 0;
    const showRestoreUI = streak?.canRestore;
    const isZeroStreak = !hasActiveStreak && !showRestoreUI;

    // ⚡️ WALLET HINT STATE & ANIMATION
    const [showWalletHint, setShowWalletHint] = useState(false);
    const hintBounce = useSharedValue(0);
    const [isFirstPostFlow, setIsFirstPostFlow] = useState(false);
    // =================================================================
    // 1. INTERCEPT: CHECK FOR FIRST POST FLAG
    // =================================================================
    useEffect(() => {
        const checkFirstPost = storage.getNumber("trigger_first_post");
        console.log(checkFirstPost);

        if (checkFirstPost !== 0 && checkFirstPost !== undefined) {
            setIsFirstPostFlow(true);
        }
    }, []);
    // ⚡️ DEV TOOLS CHECK
    // Shows if app is running locally in dev mode OR if it's your specific device in production
    const showDevTools = __DEV__ || user?.deviceId === "4bfe2b53-7591-462f-927e-68eedd7a6447";

    useEffect(() => {
        // ⚡️ Check if we've already shown it during this active app session
        if (hasShownThisSession) return;

        // ⚡️ Check how many times we've shown this hint overall
        const hintCount = storage.getNumber('wallet_hint_count2') || 0;

        if (hintCount < 10) {
            hasShownThisSession = true; // Mark as shown for this session
            setShowWalletHint(true);
            storage.set('wallet_hint_count2', hintCount + 1); // Increment lifetime count

            // Start bouncing animation
            hintBounce.value = withRepeat(
                withSequence(
                    withTiming(-8, { duration: 400 }),
                    withTiming(0, { duration: 400 })
                ), -1, true
            );

            // Auto-hide after 8 seconds 
            const hideTimer = setTimeout(() => setShowWalletHint(false), 8000);
            return () => clearTimeout(hideTimer);
        }
    }, []);

    const hintAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: hintBounce.value }]
    }));

    useEffect(() => {
        if (showRestoreUI) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.1, { duration: 500 }),
                    withTiming(1, { duration: 500 })
                ),
                -1,
                true
            );
        } else {
            pulse.value = 1;
        }
    }, [showRestoreUI]);

    const handleRestoreStreak = async () => {
        if (!user?.deviceId) return;

        if (coins < 50) {
            CustomAlert("Insufficient OC", "You need 50 OC 🪙 to revive your streak.");
            return;
        }

        CustomAlert(
            "Revive Streak?",
            "Spend 50 OC to restore your broken streak and keep your progress alive!",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        try {
                            const result = await processTransaction('spend', 'streak_restore');
                            if (!result.success) {
                                CustomAlert("System Notification", result.error || "Unable to restore streak.");
                                return;
                            }
                            const response = await apiFetch("/users/streak/restore", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ deviceId: user.deviceId }),
                            });

                            const streakResult = await response.json();

                            if (!response.ok) {
                                CustomAlert("System Error", streakResult.message || "Streak failed to revive.");
                                processTransaction('refund', 'streak_restore');
                            } else {
                                CustomAlert("Streak Revived!", `50 OC spent. Your ${streakResult.streak} day streak is back!`);
                                refreshStreak();
                                if (refreshUser) refreshUser();
                            }
                        } catch (err) {
                            CustomAlert("Connection Error", "Failed to reach the server.");
                        }
                    }
                }
            ]
        );
    };

    // ⚡️ Intercept the click to immediately hide the hint
    const handleWalletClick = () => {
        setShowWalletHint(false);
        DeviceEventEmitter.emit("navigateSafely", "/screens/Wallet");
    };

    const urgentButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    const healthyFlameStyle = useAnimatedStyle(() => ({
        transform: [{ scale: !showRestoreUI && hasActiveStreak ? pulse.value : 1 }],
    }));

    const logoSrc = isDark
        ? require("../assets/images/logowhite.png")
        : require("../assets/images/og-image.png");

    if (pathName == "/Search") return null;

    return (
        <View className={`flex-row items-center justify-between px-1 pl-4 h-14 ${isDark ? "bg-[#050505] border-b border-blue-900/30" : "bg-white border-b border-gray-200"} z-50`}>
            <Image
                source={logoSrc}
                style={{ width: 94, height: 52, resizeMode: "contain" }}
            />
            <View className="flex-row items-center gap-1 relative">

                {/* ⚡️ WRAPPED WALLET BUTTON IN A RELATIVE CONTAINER */}
                <View className="relative z-50">
                    <TouchableOpacity
                        onPress={handleWalletClick}
                        className={`flex-row items-center pl-1.5 pr-2 py-1 gap-1.5 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
                    >
                        {peakLevel > 0 ? (
                            <View className="mr-0.5">
                                <PeakBadge level={peakLevel} size={20} />
                            </View>
                        ) : null}
                        <View className="flex-col items-end justify-center">
                            <View className="flex-row items-center">
                                <Text className="text-yellow-500 font-black text-[11px] mr-1">{coins || 0}</Text>
                                {isProcessingTransaction ? <ActivityIndicator size={10} color="#ca8a04" /> : <CoinIcon type="OC" size={14} />}
                            </View>
                            {clanCoins > 0 ? (
                                <View className="flex-row items-center mt-[1px]">
                                    <Text style={{ color: isDark ? "#c084fc" : "#9333ea" }} className="font-black text-[11px] mr-1">{clanCoins}</Text>
                                    <CoinIcon type="CC" size={14} />
                                </View>
                            ) : null}
                        </View>
                    </TouchableOpacity>

                    {/* ⚡️ THE FLOATING HUD HINT (UPDATED STYLING) */}
                    {!isFirstPostFlow && showWalletHint && (
                        <Animated.View
                            style={hintAnimatedStyle}
                            className="absolute top-[80%] right-0 items-end z-[100]"
                        >
                            <Ionicons
                                name="caret-up"
                                size={24}
                                color="#f59e0b" // ⚡️ Amber color to match OC
                                style={{
                                    marginBottom: -10,
                                    marginRight: 15,
                                    textShadowColor: 'rgba(245, 158, 11, 0.5)', // Glow effect
                                    textShadowRadius: 6
                                }}
                            />
                            <View
                                style={{ backgroundColor: '#f59e0b', shadowColor: '#f59e0b' }}
                                className="px-4 py-3 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.6)] border border-yellow-300 flex-row items-center min-w-[120px] justify-center"
                            >
                                <Ionicons name="wallet" size={14} color="white" className="mr-1.5" />
                                <Text className="text-white font-black uppercase text-[12px] tracking-widest leading-tight">
                                    Tap To Open{"\n"}Wallet
                                </Text>
                            </View>
                        </Animated.View>
                    )}
                </View>

                {streak ? (
                    <TouchableOpacity
                        disabled={(!showRestoreUI && !hasActiveStreak) || isProcessingTransaction}
                        onPress={showRestoreUI ? handleRestoreStreak : () => CustomAlert("Streak", "Stay active to grow your streak!")}
                        activeOpacity={showRestoreUI ? 0.7 : 1}
                    >
                        <Animated.View
                            style={showRestoreUI ? urgentButtonStyle : {}}
                            className={`px-1.5 py-1 rounded-xl flex-row items-center border-2 ${showRestoreUI ? "bg-red-500/20 border-red-500 animate-pulse" : isZeroStreak ? "bg-gray-500/5 border-gray-500/10" : "bg-orange-500/10 border-orange-500/20 border"}`}
                        >
                            {isProcessingTransaction ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                                <View className="flex-row items-center">
                                    <Animated.View style={healthyFlameStyle}>
                                        <Ionicons
                                            name={showRestoreUI ? "bonfire-outline" : "flame"}
                                            size={showRestoreUI ? 16 : 14}
                                            color={showRestoreUI ? "#ef4444" : isZeroStreak ? "#9ca3af" : "#f97316"}
                                        />
                                    </Animated.View>
                                </View>
                            )}
                            <View className="flex-row items-center ml-0.5">
                                <Text className={`text-[13px] font-black leading-none ${showRestoreUI ? 'text-red-500 text-base' : isZeroStreak ? 'text-gray-400' : isDark ? 'text-white' : 'text-black'}`}>
                                    {showRestoreUI ? streak.recoverableStreak : (streak?.streak || 0)}
                                </Text>
                            </View>
                            {(showRestoreUI && !isProcessingTransaction) ? (
                                <View className="bg-red-500 rounded-full h-1.5 w-1.5 absolute -top-1 -right-1 border border-white" />
                            ) : null}
                        </Animated.View>
                    </TouchableOpacity>
                ) : null}

                <View className="flex-row items-center gap-1">
                    {/* ⚡️ DEV TOOLS BUTTON (Only renders if condition is met) */}
                    {showDevTools && (
                        <>
                            <TouchableOpacity
                                onPress={() => DeviceEventEmitter.emit("navigateSafely", "/DevTools/DevCosmeticSandbox")}
                                className={`p-1.5 rounded-xl border ${isDark ? "bg-purple-500/20 border-purple-500/40" : "bg-purple-100 border-purple-300"}`}
                            >
                                <Ionicons name="flask-outline" size={16} color={isDark ? "#c084fc" : "#9333ea"} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => DeviceEventEmitter.emit("navigateSafely", "/DevTools/MarketingView")}
                                className={`p-1.5 rounded-xl border ${isDark ? "bg-purple-500/20 border-purple-500/40" : "bg-purple-100 border-purple-300"}`}
                            >
                                <Ionicons name="flask-outline" size={16} color={isDark ? "#c084fc" : "#9333ea"} />
                            </TouchableOpacity>
                        </>
                    )}

                    <TouchableOpacity
                        onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/Leaderboard")}
                        className={`p-1.5 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
                    >
                        <Ionicons name="trophy-outline" size={16} color={isDark ? "#60a5fa" : "#111827"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/MoreOptions")}
                        className={`p-1.5 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
                    >
                        <Ionicons name="grid-outline" size={16} color={isDark ? "#60a5fa" : "#111827"} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}