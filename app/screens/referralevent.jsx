import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useMMKV } from "react-native-mmkv";
import { useColorScheme as useNativeWind } from "nativewind";
import { useCallback, useEffect, useState, useRef } from "react";
import {
    ActivityIndicator,
    Clipboard,
    Modal,
    RefreshControl,
    ScrollView,
    Share,
    TouchableOpacity,
    View,
    Dimensions
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    Easing as ReanimatedEasing,
    runOnJS,
    useAnimatedReaction // ⚡️ ADDED THIS IMPORT
} from 'react-native-reanimated';
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import * as Haptics from 'expo-haptics'; 

import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useUser } from "../../context/UserContext";
import { useEvent } from "../../context/EventContext";
import apiFetch from "../../utils/apiFetch";
import ClanIcon from "../../components/ClanIcon";
import TopBar from "../../components/Topbar";
import { useCoins } from "../../context/CoinContext";
import ClanBorder from "../../components/ClanBorder";
import { useAlert } from "../../context/AlertContext";
import { useLocalSearchParams } from "expo-router";

const { width } = Dimensions.get('window');
const CACHE_KEY = "referral_event_cache_v4";
const GACHA_POOL_CACHE_KEY = "gacha_pool_cache_v2";
const GACHA_OWNED_CACHE_KEY = "gacha_owned_cache_v2";

