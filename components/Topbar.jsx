import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { useEffect } from "react";
import {
    ActivityIndicator,
    DeviceEventEmitter,
    TouchableOpacity,
    View
} from "react-native";
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
import { Text } from "./Text";

const TopBar = ({ isDark }) => {
    const CustomAlert = useAlert();
    const { streak, loading, refreshStreak } = useStreak();
    const { user, refreshUser } = useUser();
    const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins(); 
    const pathName = usePathname();

    const pulse = useSharedValue(1);
    const hasActiveStreak = streak?.streak > 0;
    const showRestoreUI = streak?.canRestore;
    const isZeroStreak = !hasActiveStreak && !showRestoreUI;

    // Start pulsing animation if streak needs restoration
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

        // Confirmation Dialog
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
        <View className={`flex-row items-center justify-between px-2 h-16 ${
            isDark ? "bg-[#050505] border-b border-blue-900/30" : "bg-white border-b border-gray-200"
        }`}>
            <Image
                source={logoSrc}
                style={{ width: 90, height: 32, resizeMode: "contain" }}
            />

            <View className="flex-row items-center gap-1.5">

                {/* 🪙 COIN HUD */}
                <TouchableOpacity 
                    onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/Wallet")}
                    className={`flex-row items-center px-2 py-1.5 gap-2 rounded-xl border ${
                        isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                    }`}
                >
                    <View className="flex-row items-center gap-1.5">
                        <View className="flex-col items-end">
                            <View className="flex-row items-center">
                                <Text className="text-yellow-500 font-black text-[12px] mr-1">{coins || 0}</Text>
                                {isProcessingTransaction ? <ActivityIndicator size={10} color="#ca8a04" /> : <CoinIcon type="OC" size={12} />}
                            </View>
                            {clanCoins > 0 && (
                                <View className="flex-row items-center -mt-0.5">
                                    <Text style={{color: isDark ? "#c084fc" : "#9333ea"}} className="font-black text-[12px] mr-1">{clanCoins}</Text>
                                    <CoinIcon type="CC" size={12} />
                                </View>
                            )}
                        </View>
                        <View className="bg-yellow-500 rounded-lg p-0.5 shadow-sm">
                            <Ionicons name="add" size={12} color="black" />
                        </View>
                    </View>
                </TouchableOpacity>

                {/* 🔥 STREAK HUD */}
                {!loading && (
                    <TouchableOpacity
                        disabled={(!showRestoreUI && !hasActiveStreak) || isProcessingTransaction}
                        onPress={showRestoreUI ? handleRestoreStreak : () => CustomAlert("Streak", "Stay active to grow your streak!")}
                        activeOpacity={showRestoreUI ? 0.7 : 1}
                    >
                        <Animated.View 
                            style={showRestoreUI ? urgentButtonStyle : {}}
                            className={`px-1 py-1.5 rounded-xl flex-row items-center border-2 ${
                                showRestoreUI 
                                    ? "bg-red-500/20 border-red-500 animate-pulse" 
                                    : isZeroStreak 
                                        ? "bg-gray-500/5 border-gray-500/10" 
                                        : "bg-orange-500/10 border-orange-500/20 border"
                            }`}
                        >
                            {isProcessingTransaction ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                                <View className="flex-row items-center">
                                    <Animated.View style={healthyFlameStyle}>
                                        <Ionicons
                                            name={showRestoreUI ? "bonfire-outline" : "flame"}
                                            size={showRestoreUI ? 18 : 16}
                                            color={showRestoreUI ? "#ef4444" : isZeroStreak ? "#9ca3af" : "#f97316"}
                                        />
                                    </Animated.View>
                                </View>
                            )}

                            <View className="flex-row items-center">
                                <Text className={`text-[15px] font-black leading-none ${
                                    showRestoreUI ? 'text-red-500 text-lg' : isZeroStreak ? 'text-gray-400' : isDark ? 'text-white' : 'text-black'
                                }`}>
                                    {showRestoreUI ? streak.recoverableStreak : (streak?.streak || 0)}
                                </Text>
                            </View>

                            {showRestoreUI && !isProcessingTransaction && (
                                <View className="bg-red-500 rounded-full h-2 w-2 absolute -top-1 -right-1 border border-white" />
                            )}
                        </Animated.View>
                    </TouchableOpacity>
                )}

                <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                        onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/Leaderboard")}
                        className={`p-2 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
                    >
                        <Ionicons name="trophy-outline" size={18} color={isDark ? "#60a5fa" : "#111827"} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/MoreOptions")}
                        className={`p-2 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
                    >
                        <Ionicons name="grid-outline" size={18} color={isDark ? "#60a5fa" : "#111827"} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default TopBar;