import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, TouchableOpacity, View } from 'react-native';
import { useMMKV } from 'react-native-mmkv';
import { useCoins } from '../context/CoinContext';
import { useUser } from '../context/UserContext';
import { useEvent } from '../context/EventContext';
import CoinIcon from './ClanIcon';
import { Text } from './Text';
import THEME from './useAppTheme';
import LottieView from 'lottie-react-native';
import { SvgXml } from 'react-native-svg';

const { width } = Dimensions.get('window');
const GLOBAL_COOLDOWN_KEY = "global_promo_cooldown_timestamp";

let hasShownThisSession = false; 

const RemoteSvgIcon = ({ xml, lottieUrl, lottieJson, size = 50, color }) => {
    if (lottieJson || lottieUrl) {
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <LottieView
                    source={lottieJson ? lottieJson : { uri: lottieUrl }}
                    autoPlay
                    loop
                    style={{ width: size * 1.2, height: size * 1.2 }}
                    resizeMode="contain"
                    renderMode="hardware"
                />
            </View>
        );
    }
    if (!xml || typeof xml !== 'string' || !xml.includes('<svg')) {
        return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    }
    return <SvgXml xml={xml.replace(/currentColor/g, color || 'white')} width={size} height={size} />;
};

// ⚡️ NEW: Lightweight Countdown Component (Prevents the whole modal from lagging)
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
            <View className="flex-row items-center justify-center w-full justify-between px-2">
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

    useEffect(() => {
        if (!user || hasShownThisSession) return

        const todayStr = new Date().toDateString();
        
        const localClaimedToday = storage.getBoolean(`daily_claimed_${todayStr}`)
        const serverClaimedToday = user.lastClaimedDate ? new Date(user.lastClaimedDate).toDateString() === todayStr : false;
        const canClaimToday = !localClaimedToday && !serverClaimedToday;
        const currentStreak = user.consecutiveStreak || 0;

        if (!canClaimToday) {
            setTargetDay(currentStreak);
        } else {
            setTargetDay((currentStreak % 7) + 1);
        }

        if (canClaimToday && !hasClaimed) {
            setModalMode('daily');
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        } 
        
        if (activeEvents && activeEvents.length > 0) {
            const now = new Date().getTime();
            const globalCooldown = storage.getNumber(GLOBAL_COOLDOWN_KEY) || 0;
            
            if (now < globalCooldown) return;

            const eventQueue = activeEvents.map(evt => ({
                ...evt,
                tabKey: evt.type === 'gacha' ? 'gacha' : 'claim'
            }))
            
            const nextPromo = eventQueue.find(evt => {
                const dismissedDate = storage.getString(`last_dismissed_${evt.id}`);
                return dismissedDate !== todayStr
            });
            
            if (nextPromo) {
                setCurrentPromo(nextPromo);
                setModalMode('event');
                const timer = setTimeout(() => setVisible(true), 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [user, activeEvents, hasClaimed]); 

    const handleClaimDaily = async () => {
        if (isProcessingTransaction) return;
        
        const type = targetDay === 7 ? 'daily_login_7' : 'daily_login';
        const result = await processTransaction('claim', type, null, null);
        
        if (result.success) {
            const todayStr = new Date().toDateString();
            
            setHasClaimed(true);
            hasShownThisSession = true; 
            storage.set(`daily_claimed_${todayStr}`, true); 
            
            setTimeout(() => {
                setVisible(false);
            }, 1500);
        } else {
            hasShownThisSession = true; 
            setVisible(false);
        }
    };

    const handleDismissEvent = () => {
        if (modalMode === 'event' && currentPromo) {
            storage.set(`last_dismissed_${currentPromo.id}`, new Date().toDateString());
            const thirtyMinsFromNow = new Date().getTime() + (30 * 60 * 1000);
            storage.set(GLOBAL_COOLDOWN_KEY, thirtyMinsFromNow)
        }
        
        hasShownThisSession = true 
        setVisible(false);
    };

    const handleGoToEvent = () => {
        handleDismissEvent(); 
        const targetTab = currentPromo?.id || 'referral';
        router.push(`/screens/referralevent?tab=${targetTab}`); 
    };

    if (!visible || !modalMode) return null;

    const rewardAmount = targetDay === 7 ? 50 : 10;
    
    const eventColor = currentPromo?.themeColor || '#a855f7';
    const EventIcon = currentPromo?.icon || 'party-popper';
    const tokenVisual = currentPromo?.tokenVisual || null;

    const isComingSoon = currentPromo?.isComing || currentPromo?.status === 'coming_soon';
    const showDismissButton = !isProcessingTransaction && !(modalMode === 'daily' && hasClaimed);

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/90 px-6">
                
                <View 
                    style={{ backgroundColor: '#0f172a', borderColor: modalMode === 'daily' ? THEME.accent : eventColor }} 
                    className={`w-full rounded-2xl px-6 py-8 border-2 items-center shadow-2xl relative ${modalMode === 'daily' ? 'shadow-blue-500/40' : 'shadow-purple-500/30'}`}
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
                            <View className="bg-blue-500/20 px-4 py-1.5 rounded-sm border-l-2 border-r-2 border-blue-500 mb-6 flex-row items-center">
                                <Ionicons name="flame" size={14} color={THEME.accent} />
                                <Text style={{ color: THEME.accent }} className="font-black text-[10px] uppercase tracking-[0.2em] ml-1.5">
                                    Day {targetDay} Login
                                </Text>
                            </View>

                            {hasClaimed ? (
                                <View className="items-center mb-8 mt-4 w-full">
                                    <View className="w-24 h-24 bg-green-500/10 rounded-2xl items-center justify-center border border-green-500/30 mb-4 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                                        <Ionicons name="checkmark" size={50} color="#22c55e" />
                                    </View>
                                    <Text className="text-green-500 font-black text-2xl italic uppercase tracking-[0.3em]">Acquired</Text>
                                </View>
                            ) : (
                                <View className="items-center mb-8 mt-4 w-full">
                                    <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">
                                        Energy Payload Ready
                                    </Text>
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-white text-6xl font-black italic tracking-tighter">
                                            +{rewardAmount}
                                        </Text>
                                        <CoinIcon size={40} type="OC" />
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
                                                Extract
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
                        <View className="w-full items-center mt-2">
                            <View 
                                style={{ backgroundColor: `${eventColor}20`, borderLeftColor: eventColor, borderRightColor: eventColor }} 
                                className="px-4 py-1.5 rounded-sm border-l-2 border-r-2 mb-6 flex-row items-center"
                            >
                                <Text style={{ color: eventColor }} className="font-black text-[10px] uppercase tracking-[0.2em]">
                                    {isComingSoon ? "Incoming Signal" : "Live Event"}
                                </Text>
                            </View>

                            <View className="items-center mb-6 w-full">
                                {/* ⚡️ UPDATED: Added the cool rings for coming soon events */}
                                <View className="items-center justify-center mb-6 relative">
                                    {isComingSoon && (
                                        <>
                                            <View style={{ backgroundColor: eventColor, opacity: 0.15 }} className="absolute w-36 h-36 rounded-full" />
                                            <View style={{ borderColor: eventColor, opacity: 0.5 }} className="w-28 h-28 rounded-full border-2 border-dashed absolute" />
                                        </>
                                    )}
                                    <View 
                                        style={{ backgroundColor: `${eventColor}10`, borderColor: `${eventColor}40`, shadowColor: eventColor }}
                                        className={`w-24 h-24 rounded-full items-center justify-center border-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] transform ${isComingSoon ? 'rotate-0' : 'rotate-3'}`}
                                    >
                                        {isComingSoon && !tokenVisual ? (
                                            <MaterialCommunityIcons name="weather-night" size={50} color={eventColor} />
                                        ) : tokenVisual ? (
                                            <RemoteSvgIcon xml={tokenVisual.svgCode} lottieUrl={tokenVisual.lottieUrl} lottieJson={tokenVisual.lottieJson} size={55} color={eventColor} />
                                        ) : (
                                            <MaterialCommunityIcons name={EventIcon} size={50} color={eventColor} />
                                        )}
                                    </View>
                                </View>
                                
                                <Text className="text-white text-2xl font-black italic uppercase text-center tracking-tighter mb-2">
                                    {currentPromo.title}
                                </Text>
                                <Text className="text-slate-300 text-[10px] font-bold text-center uppercase tracking-widest leading-relaxed px-4">
                                    {currentPromo.description}
                                </Text>

                                {/* ⚡️ NEW: The Countdown is inserted right here! */}
                                {isComingSoon && currentPromo.startsAt && (
                                    <CountdownTimer startsAt={currentPromo.startsAt} color={eventColor} />
                                )}
                            </View>

                            <TouchableOpacity 
                                onPress={handleGoToEvent}
                                style={{ backgroundColor: eventColor, shadowColor: eventColor }}
                                className="w-full h-14 rounded-xl flex-row items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.4)] mt-2"
                            >
                                <Text className="text-slate-900 font-black text-[13px] uppercase tracking-[0.2em]">
                                    {isComingSoon ? "View Intel" : "Enter Portal"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showDismissButton && (
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