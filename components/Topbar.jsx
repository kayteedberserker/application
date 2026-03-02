import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    DeviceEventEmitter,
    Image,
    SafeAreaView,
    TouchableOpacity,
    View
} from "react-native";
import Animated, {
    FadeInRight,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from "react-native-reanimated";
import { useAlert } from "../context/AlertContext";
import { useStreak } from "../context/StreakContext";
import { useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import CoinIcon from "./ClanIcon";
import { Text } from "./Text";

const TopBar = ({ isDark }) => {
    const CustomAlert = useAlert();
    const router = useRouter();
    const { streak, loading, refreshStreak } = useStreak();
    const { user, refreshUser } = useUser();
    
    // UI Logic states
    const [isRestoring, setIsRestoring] = useState(false);

    // Shared value for animations
    const pulse = useSharedValue(1);

    // UI Logic helpers
    const hasActiveStreak = streak?.streak > 0;
    const showRestoreUI = streak?.canRestore;
    const isZeroStreak = !hasActiveStreak && !showRestoreUI;

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 500 }),
                withTiming(1, { duration: 500 })
            ),
            -1,
            true
        );
    }, []);

    const handleRestoreStreak = async () => {
        // 🛑 Placeholder for Coin Logic
        if (!user?.deviceId) return;

        if ((user?.coins || 0) < 30) {
            CustomAlert("Insufficient OC", "You need 30 OC 🪙 to revive your streak. Check back daily!");
            return;
        }
        
        try {
            setIsRestoring(true);
            const response = await apiFetch("/users/streak/restore-with-coins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId: user.deviceId }),
            });

            const result = await response.json();

            if (!response.ok) {
                CustomAlert("System Notification", result.message || "Unable to restore streak.");
            } else {
                CustomAlert("Streak Revived!", `30 OC spent. Your ${result.streak} day streak is back!`);
                refreshStreak();
                if (refreshUser) refreshUser(); // Update coin balance in global state
            }
        } catch (err) {
            console.log("Restore streak error:", err);
            CustomAlert("Connection Error", "Failed to reach the server.");
        } finally {
            setIsRestoring(false);
        }
    };

    const urgentButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: showRestoreUI ? pulse.value : 1 }],
    }));

    const healthyFlameStyle = useAnimatedStyle(() => ({
        transform: [{ scale: !showRestoreUI && hasActiveStreak ? pulse.value : 1 }],
    }));

    const logoSrc = isDark
        ? require("../assets/images/logowhite.png")
        : require("../assets/images/og-image.png");

    return (
        <SafeAreaView
            className={isDark ? "bg-[#050505]" : "bg-white"}
            style={{ zIndex: 100 }}
        >
            <View
                className={`flex-row items-center justify-between px-3 h-16 ${isDark
                    ? "bg-[#050505] border-b border-blue-900/30"
                    : "bg-white border-b border-gray-200"
                    }`}
            >
                <Image
                    source={logoSrc}
                    style={{ width: 105, height: 32, resizeMode: "contain" }}
                />

                {/* Main Action Container with adjusted spacing */}
                <View className="flex-row items-center gap-1.5">
                    
                    {/* 🪙 ORE COIN (OC) HUD - Retained design with added navigation logic */}
                    <TouchableOpacity 
                        onPress={() => {
                            // CustomAlert placeholder replaced with navigation logic for the future
                            DeviceEventEmitter.emit("navigateSafely", "/screens/Wallet"); 
                        }}
                        className={`flex-row items-center px-2 py-1.5 rounded-xl border ${
                            isDark 
                            ? "bg-yellow-500/10 border-yellow-500/20" 
                            : "bg-yellow-50 border-yellow-200"
                        }`}
                    >
                        <Text className="text-yellow-600 dark:text-yellow-400 font-black text-[13px] mr-1">
                            {user?.coins || 0}
                        </Text>
                        <CoinIcon type="OC" size={15} />
                    </TouchableOpacity>

                    {/* 🔍 SEARCH */}
                    <TouchableOpacity
                        onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/Search")}
                        className={`p-1.5 rounded-xl ${isDark ? "bg-blue-500/10 border border-blue-500/20" : "bg-gray-100"}`}
                    >
                        <Ionicons
                            name="search-outline"
                            size={18}
                            color={isDark ? "#60a5fa" : "#111827"}
                        />
                    </TouchableOpacity>

                    {/* 🔥 STREAK / 🏥 RESTORE HUD */}
                    {!loading && (
                        <Animated.View entering={FadeInRight}>
                            <TouchableOpacity
                                disabled={(!showRestoreUI && !hasActiveStreak) || isRestoring}
                                onPress={showRestoreUI ? handleRestoreStreak : () => CustomAlert("Streak", "Keep your daily streak alive by staying active!")}
                                activeOpacity={showRestoreUI ? 0.7 : 1}
                            >
                                <Animated.View 
                                    style={urgentButtonStyle}
                                    className={`px-2 py-1.5 rounded-full flex-row items-center gap-1.5 border ${
                                        showRestoreUI 
                                        ? "bg-red-950/40 border-red-500/50" 
                                        : isZeroStreak 
                                        ? "bg-gray-500/10 border-gray-500/20"
                                        : "bg-orange-500/10 border-orange-500/30"
                                    }`}
                                >
                                    {isRestoring ? (
                                        <ActivityIndicator size="small" color="#ef4444" />
                                    ) : (
                                        <View className="flex-row items-center">
                                            <Animated.View style={healthyFlameStyle}>
                                                <Ionicons
                                                    name="flame"
                                                    size={14}
                                                    color={
                                                        showRestoreUI ? "#ef4444" : 
                                                        isZeroStreak ? "#9ca3af" : "#f97316"
                                                    }
                                                    style={{ opacity: (showRestoreUI || isZeroStreak) ? 0.6 : 1 }}
                                                />
                                            </Animated.View>
                                            {showRestoreUI && (
                                                <View style={{ marginLeft: -5, marginTop: -6 }}>
                                                    <Ionicons name="refresh-circle" size={10} color="#ef4444" />
                                                </View>
                                            )}
                                        </View>
                                    )}
                                    
                                    <View className="flex-col leading-none">
                                        <Text className={`text-[11px] font-black leading-tight ${
                                            showRestoreUI ? 'text-red-500' : 
                                            isZeroStreak ? 'text-gray-400' :
                                            isDark ? 'text-white' : 'text-black'
                                        }`}>
                                            {showRestoreUI ? streak.recoverableStreak : (streak?.streak || 0)}
                                        </Text>
                                        {showRestoreUI && !isRestoring && (
                                            <Text className="text-[6px] font-bold text-red-400 tracking-tighter -mt-1 uppercase">
                                                -30 OC
                                            </Text>
                                        )}
                                        {isZeroStreak && (
                                            <Text className="text-[6px] font-bold text-gray-500 tracking-tighter -mt-1 uppercase">
                                                STREAK
                                            </Text>
                                        )}
                                    </View>
                                </Animated.View>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* Utility Icons (Grouped slightly for balance) */}
                    <View className="flex-row items-center gap-1">
                        {/* 🏆 LEADERBOARD */}
                        <TouchableOpacity
                            onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/Leaderboard")}
                            className={`p-1.5 rounded-xl border ${isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-gray-100 border-gray-200"}`}
                        >
                            <Ionicons
                                name="trophy-outline"
                                size={17}
                                color={isDark ? "#60a5fa" : "#111827"}
                            />
                        </TouchableOpacity>

                        {/* 🔍 SEARCH */}
                        <TouchableOpacity
                            onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/Search")}
                            className={`p-1.5 rounded-xl border ${isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-gray-100 border-gray-200"}`}
                        >
                            <Ionicons
                                name="search-outline"
                                size={17}
                                color={isDark ? "#60a5fa" : "#111827"}
                            />
                        </TouchableOpacity>

                        {/* MENU */}
                        <TouchableOpacity
                            onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/MoreOptions")}
                            className={`p-1.5 rounded-xl border ${isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-gray-100 border-gray-200"}`}
                        >
                            <Ionicons
                                name="grid-outline"
                                size={17}
                                color={isDark ? "#60a5fa" : "#111827"}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default TopBar;