const RemoteSvgIcon = ({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    return <SvgXml xml={xml} width={size} height={size} color={color} />;
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
// ⚡️ COMPONENT 1: THE CLAIM TAB
// ==========================================
const ClaimTab = ({ eventData }) => {
    const storage = useMMKV(); 
    const { processTransaction, isProcessingTransaction } = useCoins();
    const [status, setStatus] = useState({ type: '', text: '' });
    const [isEventExpired, setIsEventExpired] = useState(false); 

    const claimId = eventData?.id || '1kpostevent';
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

    if (!eventData) {
        return (
            <View className="py-20 items-center justify-center opacity-30">
                <MaterialCommunityIcons name="ghost-outline" size={50} color={THEME.textSecondary} />
                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase mt-4 text-xs tracking-[0.3em]">No Active Operations</Text>
            </View>
        );
    }

    return (
        <View className="mb-20 items-center mt-4">
            <View className="w-full bg-[#0f172a] rounded-2xl p-6 relative border border-slate-800 shadow-xl overflow-hidden mt-4">
                
                <EventCountdown endsAt={eventData.endsAt} onExpire={setIsEventExpired} themeColor={themeColor} />
                <MaterialCommunityIcons name={EventIcon} size={250} color={themeColor} style={{ position: 'absolute', opacity: 0.04, bottom: -40, left: -40, transform: [{ rotate: '-15deg'}] }} />
                
                <View className="flex-row mb-6 mt-2">
                    <View style={{ backgroundColor: `${themeColor}20`, borderLeftColor: themeColor }} className="px-3 py-1 border-l-2 rounded-sm">
                        <Text style={{ color: themeColor }} className="text-[9px] font-black uppercase tracking-widest">Milestone Reward</Text>
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
                                {hasClaimed ? "Payload Acquired" : isEventExpired ? "Event Archived" : "Extract Payload"}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ==========================================
// ⚡️ COMPONENT 2: THE GACHA TAB 
// ==========================================
const GachaTab = ({ eventData, gachaPool, ownedIds, setOwnedIds, pityCount, setPityCount }) => {
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

    // Modal Preview States
    const [previewItem, setPreviewItem] = useState(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false); 

    const themeColor = eventData?.themeColor || '#facc15';
    const EventIcon = eventData?.icon || 'moon-waning-crescent';

    const scrollX = useSharedValue(0);
    const arrowY = useSharedValue(0); 
    const portalOuterRotate = useSharedValue(0);
    const portalInnerRotate = useSharedValue(0);

    const ITEM_SIZE = 120; 
    const WIN_INDEX = 30; 

    const pityProgress = Math.min(((pityCount || 0) / 100) * 100, 100);
    
    // ⚡️ FIXED: Using useAnimatedReaction instead of addListener to prevent Reanimated v3 crashes
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

    const getTierColor = (tier) => {
        if (tier === 'MYTHIC') return '#facc15';
        if (tier === 'EPIC') return '#a855f7';
        return '#3b82f6';
    };

    const handleSpin = (pullType) => {
        if (isSpinning || gachaPool.length === 0 || isEventExpired) return;
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsSpinning(true);
        setIsFetchingServer(true); 
        setShowReveal(true); 
        setShowSummaryModal(false);

        setTimeout(async () => {
            try {
                const response = await apiFetch("/mobile/events/gacha", {
                    method: "POST",
                    body: JSON.stringify({ deviceId: user.deviceId, pullType })
                });
                const data = await response.json();

                if (data.success) {
                    await fetchCoins(); 
                    if (data.inventory) setOwnedIds(data.inventory.map(i => i.itemId));
                    if (data.pityCount !== undefined) setPityCount(data.pityCount);

                    setPullResults(data.rewards);
                    setRevealStep(0);
                    setIsFetchingServer(false); 
                    startRouletteAnimation(data.rewards[0]);
                } else {
                    setIsSpinning(false);
                    setIsFetchingServer(false);
                    setShowReveal(false);
                    CustomAlert("Summoning Failed", data.error || "Not enough Chakra (OC).");
                }
            } catch (error) {
                setIsSpinning(false);
                setIsFetchingServer(false);
                setShowReveal(false);
                CustomAlert("Network Error", "The connection to the Great Library was lost.");
            }
        }, 50);
    };

    const handleAnimationComplete = (tier) => {
        setAnimationFinished(true);
        if (tier === 'MYTHIC' || tier === 'EPIC') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
    }

    const startRouletteAnimation = (wonItem) => {
        setAnimationFinished(false);
        scrollX.value = 0; 

        let track = [];
        while (track.length < 45) {
            let shuffled = [...gachaPool].sort(() => Math.random() - 0.5);
            if (track.length > 0 && track[track.length - 1].id === shuffled[0].id && shuffled.length > 1) {
                [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
            }
            track.push(...shuffled);
        }
        
        track = track.slice(0, 45); 
        track[WIN_INDEX] = wonItem;

        if (track[WIN_INDEX - 1].id === wonItem.id && gachaPool.length > 1) {
            track[WIN_INDEX - 1] = gachaPool.find(i => i.id !== wonItem.id) || track[WIN_INDEX - 1];
        }
        if (track[WIN_INDEX + 1].id === wonItem.id && gachaPool.length > 1) {
            track[WIN_INDEX + 1] = gachaPool.find(i => i.id !== wonItem.id) || track[WIN_INDEX + 1];
        }

        setRouletteTrack(track);

        const centerOffset = (width / 2) - (ITEM_SIZE / 2);
        const finalPosition = -(WIN_INDEX * ITEM_SIZE) + centerOffset;
        const randomTick = (Math.random() * 40) - 20;

        scrollX.value = withTiming(
            finalPosition + randomTick,
            {
                duration: 4500,
                easing: ReanimatedEasing.bezier(0.1, 0.8, 0.2, 1),
            },
            (finished) => {
                if (finished) runOnJS(handleAnimationComplete)(wonItem.tier);
            }
        );
    };

    const handleNextReveal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (revealStep < pullResults.length - 1) {
            const nextItem = pullResults[revealStep + 1];
            setRevealStep(prev => prev + 1);
            startRouletteAnimation(nextItem);
        } else {
            setShowReveal(false);
            setIsSpinning(false); 
            setShowSummaryModal(true);
        }
    };

    const handleSkipReveal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowReveal(false);
        setIsSpinning(false);
        setShowSummaryModal(true);
    };

    const activeRevealItem = pullResults[revealStep];

    if (!eventData) {
        return (
            <View className="py-20 items-center justify-center opacity-30">
                <MaterialCommunityIcons name="treasure-chest" size={50} color={THEME.textSecondary} />
                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase mt-4 text-xs tracking-[0.3em]">Vault is Closed</Text>
            </View>
        );
    }

    return (
        <View className="mb-20">
            {/* ⚡️ ITEM PREVIEW INFO MODAL */}
            <Modal visible={!!previewItem} transparent={true} animationType="fade">
                <View className="flex-1 bg-black/90 items-center justify-center px-6 z-50">
                    {previewItem && (
                        <View style={{ borderColor: getTierColor(previewItem.tier), shadowColor: getTierColor(previewItem.tier) }} className="w-full bg-[#0f172a] rounded-3xl p-6 border-2 items-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                            <TouchableOpacity onPress={() => setPreviewItem(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/10 rounded-full">
                                <Ionicons name="close" size={20} color="white" />
                            </TouchableOpacity>

                            <Text style={{ color: getTierColor(previewItem.tier) }} className="font-black tracking-[0.4em] uppercase text-[10px] mb-6">
                                {previewItem.tier} REWARD
                            </Text>

                            <View style={{ backgroundColor: `${getTierColor(previewItem.tier)}15`, borderColor: `${getTierColor(previewItem.tier)}50` }} className="w-32 h-32 rounded-2xl items-center justify-center border-2 mb-6">
                                {previewItem.category === 'BORDER' ? (
                                    <ClanBorder color={previewItem.visualConfig?.primaryColor} animationType={previewItem.visualConfig?.animationType || "singleSnake"}>
                                        <View className="w-16 h-16 bg-black/40 rounded-full" />
                                    </ClanBorder>
                                ) : (
                                    <RemoteSvgIcon xml={previewItem.visualConfig?.svgCode} size={80} color={previewItem.visualConfig?.color || previewItem.visualConfig?.primaryColor} />
                                )}
                            </View>

                            <Text className="text-white text-2xl font-black italic uppercase text-center mb-2">{previewItem.name}</Text>
                            
                            <View className="flex-row items-center flex-wrap justify-center gap-2 mb-6">
                                <View style={{ backgroundColor: `${getTierColor(previewItem.tier)}20` }} className="px-3 py-1.5 rounded-md">
                                    <Text style={{ color: getTierColor(previewItem.tier) }} className="text-[10px] font-black uppercase tracking-widest">{previewItem.category}</Text>
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

                            <View className="w-full bg-black/40 rounded-xl p-4 items-center border border-white/5">
                                <Text className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-1">Acquisition Rate</Text>
                                <Text style={{ color: getTierColor(previewItem.tier) }} className="text-xl font-black">{previewItem.baseDropRate}%</Text>
                            </View>

                            <TouchableOpacity onPress={() => setPreviewItem(null)} style={{ backgroundColor: getTierColor(previewItem.tier) }} className="w-full mt-6 py-4 rounded-xl items-center justify-center">
                                <Text className="text-slate-900 font-black uppercase tracking-[0.2em] text-sm">Close Intel</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>

            {/* ⚡️ ROULETTE REVEAL MODAL */}
            <Modal visible={showReveal} transparent={true} animationType="fade">
                <View className="flex-1 bg-black/95 items-center justify-center relative overflow-hidden">
                    
                    {/* ⚡️ SKIP BUTTON */}
                    {!isFetchingServer && pullResults.length > 1 && (
                        <TouchableOpacity 
                            onPress={handleSkipReveal} 
                            className="absolute top-12 right-6 z-50 bg-white/10 px-4 py-2 rounded-full border border-white/20"
                        >
                            <Text className="text-white font-black text-[10px] uppercase tracking-widest">Skip ⏭</Text>
                        </TouchableOpacity>
                    )}

                    {isFetchingServer ? (
                        <View className="items-center justify-center relative">
                            <Animated.View style={[outerPortalStyle, { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: themeColor, borderStyle: 'dashed', opacity: 0.4 }]} />
                            <Animated.View style={[innerPortalStyle, { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: themeColor, borderStyle: 'dotted', opacity: 0.7 }]} />
                            <MaterialCommunityIcons name={EventIcon} size={40} color={themeColor} className="animate-pulse drop-shadow-[0_0_15px_rgba(250,204,21,1)]" />
                            <Text style={{ color: themeColor }} className="font-black mt-28 text-xs uppercase tracking-[0.4em] animate-pulse text-center">
                                Breaching Vault...
                            </Text>
                        </View>
                    ) : (
                        <>
                            {activeRevealItem && animationDone && (
                                <View style={{ backgroundColor: getTierColor(activeRevealItem.tier), opacity: 0.2 }} className="absolute w-[800px] h-[800px] rounded-full blur-3xl transition-opacity duration-1000" />
                            )}

                            <Text className="text-white font-black text-xs uppercase tracking-[0.5em] mb-12">
                                {animationDone ? `${activeRevealItem?.tier} ARTIFACT` : "SUMMONING..."}
                            </Text>

                            <View className="h-44 justify-center w-full relative pt-4">
                                <Animated.View style={animatedArrowStyle} className="absolute top-0 left-1/2 -ml-4 z-30 drop-shadow-2xl items-center justify-center">
                                    <Ionicons name="caret-down" size={32} color="white" style={{ textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
                                </Animated.View>
                                
                                <Animated.View style={animatedTrackStyle}>
                                    {rouletteTrack.map((item, index) => {
                                        const isWinnerSlot = index === WIN_INDEX && animationDone;
                                        return (
                                            <View 
                                                key={index} 
                                                style={{ width: 100, marginHorizontal: 10, borderColor: getTierColor(item.tier), backgroundColor: `${getTierColor(item.tier)}15` }}
                                                className={`h-28 rounded-2xl border-2 items-center justify-center ${isWinnerSlot ? 'scale-110 shadow-lg shadow-' + getTierColor(item.tier) : 'opacity-50 scale-95'}`}
                                            >
                                                {item.category === 'BORDER' ? (
                                                    <ClanBorder color={item.visualConfig?.primaryColor} animationType={item.visualConfig?.animationType || "singleSnake"}>
                                                        <View className="w-12 h-12 bg-black/40 rounded-full" />
                                                    </ClanBorder>
                                                ) : (
                                                    <RemoteSvgIcon xml={item.visualConfig?.svgCode} size={50} color={item.visualConfig?.color || item.visualConfig?.primaryColor} />
                                                )}
                                            </View>
                                        )
                                    })}
                                </Animated.View>
                            </View>

                            <View className="mt-12 items-center h-40 w-full px-8">
                                {animationDone && activeRevealItem && (
                                    <>
                                        <TouchableOpacity onPress={() => setPreviewItem(activeRevealItem)} className="flex-row items-center justify-center mb-1">
                                            <Text style={{ color: getTierColor(activeRevealItem.tier) }} className="text-3xl font-black italic text-center mr-2">
                                                {activeRevealItem.name}
                                            </Text>
                                            <Ionicons name="information-circle-outline" size={24} color={getTierColor(activeRevealItem.tier)} />
                                        </TouchableOpacity>

                                        <Text className="text-slate-400 font-bold text-[10px] tracking-widest uppercase mb-6">
                                            TYPE: {activeRevealItem.category}
                                            {pullResults.length > 1 && ` (${revealStep + 1}/${pullResults.length})`}
                                        </Text>

                                        {activeRevealItem.isDuplicate && (
                                            <Text className="text-red-500 font-black text-[10px] tracking-widest uppercase mb-6 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                                                Duplicate Converted: +{activeRevealItem.refundAmount} OC
                                            </Text>
                                        )}

                                        <TouchableOpacity 
                                            onPress={handleNextReveal}
                                            style={{ backgroundColor: getTierColor(activeRevealItem.tier) }}
                                            className="w-full py-4 rounded-xl items-center justify-center shadow-lg"
                                        >
                                            <Text className="text-slate-900 font-black uppercase tracking-widest text-sm">
                                                {revealStep < pullResults.length - 1 ? "Reveal Next" : "Accept & View All"}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </>
                    )}
                </View>
            </Modal>

            {/* ⚡️ POST-PULL SUMMARY MODAL */}
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
                                    const isBorder = item.category === 'BORDER';
                                    const visual = item.visualConfig || {};
                                    const tierColor = getTierColor(item.tier);

                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            activeOpacity={0.8}
                                            onPress={() => setPreviewItem(item)}
                                            style={{ width: '48%', borderColor: `${tierColor}40`, backgroundColor: `${tierColor}10` }}
                                            className="mb-4 rounded-2xl border-2 items-center p-4 relative"
                                        >
                                            {item.isDuplicate && (
                                                <View className="absolute top-2 left-2 bg-red-500 px-2 py-0.5 rounded border border-red-400 z-10 shadow-sm">
                                                    <Text className="text-white font-black text-[8px] uppercase tracking-widest">Duplicate</Text>
                                                </View>
                                            )}
                                            
                                            <View className="w-16 h-16 items-center justify-center mb-3">
                                                {isBorder ? (
                                                    <ClanBorder color={visual.primaryColor || visual.color || "#f59e0b"} animationType={visual?.animationType || "singleSnake"}>
                                                        <View className="w-10 h-10 bg-black/40 rounded-full" />
                                                    </ClanBorder>
                                                ) : (
                                                    <RemoteSvgIcon xml={visual.svgCode} size={45} color={visual.color || visual.primaryColor}/>
                                                )}
                                            </View>

                                            <Text style={{ color: tierColor }} className="font-black text-[11px] uppercase text-center mb-1" numberOfLines={2}>
                                                {item.name}
                                            </Text>
                                            
                                            {item.isDuplicate ? (
                                                <Text className="text-red-400 text-[9px] font-bold tracking-widest uppercase mt-1">
                                                    +{item.refundAmount} OC
                                                </Text>
                                            ) : (
                                                <Text className="text-slate-400 text-[8px] font-bold tracking-widest uppercase mt-1">
                                                    {item.tier}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        <TouchableOpacity 
                            onPress={() => setShowSummaryModal(false)}
                            className="w-full bg-blue-600 py-4 rounded-xl items-center justify-center mt-4 shadow-lg shadow-blue-500/20"
                        >
                            <Text className="text-white font-black uppercase tracking-[0.2em] text-sm">Return to Hub</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ⚡️ GAMING GACHA BANNER */}
            <View className="mt-4 mb-8">
                <View className="w-full bg-[#0f172a] rounded-2xl p-6 border border-slate-800 relative overflow-hidden shadow-xl">
                    
                    <EventCountdown endsAt={eventData.endsAt} onExpire={setIsEventExpired} themeColor={themeColor} />
                    <MaterialCommunityIcons name={EventIcon} size={250} color={themeColor} style={{ position: 'absolute', opacity: 0.05, top: -40, right: -40 }} />
                    
                    <View className="flex-row mb-6 mt-2">
                        <View style={{ backgroundColor: `${themeColor}20`, borderLeftColor: themeColor }} className="px-3 py-1 border-l-2 rounded-sm">
                            <Text style={{ color: themeColor }} className="text-[9px] font-black uppercase tracking-widest">Limited Event</Text>
                        </View>
                    </View>

                    <View className="items-center mb-6">
                        <View style={{ backgroundColor: `${themeColor}15`, borderColor: `${themeColor}40`, shadowColor: themeColor }} className="w-16 h-16 rounded-xl border-2 items-center justify-center mb-4 transform rotate-3 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                            <MaterialCommunityIcons name={EventIcon} size={35} color={themeColor} />
                        </View>
                        <Text className="text-white text-3xl font-black uppercase tracking-tighter italic text-center">
                            {eventData.title}
                        </Text>
                        <Text className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.2em] text-center mt-2 leading-relaxed px-2">
                            {eventData.description}
                        </Text>
                    </View>

                    <View className="w-full mb-6">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-gray-400 font-bold text-[9px] uppercase tracking-widest">Mythic Pity</Text>
                            <Text className="text-yellow-400 font-black text-[10px] tracking-widest">{pityCount || 0} / 100</Text>
                        </View>
                        <View className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-slate-800">
                            <View className="h-full bg-yellow-400" style={{ width: `${pityProgress}%` }} />
                        </View>
                        <Text className="text-gray-500 font-bold text-[8px] uppercase tracking-widest text-center mt-2">
                            Guaranteed Mythic at 100 pulls
                        </Text>
                    </View>

                    <View className="flex-row gap-3 w-full">
                        <TouchableOpacity
                            disabled={isSpinning || gachaPool.length === 0 || isEventExpired}
                            onPress={() => handleSpin('1x')}
                            style={{ opacity: gachaPool.length === 0 || isEventExpired ? 0.5 : 1 }}
                            className="flex-1 bg-slate-800 border border-slate-700 h-14 rounded-xl flex-row items-center justify-center"
                        >
                            {isSpinning && !isFetchingServer ? <ActivityIndicator size="small" color={themeColor} /> : (
                                <>
                                    <Text className="text-slate-300 font-black uppercase text-[11px] mr-2">
                                        {isEventExpired ? 'Locked' : '1x Pull'}
                                    </Text>
                                    {!isEventExpired && (
                                        <>
                                            <Text style={{ color: themeColor }} className="font-black text-[12px]">50</Text>
                                            <View className="ml-1 scale-75"><ClanIcon type="OC" size={16} /></View>
                                        </>
                                    )}
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            disabled={isSpinning || gachaPool.length === 0 || isEventExpired}
                            onPress={() => handleSpin('11x')}
                            style={{ opacity: gachaPool.length === 0 || isEventExpired ? 0.5 : 1, backgroundColor: isEventExpired ? '#334155' : themeColor }}
                            className="flex-1 h-14 rounded-xl flex-row items-center justify-center shadow-lg shadow-black"
                        >
                            {isSpinning && !isFetchingServer ? <ActivityIndicator size="small" color="black" /> : (
                                <>
                                    <Text className="text-slate-900 font-black uppercase text-[11px] mr-2">
                                        {isEventExpired ? 'Locked' : '10+1 Pull'}
                                    </Text>
                                    {!isEventExpired && (
                                        <>
                                            <Text className="text-slate-900 font-black text-[12px]">500</Text>
                                            <View className="ml-1 scale-75"><ClanIcon type="OC" size={16} /></View>
                                        </>
                                    )}
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* ⚡️ GAMING LOOT TABLE GRID */}
            <View className="mb-10 px-1">
                <View className="flex-row items-center mb-4">
                    <MaterialCommunityIcons name="format-list-bulleted-square" size={16} color={THEME.textSecondary} />
                    <Text style={{ color: THEME.textSecondary }} className="font-black text-[11px] ml-2 uppercase tracking-[0.2em]">Acquisition Table</Text>
                </View>
                
                {gachaPool.length === 0 ? (
                    <ActivityIndicator size="small" color={themeColor} className="mt-4" />
                ) : (
                    <View className="flex-row flex-wrap justify-between">
                        {gachaPool.map((item, idx) => {
                            const isBorder = item.category === 'BORDER';
                            const visual = item.visualConfig || {};
                            const isOwned = ownedIds.includes(item.id); 
                            const tierColor = getTierColor(item.tier);

                            return (
                                <TouchableOpacity
                                    key={item.id || idx}
                                    activeOpacity={0.8}
                                    onPress={() => setPreviewItem(item)}
                                    style={{ width: '31%' }}
                                    className={`mb-4 rounded-xl border relative items-center p-2 pt-3 ${isOwned ? 'bg-green-500/10 border-green-500/30' : 'bg-[#0f172a] border-slate-800'}`}
                                >
                                    <View style={{ borderColor: isOwned ? '#22c55e' : `${tierColor}40`, backgroundColor: `${tierColor}10` }} className="w-14 h-14 rounded-lg border items-center justify-center mb-3">
                                        {isBorder ? (
                                            <ClanBorder color={visual.primaryColor || visual.color || "#f59e0b"} animationType={visual?.animationType || "singleSnake"}>
                                                <View className="w-8 h-8" />
                                            </ClanBorder>
                                        ) : (
                                            <RemoteSvgIcon xml={visual.svgCode} size={28} color={visual.color || visual.primaryColor}/>
                                        )}
                                    </View>

                                    <Text style={{ color: isOwned ? '#22c55e' : 'white' }} className="font-black text-[9px] uppercase text-center mb-1" numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                    <Text style={{ color: tierColor }} className="text-[8px] font-bold tracking-widest uppercase">
                                        {item.baseDropRate}%
                                    </Text>

                                    {isOwned && (
                                        <View className="absolute inset-0 bg-black/60 rounded-xl items-center justify-center z-10">
                                            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>
        </View>
    );
};

// ==========================================
// ⚡️ COMPONENT 3: THE REFERRAL TAB 
// ==========================================
const ReferralTab = ({ data, rounds, referralCode, copied, onCopy, onShare, referralLink }) => {
    const QuestRow = ({ roundItem }) => {
        const isActive = data.round === roundItem.id;
        const isLocked = roundItem.id > data.round;
        const isCompleted = roundItem.id < data.round;
        const progressClamped = Math.min(data.progress || 0, 100);

        return (
            <View
                style={{
                    borderColor: isActive ? roundItem.color : THEME.border,
                    backgroundColor: isActive ? `${roundItem.color}10` : THEME.card
                }}
                className={`flex-row items-center justify-between p-5 rounded-[25px] border-2 mb-4 relative overflow-hidden`}
            >
                {isLocked && <View className="absolute inset-0 bg-black/60 z-10 items-center justify-center rounded-2xl" />}

                <View className="flex-row items-center flex-1">
                    <View
                        style={{ backgroundColor: `${roundItem.color}20`, borderColor: `${roundItem.color}40` }}
                        className="w-12 h-12 rounded-2xl items-center justify-center border mr-4"
                    >
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
                                    <Text className="text-[8px] font-bold text-slate-500 uppercase">
                                        {data.roundTotal} SUMMONED
                                    </Text>
                                    <Text style={{ color: roundItem.color }} className="text-[8px] font-black uppercase">
                                        GOAL: {roundItem.goal || (roundItem.id === 1 ? 500 : roundItem.id === 2 ? 1000 : 3000)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <View className="items-center justify-center ml-2">
                        {isCompleted ? (
                            <View className="bg-green-500/20 p-2 rounded-full border border-green-500/40">
                                <Ionicons name="checkmark-done" size={20} color="#10b981" />
                            </View>
                        ) : (
                            <MaterialCommunityIcons
                                name={isLocked ? "lock" : "chevron-right"}
                                size={24}
                                color={isActive ? roundItem.color : THEME.textSecondary}
                            />
                        )}
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
                <View className="flex-row items-center mb-4">
                    <MaterialCommunityIcons name="seal" size={14} color="#ef4444" className="mr-2" />
                    <Text style={{ color: THEME.textSecondary }} className="text-[9px] font-bold uppercase tracking-widest">Your Spirit Sigil</Text>
                </View>

                <View className="flex-row items-center justify-between bg-black/5 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 mb-5">
                    <View>
                        <Text style={{ color: THEME.textSecondary }} className="text-[8px] font-bold uppercase mb-1">SIGIL CODE</Text>
                        <Text style={{ color: THEME.text }} className="text-xl font-black tracking-widest italic">{referralCode}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={onCopy}
                        className={`p-3 rounded-xl border ${copied ? 'bg-green-500/20 border-green-500' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'}`}
                    >
                        <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={20} color={copied ? "#22c55e" : THEME.accent} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    onPress={onShare}
                    activeOpacity={0.8}
                    style={{ backgroundColor: THEME.accent }}
                    className="py-4 rounded-2xl flex-row justify-center items-center shadow-lg"
                >
                    <MaterialCommunityIcons name="auto-fix" size={18} color="white" />
                    <Text className="text-white font-black uppercase ml-2 tracking-widest text-[13px] italic">Summon Disciples</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-row items-center mb-5 ml-1">
                <MaterialCommunityIcons name="medal-outline" size={16} color={THEME.accent} />
                <Text className="text-gray-500 font-black uppercase text-[11px] tracking-widest ml-2">Clan Progression</Text>
            </View>

            <View className="mb-8">
                {rounds.map((round) => (
                    <QuestRow key={round.id} roundItem={round} />
                ))}
            </View>

            <View className="mb-20">
                <View className="flex-row justify-between items-center mb-6 px-1">
                    <Text style={{ color: THEME.text }} className="text-xl font-black uppercase italic">Top Recruiter</Text>
                    <View style={{ backgroundColor: `${THEME.accent}20`, borderColor: THEME.accent }} className="px-3 py-1 rounded-full border">
                        <Text style={{ color: THEME.accent }} className="text-[9px] font-bold uppercase">Real-Time</Text>
                    </View>
                </View>

                {data.leaderboard.length > 0 ? (
                    data.leaderboard.map((item, index) => (
                        <View
                            key={index}
                            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
                            className="w-full p-4 rounded-[22px] border-2 mb-3 flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center">
                                <View className={`w-8 h-8 rounded-lg items-center justify-center mr-4 border ${index === 0 ? 'bg-yellow-500/20 border-yellow-500' : 'bg-black/5 dark:bg-black/20 border-black/10 dark:border-white/10'}`}>
                                    <Text style={{ color: index === 0 ? '#eab308' : THEME.text }} className="font-black text-xs">{index + 1}</Text>
                                </View>
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
                    ))
                ) : (
                    <View className="py-12 items-center opacity-40">
                        <MaterialCommunityIcons name="ghost-off" size={40} color={THEME.textSecondary} />
                        <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-bold uppercase mt-3 italic">Searching for Awakened Souls...</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

// ==========================================
// ⚡️ MAIN COMPONENT: EVENT HUB SCREEN
// ==========================================
export default function EventHubScreen() {
    const storage = useMMKV();
    const { user } = useUser();
    const CustomAlert = useAlert();
    
    const { activeEvent } = useEvent(); 
    
    const { colorScheme } = useNativeWind();
    const isDark = colorScheme === "dark";

    const { tab } = useLocalSearchParams(); 
    const [activeTab, setActiveTab] = useState(tab || 'claim');

    const [pityCount, setPityCount] = useState(0); 

    useEffect(() => {
        if (tab && ['referral', 'gacha', 'claim'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [tab]);

    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    const [gachaPool, setGachaPool] = useState([]);
    const [ownedIds, setOwnedIds] = useState([]); 
    
    const [data, setData] = useState({
        round: 1,
        roundTotal: 0,
        leaderboard: [],
        currentMilestone: { goal: 500, reward: "$10", winners: 1 },
        progress: 0
    });

    const referralCode = user?.referralCode?.toUpperCase() || "RECRUIT_01";
    const referralLink = `https://play.google.com/store/apps/details?id=com.kaytee.oreblogda&referrer=${referralCode}`;

    const rounds = [
        { id: 1, title: "Initiate Rank", reward: "$10", color: "#cd7f32", icon: "fountain-pen-tip" },
        { id: 2, title: "Elite Vanguard", reward: "$50", color: "#94a3b8", icon: "sword-cross" },
        { id: 3, title: "Legendary Sannin", reward: "$100", color: "#fbbf24", icon: "crown" },
    ];

    const fetchEventData = useCallback(async (isBackground = false) => {
        if (!isBackground && data.leaderboard.length === 0) setLoading(true);
        try {
            const refRes = await apiFetch("/referrals/stats", { method: "GET" });
            const refData = await refRes.json();

            if (refRes.ok && refData.success) {
                const updatedData = {
                    round: refData.round,
                    roundTotal: refData.roundTotal,
                    leaderboard: refData.leaderboard || [],
                    currentMilestone: refData.currentMilestone,
                    progress: refData.progress
                };
                setData(updatedData);
                storage.set(CACHE_KEY, JSON.stringify(updatedData));
            }

            const deviceParam = user?.deviceId ? `?deviceId=${user.deviceId}` : '';
            const gachaRes = await apiFetch(`/mobile/events/gacha${deviceParam}`, { method: "GET" });
            const gachaData = await gachaRes.json();
            
            if (gachaRes.ok && gachaData.success) {
                setGachaPool(gachaData.pool);
                setOwnedIds(gachaData.ownedIds || []);
                setPityCount(gachaData.pityCount || 0); 
                
                storage.set(GACHA_POOL_CACHE_KEY, JSON.stringify(gachaData.pool));
                storage.set(GACHA_OWNED_CACHE_KEY, JSON.stringify(gachaData.ownedIds || []));
            }

        } catch (error) {
            console.error("Failed to fetch event data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [data.leaderboard.length, user?.deviceId]);

    useEffect(() => {
        try {
            const cachedRef = storage.getString(CACHE_KEY);
            const cachedGachaPool = storage.getString(GACHA_POOL_CACHE_KEY);
            const cachedOwnedIds = storage.getString(GACHA_OWNED_CACHE_KEY);
            
            if (cachedRef) setData(JSON.parse(cachedRef));
            if (cachedGachaPool) setGachaPool(JSON.parse(cachedGachaPool));
            if (cachedOwnedIds) setOwnedIds(JSON.parse(cachedOwnedIds));
        } catch (e) {
            console.log("Cache parse error:", e);
        }
        
        fetchEventData(true);
    }, [fetchEventData, storage]);

    const copyToClipboard = () => {
        Clipboard.setString(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const onShare = async () => {
        try {
            await Share.share({
                message: `Join me on OreBlogda - My Anime blog! 🌀 Help us unlock the ${rounds[data.round - 1]?.reward} Grand Reward: ${referralLink}`,
            });
        } catch (error) {
            console.log(error.message);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchEventData(true);
    }, [fetchEventData]);

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={THEME.accent} />
                <Text style={{ color: THEME.textSecondary, marginTop: 15 }} className="font-black uppercase text-[10px] tracking-[0.2em]">
                    Connecting to Event Server...
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
            <TopBar isDark={isDark} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                className="px-4 pt-4"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accent} />}
            >
                {/* ⚡️ UN-BOXED GAMING TAB SWITCHER */}
                <View className="flex-row mb-6 px-2 border-b border-slate-800">
                    <TouchableOpacity
                        onPress={() => setActiveTab('referral')}
                        className={`pb-3 mr-6 items-center justify-center border-b-2 ${activeTab === 'referral' ? 'border-[#3b82f6]' : 'border-transparent'}`}
                    >
                        <Text className={`font-black uppercase tracking-widest text-[11px] ${activeTab === 'referral' ? 'text-[#3b82f6]' : 'text-slate-500'}`}>
                            Summon
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('gacha')}
                        className={`pb-3 mr-6 items-center justify-center border-b-2 ${activeTab === 'gacha' ? 'border-[#f59e0b]' : 'border-transparent'}`}
                    >
                        <Text className={`font-black uppercase tracking-widest text-[11px] ${activeTab === 'gacha' ? 'text-[#f59e0b]' : 'text-slate-500'}`}>
                            Eid Event
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('claim')}
                        className={`pb-3 mr-6 items-center justify-center border-b-2 ${activeTab === 'claim' ? 'border-[#a855f7]' : 'border-transparent'}`}
                    >
                        <Text className={`font-black uppercase tracking-widest text-[11px] ${activeTab === 'claim' ? 'text-[#a855f7]' : 'text-slate-500'}`}>
                            1000 Posts Event
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ⚡️ RENDER ACTIVE TAB COMPONENT */}
                {activeTab === 'referral' ? (
                    <ReferralTab
                        data={data}
                        rounds={rounds}
                        referralCode={referralCode}
                        referralLink={referralLink}
                        copied={copied}
                        onCopy={copyToClipboard}
                        onShare={onShare}
                    />
                ) : activeTab === 'gacha' ? (
                    <GachaTab 
                        eventData={activeEvent?.gacha} 
                        gachaPool={gachaPool} 
                        ownedIds={ownedIds} 
                        setOwnedIds={setOwnedIds} 
                        pityCount={pityCount} 
                        setPityCount={setPityCount}
                    />
                ) : (
                    <ClaimTab eventData={activeEvent?.claim} />
                )}

            </ScrollView>
        </SafeAreaView>
    );
}