import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useColorScheme as useNativeWind } from "nativewind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Clipboard,
    Dimensions,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    TouchableOpacity,
    View
} from "react-native";
import { useMMKV } from "react-native-mmkv";
import Animated, {
    Easing as ReanimatedEasing,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";

import { useLocalSearchParams } from "expo-router";
import ClanBorder from "../../components/ClanBorder";
import ClanIcon from "../../components/ClanIcon";
import { Text } from "../../components/Text";
import TopBar from "../../components/Topbar";
import THEME from "../../components/useAppTheme";
import { useAlert } from "../../context/AlertContext";
import { useCoins } from "../../context/CoinContext";
import { useEvent } from "../../context/EventContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";

// ⚡️ Imports PlayerCard for the Preview Modal
import LottieView from "lottie-react-native";
import PlayerCard from "../../components/PlayerCard";

const { width } = Dimensions.get('window');
const CACHE_KEY = "referral_event_cache_v4";
// ⚡️ FIXED: Using new _v2 keys so it doesn't collide with the old single-array cache
const GACHA_POOLS_CACHE_KEY = "gacha_pools_cache_v2";
const GACHA_OWNED_CACHE_KEY = "gacha_owned_cache_v2";
const GACHA_PITY_CACHE_KEY = "gacha_pity_cache_v2";
const GACHA_POINTS_CACHE_KEY = "gacha_points_cache_v2";

// ==========================================
// ⚡️ HELPER: CRASH-SAFE SVG ICON
// ==========================================
const RemoteSvgIcon = ({ xml, lottieUrl, lottieJson, size = 50, color }) => {
    // ⚡️ 1. Lottie Animation Check
    if (lottieJson || lottieUrl) {
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <LottieView
                    source={lottieJson ? lottieJson : { uri: lottieUrl }}
                    autoPlay
                    loop
                    // Scaling it slightly (1.2) ensures it fills the bounding box nicely just like the SVGs do
                    style={{ width: size * 1.2, height: size * 1.2 }}
                    resizeMode="contain"
                    renderMode="hardware"
                />
            </View>
        );
    }

    // ⚡️ 2. Strict SVG Check (Prevents 'push of null' crashes)
    if (!xml || typeof xml !== 'string' || !xml.includes('<svg')) {
        return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    }

    // ⚡️ 3. Render Valid SVG
    return <SvgXml xml={xml.replace(/currentColor/g, color || 'white')} width={size} height={size} />;
};

// ==========================================
// ⚡️ HELPER: RARITY COLOR MAPPER
// ==========================================
const getRarityColor = (rarity) => {
    switch (rarity?.toUpperCase()) {
        case 'MYTHIC': return '#ef4444'; // Red
        case 'LEGENDARY': return '#fbbf24'; // Gold
        case 'EPIC': return '#a855f7'; // Purple
        case 'RARE': return '#3b82f6'; // Blue
        case 'COMMON': default: return '#9ca3af'; // Gray
    }
};

