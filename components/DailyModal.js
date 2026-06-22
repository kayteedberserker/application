import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Linking, Modal, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useMMKV } from 'react-native-mmkv';
import { SvgXml } from 'react-native-svg';
import { useCoins } from '../context/CoinContext';
import { useEvent } from '../context/EventContext';
import { useUser } from '../context/UserContext';
import apiFetch from '../utils/apiFetch';
import ClanCrest from './ClanCrest'; // ⚡️ NEW IMPORT REQUIRED
import CoinIcon from './ClanIcon';
import { Text } from './Text';
import THEME from './useAppTheme';

const { width } = Dimensions.get('window');
const GLOBAL_COOLDOWN_KEY = "global_promo_cooldown_timestamp";
const COLLAB_COOLDOWN_KEY = "collab_modal_last_shown";
const COLLAB_WEB_LINK = "https://www.moviex.name.ng/";
const COLLAB_IMAGE_URI = "https://res.cloudinary.com/donakg9he/image/upload/v1778998640/WhatsApp_Image_2026-05-17_at_7.14.42_AM_k2llzm.jpg";
const MODAL_BG_IMAGE_URI = "https://res.cloudinary.com/donakg9he/image/upload/v1779001079/WhatsApp_Image_2026-05-17_at_7.56.39_AM_bbaxdp.jpg";
const FALLBACK_AVATAR = "https://res.cloudinary.com/donakg9he/image/upload/v1779268803/avatar_placeholder_y9sps5.png";

let hasShownThisSession = false;

// ⚡️ RARITY CONFIG WITH ABBREVIATIONS
const HYPE_TIERS = {
    FREE: {
        cost: 0, points: 50,
        label: 'FREE HYPE', rarity: 'COMMON', abbr: 'FH',
        colors: ['#475569', '#1e293b', '#0f172a'],
        glow: '#94a3b8'
    },
    STANDARD: {
        cost: 20, points: 100,
        label: 'STANDARD', rarity: 'RARE', abbr: 'SH',
        colors: ['#0284c7', '#0369a1', '#082f49'],
        glow: '#38bdf8'
    },
    SUPER: {
        cost: 100, points: 600,
        label: 'SUPER HYPE', rarity: 'EPIC', abbr: 'SP',
        colors: ['#9333ea', '#6b21a8', '#3b0764'],
        glow: '#c084fc'
    },
    MEGA: {
        cost: 400, points: 3000,
        label: 'MEGA BLAST', rarity: 'LEGENDARY', abbr: 'ME',
        colors: ['#d97706', '#92400e', '#451a03'],
        glow: '#fbbf24'
    }
};

// ⚡️ NEW: DYNAMIC VECTOR HYPE ICON GENERATOR
const HypeIconDisplay = memo(({ tierKey, color, size = 26 }) => {
    // 1. Determine the structure based on the tier
    const renderLayout = () => {
        if (tierKey === 'MEGA') {
            return (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    {/* Top center bolt */}
                    <MaterialCommunityIcons name="lightning-bolt" size={size} color={color} style={{ marginBottom: -10, zIndex: 2 }} />
                    {/* Bottom side-by-side bolts */}
                    <View style={{ flexDirection: 'row' }}>
                        <MaterialCommunityIcons name="lightning-bolt" size={size} color={color} style={{ marginRight: -6 }} />
                        <MaterialCommunityIcons name="lightning-bolt" size={size} color={color} style={{ marginLeft: -6 }} />
                    </View>
                </View>
            );
        }

        if (tierKey === 'SUPER') {
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={size * 1.1} color={color} style={{ marginRight: -6 }} />
                    <MaterialCommunityIcons name="lightning-bolt" size={size * 1.1} color={color} style={{ marginLeft: -6 }} />
                </View>
            );
        }

        // FREE & STANDARD
        return <MaterialCommunityIcons name="lightning-bolt" size={size * 1.3} color={color} />;
    };

    return (
        <View style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
            {/* Pulsing Energy Glow Behind */}
            <MotiView
                from={{ opacity: 0.3, scale: 0.85 }}
                animate={{ opacity: 0.8, scale: 1.15 }}
                transition={{ type: 'timing', duration: 1000, loop: true, direction: 'alternate' }}
                style={{ position: 'absolute', textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}
            >
                {renderLayout()}
            </MotiView>

            {/* Solid Core Structure */}
            <View style={{ position: 'absolute' }}>
                {renderLayout()}
            </View>
        </View>
    );
});

