import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Linking, Modal, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useMMKV } from 'react-native-mmkv';
import { SvgXml } from 'react-native-svg';
import { useCoins } from '../context/CoinContext';
import { useEvent } from '../context/EventContext';
import { useUser } from '../context/UserContext';
import CoinIcon from './ClanIcon';
import { Text } from './Text';
import THEME from './useAppTheme';

const { width } = Dimensions.get('window');
const GLOBAL_COOLDOWN_KEY = "global_promo_cooldown_timestamp";
const COLLAB_COOLDOWN_KEY = "collab_modal_last_shown";
const COLLAB_WEB_LINK = "https://www.moviex.name.ng/";
const COLLAB_IMAGE_URI = "https://res.cloudinary.com/donakg9he/image/upload/v1778998640/WhatsApp_Image_2026-05-17_at_7.14.42_AM_k2llzm.jpg"; // Replace with your own collaboration image
const MODAL_BG_IMAGE_URI = "https://res.cloudinary.com/donakg9he/image/upload/v1779001079/WhatsApp_Image_2026-05-17_at_7.56.39_AM_bbaxdp.jpg"; // Background image for the modal surface

let hasShownThisSession = false;

const RemoteSvgIcon = React.memo(({ xml, lottieUrl, lottieJson, size = 50, color }) => {
    if (lottieJson || lottieUrl) {
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <LottieView
                    source={lottieJson ? lottieJson : { uri: lottieUrl }}
                    autoPlay
                    loop
                    style={{ width: size * 1.2, height: size * 1.2 }}
                    resizeMode="contain"
                    renderMode="hardware" // 🔥 Good choice for performance
                />
            </View>
        );
    }

    // ⚡️ 2. SVG Validation & Color Injection
    // We use useMemo so the string replacement ONLY happens when inputs change
    const processedXml = useMemo(() => {
        if (!xml || typeof xml !== 'string' || !xml.includes('<svg')) {
            return null;
        }
        // Injects the color into the XML string
        return xml.replace(/currentColor/g, color || 'white');
    }, [xml, color]);

    // ⚡️ 3. Strict SVG Check (Prevents 'push of null' crashes)
    if (!processedXml) {
        return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    }

    // ⚡️ 4. Render Valid SVG
    return <SvgXml xml={processedXml} width={size} height={size} />;
});

const CountdownTimer = ({ startsAt, color }) => {
    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        if (!startsAt) return;
        const launchDate = new Date(startsAt);

        const calculateTimeLeft = () => {
            const diff = launchDate.getTime() - new Date().getTime();
            if (diff > 0) {
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((diff / 1000 / 60) % 60),
                    seconds: Math.floor((diff / 1000) % 60)
                });
            } else {
                setTimeLeft({ ready: true });
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [startsAt]);

    const formatTime = (t) => t < 10 ? `0${t}` : t;

    if (!startsAt) return null;

    if (timeLeft?.ready) {
        return <Text style={{ color }} className="font-black uppercase tracking-[0.2em] text-sm animate-pulse mt-4">Initializing...</Text>;
    }

    if (!timeLeft) return null;

    return (
        <View style={{ backgroundColor: `${color}10`, borderColor: `${color}30` }} className="w-full mt-4 px-4 py-3 rounded-xl border items-center shadow-sm">
            <Text className="text-slate-500 font-black uppercase text-[9px] tracking-widest mb-1.5 flex-row items-center">
                <Ionicons name="time" size={10} color="#64748b" /> ETA TO LAUNCH
            </Text>
            <View className="flex-row items-center justify-between w-full px-2">
                <View className="items-center">
                    <Text style={{ color }} className="text-xl font-black font-mono">{formatTime(timeLeft.days)}</Text>
                    <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Days</Text>
                </View>
                <Text style={{ color }} className="text-xl font-black font-mono pb-3">:</Text>
                <View className="items-center">
                    <Text style={{ color }} className="text-xl font-black font-mono">{formatTime(timeLeft.hours)}</Text>
                    <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Hrs</Text>
                </View>
                <Text style={{ color }} className="text-xl font-black font-mono pb-3">:</Text>
                <View className="items-center">
                    <Text style={{ color }} className="text-xl font-black font-mono">{formatTime(timeLeft.minutes)}</Text>
                    <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Min</Text>
                </View>
                <Text style={{ color }} className="text-xl font-black font-mono pb-3">:</Text>
                <View className="items-center w-6">
                    <Text style={{ color }} className="text-xl font-black font-mono">{formatTime(timeLeft.seconds)}</Text>
                    <Text className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Sec</Text>
                </View>
            </View>
        </View>
    );
};