// ==========================================
// ⚡️ HELPER: NEON HUD COUNTDOWN TIMER
// ==========================================
const EventCountdown = ({ endsAt, onExpire, themeColor = "#f59e0b" }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (!endsAt) return;

        const calculateTime = () => {
            const now = new Date().getTime();
            const target = new Date(endsAt).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setIsExpired(true);
                setTimeLeft('ARCHIVED');
                if (onExpire) onExpire(true);
                return false;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft(`${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
            return true;
        };

        if (calculateTime()) {
            const interval = setInterval(calculateTime, 1000);
            return () => clearInterval(interval);
        }
    }, [endsAt]);

    if (!endsAt) return null;

    const displayColor = isExpired ? "#ef4444" : themeColor;

    return (
        <View
            style={{ backgroundColor: `${displayColor}15`, borderBottomColor: displayColor, borderLeftColor: displayColor }}
            className="flex-row items-center px-4 py-1.5 rounded-bl-xl border-b-2 border-l-2 absolute top-0 right-0 z-20"
        >
            <MaterialCommunityIcons name={isExpired ? "timer-off-outline" : "timer-sand"} size={12} color={displayColor} />
            <Text style={{ color: displayColor }} className="text-[10px] font-black uppercase ml-1.5 tracking-[0.2em]">
                {timeLeft}
            </Text>
        </View>
    );
};

// ==========================================
// ⚡️ COMPONENT: UNIFIED PREVIEW MODAL
// ==========================================
const EventItemPreviewModal = ({
    isVisible,
    onClose,
    currentUser,
    previewItem,
    tierDropRates,
    isDark,
    actionType = "preview",
    onAction,
    isProcessing,
    eventPoints = 0,
    tokenVisual, // ⚡️ ADDED: Token Visual Data
    tokenName    // ⚡️ ADDED: Token Name
}) => {
    const previewUser = useMemo(() => {
        if (!currentUser || !previewItem) return null;
        const filteredInventory = (currentUser.inventory || []).map(item => {
            if (item.category === previewItem.category) return { ...item, isEquipped: false };
            return item;
        });
        const normalizedProduct = {
            ...previewItem,
            isEquipped: true,
            visualConfig: previewItem.visualConfig || previewItem.visualData || {}
        };
        return { ...currentUser, inventory: [...filteredInventory, normalizedProduct] };
    }, [currentUser, previewItem]);

    if (!isVisible || !previewItem) return null;

    const rarity = previewItem.rarity?.toUpperCase() || 'COMMON';
    const rarityColor = getRarityColor(rarity);
    const isCosmetic = ['BORDER', 'GLOW', 'BADGE', 'WATERMARK', 'BACKGROUND'].includes(previewItem.category);

    const tierRate = tierDropRates[rarity] || 0;
    const displayRate = previewItem.keepBaseRate ? previewItem.baseDropRate : tierRate;
    const rateLabel = previewItem.keepBaseRate ? "Acquisition Rate" : "Tier Acquisition Rate";

    const price = previewItem.exchangePrice || 0;
    const canAfford = eventPoints >= price;

    return (
        <Modal visible={isVisible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/90 items-center justify-center px-6 z-50" onPress={onClose}>

                {/* ⚡️ FIXED: Added max-h-[85%] to prevent screen overflow, and stopped propagation so tapping the card doesn't close it */}
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    style={{ borderColor: rarityColor }}
                    className="w-full max-h-[85%] bg-[#0f172a] rounded-3xl border-2 shadow-2xl overflow-hidden"
                >
                    <TouchableOpacity onPress={onClose} className="absolute top-4 right-4 z-20 p-2 bg-white/10 rounded-full">
                        <Ionicons name="close" size={20} color="white" />
                    </TouchableOpacity>

                    {/* ⚡️ FIXED: Inner content is now scrollable! */}
                    <ScrollView
                        contentContainerStyle={{ padding: 24, paddingTop: 40, alignItems: 'center' }}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        <View className="flex-row items-center justify-center mb-6">
                            <MaterialCommunityIcons name="star-four-points" size={16} color={rarityColor} />
                            <Text style={{ color: rarityColor }} className="font-black tracking-[0.4em] uppercase text-[10px] ml-2 mt-1">
                                {rarity} ITEM
                            </Text>
                        </View>

                        <View style={{ backgroundColor: `${rarityColor}15`, borderColor: `${rarityColor}50` }} className="w-full min-h-[160px] rounded-2xl items-center justify-center border-2 mb-6 py-6 overflow-hidden">
                            {isCosmetic ? (
                                <View style={{ transform: [{ scale: 0.85 }] }}>
                                    <PlayerCard author={previewUser} isDark={isDark} />
                                </View>
                            ) : (
                                <RemoteSvgIcon lottieUrl={previewItem.visualConfig?.lottieUrl}
                                    lottieJson={previewItem.visualConfig?.lottieJson} xml={previewItem.visualConfig?.svgCode} size={80} color={previewItem.visualConfig?.primaryColor} />
                            )}
                        </View>

                        <Text className="text-white text-2xl font-black italic uppercase text-center mb-2">{previewItem.name}</Text>

                        <View className="flex-row items-center flex-wrap justify-center gap-2 mb-6">
                            <View style={{ backgroundColor: `${rarityColor}20` }} className="px-3 py-1.5 rounded-md">
                                <Text style={{ color: rarityColor }} className="text-[10px] font-black uppercase tracking-widest">{previewItem.category}</Text>
                            </View>
                            {previewItem.expiresInDays && (
                                <View className="px-3 py-1.5 bg-orange-500/20 rounded-md border border-orange-500/30">
                                    <Text className="text-orange-500 text-[10px] font-black uppercase tracking-widest">{previewItem.expiresInDays} Day Duration</Text>
                                </View>
                            )}
                            {previewItem.rewardAmount && (
                                <View className="px-3 py-1.5 bg-green-500/20 rounded-md border border-green-500/30">
                                    <Text className="text-green-500 text-[10px] font-black uppercase tracking-widest">Yields: {previewItem.rewardAmount} OC</Text>
                                </View>
                            )}
                        </View>

                        <View className="w-full bg-black/40 rounded-xl p-4 items-center border border-white/5 mb-2">
                            <Text className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-1">{rateLabel}</Text>
                            <Text style={{ color: rarityColor }} className="text-xl font-black">{displayRate?.toFixed(2)}%</Text>
                        </View>
                    </ScrollView>

                    {/* ⚡️ FIXED: The Action buttons are pinned to the bottom of the card, outside the ScrollView */}
                    <View className="p-6 pt-2 bg-[#0f172a]">
                        {actionType === "exchange" ? (
                            <TouchableOpacity
                                disabled={isProcessing || !canAfford}
                                onPress={() => onAction(previewItem)}
                                style={{ backgroundColor: canAfford ? rarityColor : '#334155' }}
                                className="w-full py-4 rounded-xl items-center justify-center shadow-lg"
                            >
                                {isProcessing ? <ActivityIndicator color="black" /> : (
                                    <View className="flex-row items-center justify-center">
                                        <Text className="text-slate-900 font-black uppercase tracking-[0.1em] text-sm mr-2">Exchange for {price}</Text>

                                        {/* Shows Token Image on the Exchange Button! */}
                                        {tokenVisual ? (
                                            <RemoteSvgIcon lottieUrl={tokenVisual.lottieUrl} lottieJson={tokenVisual.lottieJson} xml={tokenVisual.svgCode} size={18} color="#0f172a" />
                                        ) : (
                                            <Text className="text-slate-900 font-black uppercase tracking-[0.1em] text-sm">{tokenName || 'Tokens'}</Text>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={onClose} style={{ backgroundColor: rarityColor }} className="w-full py-4 rounded-xl items-center justify-center">
                                <Text className="text-slate-900 font-black uppercase tracking-[0.2em] text-sm">Close Intel</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                </Pressable>
            </Pressable>
        </Modal>
    );
};

// ==========================================
// ⚡️ COMPONENT: EXCHANGE MODAL
// ==========================================
const ExchangeModal = ({ isVisible, onClose, gachaPool, eventPoints, ownedIds, onSelectItem, themeColor, tokenVisual, tokenName }) => {
    return (
        <Modal visible={isVisible} animationType="slide" transparent={true}>
            <View className="flex-1 bg-black/95 justify-end">
                <View className="bg-[#0f172a] h-[85%] rounded-t-[40px] border-t border-slate-800 p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-white text-2xl font-black uppercase italic tracking-tighter">Point Exchange</Text>
                            <View className="flex-row items-center mt-1">
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Balance: </Text>
                                <Text style={{ color: themeColor }} className="text-[10px] font-black mr-1">{eventPoints}</Text>

                                {/* ⚡️ NEW: Shows Token Image in Header Balance */}
                                {tokenVisual ? (
                                    <RemoteSvgIcon lottieUrl={tokenVisual.lottieUrl} lottieJson={tokenVisual.lottieJson} xml={tokenVisual.svgCode} size={14} color={themeColor} />
                                ) : (
                                    <Text style={{ color: themeColor }} className="text-[10px] font-black">{tokenName || 'Tokens'}</Text>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-white/10 rounded-full">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                        <View className="flex-row flex-wrap justify-between">
                            {gachaPool.filter(i => !['EVENT_POINT', 'CONSUMABLE'].includes(i.category)).map((item) => {
                                const isOwned = ownedIds.includes(item.id);
                                const price = item.exchangePrice || 0;
                                const rarityColor = getRarityColor(item.rarity);
                                const canAfford = eventPoints >= price;

                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => onSelectItem(item)}
                                        style={{ width: '48%', borderColor: isOwned ? '#22c55e40' : `${rarityColor}30`, backgroundColor: isOwned ? '#22c55e05' : `${rarityColor}05` }}
                                        className="mb-4 rounded-2xl border-2 p-4 items-center"
                                    >
                                        <View className="w-16 h-16 items-center justify-center mb-3">
                                            {item.category === 'BORDER' ? (
                                                <ClanBorder animationType={item.visualConfig?.animationType} color={item.visualConfig?.primaryColor}>
                                                    <View className="w-10 h-10 flex items-center text-center justify-center">
                                                        <Text className="text-xs">FRAME</Text>
                                                    </View>
                                                </ClanBorder>
                                            ) : (
                                                <RemoteSvgIcon lottieUrl={item.visualConfig?.lottieUrl} lottieJson={item.visualConfig?.lottieJson} xml={item.visualConfig?.svgCode} size={45} color={item.visualConfig?.primaryColor} />
                                            )}
                                        </View>

                                        <Text style={{ color: isOwned ? '#22c55e' : 'white' }} className="font-black text-[11px] uppercase text-center mb-2" numberOfLines={1}>
                                            {item.name}
                                        </Text>

                                        {isOwned ? (
                                            <View className="bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                                                <Text className="text-green-500 font-black text-[8px] uppercase">Acquired</Text>
                                            </View>
                                        ) : (
                                            <View className="flex-row items-center bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                                                <Text style={{ color: canAfford ? themeColor : '#ef4444' }} className="font-black text-[10px] mr-1">{price}</Text>

                                                {/* ⚡️ NEW: Shows Token Image on the Item Price Tag */}
                                                {tokenVisual ? (
                                                    <RemoteSvgIcon lottieUrl={tokenVisual.lottieUrl} lottieJson={tokenVisual.lottieJson} xml={tokenVisual.svgCode} size={12} color={canAfford ? themeColor : '#ef4444'} />
                                                ) : (
                                                    <Text className="text-slate-500 font-bold text-[8px] uppercase">{tokenName || 'Tokens'}</Text>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

// ==========================================
// ⚡️ HELPER: GRID ITEM (4 per row, Anime Themed)
// ==========================================
const GridItem = ({ item, index, activeStep, totalItems, isOwned, themeColor, wonItem, sparkScale, setPreviewItem, tierDropRates, isSpinning }) => {
    const isBorder = item.category === 'BORDER';
    const visual = item.visualConfig || {};
    const rarityColor = getRarityColor(item.rarity);

    // ⚡️ keepBaseRate display logic
    const displayRate = item.keepBaseRate ? item.baseDropRate : tierDropRates[item.rarity?.toUpperCase()];
    const rateSuffix = item.keepBaseRate ? "%" : "% TIER";

    const animatedHighlightStyle = useAnimatedStyle(() => {
        const currentIndex = Math.floor(activeStep.value) % totalItems;
        // ⚡️ Only show the highlight when the roulette is actively spinning
        const isHighlighted = isSpinning && (currentIndex === index);

        return {
            borderWidth: isHighlighted ? 3 : 1,
            // Uses the event theme color for an "aura" instead of a plain white box
            borderColor: isHighlighted ? '#ffffff' : (isOwned && !isSpinning ? '#22c55e' : `${rarityColor}40`),
            backgroundColor: isHighlighted ? `${themeColor}80` : `${rarityColor}10`,
            transform: [{ scale: isHighlighted ? 1.15 : 1 }],
            shadowColor: isHighlighted ? '#ffffff' : 'transparent',
            shadowOpacity: isHighlighted ? 1 : 0,
            shadowRadius: isHighlighted ? 10 : 0,
            elevation: isHighlighted ? 5 : 0,
            zIndex: isHighlighted ? 10 : 1
        };
    });

    const animatedSparkStyle = useAnimatedStyle(() => {
        const isWinner = wonItem?.id === item.id && sparkScale.value > 0;
        return {
            opacity: isWinner ? 1 : 0,
            transform: [{ scale: isWinner ? sparkScale.value : 0 }]
        };
    });

    // ⚡️ 23% width fits exactly 4 items per row with space-between/gap-2
    return (
        <View style={{ width: '23%' }} className="relative mb-3">
            <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewItem(item)}>
                <Animated.View className="rounded-xl items-center p-1 py-2" style={animatedHighlightStyle}>
                    <View className="w-10 h-10 items-center justify-center mb-1">
                        {isBorder ? (
                            <ClanBorder animationType={visual.animationType} color={visual.primaryColor || "#f59e0b"}>
                                <View className="w-5 h-5 bg-black/40 rounded-full">
                                    <Text>
                                        FRAME
                                    </Text>
                                </View>
                            </ClanBorder>
                        ) : (
                            <RemoteSvgIcon lottieUrl={visual.lottieUrl}
                                lottieJson={visual.lottieJson} xml={visual.svgCode} size={20} color={visual.color || visual.primaryColor} />
                        )}
                    </View>
                    <Text style={{ color: isOwned && !isSpinning ? '#22c55e' : 'white' }} className="font-black text-[6px] uppercase text-center" numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={{ color: rarityColor }} className="text-[6px] font-bold tracking-widest uppercase mt-0.5" numberOfLines={1}>
                        {displayRate?.toFixed(1)}{rateSuffix}
                    </Text>
                    {isOwned && !isSpinning && (
                        <View className="absolute inset-0 bg-black/60 rounded-xl items-center justify-center z-10">
                            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                        </View>
                    )}
                </Animated.View>
            </TouchableOpacity>

            {/* ⚡️ THEMATIC REWARD INDICATOR: Uses theme color for a magical pop */}
            <Animated.View
                style={[animatedSparkStyle, { borderColor: themeColor, shadowColor: themeColor }]}
                className="absolute -inset-2 border-2 bg-white/20 rounded-xl pointer-events-none z-50 shadow-[0_0_15px_rgba(0,0,0,0.8)]"
            />
        </View>
    );
};

// ==========================================
// ⚡️ COMPONENT 2B: THE GRID GACHA TAB
// ==========================================
const GridGachaTab = ({ eventData, pullAmount, gachaPool, ownedIds, setOwnedIds, eventPoints, setEventPoints, isDark }) => {
    const { user, fetchUser } = useUser();
    const { fetchCoins } = useCoins();
    const CustomAlert = useAlert();

    const [isSpinning, setIsSpinning] = useState(false);
    const [isExchanging, setIsExchanging] = useState(false);
    const [isEventExpired, setIsEventExpired] = useState(false);

    const [wonItem, setWonItem] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    const [showExchange, setShowExchange] = useState(false);
    const [pullResults, setPullResults] = useState([]);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    const isSpinningRef = useRef(false);
    const pendingInventoryRef = useRef(null);

    const themeColor = eventData?.themeColor || '#facc15';
    const EventIcon = eventData?.icon || 'moon-waning-crescent';

    // ⚡️ Extract Token Data for the Banner and Modal
    const tokenName = eventData?.tokenName || 'Tokens';
    const tokenVisual = eventData?.tokenVisual || eventData?.visualConfig || null;

    const activeStep = useSharedValue(0);
    const sparkScale = useSharedValue(0);

    const tierDropRates = useMemo(() => {
        const rates = {};
        let totalWeight = 0;
        gachaPool.forEach(item => { totalWeight += (item.baseDropRate || 0); });
        gachaPool.forEach(item => {
            const r = (item.rarity || 'COMMON').toUpperCase();
            rates[r] = (rates[r] || 0) + (item.baseDropRate || 0);
        });
        if (totalWeight > 0) {
            Object.keys(rates).forEach(tier => { rates[tier] = (rates[tier] / totalWeight) * 100; });
        }
        return rates;
    }, [gachaPool]);

    useAnimatedReaction(
        () => Math.floor(activeStep.value),
        (currentStep, previousStep) => {
            if (currentStep !== previousStep && previousStep !== null) {
                runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
            }
        }
    );

    const handleExchange = async (item) => {
        if (isExchanging || ownedIds.includes(item.id)) return;

        setIsExchanging(true);
        try {
            const res = await apiFetch("/mobile/events/gacha", {
                method: "POST",
                body: JSON.stringify({
                    deviceId: user.deviceId,
                    pullType: 'exchange',
                    eventId: eventData.id,
                    itemId: item.id
                })
            });
            const data = await res.json();

            if (data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setEventPoints(data.eventPoints);
                setOwnedIds(data.inventory.map(i => i.itemId));
                await fetchUser();
                setPreviewItem(null);
                CustomAlert("Acquisition Complete", `${item.name} has been added to your vault.`);
            } else {
                CustomAlert("Exchange Failed", data.error || "Could not complete transaction.");
            }
        } catch (err) {
            CustomAlert("Error", "Communication with the vault failed.");
        } finally {
            setIsExchanging(false);
        }
    };

    const onSequenceStepComplete = useCallback((reward, index, rewards, pullType) => {
        if (!isSpinningRef.current) return;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setWonItem(reward);

        sparkScale.value = withSequence(
            withTiming(1.3, { duration: 100 }),
            withSpring(1, { damping: 12, stiffness: 150 })
        );

        setTimeout(() => {
            if (isSpinningRef.current) animateNextReward(index + 1, rewards, pullType);
        }, pullType === '11x' ? 400 : 1000);
    }, []);

    const animateNextReward = useCallback((index, rewards, pullType) => {
        if (!isSpinningRef.current) return;

        if (index >= rewards.length) {
            setIsSpinning(false);
            isSpinningRef.current = false;
            setShowSummaryModal(true);

            if (pendingInventoryRef.current) {
                setOwnedIds(pendingInventoryRef.current);
                pendingInventoryRef.current = null;
            }
            return;
        }

        const reward = rewards[index];
        setWonItem(null);
        sparkScale.value = 0;

        activeStep.value = 0;

        const targetIndex = gachaPool.findIndex(item => item.id === reward.id);
        const safeTargetIndex = targetIndex !== -1 ? targetIndex : 0;

        const loops = pullType === '11x' ? 1 : 2;
        const totalSteps = (loops * gachaPool.length) + safeTargetIndex;
        const duration = pullType === '11x' ? 1200 : 2500;

        activeStep.value = withTiming(
            totalSteps,
            // ⚡️ FIXED: Restored your exact ReanimatedEasing object format here!
            { duration, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) },
            (finished) => {
                if (finished) runOnJS(onSequenceStepComplete)(reward, index, rewards, pullType);
            }
        );
    }, [activeStep, gachaPool, sparkScale, onSequenceStepComplete, setOwnedIds]);

    const handleSpin = async (pullType) => {
        if (isSpinning || gachaPool.length === 0 || isEventExpired) return;
        setIsSpinning(true);
        isSpinningRef.current = true;
        setWonItem(null);
        setShowSummaryModal(false);
        activeStep.value = 0;
        pendingInventoryRef.current = null;

        try {
            const response = await apiFetch("/mobile/events/gacha", {
                method: "POST",
                body: JSON.stringify({ deviceId: user.deviceId, pullType, eventId: eventData.id })
            });
            const data = await response.json();

            if (data.success) {
                await fetchCoins();
                if (data.eventPoints !== undefined) setEventPoints(data.eventPoints);

                if (data.inventory) {
                    pendingInventoryRef.current = data.inventory.map(i => i.itemId);
                }

                setPullResults(data.rewards);
                animateNextReward(0, data.rewards, pullType);
            } else {
                setIsSpinning(false);
                isSpinningRef.current = false;
                CustomAlert("Failed", data.error || "Not enough Chakra.");
            }
        } catch (error) {
            setIsSpinning(false);
            isSpinningRef.current = false;
            CustomAlert("Network Error", "Lost connection to the vault.");
        }
    };

    const handleSkip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        isSpinningRef.current = false;
        setIsSpinning(false);
        setWonItem(null);
        setShowSummaryModal(true);

        if (pendingInventoryRef.current) {
            setOwnedIds(pendingInventoryRef.current);
            pendingInventoryRef.current = null;
        }
    };

    return (
        <View className="mb-20 px-1 relative">
            <ExchangeModal
                isVisible={showExchange}
                onClose={() => setShowExchange(false)}
                gachaPool={gachaPool}
                eventPoints={eventPoints}
                ownedIds={ownedIds}
                themeColor={themeColor}
                tokenVisual={tokenVisual}
                tokenName={tokenName}
                onSelectItem={(item) => setPreviewItem(item)}
            />

            <EventItemPreviewModal
                isVisible={!!previewItem}
                onClose={() => setPreviewItem(null)}
                currentUser={user}
                previewItem={previewItem}
                tierDropRates={tierDropRates}
                isDark={isDark}
                actionType={showExchange ? "exchange" : "preview"}
                eventPoints={eventPoints}
                isProcessing={isExchanging}
                onAction={handleExchange}
                tokenVisual={tokenVisual}
                tokenName={tokenName}
            />

            <View className="w-full bg-[#0f172a] rounded-2xl p-6 border border-slate-800 items-center shadow-xl mb-6 mt-4 overflow-hidden relative">
                <EventCountdown endsAt={eventData.endsAt} onExpire={setIsEventExpired} themeColor={themeColor} />

                <MaterialCommunityIcons name={EventIcon} size={40} color={themeColor} className="mb-2" />
                <Text className="text-white text-3xl font-black uppercase italic text-center">{eventData.title}</Text>

                <View className="w-full mt-6 bg-black/40 p-4 rounded-xl border border-white/5 flex-row justify-between items-center z-10">

                    <View className="flex-row items-center">
                        {tokenVisual && (
                            <View className="mr-3">
                                <RemoteSvgIcon lottieUrl={tokenVisual.lottieUrl} lottieJson={tokenVisual.lottieJson} xml={tokenVisual.svgCode} size={28} color={themeColor} />
                            </View>
                        )}
                        <View>
                            <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-widest mb-1">{tokenName}</Text>
                            <Text style={{ color: themeColor }} className="font-black text-lg">{eventPoints || 0}</Text>
                        </View>
                    </View>

                    <TouchableOpacity onPress={() => setShowExchange(true)} className="bg-blue-600 px-4 py-2 rounded-lg flex-row items-center">
                        <Ionicons name="cart" size={14} color="white" />
                        <Text className="text-white font-black uppercase text-[10px] ml-2">Exchange</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View className="bg-[#0a0f1c] p-4 rounded-3xl border border-slate-800 flex-row flex-wrap justify-center gap-2 relative overflow-hidden">
                {isSpinning && pullResults.length > 1 && (
                    <TouchableOpacity onPress={handleSkip} className="absolute top-2 right-2 z-50 bg-black/80 px-3 py-1.5 rounded-full border border-white/20">
                        <Text className="text-white font-black text-[9px] uppercase tracking-widest">Skip ⏭</Text>
                    </TouchableOpacity>
                )}

                {gachaPool.map((item, index) => (
                    <GridItem
                        key={item.id}
                        item={item}
                        index={index}
                        activeStep={activeStep}
                        totalItems={gachaPool.length}
                        isOwned={ownedIds.includes(item.id)}
                        themeColor={themeColor}
                        wonItem={wonItem}
                        sparkScale={sparkScale}
                        setPreviewItem={setPreviewItem}
                        tierDropRates={tierDropRates}
                        isSpinning={isSpinning}
                    />
                ))}
            </View>

            <View className="flex-row gap-3 w-full mt-6">
                <TouchableOpacity disabled={isSpinning || isEventExpired} onPress={() => handleSpin('1x')} style={{ opacity: isEventExpired ? 0.5 : 1 }} className="flex-1 bg-slate-800 border border-slate-700 h-14 rounded-xl flex-row items-center justify-center">
                    <Text className="text-slate-300 font-black uppercase text-[11px] mr-2">{isEventExpired ? 'Locked' : '1x Pull'}</Text>
                    {!isEventExpired && <Text style={{ color: themeColor }} className="font-black text-[12px]">25 OC</Text>}
                </TouchableOpacity>
                <TouchableOpacity disabled={isSpinning || isEventExpired} onPress={() => handleSpin('11x')} style={{ opacity: isEventExpired ? 0.5 : 1, backgroundColor: isEventExpired ? '#334155' : themeColor }} className="flex-1 h-14 rounded-xl flex-row items-center justify-center shadow-lg">
                    <Text className="text-slate-900 font-black uppercase text-[11px] mr-2">{isEventExpired ? 'Locked' : '10+1 Pull'}</Text>
                    {!isEventExpired && <Text className="text-slate-900 font-black text-[12px]">250 OC</Text>}
                </TouchableOpacity>
            </View>

            <Modal visible={showSummaryModal} transparent={true} animationType="slide">
                <View className="flex-1 bg-black/95 justify-end">
                    <View className="bg-[#0f172a] h-[85%] rounded-t-[40px] border-t border-slate-800 p-6 flex flex-col">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-white text-2xl font-black uppercase italic tracking-tighter">Summoning Results</Text>
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                                    {pullResults.length} Artifact{pullResults.length > 1 ? 's' : ''} Acquired
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowSummaryModal(false)} className="p-2 bg-white/10 rounded-full">
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                            <View className="flex-row flex-wrap justify-between">
                                {pullResults.map((item, idx) => {
                                    const visual = item.visualConfig || {};
                                    const rarityColor = getRarityColor(item.rarity);
                                    return (
                                        <TouchableOpacity key={idx} activeOpacity={0.8} onPress={() => setPreviewItem(item)} style={{ width: '48%', borderColor: `${rarityColor}40`, backgroundColor: `${rarityColor}10` }} className="mb-4 rounded-2xl border-2 items-center p-4 relative">
                                            {item.isDuplicate && <View className="absolute top-2 left-2 bg-red-500 px-2 py-0.5 rounded border border-red-400 z-10"><Text className="text-white font-black text-[8px] uppercase">Duplicate</Text></View>}
                                            <View className="w-16 h-16 items-center justify-center mb-3">
                                                {item.category === 'BORDER' ? <ClanBorder animationType={visual.animationType} color={visual.primaryColor}>
                                                    <View className="w-10 h-10 bg-black/40 rounded-full">
                                                        <Text className="text-xs">FRAME</Text>
                                                    </View>
                                                </ClanBorder> : <RemoteSvgIcon lottieUrl={visual.lottieUrl}
                                                    lottieJson={visual.lottieJson} xml={visual.svgCode} size={45} color={visual.primaryColor} />}
                                            </View>
                                            <Text style={{ color: rarityColor }} className="font-black text-[11px] uppercase text-center" numberOfLines={2}>{item.name}</Text>
                                            <Text className="text-slate-400 text-[8px] font-bold uppercase mt-1">{item.isDuplicate ? `+${item.refundAmount} OC` : item.rarity?.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowSummaryModal(false)} className="w-full bg-blue-600 py-4 rounded-xl items-center justify-center mt-4"><Text className="text-white font-black uppercase text-sm">Return to Hub</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
// ==========================================
// ⚡️ COMPONENT 1: THE CLAIM TAB
// ==========================================
const ClaimTab = ({ eventData }) => {
    const storage = useMMKV();
    const { processTransaction, isProcessingTransaction } = useCoins();
    const [status, setStatus] = useState({ type: '', text: '' });
    const [isEventExpired, setIsEventExpired] = useState(false);

    const claimId = eventData?.id;
    const claimAmount = eventData?.amount || 1000;
    const themeColor = eventData?.themeColor || '#3b82f6';
    const EventIcon = eventData?.icon || 'gift';

    const [hasClaimed, setHasClaimed] = useState(() => {
        return storage.getBoolean(`has_claimed_${claimId}`) || false;
    });

    const handleClaim = async () => {
        if (isProcessingTransaction || hasClaimed || isEventExpired) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setStatus({ type: '', text: '' });
        const result = await processTransaction('claim', claimId);

        if (result.success) {
            setHasClaimed(true);
            storage.set(`has_claimed_${claimId}`, true);
            setStatus({ type: 'success', text: `${claimAmount} OC Acquired!` });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            const errorMessage = result.error || 'Failed to claim.';
            if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('claimed')) {
                setHasClaimed(true);
                storage.set(`has_claimed_${claimId}`, true);
            }
            setStatus({ type: 'error', text: errorMessage });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    if (!eventData) return null;

    return (
        <View className="mb-20 items-center mt-4">
            <View className="w-full bg-[#0f172a] rounded-2xl p-6 relative border border-slate-800 shadow-xl overflow-hidden mt-4">

                <EventCountdown endsAt={eventData.endsAt} onExpire={setIsEventExpired} themeColor={themeColor} />
                <MaterialCommunityIcons name={EventIcon} size={250} color={themeColor} style={{ position: 'absolute', opacity: 0.04, bottom: -40, left: -40, transform: [{ rotate: '-15deg' }] }} />

                <View className="flex-row mb-6 mt-2">
                    <View style={{ backgroundColor: `${themeColor}20`, borderLeftColor: themeColor }} className="px-3 py-1 border-l-2 rounded-sm">
                        <Text style={{ color: themeColor }} className="text-[9px] font-black uppercase tracking-widest">Limited Entry</Text>
                    </View>
                </View>

                <View className="items-center mb-8">
                    <View style={{ backgroundColor: `${themeColor}15`, borderColor: `${themeColor}40`, shadowColor: themeColor }} className="w-20 h-20 rounded-2xl items-center justify-center border-2 shadow-[0_0_20px_rgba(0,0,0,0.5)] transform -rotate-3 mb-4">
                        <MaterialCommunityIcons name={EventIcon} size={45} color={themeColor} />
                    </View>
                    <Text className="text-white text-3xl font-black italic uppercase text-center tracking-tighter">
                        {eventData.title}
                    </Text>
                </View>

                <View className="bg-black/30 rounded-xl p-5 mb-6 border border-slate-800 items-center">
                    <Text className="text-slate-300 text-[10px] font-bold text-center uppercase tracking-[0.2em] leading-loose mb-4">
                        {eventData.description}
                    </Text>
                    <View className="flex-row items-center justify-center">
                        <Text style={{ color: themeColor }} className="text-4xl font-black tracking-tighter italic mr-2">+{claimAmount}</Text>
                        <ClanIcon type="OC" size={28} />
                    </View>
                </View>

                {status.text !== '' && (
                    <View className={`mb-6 px-4 py-3 rounded-lg border flex-row items-center w-full ${status.type === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <Ionicons name={status.type === 'success' ? "checkmark-circle" : "alert-circle"} size={20} color={status.type === 'success' ? "#22c55e" : "#ef4444"} />
                        <Text style={{ color: status.type === 'success' ? '#22c55e' : '#ef4444' }} className="font-black text-[9px] uppercase tracking-widest ml-3 flex-1">{status.text}</Text>
                    </View>
                )}

                <TouchableOpacity
                    onPress={handleClaim}
                    disabled={isProcessingTransaction || hasClaimed || isEventExpired}
                    style={{ backgroundColor: hasClaimed ? THEME.success : isEventExpired ? '#334155' : themeColor, opacity: isProcessingTransaction ? 0.7 : 1 }}
                    className="w-full h-14 rounded-xl flex-row items-center justify-center shadow-lg shadow-black"
                >
                    {isProcessingTransaction ? <ActivityIndicator color="white" /> : (
                        <>
                            <MaterialCommunityIcons name={hasClaimed ? "check-all" : isEventExpired ? "lock" : "lightning-bolt"} size={20} color={isEventExpired ? '#94a3b8' : 'white'} />
                            <Text style={{ color: isEventExpired ? '#94a3b8' : 'white' }} className="font-black text-[12px] uppercase tracking-[0.2em] ml-2">
                                {hasClaimed ? "Payload Acquired" : isEventExpired ? "Operation Archived" : "Extract Payload"}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};
// ==========================================
// ⚡️ COMPONENT 2: THE GACHA TAB (Roulette)
// ==========================================
const GachaTab = ({ eventData, pullAmount, gachaPool, ownedIds, setOwnedIds, pityCount, setPityCount, isDark }) => {
    const { user } = useUser();
    const { fetchCoins } = useCoins();
    const CustomAlert = useAlert();

    const [isSpinning, setIsSpinning] = useState(false);
    const [isFetchingServer, setIsFetchingServer] = useState(false);
    const [isEventExpired, setIsEventExpired] = useState(false);

    const [pullResults, setPullResults] = useState([]);
    const [showReveal, setShowReveal] = useState(false);
    const [revealStep, setRevealStep] = useState(0);
    const [rouletteTrack, setRouletteTrack] = useState([]);
    const [animationDone, setAnimationFinished] = useState(false);

    // ⚡️ Strict states to prevent early UI reveals
    const [isWheelMoving, setIsWheelMoving] = useState(false);
    const [currentlyDisplayedReward, setCurrentlyDisplayedReward] = useState(null);
    const [sequenceDone, setSequenceDone] = useState(false);

    const [previewItem, setPreviewItem] = useState(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // ⚡️ REFS for tracking continuous infinite scrolling
    const isSpinningRef = useRef(false);
    const currentTargetIndexRef = useRef(0);
    const trackRef = useRef([]);

    const themeColor = eventData?.themeColor || '#facc15';
    const EventIcon = eventData?.icon || 'moon-waning-crescent';

    const scrollX = useSharedValue(0);
    const arrowY = useSharedValue(0);
    const portalOuterRotate = useSharedValue(0);
    const portalInnerRotate = useSharedValue(0);

    const ITEM_SIZE = 120;
    const ITEMS_PER_SPIN = 60; // How many items to jump forward per spin

    const pityProgress = Math.min(((pityCount || 0) / 100) * 100, 100);

    const tierDropRates = useMemo(() => {
        const rates = {};
        let totalWeight = 0;
        gachaPool.forEach(item => { totalWeight += (item.baseDropRate || 0); });
        gachaPool.forEach(item => {
            const r = (item.rarity || 'COMMON').toUpperCase();
            rates[r] = (rates[r] || 0) + (item.baseDropRate || 0);
        });
        if (totalWeight > 0) {
            Object.keys(rates).forEach(tier => { rates[tier] = (rates[tier] / totalWeight) * 100; });
        }
        return rates;
    }, [gachaPool]);

    useAnimatedReaction(
        () => Math.abs(Math.round(scrollX.value / ITEM_SIZE)),
        (currentIndex, previousIndex) => {
            if (currentIndex !== previousIndex && previousIndex !== null) {
                runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
            }
        }
    );

    useEffect(() => {
        if (showReveal) {
            arrowY.value = withRepeat(
                withSequence(
                    withTiming(-8, { duration: 500, easing: ReanimatedEasing.ease }),
                    withTiming(0, { duration: 500, easing: ReanimatedEasing.ease })
                ), -1, true
            );
        } else {
            arrowY.value = 0;
        }

        if (isFetchingServer) {
            portalOuterRotate.value = withRepeat(withTiming(360, { duration: 4000, easing: ReanimatedEasing.linear }), -1, false);
            portalInnerRotate.value = withRepeat(withTiming(-360, { duration: 3000, easing: ReanimatedEasing.linear }), -1, false);
        } else {
            portalOuterRotate.value = 0;
            portalInnerRotate.value = 0;
        }
    }, [showReveal, isFetchingServer]);

    const animatedTrackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: scrollX.value }], flexDirection: 'row' }));
    const animatedArrowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: arrowY.value }] }));
    const outerPortalStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${portalOuterRotate.value}deg` }] }));
    const innerPortalStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${portalInnerRotate.value}deg` }] }));

    // ⚡️ Safely triggers the UI updates exactly when the wheel stops
    const onSpinFinishJS = useCallback((wonItem, currentIndex, rewards, pullType) => {
        if (!isSpinningRef.current) return;

        // 1. Wheel has stopped. Safe to reveal the text and colors.
        setIsWheelMoving(false);
        setCurrentlyDisplayedReward(wonItem);
        setAnimationFinished(true);

        if (wonItem.rarity?.toUpperCase() === 'MYTHIC' || wonItem.rarity?.toUpperCase() === 'EPIC') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        // 2. Check if we are done, or if we need to auto-play the next item
        if (currentIndex >= rewards.length - 1) {
            setSequenceDone(true);
            setIsSpinning(false);
            isSpinningRef.current = false;
        } else {
            // Auto-Play Delay
            setTimeout(() => {
                if (isSpinningRef.current) {
                    setRevealStep(currentIndex + 1);
                    // Hide the text instantly when the next spin starts
                    setCurrentlyDisplayedReward(null);
                    startRouletteAnimation(rewards[currentIndex + 1], pullType, currentIndex + 1, rewards);
                }
            }, pullType === '11x' ? 1000 : 2000);
        }
    }, []);

    const startRouletteAnimation = useCallback((wonItem, pullType, currentIndex, rewards) => {
        // ⚡️ Hide all text/rewards IMMEDIATELY
        setAnimationFinished(false);
        setCurrentlyDisplayedReward(null);
        setIsWheelMoving(true);

        let track = [...trackRef.current];

        // ⚡️ Target Index progressively shifts forward so it NEVER spins backward
        const targetIdx = currentIndex === 0 ? ITEMS_PER_SPIN : currentTargetIndexRef.current + ITEMS_PER_SPIN;
        currentTargetIndexRef.current = targetIdx;

        // We ensure the track is long enough to hold the new target + some padding
        const requiredLength = targetIdx + 15;

        while (track.length < requiredLength) {
            let shuffled = [...gachaPool].sort(() => Math.random() - 0.5);
            if (track.length > 0 && track[track.length - 1].id === shuffled[0].id && shuffled.length > 1) {
                [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
            }
            track.push(...shuffled);
        }

        // Plant the actual won item exactly at the target index
        track[targetIdx] = wonItem;

        // Prevent identical items sitting right next to the winning item to avoid visual confusion
        if (track[targetIdx - 1]?.id === wonItem.id && gachaPool.length > 1) {
            track[targetIdx - 1] = gachaPool.find(i => i.id !== wonItem.id) || track[targetIdx - 1];
        }
        if (track[targetIdx + 1]?.id === wonItem.id && gachaPool.length > 1) {
            track[targetIdx + 1] = gachaPool.find(i => i.id !== wonItem.id) || track[targetIdx + 1];
        }

        // Save the appended array to the Ref and State
        trackRef.current = track;
        setRouletteTrack(track);

        const centerOffset = (width / 2) - (ITEM_SIZE / 2);
        const finalPosition = -(targetIdx * ITEM_SIZE) + centerOffset;
        const randomTick = (Math.random() * 40) - 20;

        const duration = pullType === '11x' ? 2000 : 4000;

        // ⚡️ Tiny timeout ensures React Native renders the newly appended track items BEFORE animating into them
        setTimeout(() => {
            if (!isSpinningRef.current) return;
            scrollX.value = withTiming(
                finalPosition + randomTick,
                { duration, easing: ReanimatedEasing.bezier(0.1, 0.8, 0.2, 1) },
                (finished) => {
                    if (finished) {
                        runOnJS(onSpinFinishJS)(wonItem, currentIndex, rewards, pullType);
                    }
                }
            );
        }, 50);
    }, [gachaPool, scrollX, onSpinFinishJS]);

    const handleSpin = (pullType) => {
        if (isSpinning || gachaPool.length === 0 || isEventExpired) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsSpinning(true);
        isSpinningRef.current = true;
        setIsFetchingServer(true);
        setShowReveal(true);
        setShowSummaryModal(false);
        setSequenceDone(false);

        // Ensure everything is hidden while server fetches
        setCurrentlyDisplayedReward(null);
        setIsWheelMoving(false);

        // ⚡️ Reset the infinite track completely ONLY on a fresh button press
        scrollX.value = 0;
        trackRef.current = [];
        currentTargetIndexRef.current = 0;

        setTimeout(async () => {
            try {
                const response = await apiFetch("/mobile/events/gacha", {
                    method: "POST",
                    body: JSON.stringify({ deviceId: user.deviceId, pullType, eventId: eventData.id })
                });
                const data = await response.json();

                if (data.success) {
                    await fetchCoins();
                    if (data.inventory) setOwnedIds(data.inventory.map(i => i.itemId));
                    if (data.pityCount !== undefined) setPityCount(data.pityCount);

                    setPullResults(data.rewards);
                    setRevealStep(0);
                    setIsFetchingServer(false);
                    startRouletteAnimation(data.rewards[0], pullType, 0, data.rewards);
                } else {
                    setIsSpinning(false);
                    isSpinningRef.current = false;
                    setIsFetchingServer(false);
                    setShowReveal(false);
                    CustomAlert("Summoning Failed", data.error || "Not enough Chakra (OC).");
                }
            } catch (error) {
                setIsSpinning(false);
                isSpinningRef.current = false;
                setIsFetchingServer(false);
                setShowReveal(false);
                CustomAlert("Network Error", "The connection to the Great Library was lost.");
            }
        }, 50);
    };

    const handleSkipReveal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowReveal(false);
        setIsSpinning(false);
        isSpinningRef.current = false; // Stops recursive timeouts
        setShowSummaryModal(true);
    };

    const activeRevealItem = pullResults[revealStep];

    return (
        <View className="mb-20">
            <EventItemPreviewModal isVisible={!!previewItem} onClose={() => setPreviewItem(null)} currentUser={user} previewItem={previewItem} tierDropRates={tierDropRates} isDark={isDark} />

            <Modal visible={showReveal} transparent={true} animationType="fade">
                <View className="flex-1 bg-black/95 items-center justify-center relative overflow-hidden">
                    {!isFetchingServer && pullResults.length > 1 && (
                        <TouchableOpacity onPress={handleSkipReveal} className="absolute top-12 right-6 z-50 bg-white/10 px-4 py-2 rounded-full border border-white/20">
                            <Text className="text-white font-black text-[10px] uppercase tracking-widest">Skip ⏭</Text>
                        </TouchableOpacity>
                    )}

                    {isFetchingServer ? (
                        <View className="items-center justify-center relative">
                            <Animated.View style={[outerPortalStyle, { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: themeColor, borderStyle: 'dashed', opacity: 0.4 }]} />
                            <Animated.View style={[innerPortalStyle, { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: themeColor, borderStyle: 'dotted', opacity: 0.7 }]} />
                            <MaterialCommunityIcons name={EventIcon} size={40} color={themeColor} />
                            <Text style={{ color: themeColor }} className="font-black mt-28 text-xs uppercase tracking-[0.4em] text-center">Breaching Vault...</Text>
                        </View>
                    ) : (
                        <>
                            {/* ⚡️ Background Glow: Only shows when wheel is completely stopped */}
                            {!isWheelMoving && currentlyDisplayedReward && (
                                <View style={{ backgroundColor: getRarityColor(currentlyDisplayedReward.rarity), opacity: 0.2 }} className="absolute w-[800px] h-[800px] rounded-full blur-3xl" />
                            )}

                            {/* ⚡️ Top Text: Safely generic while spinning */}
                            <Text className="text-white font-black text-xs uppercase tracking-[0.5em] mb-12">
                                {!isWheelMoving && currentlyDisplayedReward ? `${currentlyDisplayedReward.rarity?.toUpperCase()} ARTIFACT` : "SUMMONING..."}
                            </Text>

                            <View className="h-44 justify-center w-full relative pt-4">
                                <Animated.View style={animatedArrowStyle} className="absolute top-0 left-1/2 -ml-4 z-30"><Ionicons name="caret-down" size={32} color="white" /></Animated.View>
                                <Animated.View style={animatedTrackStyle}>
                                    {rouletteTrack.map((item, index) => {
                                        // Highlight winning item ONLY when the wheel stops
                                        const isWinnerSlot = index === currentTargetIndexRef.current && !isWheelMoving && currentlyDisplayedReward;
                                        return (
                                            <View key={index} style={{ width: 100, marginHorizontal: 10, borderColor: getRarityColor(item.rarity), backgroundColor: `${getRarityColor(item.rarity)}15` }} className={`h-28 rounded-2xl border-2 items-center justify-center ${isWinnerSlot ? 'scale-110 shadow-lg' : 'opacity-50 scale-95'}`}>
                                                {item.category === 'BORDER' ? <ClanBorder animationType={item.visualConfig?.animationType} color={item.visualConfig?.primaryColor}>
                                                    <View className="w-12 h-12 bg-black/40 rounded-full">
                                                        <Text className="text-xs">
                                                            FRAME
                                                        </Text>
                                                    </View>
                                                </ClanBorder> : <RemoteSvgIcon lottieUrl={item.visualConfig?.lottieUrl}
                                                    lottieJson={item.visualConfig?.lottieJson} xml={item.visualConfig?.svgCode} size={50} color={item.visualConfig?.primaryColor} />}
                                            </View>
                                        );
                                    })}
                                </Animated.View>
                            </View>

                            <View className="mt-12 items-center h-40 w-full px-8">
                                {/* ⚡️ This section is fully hidden until the spin finishes */}
                                {!isWheelMoving && currentlyDisplayedReward && (
                                    <>
                                        <TouchableOpacity onPress={() => setPreviewItem(currentlyDisplayedReward)} className="flex-row items-center justify-center mb-1">
                                            <Text style={{ color: getRarityColor(currentlyDisplayedReward.rarity) }} className="text-3xl font-black italic text-center mr-2">{currentlyDisplayedReward.name}</Text>
                                            <Ionicons name="information-circle-outline" size={24} color={getRarityColor(currentlyDisplayedReward.rarity)} />
                                        </TouchableOpacity>

                                        {sequenceDone && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setShowReveal(false);
                                                    setShowSummaryModal(true);
                                                }}
                                                style={{ backgroundColor: getRarityColor(currentlyDisplayedReward.rarity) }}
                                                className="w-full py-4 rounded-xl items-center justify-center mt-6 shadow-lg"
                                            >
                                                <Text className="text-slate-900 font-black uppercase tracking-widest text-sm">Accept & View All</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </View>
                        </>
                    )}
                </View>
            </Modal>

            <Modal visible={showSummaryModal} transparent={true} animationType="slide">
                <View className="flex-1 bg-black/95 justify-end">
                    <View className="bg-[#0f172a] h-[85%] rounded-t-[40px] border-t border-slate-800 p-6 flex flex-col">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-white text-2xl font-black uppercase italic tracking-tighter">Summoning Results</Text>
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                                    {pullResults.length} Artifact{pullResults.length > 1 ? 's' : ''} Acquired
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowSummaryModal(false)} className="p-2 bg-white/10 rounded-full">
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                            <View className="flex-row flex-wrap justify-between">
                                {pullResults.map((item, idx) => {
                                    const visual = item.visualConfig || {};
                                    const rarityColor = getRarityColor(item.rarity);
                                    return (
                                        <TouchableOpacity key={idx} activeOpacity={0.8} onPress={() => setPreviewItem(item)} style={{ width: '48%', borderColor: `${rarityColor}40`, backgroundColor: `${rarityColor}10` }} className="mb-4 rounded-2xl border-2 items-center p-4 relative">
                                            {item.isDuplicate && <View className="absolute top-2 left-2 bg-red-500 px-2 py-0.5 rounded border border-red-400 z-10"><Text className="text-white font-black text-[8px] uppercase">Duplicate</Text></View>}
                                            <View className="w-16 h-16 items-center justify-center mb-3">
                                                {item.category === 'BORDER' ? <ClanBorder animationType={visual.animationType} color={visual.primaryColor}>
                                                    <View className="w-10 h-10 ">
                                                        <Text className="text-xs">
                                                            FRAME
                                                        </Text>
                                                    </View>
                                                </ClanBorder> : <RemoteSvgIcon lottieUrl={visual.lottieUrl}
                                                    lottieJson={visual.lottieJson} xml={visual.svgCode} size={45} color={visual.primaryColor} />}
                                            </View>
                                            <Text style={{ color: rarityColor }} className="font-black text-[11px] uppercase text-center" numberOfLines={2}>{item.name}</Text>
                                            <Text className="text-slate-400 text-[8px] font-bold uppercase mt-1">{item.isDuplicate ? `+${item.refundAmount} OC` : item.rarity?.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowSummaryModal(false)} className="w-full bg-blue-600 py-4 rounded-xl items-center justify-center mt-4"><Text className="text-white font-black uppercase text-sm">Return to Hub</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <View className="mt-4 mb-8">
                <View className="w-full bg-[#0f172a] rounded-2xl p-6 border border-slate-800 relative overflow-hidden shadow-xl">
                    <EventCountdown endsAt={eventData.endsAt} onExpire={setIsEventExpired} themeColor={themeColor} />
                    <MaterialCommunityIcons name={EventIcon} size={250} color={themeColor} style={{ position: 'absolute', opacity: 0.05, top: -40, right: -40 }} />
                    <View className="items-center mb-6">
                        <View style={{ backgroundColor: `${themeColor}15`, borderColor: `${themeColor}40` }} className="w-16 h-16 rounded-xl border-2 items-center justify-center mb-4 transform rotate-3 shadow-lg">
                            <MaterialCommunityIcons name={EventIcon} size={35} color={themeColor} />
                        </View>
                        <Text className="text-white text-3xl font-black uppercase italic text-center">{eventData.title}</Text>
                        <Text className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.2em] text-center mt-2 px-2">{eventData.description}</Text>
                    </View>

                    <View className="w-full mb-6">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-gray-400 font-bold text-[9px] uppercase tracking-widest">Mythic Pity</Text>
                            <Text className="text-yellow-400 font-black text-[10px] tracking-widest">{pityCount || 0} / 100</Text>
                        </View>
                        <View className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-slate-800">
                            <View className="h-full bg-yellow-400" style={{ width: `${pityProgress}%` }} />
                        </View>
                    </View>

                    <View className="flex-row gap-3 w-full">
                        <TouchableOpacity disabled={isSpinning || isEventExpired} onPress={() => handleSpin('1x')} style={{ opacity: isEventExpired ? 0.5 : 1 }} className="flex-1 bg-slate-800 border border-slate-700 h-14 rounded-xl flex-row items-center justify-center">
                            <Text className="text-slate-300 font-black uppercase text-[11px] mr-2">{isEventExpired ? 'Locked' : '1x Pull'}</Text>
                            {!isEventExpired && <Text style={{ color: themeColor }} className="font-black text-[12px]">50 OC</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity disabled={isSpinning || isEventExpired} onPress={() => handleSpin('11x')} style={{ opacity: isEventExpired ? 0.5 : 1, backgroundColor: isEventExpired ? '#334155' : themeColor }} className="flex-1 h-14 rounded-xl flex-row items-center justify-center">
                            <Text className="text-slate-900 font-black uppercase text-[11px] mr-2">{isEventExpired ? 'Locked' : '10+1 Pull'}</Text>
                            {!isEventExpired && <Text className="text-slate-900 font-black text-[12px]">500 OC</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View className="mb-10 px-1">
                <View className="flex-row flex-wrap justify-between">
                    {gachaPool.map((item, idx) => {
                        const isOwned = ownedIds.includes(item.id);
                        const rarityColor = getRarityColor(item.rarity);
                        const displayRate = item.keepBaseRate ? item.baseDropRate : tierDropRates[item.rarity?.toUpperCase()];
                        const rateSuffix = item.keepBaseRate ? "%" : "% TIER";
                        return (
                            <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => setPreviewItem(item)} style={{ width: '31%' }} className={`mb-4 rounded-xl border relative items-center p-2 pt-3 ${isOwned ? 'bg-green-500/10 border-green-500/30' : 'bg-[#0f172a] border-slate-800'}`}>
                                <View style={{ borderColor: isOwned ? '#22c55e' : `${rarityColor}40`, backgroundColor: `${rarityColor}10` }} className="w-14 h-14 rounded-lg border items-center justify-center mb-3">
                                    {item.category === 'BORDER' ? <ClanBorder animationType={item.visualConfig?.animationType} color={item.visualConfig?.primaryColor}>
                                        <View className="w-8 h-8">
                                            <Text>
                                                FRAME
                                            </Text>
                                        </View>
                                    </ClanBorder> : <RemoteSvgIcon lottieUrl={item.visualConfig?.lottieUrl}
                                        lottieJson={item.visualConfig?.lottieJson} xml={item.visualConfig?.svgCode} size={28} color={item.visualConfig?.primaryColor} />}
                                </View>
                                <Text style={{ color: isOwned ? '#22c55e' : 'white' }} className="font-black text-[9px] uppercase text-center mb-1" numberOfLines={1}>{item.name}</Text>
                                <Text style={{ color: rarityColor }} className="text-[8px] font-bold tracking-widest uppercase">{displayRate?.toFixed(1)}{rateSuffix}</Text>
                                {isOwned && <View className="absolute inset-0 bg-black/60 rounded-xl items-center justify-center z-10"><Ionicons name="checkmark-circle" size={24} color="#22c55e" /></View>}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </View>
    );
};

// ==========================================
// ⚡️ COMPONENT 3: THE REFERRAL TAB 
// ==========================================
const ReferralTab = ({ data, rounds, referralCode, copied, onCopy, onShare, referralLink }) => {
    // ⚡️ SAFEGUARD: Ensure data fields exist to prevent `data.round` crashes
    const safeData = {
        round: data?.round || 1,
        progress: data?.progress || 0,
        roundTotal: data?.roundTotal || 0,
        leaderboard: data?.leaderboard || []
    };

    const QuestRow = ({ roundItem }) => {
        const isActive = safeData.round === roundItem.id;
        const isLocked = roundItem.id > safeData.round;
        const isCompleted = roundItem.id < safeData.round;
        const progressClamped = Math.min(safeData.progress, 100);

        return (
            <View style={{ borderColor: isActive ? roundItem.color : THEME.border, backgroundColor: isActive ? `${roundItem.color}10` : THEME.card }} className={`flex-row items-center justify-between p-5 rounded-[25px] border-2 mb-4 relative overflow-hidden`}>
                {isLocked && <View className="absolute inset-0 bg-black/60 z-10 items-center justify-center rounded-2xl" />}
                <View className="flex-row items-center flex-1">
                    <View style={{ backgroundColor: `${roundItem.color}20`, borderColor: `${roundItem.color}40` }} className="w-12 h-12 rounded-2xl items-center justify-center border mr-4">
                        <MaterialCommunityIcons name={roundItem.icon} size={24} color={roundItem.color} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center">
                            <Text style={{ color: roundItem.color }} className="text-[10px] font-black uppercase tracking-widest">{roundItem.title}</Text>
                            {isActive && <View className="w-1.5 h-1.5 bg-green-500 rounded-full ml-2" />}
                        </View>
                        <Text style={{ color: THEME.text }} className="text-[16px] font-black uppercase mb-1">REWARD: {roundItem.reward}</Text>
                        {isActive && (
                            <View className="mt-3 mr-4 relative">
                                <View style={{ left: `${progressClamped}%`, marginLeft: -10 }} className="absolute -top-5 items-center">
                                    <View style={{ backgroundColor: roundItem.color }} className="px-1.5 py-0.5 rounded-md shadow-sm">
                                        <MaterialCommunityIcons name="star-four-points" size={10} color="white" />
                                    </View>
                                </View>
                                <View className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                    <View style={{ width: `${progressClamped}%`, backgroundColor: roundItem.color }} className="h-full" />
                                </View>
                                <View className="flex-row justify-between mt-1">
                                    <Text className="text-[8px] font-bold text-slate-500 uppercase">{safeData.roundTotal} SUMMONED</Text>
                                    <Text style={{ color: roundItem.color }} className="text-[8px] font-black uppercase">GOAL: {roundItem.goal || (roundItem.id === 1 ? 500 : roundItem.id === 2 ? 1000 : 3000)}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                    <View className="items-center justify-center ml-2">
                        {isCompleted ? <View className="bg-green-500/20 p-2 rounded-full border border-green-500/40"><Ionicons name="checkmark-done" size={20} color="#10b981" /></View> : <MaterialCommunityIcons name={isLocked ? "lock" : "chevron-right"} size={24} color={isActive ? roundItem.color : THEME.textSecondary} />}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View>
            <View className="mb-6 flex-row justify-between items-center">
                <View>
                    <View className="flex-row items-center mb-1">
                        <View style={{ backgroundColor: THEME.accent, transform: [{ rotate: '45deg' }] }} className="w-2 h-2 rounded-sm mr-2" />
                        <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.3em]">Permanent Event</Text>
                    </View>
                    <Text style={{ color: THEME.text }} className="text-3xl font-black uppercase tracking-tighter italic">Grand Summoning</Text>
                </View>
            </View>

            <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="p-6 rounded-[35px] border-2 mb-8 shadow-sm">
                <View className="flex-row items-center justify-between bg-black/5 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 mb-5">
                    <View>
                        <Text style={{ color: THEME.textSecondary }} className="text-[8px] font-bold uppercase mb-1">SIGIL CODE</Text>
                        <Text style={{ color: THEME.text }} className="text-xl font-black tracking-widest italic">{referralCode}</Text>
                    </View>
                    <TouchableOpacity onPress={onCopy} className={`p-3 rounded-xl border ${copied ? 'bg-green-500/20 border-green-500' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'}`}>
                        <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={20} color={copied ? "#22c55e" : THEME.accent} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={onShare} activeOpacity={0.8} style={{ backgroundColor: THEME.accent }} className="py-4 rounded-2xl flex-row justify-center items-center shadow-lg">
                    <MaterialCommunityIcons name="auto-fix" size={18} color="white" />
                    <Text className="text-white font-black uppercase ml-2 tracking-widest text-[13px] italic">Summon Disciples</Text>
                </TouchableOpacity>
            </View>

            <View className="mb-8">
                {rounds.map((round) => <QuestRow key={round.id} roundItem={round} />)}
            </View>

            <View className="mb-20">
                <Text style={{ color: THEME.text }} className="text-xl font-black uppercase italic mb-6 px-1">Top Recruiter</Text>
                {safeData.leaderboard.length > 0 ? safeData.leaderboard.map((item, index) => (
                    <View key={index} style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="w-full p-4 rounded-[22px] border-2 mb-3 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <View className={`w-8 h-8 rounded-lg items-center justify-center mr-4 border ${index === 0 ? 'bg-yellow-500/20 border-yellow-500' : 'bg-black/5 dark:bg-black/20'}`}><Text style={{ color: index === 0 ? '#eab308' : THEME.text }} className="font-black text-xs">{index + 1}</Text></View>
                            <View>
                                <Text style={{ color: THEME.text }} className="font-bold uppercase text-[13px] italic">{item.username}</Text>
                                <Text style={{ color: THEME.textSecondary }} className="text-[8px] uppercase">AUTHOR</Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text style={{ color: THEME.accent }} className="font-black text-sm">{item.count}</Text>
                            <Text className="text-slate-500 text-[7px] font-bold uppercase">RECRUITS</Text>
                        </View>
                    </View>
                )) : <View className="py-12 items-center opacity-40"><MaterialCommunityIcons name="ghost-off" size={40} color={THEME.textSecondary} /><Text style={{ color: THEME.textSecondary }} className="text-[10px] font-bold uppercase mt-3 italic">Searching Souls...</Text></View>}
            </View>
        </View>
    );
};

// ========================================================
// ⚡️ NEW: LIVE COUNTDOWN COMPONENT
// ========================================================
const ComingSoonView = ({ event, isDark }) => {
    const eventColor = event.themeColor || '#a855f7';
    const tokenVisual = event.tokenVisual;
    const startsAtString = event.startsAt; // ⚡️ Extract string for dependency array

    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        if (!startsAtString) return;

        const calculateTimeLeft = () => {
            const targetDate = new Date(startsAtString).getTime();
            const difference = targetDate - new Date().getTime();

            if (difference > 0) {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60)
                });
            } else {
                setTimeLeft({ ready: true }); // Time is up!
            }
        };

        calculateTimeLeft(); // Run immediately
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);

        // ⚡️ CRITICAL FIX: We are now using the string in the dependency array
    }, [startsAtString]);

    // Formats numbers to always be 2 digits (e.g., "09" instead of "9")
    const formatTime = (time) => time < 10 ? `0${time}` : time;

    return (
        <View className="py-10 items-center justify-center px-4">

            {/* The Locked Event Icon Matrix */}
            <View className="items-center justify-center mb-8 relative">
                {/* Glowing background blob */}
                <View style={{ backgroundColor: eventColor, opacity: 0.15 }} className="absolute w-40 h-40 rounded-full" />

                {/* Dashed outer ring */}
                <View style={{ borderColor: eventColor, opacity: 0.5 }} className="w-32 h-32 rounded-full border-2 border-dashed absolute" />

                {/* Inner Solid Hub */}
                <View
                    style={{ borderColor: eventColor, backgroundColor: isDark ? '#050505' : '#ffffff' }}
                    className="w-24 h-24 rounded-full border-4 items-center justify-center shadow-lg"
                >
                    {/* ⚡️ Renders the TokenVisual if available, otherwise fallback icon */}
                    {tokenVisual ? (
                        <RemoteSvgIcon xml={tokenVisual.svgCode} lottieUrl={tokenVisual.lottieUrl} lottieJson={tokenVisual.lottieJson} size={55} color={eventColor} />
                    ) : (
                        <MaterialCommunityIcons name={event.icon || "lock-clock"} size={40} color={eventColor} />
                    )}
                </View>
            </View>

            <View className="bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/30 mb-6">
                <Text className="text-red-500 font-black uppercase text-[10px] tracking-[0.3em]">
                    Classified Payload
                </Text>
            </View>

            <Text className="text-slate-900 dark:text-white text-3xl font-black italic uppercase tracking-tighter text-center mb-3">
                {event.title}
            </Text>

            <Text className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.1em] text-[11px] text-center leading-relaxed mb-10 px-2">
                {event.description || "The portal is not yet fully formed. Gather your energy and await the signal."}
            </Text>

            {/* ⚡️ The Live Countdown Display */}
            <View
                style={{ backgroundColor: `${eventColor}10`, borderColor: `${eventColor}30` }}
                className="w-full px-6 py-6 rounded-2xl border items-center shadow-sm"
            >
                <Text className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-3 flex-row items-center">
                    <Ionicons name="time" size={12} color="#64748b" /> ETA TO LAUNCH
                </Text>

                {timeLeft?.ready ? (
                    <Text style={{ color: eventColor }} className="font-black uppercase tracking-[0.2em] text-xl text-center animate-pulse">
                        INITIALIZING...
                    </Text>
                ) : event.startsAt && timeLeft ? (
                    <View className="flex-row items-center justify-center w-full max-w-[250px] justify-between">
                        <View className="items-center">
                            <Text style={{ color: eventColor }} className="text-2xl font-black font-mono">{formatTime(timeLeft.days)}</Text>
                            <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-1">Days</Text>
                        </View>
                        <Text style={{ color: eventColor }} className="text-2xl font-black font-mono mb-4">:</Text>
                        <View className="items-center">
                            <Text style={{ color: eventColor }} className="text-2xl font-black font-mono">{formatTime(timeLeft.hours)}</Text>
                            <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-1">Hrs</Text>
                        </View>
                        <Text style={{ color: eventColor }} className="text-2xl font-black font-mono mb-4">:</Text>
                        <View className="items-center">
                            <Text style={{ color: eventColor }} className="text-2xl font-black font-mono">{formatTime(timeLeft.minutes)}</Text>
                            <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-1">Min</Text>
                        </View>
                        <Text style={{ color: eventColor }} className="text-2xl font-black font-mono mb-4">:</Text>
                        <View className="items-center w-10">
                            <Text style={{ color: eventColor }} className="text-2xl font-black font-mono">{formatTime(timeLeft.seconds)}</Text>
                            <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-1">Sec</Text>
                        </View>
                    </View>
                ) : (
                    <Text style={{ color: eventColor }} className="font-black uppercase tracking-[0.1em] text-lg text-center">
                        SIGNAL ENCRYPTED
                    </Text>
                )}
            </View>
        </View>
    );
};

export default function EventHubScreen() {
    const storage = useMMKV();
    const { user } = useUser();
    console.log(user.deviceId);

    const { activeEvents, isLoading: contextLoading } = useEvent();
    const { colorScheme } = useNativeWind();
    const isDark = colorScheme === "dark";

    const { tab } = useLocalSearchParams();


    const [activeTab, setActiveTab] = useState(activeEvents[0].id);
    // Default to 'referral' in dev build, otherwise use first gacha event
    useEffect(() => {
        if (tab) {
            const targetTab = Array.isArray(tab) ? tab[0] : tab;

            if (targetTab === 'gacha' && activeEvents?.length > 0) {
                const firstGacha = activeEvents.find(e => e.type === 'gacha');
                if (firstGacha) {
                    setActiveTab(firstGacha.id);
                    return;
                }
            }
            setActiveTab(targetTab);
        } else if (!__DEV__ && activeTab === 'referral' && activeEvents?.length > 0) {
            // In production, if somehow on referral tab, switch to first gacha
            const firstGacha = activeEvents.find(e => e.type === 'gacha');
            if (firstGacha) {
                setActiveTab(firstGacha.id);
            }
        }
    }, [tab, activeEvents]);

    const [poolsMap, setPoolsMap] = useState(() => {
        try { const cached = storage.getString(GACHA_POOLS_CACHE_KEY); return cached ? JSON.parse(cached) : {}; } catch { return {}; }
    });
    const [ownedMap, setOwnedMap] = useState(() => {
        try { const cached = storage.getString(GACHA_OWNED_CACHE_KEY); return cached ? JSON.parse(cached) : {}; } catch { return {}; }
    });
    const [pityMap, setPityMap] = useState(() => {
        try { const cached = storage.getString(GACHA_PITY_CACHE_KEY); return cached ? JSON.parse(cached) : {}; } catch { return {}; }
    });
    const [pointsMap, setPointsMap] = useState(() => {
        try { const cached = storage.getString(GACHA_POINTS_CACHE_KEY); return cached ? JSON.parse(cached) : {}; } catch { return {}; }
    });

    const [data, setData] = useState(() => {
        try { const cached = storage.getString(CACHE_KEY); return cached ? JSON.parse(cached) : { round: 1, roundTotal: 0, leaderboard: [], progress: 0 }; } catch { return { round: 1, roundTotal: 0, leaderboard: [], progress: 0 }; }
    });

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [copied, setCopied] = useState(false);

    const referralCode = user?.referralCode?.toUpperCase() || "RECRUIT_01";
    const referralLink = `https://play.google.com/store/apps/details?id=com.kaytee.oreblogda&referrer=${referralCode}`;

    const rounds = [
        { id: 1, title: "Initiate Rank", reward: "$10", color: "#cd7f32", icon: "fountain-pen-tip" },
        { id: 2, title: "Elite Vanguard", reward: "$50", color: "#94a3b8", icon: "sword-cross" },
        { id: 3, title: "Legendary Sannin", reward: "$100", color: "#fbbf24", icon: "crown" },
    ];

    const fetchAllData = useCallback(async (isBackground = false) => {
        const needsLoading = activeTab === 'referral'
            ? data.leaderboard.length === 0
            : !(poolsMap[activeTab]?.length > 0);

        if (!isBackground && needsLoading) setLoading(true);

        try {
            const refRes = await apiFetch("/referrals/stats");
            const refData = await refRes.json();
            if (refRes.ok) {
                setData(refData);
                storage.set(CACHE_KEY, JSON.stringify(refData));
            }

            if (activeTab !== 'referral' && activeEvents?.length > 0) {
                const activeEventDetail = activeEvents.find(e => e.id === activeTab);

                if (activeEventDetail?.type === 'gacha' && !activeEventDetail.isComing && activeEventDetail.status !== 'coming_soon') {
                    const gachaRes = await apiFetch(`/mobile/events/gacha?deviceId=${user?.deviceId}&eventId=${activeTab}`);
                    const gachaData = await gachaRes.json();

                    if (gachaRes.ok) {
                        setPoolsMap(prev => {
                            const next = { ...prev, [activeTab]: gachaData.pool || [] };
                            storage.set(GACHA_POOLS_CACHE_KEY, JSON.stringify(next));
                            return next;
                        });
                        setOwnedMap(prev => {
                            const next = { ...prev, [activeTab]: gachaData.ownedIds || [] };
                            storage.set(GACHA_OWNED_CACHE_KEY, JSON.stringify(next));
                            return next;
                        });
                        setPityMap(prev => {
                            const next = { ...prev, [activeTab]: gachaData.pityCount || 0 };
                            storage.set(GACHA_PITY_CACHE_KEY, JSON.stringify(next));
                            return next;
                        });
                        setPointsMap(prev => {
                            const next = { ...prev, [activeTab]: gachaData.eventPoints || 0 };
                            storage.set(GACHA_POINTS_CACHE_KEY, JSON.stringify(next));
                            return next;
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab, activeEvents, user?.deviceId]);

    useEffect(() => { fetchAllData(); }, [activeTab, fetchAllData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAllData(true);
    }, [fetchAllData]);

    const copyToClipboard = () => {
        Clipboard.setString(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const currentPool = poolsMap[activeTab] || [];
    const currentOwned = ownedMap[activeTab] || [];
    const currentPity = pityMap[activeTab] || 0;
    const currentPoints = pointsMap[activeTab] || 0;

    const updateTargetOwnedIds = (newIds) => {
        const updated = { ...ownedMap, [activeTab]: newIds };
        setOwnedMap(updated);
        storage.set(GACHA_OWNED_CACHE_KEY, JSON.stringify(updated));
    };

    const updateTargetEventPoints = (newPoints) => {
        const updated = { ...pointsMap, [activeTab]: newPoints };
        setPointsMap(updated);
        storage.set(GACHA_POINTS_CACHE_KEY, JSON.stringify(updated));
    };

    const updateTargetPityCount = (newPity) => {
        const updated = { ...pityMap, [activeTab]: newPity };
        setPityMap(updated);
        storage.set(GACHA_PITY_CACHE_KEY, JSON.stringify(updated));
    };

    const isInitialLoad = (contextLoading && !activeEvents?.length) ||
        (loading && activeTab !== 'referral' && currentPool.length === 0) ||
        (loading && activeTab === 'referral' && data.leaderboard.length === 0);

    if (isInitialLoad) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={THEME.accent} />
                <Text style={{ color: THEME.textSecondary, marginTop: 15 }} className="font-black uppercase text-[10px]">Syncing Events...</Text>
            </SafeAreaView>
        );
    }

    const renderActiveEvent = () => {
        if (activeTab === 'referral') {
            return <ReferralTab data={data} rounds={rounds} referralCode={referralCode} referralLink={referralLink} copied={copied} onCopy={copyToClipboard} onShare={() => Share.share({ message: `Join me: ${referralLink}` })} />;
        }

        const currentEvent = activeEvents?.find(e => e.id === activeTab);

        if (!currentEvent) {
            return (
                <View className="py-20 items-center justify-center">
                    <MaterialCommunityIcons name="timer-sand-empty" size={64} color={isDark ? "#334155" : "#cbd5e1"} />
                    <Text className="text-slate-500 font-black mt-4 uppercase tracking-widest text-xs text-center">
                        Event Concluded{"\n"}Or Unavailable
                    </Text>
                </View>
            );
        }

        // ========================================================
        // ⚡️ EPIC COMING SOON UI INTERCEPTOR
        // ========================================================
        if (currentEvent.isComing || currentEvent.status === 'coming_soon') {
            return <ComingSoonView event={currentEvent} isDark={isDark} />;
        }

        if (currentEvent.type === 'gacha') {
            if (currentEvent.gachaType === 'GRID') {
                return (
                    <GridGachaTab
                        eventData={currentEvent}
                        gachaPool={currentPool}
                        ownedIds={currentOwned}
                        setOwnedIds={updateTargetOwnedIds}
                        eventPoints={currentPoints}
                        setEventPoints={updateTargetEventPoints}
                        isDark={isDark}
                    />
                );
            } else {
                return (
                    <GachaTab
                        eventData={currentEvent}
                        gachaPool={currentPool}
                        ownedIds={currentOwned}
                        setOwnedIds={updateTargetOwnedIds}
                        pityCount={currentPity}
                        setPityCount={updateTargetPityCount}
                        isDark={isDark}
                    />
                );
            }
        }
        return <ClaimTab eventData={currentEvent} />;
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0a0a0a' : '#f9fafb' }}>
            <TopBar isDark={isDark} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                className="pt-4"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accent} />}
            >
                <View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 16 }}
                        className="mb-2"
                    >
                        {(__DEV__ || user.deviceId == "4bfe2b53-7591-462f-927e-68eedd7a6447") && (
                            <TouchableOpacity
                                onPress={() => setActiveTab('referral')}
                                activeOpacity={0.8}
                                className={`px-5 py-2.5 rounded-xl border flex-row items-center justify-center`}
                                style={{
                                    backgroundColor: activeTab === 'referral' ? 'rgba(59, 130, 246, 0.15)' : (isDark ? '#18181b' : '#ffffff'),
                                    borderColor: activeTab === 'referral' ? '#3b82f6' : (isDark ? '#27272a' : '#e5e7eb'),
                                    borderWidth: activeTab === 'referral' ? 1.5 : 1
                                }}
                            >
                                <MaterialCommunityIcons
                                    name="star-shooting"
                                    size={14}
                                    color={activeTab === 'referral' ? '#3b82f6' : '#9ca3af'}
                                    style={{ marginRight: 6 }}
                                />
                                <Text className={`font-black uppercase tracking-[0.15em] text-[10px] ${activeTab === 'referral' ? 'text-blue-500' : 'text-slate-500'}`}>
                                    Main Summon
                                </Text>
                            </TouchableOpacity>
                        )}

                        {activeEvents?.map((event) => {
                            const isActive = activeTab === event.id;
                            const tColor = event.themeColor || '#a855f7';

                            const isComing = event.isComing || event.status === 'coming_soon';

                            return (
                                <TouchableOpacity
                                    key={event.id}
                                    onPress={() => setActiveTab(event.id)}
                                    activeOpacity={0.8}
                                    className={`px-5 py-2.5 rounded-xl border flex-row items-center justify-center`}
                                    style={{
                                        backgroundColor: isActive ? `${tColor}20` : (isDark ? '#18181b' : '#ffffff'),
                                        borderColor: isActive ? tColor : (isDark ? '#27272a' : '#e5e7eb'),
                                        borderWidth: isActive ? 1.5 : 1
                                    }}
                                >
                                    <MaterialCommunityIcons
                                        name={isComing ? "lock" : "lightning-bolt"}
                                        size={14}
                                        color={isActive ? tColor : '#9ca3af'}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text
                                        style={{ color: isActive ? tColor : '#64748b' }}
                                        className="font-black uppercase tracking-[0.15em] text-[10px]"
                                    >
                                        {event.title}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>
                </View>

                <View className="px-4 pb-20">
                    {renderActiveEvent()}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}