const RemoteSvgIcon = React.memo(({ xml, lottieUrl, lottieJson, size = 50, color }) => {
    const processedXml = useMemo(() => {
        if (!xml || typeof xml !== 'string' || !xml.includes('<svg')) {
            return null;
        }
        return xml.replace(/currentColor/g, color || 'white');
    }, [xml, color]);

    if (!processedXml) {
        return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    }

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

    // ⚡️ NEW: Dynamic Clan States
    const [targetClan, setTargetClan] = useState(null);
    const [clanFetchAttempted, setClanFetchAttempted] = useState(false);
    const [isJoiningClan, setIsJoiningClan] = useState(false);
    const [isOpeningCollab, setIsOpeningCollab] = useState(false);

    const timeoutRef = useRef(null);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    const activeBackground = isDarkMode ? '#0f172a' : '#f8fafc';
    const activeSurface = isDarkMode ? '#111827' : '#ffffff';
    const activeText = isDarkMode ? '#f8fafc' : '#0f172a';
    const activeSecondary = isDarkMode ? '#94a3b8' : '#475569';

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // ⚡️ NEW: Fetch dynamic clan data in the background + pass userId
    useEffect(() => {
        const fetchReferredClan = async () => {
            if (!user?.referredBy || !user?._id) {
                setClanFetchAttempted(true);
                return;
            }

            try {
                const res = await apiFetch(`/events/active?referredBy=${user.referredBy}&userId=${user._id}`);
                if (res.ok) {
                    const data = await res.json();
                    // The server will ONLY return referredClan if the user is not already following/member
                    if (data.referredClan) {
                        setTargetClan(data.referredClan);
                    }
                }
            } catch (err) {
                console.warn("Failed to fetch referral clan:", err);
            } finally {
                setClanFetchAttempted(true);
            }
        };

        fetchReferredClan();
    }, [user?.referredBy, user?._id]);

    const currentReward = useMemo(() => {
        const schedule = {
            1: { type: 'OC', amount: 5 },
            2: { type: 'OC', amount: 5 },
            3: { type: 'OC', amount: 5 },
            4: { type: 'OC', amount: 5 },
            5: { type: 'OC', amount: 5 },
            6: { type: 'OC', amount: 5 },
            7: { type: 'BOTH', amountOC: 5, amountHype: 1 }
        };
        return schedule[targetDay] || { type: 'OC', amount: 5 };
    }, [targetDay]);

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
            return dismissedDate !== todayStr;
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

    const canShowClanInvite = useCallback(() => {
        if (!targetClan || !user?.referredBy) return false;

        // This local logic catches cases where MMKV already knows they followed,
        // though the server should also block it naturally now.
        const followedClansStr = storage.getString("followed_clans");
        let followedClans = [];
        try {
            followedClans = followedClansStr ? JSON.parse(followedClansStr) : [];
        } catch (e) {
            followedClans = [];
        }

        const hasJoinedClan = followedClans.some(c => {
            if (typeof c === 'string') return c === targetClan?.tag;
            if (c && typeof c === 'object') return c.tag === targetClan?.tag;
            return false;
        });

        if (hasJoinedClan) {
            storage.set(`clan_invite_show_count_${user.referredBy}`, 3);
            storage.set(`clan_invite_shown_${user.referredBy}`, true);
            return false;
        }

        const showCount = storage.getNumber(`clan_invite_show_count_${user.referredBy}`) || 0;
        return showCount < 3;
    }, [targetClan, user?.referredBy, storage]);

    const canShowClanPromo = useCallback(() => {
        const completed = storage.getBoolean('clan_creation_promo_completed');
        if (completed) return false;

        const count = storage.getNumber('clan_creation_promo_show_count') || 0;
        return count < 2;
    }, [storage]);

    useEffect(() => {
        if (!user || hasShownThisSession || visible) return;

        // Wait until the dynamic clan check finishes before running priorities
        if (user.referredBy && !clanFetchAttempted) return;

        const todayStr = new Date().toDateString();
        const localClaimedToday = storage.getBoolean(`daily_claimed_${todayStr}`);
        const serverClaimedToday = user.lastClaimedDate ? new Date(user.lastClaimedDate).toDateString() === todayStr : false;
        const canClaimToday = !localClaimedToday && !serverClaimedToday;
        const currentStreak = user.consecutiveStreak || 1

        if (canClaimToday) {
            setTargetDay(currentStreak)
        } else {
            setTargetDay((currentStreak % 7) + 1);
        }

        const nextPromo = getNextEvent();
        if (nextPromo) setCurrentPromo(nextPromo);

        // 1. PRIORITY: DAILY CLAIM
        if (canClaimToday && !hasClaimed) {
            setModalMode('daily');
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }

        // 2. PRIORITY: CLAN INVITE MODAL (Will trigger only if canShowClanInvite returns true < 3 times)
        if (canShowClanInvite()) {
            setModalMode('clan');
            const currentCount = storage.getNumber(`clan_invite_show_count_${user.referredBy}`) || 0;
            storage.set(`clan_invite_show_count_${user.referredBy}`, currentCount + 1);
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }

        // 3. PRIORITY: RESTRICTIONS LIFTED / DISCOVERY PROMO
        if (canShowClanPromo()) {
            setModalMode('clan_promo');
            const currentCount = storage.getNumber('clan_creation_promo_show_count') || 0;
            storage.set('clan_creation_promo_show_count', currentCount + 1);
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }

        // 4. PRIORITY: EVENT PROMO
        if (nextPromo) {
            setModalMode('event');
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }

        // 5. PRIORITY: WEB COLLAB
        if (canShowCollab()) {
            setModalMode('collab');
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [user, activeEvents, hasClaimed, clanFetchAttempted, canShowCollab, canShowClanInvite, canShowClanPromo, getNextEvent, storage, visible]);

    const handleClaimDaily = async () => {
        if (isProcessingTransaction) return;

        const type = `daily_login`;
        const result = await processTransaction('claim', type, null, null);

        const todayStr = new Date().toDateString();

        if (result.success) {
            setHasClaimed(true);
            storage.set(`daily_claimed_${todayStr}`, true);

            timeoutRef.current = setTimeout(() => {
                hasShownThisSession = true;
                setVisible(false);
            }, 1000);
        } else {
            storage.set(`daily_claimed_${todayStr}`, true);
            hasShownThisSession = true;
            setVisible(false);
        }
    };

    const handleDismissEvent = () => {
        if (modalMode === 'event' && currentPromo) {
            storage.set(`last_dismissed_${currentPromo.id}`, new Date().toDateString());
            const thirtyMinsFromNow = new Date().getTime() + (30 * 60 * 1000);
            storage.set(GLOBAL_COOLDOWN_KEY, thirtyMinsFromNow);
        } else if (modalMode === 'clan') {
            if (user?.referredBy) {
                // Ensures if they manually dismiss it, we count it towards the cap immediately
                const currentCount = storage.getNumber(`clan_invite_show_count_${user.referredBy}`) || 0;
                if (currentCount >= 3) {
                    storage.set(`clan_invite_shown_${user.referredBy}`, true);
                }
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
        setIsOpeningCollab(true);
        try {
            const supported = await Linking.canOpenURL(COLLAB_WEB_LINK);
            if (supported) {
                await Linking.openURL(COLLAB_WEB_LINK);
            }
        } catch (error) {
            console.warn('Unable to open collaboration link', error);
        } finally {
            setIsOpeningCollab(false);
            showCollabAndTrack();
            hasShownThisSession = true;
            setVisible(false);
        }
    };

    const handleJoinClan = () => {
        setIsJoiningClan(true);
        // Timeout applied simply to render the UI ActivityIndicator state gracefully before the unmount
        setTimeout(() => {
            if (user?.referredBy) {
                // Stop showing entirely once they click Join
                storage.set(`clan_invite_show_count_${user.referredBy}`, 3);
                storage.set(`clan_invite_shown_${user.referredBy}`, true);
            }
            hasShownThisSession = true;
            setVisible(false);
            router.push(`/clans/${targetClan?.tag}`);
            setIsJoiningClan(false);
        }, 150);
    };

    const handleGoToDiscovery = () => {
        storage.set('clan_creation_promo_complete', true);
        hasShownThisSession = true;
        setVisible(false);
        router.push('/screens/discover');
    };

    if (!visible || !modalMode) return null;

    const eventColor = currentPromo?.themeColor || '#a855f7';
    const EventIcon = currentPromo?.icon || 'party-popper';
    const tokenVisual = currentPromo?.tokenVisual || null;
    const isComingSoon = currentPromo?.isComing || currentPromo?.status === 'coming_soon';
    const showDismissButton = !isProcessingTransaction && !isJoiningClan && !isOpeningCollab;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View className="flex-1 justify-center items-center px-3" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.92)' : 'rgba(15,23,42,0.75)' }}>
                {(modalMode === 'collab' || modalMode === 'clan' || modalMode === 'clan_promo') && (
                    <View className="absolute inset-0 opacity-10">
                        <Image
                            source={{ uri: MODAL_BG_IMAGE_URI }}
                            contentFit="cover"
                            style={{ width: '100%', height: '100%', opacity: 0.4 }}
                        />
                    </View>
                )}

                <View
                    style={{
                        backgroundColor: activeSurface,
                        borderColor: modalMode === 'daily' ? THEME.accent : modalMode === 'clan' ? targetClan?.color : modalMode === 'clan_promo' ? '#06b6d4' : eventColor
                    }}
                    className={`w-full rounded-2xl px-3 py-8 border-2 items-center shadow-2xl relative ${modalMode === 'daily' ? 'shadow-blue-500/40' : modalMode === 'clan' ? 'shadow-emerald-500/30' : modalMode === 'clan_promo' ? 'shadow-cyan-500/30' : 'shadow-purple-500/30'
                        }`}
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
                                Claim your daily rewards, keep your streak alive, and power up today's grind with a fast boost.
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
                                    <Text className="text-slate-400 font-semibold text-[11px] uppercase tracking-[0.25em] mb-4">
                                        Energy Payload Ready
                                    </Text>

                                    {currentReward.type === 'OC' && (
                                        <View className="flex-row items-center gap-3">
                                            <Text style={{ color: activeText }} className="text-6xl font-black italic tracking-tighter">
                                                +{currentReward.amount}
                                            </Text>
                                            <CoinIcon size={44} type="OC" />
                                        </View>
                                    )}

                                    {currentReward.type === 'HYPE' && (
                                        <View className="flex-row items-center gap-4 bg-slate-950/20 px-6 py-4 rounded-2xl border border-slate-800">
                                            <Text className="text-5xl font-black italic tracking-tighter" style={{ color: HYPE_TIERS.FREE.glow }}>
                                                +{currentReward.amount}
                                            </Text>
                                            <HypeIconDisplay tierKey={"FREE"} color={HYPE_TIERS.FREE.glow} size={42} />
                                        </View>
                                    )}

                                    {currentReward.type === 'BOTH' && (
                                        <View className="flex-row items-center justify-center gap-5 w-full px-4 bg-slate-950/20 py-4 rounded-2xl border border-slate-800">
                                            <View className="flex-row items-center gap-2">
                                                <Text style={{ color: activeText }} className="text-4xl font-black italic tracking-tighter">
                                                    +{currentReward.amountOC}
                                                </Text>
                                                <CoinIcon size={32} type="OC" />
                                            </View>
                                            <Text className="text-xl font-black text-slate-400 dark:text-slate-600">&</Text>
                                            <View className="flex-row items-center">
                                                <Text className="text-4xl font-black italic tracking-tighter" style={{ color: HYPE_TIERS.FREE.glow }}>
                                                    +{currentReward.amountHype}
                                                </Text>
                                                <HypeIconDisplay tierKey={"FREE"} color={HYPE_TIERS.FREE.glow} size={36} />
                                            </View>
                                        </View>
                                    )}
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

                    {modalMode === 'event' && currentPromo && (
                        <View className="w-full items-center">
                            <View
                                style={{
                                    backgroundColor: '#0f172a',
                                    borderColor: eventColor,
                                    shadowColor: eventColor,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 20,
                                    elevation: 10
                                }}
                                className="w-full rounded-3xl border-2 overflow-hidden relative"
                            >
                                {currentPromo.promoImage ? (
                                    <View className="w-full aspect-[1/1] relative">
                                        <Image
                                            source={currentPromo.promoImage}
                                            contentFit="cover"
                                            transition={500}
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                        <LinearGradient
                                            colors={['transparent', 'rgba(15, 23, 42, 0.5)', '#0f172a']}
                                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }}
                                        />
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

                    {/* ⚔️ BRAND NEW CLAN INVITATION PANEL MODAL MODE */}
                    {modalMode === 'clan' && targetClan && (
                        <View className="w-full items-center">
                            <MotiView
                                from={{ opacity: 0, scale: 0.95, translateY: 10 }}
                                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                                transition={{ type: 'timing', duration: 400 }}
                                className="w-full rounded-3xl border p-6 items-center"
                                style={{
                                    backgroundColor: activeSurface,
                                    borderColor: targetClan.color,
                                    shadowColor: targetClan.color,
                                    shadowOpacity: 0.25,
                                    shadowRadius: 20,
                                    elevation: 8
                                }}
                            >
                                {/* ⚡️ NEW: Profile x Clan Crest Layout */}
                                <View className="flex-row items-center justify-center space-x-5 mb-5 w-full">
                                    <View className="w-[80px] h-[80px] rounded-full border-2 overflow-hidden bg-slate-800" style={{ borderColor: targetClan.color }}>
                                        <Image
                                            source={{ uri: targetClan.referrerImage || FALLBACK_AVATAR }}
                                            contentFit="cover"
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                    </View>

                                    <MaterialCommunityIcons name="close" size={20} color={activeSecondary} />

                                    <View className="w-[60px] h-[60px] items-center justify-center">
                                        <ClanCrest rank={targetClan.rank} size={80} isFeed={true} glowColor={targetClan.color} />
                                    </View>
                                </View>

                                <Text style={{ color: targetClan.color }} className="uppercase tracking-[0.3em] text-[10px] font-black text-center mb-1">
                                    Clan Connection Found
                                </Text>

                                <Text style={{ color: activeText }} className="text-2xl font-black italic uppercase text-center tracking-tight mb-3">
                                    Join {targetClan.name}
                                </Text>

                                <View className="px-3 py-1.5 rounded-md bg-slate-800/40 border border-slate-700/50 mb-4">
                                    <Text style={{ color: targetClan.color }} className="text-[12px] font-black tracking-widest">
                                        TAG: [{targetClan.tag}]
                                    </Text>
                                </View>

                                <Text style={{ color: activeSecondary }} className="text-[13px] leading-6 text-center mb-6 px-2">
                                    You were referred by <Text style={{ color: targetClan.color, fontWeight: 'bold' }}>{targetClan.referrerName}</Text>, who is a prominent member of <Text style={{ color: targetClan.color, fontWeight: 'bold' }}>{targetClan.name}</Text>. {targetClan.description}
                                </Text>

                                <TouchableOpacity
                                    onPress={handleJoinClan}
                                    disabled={isJoiningClan}
                                    style={{
                                        backgroundColor: targetClan.color,
                                        shadowColor: targetClan.color,
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 10
                                    }}
                                    className="w-full h-14 rounded-xl flex-row items-center justify-center mb-3"
                                >
                                    {isJoiningClan ? (
                                        <ActivityIndicator color="#0f172a" />
                                    ) : (
                                        <>
                                            <Text className="text-slate-950 font-black text-[12px] uppercase tracking-[0.2em]">
                                                Follow Clan Immediately
                                            </Text>
                                            <Ionicons name="flash" size={15} color="#0f172a" style={{ marginLeft: 6 }} />
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleDismissEvent}
                                    className="w-full h-12 rounded-xl border border-slate-300/10 bg-white/5 items-center justify-center"
                                >
                                    <Text style={{ color: activeSecondary }} className="font-bold text-[11px] uppercase tracking-[0.15em]">
                                        Ignore Invitation
                                    </Text>
                                </TouchableOpacity>
                            </MotiView>
                        </View>
                    )}

                    {/* ⚡️ NEW: RESTRICTIONS LIFTED CLAN CREATION PROMO */}
                    {modalMode === 'clan_promo' && (
                        <View className="w-full items-center">
                            <MotiView
                                from={{ opacity: 0, scale: 0.95, translateY: 10 }}
                                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                                transition={{ type: 'timing', duration: 400 }}
                                className="w-full rounded-3xl border p-6 items-center"
                                style={{
                                    backgroundColor: activeSurface,
                                    borderColor: '#06b6d4',
                                    shadowColor: '#06b6d4',
                                    shadowOpacity: 0.25,
                                    shadowRadius: 20,
                                    elevation: 8
                                }}
                            >
                                <View
                                    style={{ backgroundColor: `#06b6d415`, borderColor: `#06b6d430` }}
                                    className="w-20 h-20 rounded-2xl items-center justify-center border mechanical-box mb-4"
                                >
                                    <MaterialCommunityIcons name="sword-cross" size={44} color="#06b6d4" />
                                </View>

                                <Text style={{ color: '#06b6d4' }} className="uppercase tracking-[0.3em] text-[10px] font-black text-center mb-1">
                                    New Update
                                </Text>

                                <Text style={{ color: activeText }} className="text-2xl font-black italic uppercase text-center tracking-tight mb-3">
                                    Create Your Clan
                                </Text>

                                <Text style={{ color: activeSecondary }} className="text-[13px] leading-6 text-center mb-6 px-2">
                                    We have completely removed the requirements to create a clan! You can now start your own clan and invite your friends immediately. Head over to the Discovery page to create yours now.
                                </Text>

                                <TouchableOpacity
                                    onPress={handleGoToDiscovery}
                                    style={{
                                        backgroundColor: '#06b6d4',
                                        shadowColor: '#06b6d4',
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 10
                                    }}
                                    className="w-full h-14 rounded-xl flex-row items-center justify-center mb-3"
                                >
                                    <Text className="text-slate-950 font-black text-[12px] uppercase tracking-[0.2em]">
                                        Go to Discovery
                                    </Text>
                                    <Ionicons name="compass" size={15} color="#0f172a" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleDismissEvent}
                                    className="w-full h-12 rounded-xl border border-slate-300/10 bg-white/5 items-center justify-center"
                                >
                                    <Text style={{ color: activeSecondary }} className="font-bold text-[11px] uppercase tracking-[0.15em]">
                                        Maybe Later
                                    </Text>
                                </TouchableOpacity>
                            </MotiView>
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
                                        <Text style={{ color: activeText }} className="text-[11px] font-black uppercase">OREBLOGDA </Text>
                                        <Text style={{ color: activeSecondary }} className="text-[11px] font-black uppercase">X</Text>
                                        <Text style={{ color: activeText }} className="text-[11px] font-black uppercase"> MOVIEX</Text>
                                    </View>

                                    <Text style={{ color: activeSecondary }} className="text-[13px] leading-7 text-center mb-6 px-3">
                                        Discover the OREBLOGDA x MOVIEX collaboration. MOVIEX is a movie/anime streaming platform, With the shuttingdown of major anime platforms, this can verywell be your next anime site. It also allow downloads incase you'd want to save for later. Check it out.
                                    </Text>
                                </View>

                                <LinearGradient
                                    colors={[THEME.accent, '#7c3aed']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{
                                        width: '100%',
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        marginBottom: 12,
                                    }}
                                >
                                    <TouchableOpacity
                                        onPress={handleOpenCollab}
                                        disabled={isOpeningCollab}
                                        className="w-full h-14 items-center justify-center flex-row"
                                    >
                                        {isOpeningCollab ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Text className="text-slate-900 font-black text-[13px] uppercase tracking-[0.2em]">
                                                Open MOVIEX
                                            </Text>
                                        )}
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

                    {showDismissButton && modalMode !== 'collab' && modalMode !== 'clan' && modalMode !== 'clan_promo' && (
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