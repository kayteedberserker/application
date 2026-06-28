import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { memo, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    DeviceEventEmitter,
    TouchableOpacity,
    View
} from "react-native";
import { useMMKV } from "react-native-mmkv";
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from "react-native-reanimated";
import { useAlert } from "../context/AlertContext";
import { useCoins } from "../context/CoinContext";
import { useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import CoinIcon from "./ClanIcon";
import AnimatedItemIcon from "./ConsumableSkiaIcon";
import PeakBadge from "./PeakBadge";
import { Text } from "./Text";

let hasShownThisSession = false;

const getFrozenTimeRemaining = (frozenUntil) => {
    if (!frozenUntil) return null;
    const diff = new Date(frozenUntil) - new Date();
    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
};

function TopBar({ isDark }) {
    const storage = useMMKV();
    const CustomAlert = useAlert();
    const { user, refreshUser, streak, loading, refreshStreak } = useUser();
    const { coins, peakLevel } = useCoins();

    // ⚡️ NEW: We manage loading state locally now since we dropped `isProcessingTransaction`
    const [isRestoring, setIsRestoring] = useState(false);

    const pathName = usePathname();

    const pulse = useSharedValue(1);
    const hasActiveStreak = streak?.streak > 0;
    const showRestoreUI = streak?.canRestore;
    const isZeroStreak = !hasActiveStreak && !showRestoreUI;
    const isFrozen = streak?.frozenUntil && new Date(streak.frozenUntil) > new Date();
    // Calculate freeze time on every render
    const frozenTime = useMemo(() => isFrozen ? getFrozenTimeRemaining(streak.frozenUntil) : null, [isFrozen, streak]);

    const [showWalletHint, setShowWalletHint] = useState(false);
    const hintBounce = useSharedValue(0);
    const [isFirstPostFlow, setIsFirstPostFlow] = useState(false);

    useEffect(() => {
        const checkFirstPost = storage.getNumber("trigger_first_post");
        if (checkFirstPost !== 0 && checkFirstPost !== undefined) {
            setIsFirstPostFlow(true);
        }
    }, []);

    const showDevTools = __DEV__ || user?.deviceId === "4bfe2b53-7591-462f-927e-68eedd7a6447";

    useEffect(() => {
        if (hasShownThisSession) return;
        const hintCount = storage.getNumber('wallet_hint_count2') || 0;

        if (hintCount < 10) {
            hasShownThisSession = true;
            setShowWalletHint(true);
            storage.set('wallet_hint_count2', hintCount + 1);

            hintBounce.value = withRepeat(
                withSequence(
                    withTiming(-8, { duration: 400 }),
                    withTiming(0, { duration: 400 })
                ), -1, true
            );

            const hideTimer = setTimeout(() => {
                setShowWalletHint(false);
                cancelAnimation(hintBounce);
            }, 8000);

            return () => {
                clearTimeout(hideTimer);
                cancelAnimation(hintBounce);
            };
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

    // ⚡️ UPDATED RESTORE LOGIC
    const handleRestoreStreak = async () => {
        if (!user?.deviceId || isRestoring) return;

        // Check Inventory for Restore Pass
        const hasRestorePass = user.inventory?.some(i => i.itemId === 'streak_restore');

        // If they have no pass AND no money
        if (!hasRestorePass && coins < 50) {
            CustomAlert("Insufficient OC", "You need 50 OC 🪙 or a Restore Pass to revive your streak.");
            return;
        }

        const alertTitle = hasRestorePass ? "Use Restore Pass?" : "Revive Streak?";
        const alertBody = hasRestorePass
            ? "Consume 1 Streak Restore Pass from your inventory to revive your streak?"
            : "Spend 50 OC to restore your broken streak and keep your progress alive!";

        CustomAlert(
            alertTitle,
            alertBody,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        setIsRestoring(true);
                        try {
                            const response = await apiFetch("/users/streak/restore", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ deviceId: user.deviceId }),
                            });

                            const streakResult = await response.json();

                            if (!response.ok) {
                                CustomAlert("System Error", streakResult.message || "Streak failed to revive.");
                            } else {
                                CustomAlert("Streak Revived!", streakResult.message);
                                refreshStreak();
                                if (refreshUser) refreshUser(); // This ensures the frontend coin balance updates
                            }
                        } catch (err) {
                            CustomAlert("Connection Error", "Failed to reach the server.");
                        } finally {
                            setIsRestoring(false);
                        }
                    }
                }
            ]
        );
    };

    const handleWalletClick = () => {
        setShowWalletHint(false);
        cancelAnimation(hintBounce);
        DeviceEventEmitter.emit("navigateSafely", "/screens/Wallet");
    };

    const urgentButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    const logoSrc = isDark
        ? require("../assets/images/logowhite.png")
        : require("../assets/images/og-image.png");

    if (pathName == "/Search") return null;

    return (
        <View className={`flex-row items-center justify-between px-1 pl-4 h-14 ${isDark ? "bg-[#050505] border-b border-blue-900/30" : "bg-white border-b border-gray-200"} z-50`}>
            <Image
                source={logoSrc}
                style={{ width: 94, height: 52, contentFit: "contain" }}
            />
            <View className="flex-row items-center gap-1 relative">

                <View className="relative z-50">
                    <TouchableOpacity
                        onPress={handleWalletClick}
                        className={`flex-row items-center pl-1.5 pr-2 py-1 px-1 gap-1.5 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
                    >
                        {peakLevel > 0 ? (
                            <View className="mr-0.5">
                                <PeakBadge isFeed={true} level={peakLevel} size={20} />
                            </View>
                        ) : null}
                        <View className="flex-col items-end gap-[1px] justify-center">
                            <View className="flex-row items-center">
                                <Text className="text-yellow-500 font-black text-[11px] mr-1">{coins || 0}</Text>
                                <CoinIcon type="OC" size={14} />
                            </View>
                        </View>
                    </TouchableOpacity>

                    {!isFirstPostFlow && showWalletHint && (
                        <Animated.View
                            style={[hintAnimatedStyle, { position: 'absolute', top: '80%', right: 0, alignItems: 'flex-end', zIndex: 100 }]}
                        >
                            <Ionicons
                                name="caret-up"
                                size={24}
                                color="#f59e0b"
                                style={{
                                    marginBottom: -10,
                                    marginRight: 15,
                                    textShadowColor: 'rgba(245, 158, 11, 0.5)',
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
                        disabled={(!showRestoreUI && !hasActiveStreak) || isRestoring}
                        onPress={showRestoreUI ? handleRestoreStreak : () => CustomAlert("Streak", isFrozen ? `Streak Protected by Freeze Protocol for ${frozenTime}` : "Stay active to grow your streak!")}
                        activeOpacity={0.7}
                    >
                        <Animated.View
                            style={[
                                showRestoreUI ? urgentButtonStyle : {},
                                {
                                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 2, flexDirection: 'row', alignItems: 'center',
                                    // ⚡️ Logic: Restore (Red) > Frozen (Cyan/Blue) > Zero (Grey) > Active (Orange)
                                    backgroundColor: isFrozen ? 'rgba(6, 182, 212, 0.2)' : showRestoreUI ? 'rgba(239,68,68,0.2)' : isZeroStreak ? 'rgba(107,114,128,0.05)' : 'rgba(249,115,22,0.1)',
                                    borderColor: isFrozen ? '#06b6d4' : showRestoreUI ? '#ef4444' : isZeroStreak ? 'rgba(107,114,128,0.1)' : 'rgba(249,115,22,0.2)'
                                }
                            ]}
                        >
                            {isRestoring ? <ActivityIndicator size="small" color="#ef4444" /> : (
                                <View className="flex-row items-center">
                                    {isFrozen ? (
                                        <AnimatedItemIcon itemId="streak_freeze" primaryColor="#06b6d4" secondaryColor="#bae6fd" size={20} />
                                    ) : (
                                        <Ionicons
                                            name={showRestoreUI ? "bonfire-outline" : "flame"}
                                            size={showRestoreUI ? 16 : 14}
                                            color={showRestoreUI ? "#ef4444" : isZeroStreak ? "#9ca3af" : "#f97316"}
                                        />
                                    )}
                                    <Text className={`ml-1 text-[13px] font-black leading-none ${isFrozen ? 'text-cyan-400' : showRestoreUI ? 'text-red-500' : isZeroStreak ? 'text-gray-400' : 'text-orange-500'}`}>
                                        {showRestoreUI ? streak.recoverableStreak : (streak?.streak || 0)}
                                    </Text>
                                </View>
                            )}
                        </Animated.View>
                    </TouchableOpacity>
                ) : null}

                <View className="flex-row items-center gap-1">
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

export default memo(TopBar);