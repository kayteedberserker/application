import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    DeviceEventEmitter,
    Image,
    SafeAreaView,
    TouchableOpacity,
    View,
} from "react-native";
// 🔹 Standard LevelPlay import
import Animated, {
    FadeInRight,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from "react-native-reanimated";
import { LevelPlayRewardedAd } from 'unity-levelplay-mediation';
import { useStreak } from "../context/StreakContext";
import { useUser } from "../context/UserContext";
import { AdConfig } from "../utils/AdConfig";
import apiFetch from "../utils/apiFetch";
import { Text } from "./Text";

const REWARDED_ID = String(AdConfig.rewarded || "0");

const TopBar = ({ isDark }) => {
    const router = useRouter();
    const { streak, loading, refreshStreak } = useStreak();
    const { user } = useUser();
    
    // UI Logic states
    const [isRestoring, setIsRestoring] = useState(false);
    const [isAdLoaded, setIsAdLoaded] = useState(false);
    const [isAdShowing, setIsAdShowing] = useState(false);

    // 🛠️ Refs to store the Ad Instance and Retry Timer
    const rewardedAdRef = useRef(null);
    const retryTimerRef = useRef(null);

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

    // 🔹 LEVELPLAY REWARDED LOGIC - WITH RETRY MECHANISM
    useEffect(() => {
        if (REWARDED_ID === "0") return;

        // 1. Create the instance
        const rewardedAd = new LevelPlayRewardedAd(REWARDED_ID);
        rewardedAdRef.current = rewardedAd;

        const checkAvailability = async () => {
            try {
                // Use isAdReady() as defined in your library snippet
                const available = await rewardedAd.isAdReady();
                setIsAdLoaded(available);
            } catch (e) {
                console.log("Ad availability check failed:", e);
            }
        };

        const listener = {
            onAdLoaded: (adInfo) => {
                console.log("Rewarded Ad Loaded (Internal Callback)");
                setIsAdLoaded(true);
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            },
            onAdLoadFailed: (error) => {
                console.warn("Rewarded Ad Load Failed:", error?.errorMessage);
                setIsAdLoaded(false);
                
                // 🔄 RETRY LOGIC: If "No Fill", try again in 10 seconds
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(() => {
                    console.log("Retrying to load Rewarded Ad...");
                    rewardedAd.loadAd();
                }, 10000); 
            },
            onAdAvailable: (adInfo) => {
                console.log("Rewarded Ad Available");
                setIsAdLoaded(true);
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            },
            onAdUnavailable: () => {
                console.log("Rewarded Ad Unavailable");
                setIsAdLoaded(false);
            },
            onAdRewarded: (reward, adInfo) => {
                console.log("User earned reward");
                handleRestoreStreak();
            },
            onAdClosed: (adInfo) => {
                console.log("Rewarded Ad Closed");
                setIsAdShowing(false);
                // Reload ad for next time
                rewardedAd.loadAd();
            },
            onAdShowFailed: (error, adInfo) => {
                console.error("Rewarded Show Failed:", error?.errorMessage);
                setIsAdShowing(false);
                Alert.alert("Ad Error", "Could not play the video. Please try again.");
                // Try to reload after show failure
                rewardedAd.loadAd();
            },
            onAdClicked: (reward, adInfo) => console.log("Ad Clicked"),
            onAdOpened: (adInfo) => setIsAdShowing(true),
        };

        // 2. Set listener on the instance
        rewardedAd.setListener(listener);

        // 3. Load the ad
        rewardedAd.loadAd();

        // Initial check
        checkAvailability();

        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            // Cleanup if your library supports it
            if (rewardedAd.remove) {
                try {
                    rewardedAd.remove();
                } catch(e) {
                    console.log("Cleanup error:", e);
                }
            }
        };
    }, []);

    const handleRestoreStreak = async () => {
        if (!user?.deviceId) return;
        
        try {
            setIsRestoring(true);
            const response = await apiFetch("/users/streak/restore", {
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
    };

    const handleShowAd = async () => {
        const adInstance = rewardedAdRef.current;
        if (!adInstance) {
            Alert.alert("Error", "Ad system not initialized.");
            return;
        }

        const canShow = await adInstance.isAdReady();
        if (canShow) {
            adInstance.showAd("");
        } else {
            console.log("Ad not ready yet. Attempting reload.");
            adInstance.loadAd();
        }
    };

    // UI Logic helpers
    const hasActiveStreak = streak?.streak > 0;
    const showRestoreUI = streak?.canRestore;
    const isZeroStreak = !hasActiveStreak && !showRestoreUI;

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
                    style={{ width: 110, height: 32, resizeMode: "contain" }}
                />

                <View className="flex-row items-center gap-2">
                    
                    {/* 🏆 LEADERBOARD */}
                    <TouchableOpacity
                        onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/Leaderboard")}
                        className={`p-1.5 rounded-xl ${isDark ? "bg-blue-500/10 border border-blue-500/20" : "bg-gray-100"}`}
                    >
                        <Ionicons
                            name="trophy-outline"
                            size={18}
                            color={isDark ? "#60a5fa" : "#111827"}
                        />
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
                                disabled={!showRestoreUI || isRestoring || isAdShowing}
                                onPress={handleShowAd}
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
                                    {/* 🔄 LOADING ANIMATION (Applied when ad or restoration is pending) */}
                                    {isRestoring || (showRestoreUI && !isAdLoaded) ? (
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
                        onPress={() => DeviceEventEmitter.emit("navigateSafely", "/screens/MoreOptions")}
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