export default function DailyModal() {
    const storage = useMMKV();
    const router = useRouter();
    const { user } = useUser();
    const { processTransaction, isProcessingTransaction } = useCoins();
    const { activeEvents } = useEvent();

    const [visible, setVisible] = useState(false);
    const [targetDay, setTargetDay] = useState(1);
    const [hasClaimed, setHasClaimed] = useState(false);
    const [modalMode, setModalMode] = useState(null);
    const [currentPromo, setCurrentPromo] = useState(null);

    const timeoutRef = useRef(null);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    const activeBackground = isDarkMode ? '#0f172a' : '#f8fafc';
    const activeSurface = isDarkMode ? '#111827' : '#ffffff';
    const activeText = isDarkMode ? '#f8fafc' : '#0f172a';
    const activeSecondary = isDarkMode ? '#94a3b8' : '#475569';

    // Clean up timeouts on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // ⚡️ HELPER: Check if there's an event waiting
    const getNextEvent = useCallback(() => {
        if (!activeEvents || activeEvents.length === 0) return null;

        const now = new Date().getTime();
        const globalCooldown = storage.getNumber(GLOBAL_COOLDOWN_KEY) || 0;

        if (now < globalCooldown) return null;

        const todayStr = new Date().toDateString();
        const eventQueue = activeEvents.map(evt => ({
            ...evt,
            tabKey: evt.type === 'gacha' ? 'gacha' : 'claim'
        }));

        return eventQueue.find(evt => {
            const dismissedDate = storage.getString(`last_dismissed_${evt.id}`);

            return dismissedDate !== todayStr
        });
    }, [activeEvents, storage]);

    const hasCollabCooldown = useCallback(() => {
        const lastShown = storage.getNumber(COLLAB_COOLDOWN_KEY) || 0;
        return new Date().getTime() - lastShown < 24 * 60 * 60 * 1000;
    }, [storage]);

    const canShowCollab = useCallback(() => {
        return !hasCollabCooldown();
    }, [hasCollabCooldown]);

    const showCollabAndTrack = useCallback(() => {
        storage.set(COLLAB_COOLDOWN_KEY, new Date().getTime());
    }, [storage]);

    useEffect(() => {
        if (!user || hasShownThisSession) return

        const todayStr = new Date().toDateString();
        const localClaimedToday = storage.getBoolean(`daily_claimed_${todayStr}`);
        const serverClaimedToday = user.lastClaimedDate ? new Date(user.lastClaimedDate).toDateString() === todayStr : false;
        const canClaimToday = !localClaimedToday && !serverClaimedToday;
        const currentStreak = user.consecutiveStreak || 0;

        if (!canClaimToday) {
            setTargetDay(currentStreak);
        } else {
            setTargetDay((currentStreak % 7) + 1);
        }

        // Check if there is an event waiting
        const nextPromo = getNextEvent();

        if (nextPromo) setCurrentPromo(nextPromo);

        // Logic 1: Show Daily Login First
        if (canClaimToday && !hasClaimed) {
            setModalMode('daily');
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }

        // Logic 2: Show Event (if daily login was already claimed previously)
        if (nextPromo) {
            setModalMode('event');
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }

        // Logic 3: Show one static collaboration view, once every 24 hours.
        if (canShowCollab()) {
            setModalMode('collab');
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [user, activeEvents, hasClaimed, canShowCollab, getNextEvent, storage]);

    const handleClaimDaily = async () => {
        if (isProcessingTransaction) return;

        const type = targetDay === 7 ? 'daily_login_7' : 'daily_login';
        const result = await processTransaction('claim', type, null, null);

        if (result.success) {
            const todayStr = new Date().toDateString();
            setHasClaimed(true);
            storage.set(`daily_claimed_${todayStr}`, true);

            // Wait 1 second to show the "Acquired" checkmark safely
            timeoutRef.current = setTimeout(() => {
                // ⚡️ IF there is an event waiting, switch to it! Otherwise, show collab if available.
                if (currentPromo) {
                    setModalMode('event');
                } else if (canShowCollab()) {
                    showCollabAndTrack();
                    setModalMode('collab');
                } else {
                    hasShownThisSession = true;
                    setVisible(false);
                }
            }, 1000);
        } else {
            // Transaction failed (likely a server desync)
            const todayStr = new Date().toDateString();
            storage.set(`daily_claimed_${todayStr}`, true);

            if (currentPromo) {
                setModalMode('event');
            } else if (canShowCollab()) {
                showCollabAndTrack();
                setModalMode('collab');
            } else {
                hasShownThisSession = true;
                setVisible(false);
            }
        }
    };

    const handleDismissEvent = () => {
        if (modalMode === 'event' && currentPromo) {
            storage.set(`last_dismissed_${currentPromo.id}`, new Date().toDateString());
            const thirtyMinsFromNow = new Date().getTime() + (30 * 60 * 1000);
            storage.set(GLOBAL_COOLDOWN_KEY, thirtyMinsFromNow);
        } else if (modalMode === 'daily') {
            // ⚡️ If they dismiss the daily login without claiming, still check for events!
            if (currentPromo) {
                setModalMode('event');
                return; // Stop here, don't close the modal yet
            }

            if (canShowCollab()) {
                showCollabAndTrack();
                setModalMode('collab');
                return;
            }
        } else if (modalMode === 'collab') {
            showCollabAndTrack();
        }

        hasShownThisSession = true;
        setVisible(false);
    };

    const handleGoToEvent = () => {
        handleDismissEvent();
        const targetTab = currentPromo?.id || 'referral';
        router.push(`/screens/referralevent?tab=${targetTab}`);
    };

    const handleOpenCollab = async () => {
        try {
            const supported = await Linking.canOpenURL(COLLAB_WEB_LINK);
            if (supported) {
                await Linking.openURL(COLLAB_WEB_LINK);
            }
        } catch (error) {
            console.warn('Unable to open collaboration link', error);
        }

        showCollabAndTrack();
        hasShownThisSession = true;
        setVisible(false);
    };

    if (!visible || !modalMode) return null;

    const rewardAmount = targetDay === 7 ? 50 : 10;
    const eventColor = currentPromo?.themeColor || '#a855f7';
    const EventIcon = currentPromo?.icon || 'party-popper';
    const tokenVisual = currentPromo?.tokenVisual || null;

    const isComingSoon = currentPromo?.isComing || currentPromo?.status === 'coming_soon';

    // ⚡️ FIXED: The dismiss button ONLY hides when a transaction is actively spinning
    const showDismissButton = !isProcessingTransaction;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View className="flex-1 justify-center items-center px-3" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.92)' : 'rgba(15,23,42,0.75)' }}>
                {modalMode === 'collab' && (
                    <View className="absolute inset-0 opacity-10">
                        <Image
                            source={{ uri: MODAL_BG_IMAGE_URI }}
                            contentFit="cover"
                            style={{ width: '100%', height: '100%', opacity: 0.4 }}
                        />
                    </View>
                )}

                <View
                    style={{ backgroundColor: activeSurface, borderColor: modalMode === 'daily' ? THEME.accent : eventColor }}
                    className={`w-full rounded-2xl px-3 py-8 border-2 items-center shadow-2xl relative ${modalMode === 'daily' ? 'shadow-blue-500/40' : 'shadow-purple-500/30'}`}
                >
                    {showDismissButton && (
                        <TouchableOpacity
                            onPress={handleDismissEvent}
                            className="absolute top-4 right-4 z-50 p-2 bg-white/10 rounded-full"
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    )}

                    {modalMode === 'daily' && (
                        <View className="w-full items-center">
                            <View className="bg-blue-500/15 px-4 py-2 rounded-3xl border border-blue-500/20 mb-6">
                                <Text style={{ color: THEME.accent }} className="font-black text-[11px] uppercase tracking-[0.25em] text-center">
                                    Day {targetDay} Login
                                </Text>
                            </View>

                            <Text style={{ color: activeText }} className="text-2xl font-black uppercase tracking-[0.18em] text-center mb-3">
                                Daily Recharge
                            </Text>
                            <Text style={{ color: activeSecondary }} className="text-[13px] leading-6 text-center mb-6 px-2">
                                Claim your daily OC burst, keep your streak alive, and power up today’s grind with a fast boost.
                            </Text>

                            {hasClaimed ? (
                                <View className="items-center mb-8 mt-4 w-full">
                                    <View className="w-24 h-24 bg-green-500/10 rounded-2xl items-center justify-center border border-green-500/30 mb-4 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                                        <Ionicons name="checkmark" size={50} color="#22c55e" />
                                    </View>
                                    <Text className="text-green-500 font-black text-2xl italic uppercase tracking-[0.3em]">Acquired</Text>
                                </View>
                            ) : (
                                <View className="items-center mb-8 mt-4 w-full">
                                    <Text className="text-slate-400 font-semibold text-[11px] uppercase tracking-[0.25em] mb-2">
                                        Energy Payload Ready
                                    </Text>
                                    <View className="flex-row items-center gap-3">
                                        <Text className="text-white text-6xl font-black italic tracking-tighter">
                                            +{rewardAmount}
                                        </Text>
                                        <CoinIcon size={44} type="OC" />
                                    </View>
                                </View>
                            )}

                            {!hasClaimed && (
                                <TouchableOpacity
                                    onPress={handleClaimDaily}
                                    disabled={isProcessingTransaction}
                                    style={{ backgroundColor: THEME.accent }}
                                    className="w-full h-14 rounded-xl flex-row items-center justify-center shadow-lg shadow-blue-500/50"
                                >
                                    {isProcessingTransaction ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="lightning-bolt" size={20} color="white" />
                                            <Text className="text-white font-black text-[12px] uppercase tracking-[0.2em] ml-2">
                                                Claim Boost
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* ========================================== */}
                    {/* ⚡️ MODE 2: DYNAMIC EVENT PROMO (W/ COUNTDOWN) */}
                    {/* ========================================== */}
                    {modalMode === 'event' && currentPromo && (
                        <View className="w-full items-center">
                            {/* 1. CONTAINER WITH AURA GLOW */}
                            <View
                                style={{
                                    backgroundColor: '#0f172a',
                                    borderColor: eventColor,
                                    shadowColor: eventColor,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 20,
                                    elevation: 10 // Android Glow
                                }}
                                className="w-full rounded-3xl border-2 overflow-hidden relative"
                            >
                                {/* 2. THE POSTER IMAGE (EXPO-IMAGE) */}
                                {currentPromo.promoImage ? (
                                    <View className="w-full aspect-[1/1] relative">
                                        <Image
                                            source={currentPromo.promoImage}
                                            contentFit="cover"
                                            transition={500} // Smooth fade-in
                                            style={{ width: '100%', height: '100%' }}
                                        />

                                        {/* 3. VIGNETTE OVERLAY (Bottom Shadow for text readability) */}
                                        <LinearGradient
                                            colors={['transparent', 'rgba(15, 23, 42, 0.5)', '#0f172a']}
                                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }}
                                        />

                                        {/* 4. TOP BADGE OVERLAY */}
                                        <View
                                            style={{ backgroundColor: `${eventColor}CC` }}
                                            className="absolute top-4 left-4 px-3 py-1 rounded-full flex-row items-center"
                                        >
                                            <MaterialCommunityIcons
                                                name={isComingSoon ? "radar" : "broadcast"}
                                                size={12}
                                                color="white"
                                            />
                                            <Text className="text-white font-black text-[9px] uppercase tracking-widest ml-1.5">
                                                {isComingSoon ? "Incoming Signal" : "Live Event"}
                                            </Text>
                                        </View>

                                        {/* 5. CONTENT OVERLAY (Title & Timer) */}
                                        <View className="absolute bottom-0 left-0 right-0 p-6 items-center">
                                            <Text className="text-white text-3xl font-black italic uppercase text-center tracking-tighter mb-1">
                                                {currentPromo.title}
                                            </Text>

                                            {isComingSoon && currentPromo.startsAt && (
                                                <View className="w-full">
                                                    <CountdownTimer startsAt={currentPromo.startsAt} color={eventColor} />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ) : (
                                    /* FALLBACK: YOUR ORIGINAL ICON-BASED UI */
                                    <View className="w-full items-center py-8 px-6">
                                        <View
                                            style={{ backgroundColor: `${eventColor}10`, borderColor: `${eventColor}40` }}
                                            className="w-24 h-24 rounded-full items-center justify-center border-2 mb-6"
                                        >
                                            {tokenVisual ? (
                                                <RemoteSvgIcon xml={tokenVisual.svgCode} lottieUrl={tokenVisual.lottieUrl} size={55} color={eventColor} />
                                            ) : (
                                                <MaterialCommunityIcons name={EventIcon} size={50} color={eventColor} />
                                            )}
                                        </View>
                                        <Text style={{ color: activeText }} className="text-white text-xl font-black italic uppercase text-center mb-2">
                                            {currentPromo.title}
                                        </Text>
                                        <Text style={{ color: activeSecondary }} className="text-[10px] font-bold text-center uppercase tracking-widest px-4">
                                            {currentPromo.description}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* 6. ACTION BUTTON (Stays outside the card for hierarchy) */}
                            <TouchableOpacity
                                onPress={handleGoToEvent}
                                style={{
                                    backgroundColor: eventColor,
                                    shadowColor: eventColor,
                                    shadowOffset: { width: 0, height: 10 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 15
                                }}
                                className="w-full h-14 rounded-2xl flex-row items-center justify-center mt-6"
                            >
                                <Text className="text-slate-900 font-black text-[13px] uppercase tracking-[0.2em]">
                                    {isComingSoon ? "View Intel" : "Enter Portal"}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color="#0f172a" style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {modalMode === 'collab' && (
                        <View className="w-full items-center">
                            <MotiView
                                from={{ opacity: 0, translateY: 18 }}
                                animate={{ opacity: 1, translateY: 0 }}
                                transition={{ type: 'timing', duration: 350 }}
                                className="w-full rounded-3xl border p-6"
                                style={{ backgroundColor: activeSurface, borderColor: activeSecondary, shadowColor: THEME.accent, shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}
                            >
                                <View className="relative mb-5 rounded-3xl overflow-hidden bg-slate-950/10 border border-white/5">
                                    <Image
                                        source={{ uri: COLLAB_IMAGE_URI }}
                                        contentFit="cover"
                                        transition={500}
                                        style={{ width: '100%', height: 160 }}
                                    />
                                    <LinearGradient
                                        colors={['transparent', 'rgba(15, 23, 42, 0.8)']}
                                        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
                                    />
                                </View>

                                <View className="items-center px-1">
                                    <Text style={{ color: activeText }} className="text-slate-300 uppercase tracking-[0.35em] text-[10px] font-black mb-3">
                                        Exclusive Collaboration
                                    </Text>

                                    <View className="rounded-full bg-white/5 border border-slate-700 px-4 py-2 flex-row items-center justify-center space-x-2 mb-4">
                                        <Text style={{ color: activeText }} className="text-[11px] font-black uppercase">OREBLOGDA</Text>
                                        <Text style={{ color: activeSecondary }} className="text-[11px] font-black uppercase">X</Text>
                                        <Text style={{ color: activeText }} className="text-[11px] font-black uppercase">MOVIEX</Text>
                                    </View>

                                    <Text style={{ color: activeSecondary }} className="text-[13px] leading-7 text-center mb-6 px-3">
                                        Discover the OREBLOGDA x MOVIEX launch. Expect exclusive drops, limited-time story beats, and rewards straight into your world.
                                    </Text>
                                </View>

                                <LinearGradient
                                    colors={[THEME.accent, '#7c3aed']}
                                    start={[0, 0]}
                                    end={[1, 1]}
                                    className="w-full rounded-2xl overflow-hidden mb-3"
                                >
                                    <TouchableOpacity
                                        onPress={handleOpenCollab}
                                        className="w-full h-14 items-center justify-center"
                                    >
                                        <Text className="text-slate-900 font-black text-[13px] uppercase tracking-[0.2em]">
                                            Open MOVIEX
                                        </Text>
                                    </TouchableOpacity>
                                </LinearGradient>

                                <TouchableOpacity
                                    onPress={handleDismissEvent}
                                    className="w-full h-14 rounded-2xl border border-slate-300/20 bg-white/5 items-center justify-center"
                                >
                                    <Text style={{ color: activeText }} className="font-black text-[12px] uppercase tracking-[0.2em]">
                                        Maybe later
                                    </Text>
                                </TouchableOpacity>
                            </MotiView>
                        </View>
                    )}

                    {/* ⚡️ FIXED: The bottom dismiss text is always available when appropriate */}
                    {showDismissButton && modalMode !== 'collab' && (
                        <TouchableOpacity
                            onPress={handleDismissEvent}
                            activeOpacity={0.5}
                            className="mt-4 pt-4 pb-2 px-10 items-center justify-center z-50"
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            <Text className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] opacity-70">
                                Dismiss
                            </Text>
                        </TouchableOpacity>
                    )}

                </View>
            </View>
        </Modal>
    );
}