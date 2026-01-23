import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    TouchableOpacity,
    View,
} from "react-native";
import { useRewardedAd } from 'react-native-google-mobile-ads';
import Animated, {
    FadeInRight,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from "react-native-reanimated";
import { useStreak } from "../context/StreakContext";
import { useUser } from "../context/UserContext";
import { AdConfig } from "../utils/AdConfig";
import { Text } from "./Text";

const TopBar = ({ isDark }) => {
    const router = useRouter();
    const { streak, loading, refreshStreak } = useStreak();
    const { user } = useUser();
    const [isRestoring, setIsRestoring] = useState(false);

    // Shared value for animations
    const pulse = useSharedValue(1);

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

    // UI Logic states
    const hasActiveStreak = streak?.streak > 0;
    const showRestoreUI = streak?.canRestore;
    const isZeroStreak = !hasActiveStreak && !showRestoreUI;

    // Animation Style for the WHOLE button (Warning/Urgent mode)
    const urgentButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: showRestoreUI ? pulse.value : 1 }],
    }));

    // Animation Style for ONLY the flame (Healthy/Active mode)
    const healthyFlameStyle = useAnimatedStyle(() => ({
        transform: [{ scale: !showRestoreUI && hasActiveStreak ? pulse.value : 1 }],
    }));

    const {
        isLoaded,
        isEarnedReward,
        isClosed,
        load,
        show,
    } = useRewardedAd(AdConfig.rewarded, {
        requestNonPersonalizedAdsOnly: true,
    });

    useEffect(() => {
        load();
    }, [load]);

    // Handle the restoration logic
    useEffect(() => {
        const handleRestore = async () => {
            if (isEarnedReward && isClosed && user?.deviceId) {
                try {
                    setIsRestoring(true);
                    const response = await fetch("https://oreblogda.com/api/users/streak/restore", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ deviceId: user.deviceId }),
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        Alert.alert("System Notification", result.message || "Unable to restore streak.");
                    } else {
                        Alert.alert("Streak Revived!", `Your ${result.streak} day streak is back from the dead.`);
                        refreshStreak();
                    }
                } catch (err) {
                    console.log("Restore streak error:", err);
                    Alert.alert("Connection Error", "Failed to reach the server.");
                } finally {
                    setIsRestoring(false);
                }
            }
        };

        handleRestore();
    }, [isEarnedReward, isClosed]);

    useEffect(() => {
        if (isClosed) load();
    }, [isClosed, load]);

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
                {/* LOGO - Adjusted width slightly to make space */}
                <Image
                    source={logoSrc}
                    style={{ width: 110, height: 32, resizeMode: "contain" }}
                />

                {/* RIGHT SIDE TOOLS - Reduced gap to fit search */}
                <View className="flex-row items-center gap-2">
                    
                    {/* 🏆 LEADERBOARD */}
                    <TouchableOpacity
                        onPress={() => router.push("/screens/Leaderboard")}
                        className={`p-1.5 rounded-xl ${isDark ? "bg-blue-500/10 border border-blue-500/20" : "bg-gray-100"}`}
                    >
                        <Ionicons
                            name="trophy-outline"
                            size={18}
                            color={isDark ? "#60a5fa" : "#111827"}
                        />
                    </TouchableOpacity>

                    {/* 🔍 SEARCH - NEW ICON */}
                    <TouchableOpacity
                        onPress={() => router.push("/screens/Search")}
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
                                disabled={!showRestoreUI || isRestoring}
                                onPress={() => isLoaded ? show() : load()}
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
                                    {isRestoring || (showRestoreUI && !isLoaded) ? (
                                        <ActivityIndicator size="small" color={showRestoreUI ? "#ef4444" : "#f97316"} />
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
                                                    <Ionicons name="add-circle" size={10} color="#ef4444" />
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
                                                RESTORE
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

                    {/* MENU */}
                    <TouchableOpacity
                        onPress={() => router.push("/screens/MoreOptions")}
                        className={`p-1.5 rounded-xl ${isDark ? "bg-blue-500/10 border border-blue-500/20" : "bg-gray-100"}`}
                    >
                        <Ionicons
                            name="grid-outline"
                            size={18}
                            color={isDark ? "#60a5fa" : "#111827"}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default TopBar;
