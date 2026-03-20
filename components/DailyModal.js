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

const { width } = Dimensions.get('window');
const GLOBAL_COOLDOWN_KEY = "global_promo_cooldown_timestamp";

export default function DailyModal() {
    const storage = useMMKV();
    const router = useRouter();
    const { user } = useUser();
    const { coins, processTransaction, isProcessingTransaction } = useCoins();
    const { activeEvent } = useEvent();

    const [visible, setVisible] = useState(false);
    const [targetDay, setTargetDay] = useState(1);
    const [hasClaimed, setHasClaimed] = useState(false); 
    const [modalMode, setModalMode] = useState(null); 
    const [currentPromo, setCurrentPromo] = useState(null);

    useEffect(() => {
        if (!user) return;

        const todayStr = new Date().toDateString();
        const lastClaimStr = user.lastClaimedDate ? new Date(user.lastClaimedDate).toDateString() : null;
        const canClaimToday = todayStr !== lastClaimStr;
        const currentStreak = user.consecutiveStreak || 0;

        if (!canClaimToday) {
            setTargetDay(currentStreak);
        } else {
            setTargetDay((currentStreak % 7) + 1);
        }

        // ⚡️ MODE 1: Daily Login Priority
        if (canClaimToday && !hasClaimed) {
            setModalMode('daily');
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        } 
        
        // ⚡️ MODE 2: Promo Queue System
        if (activeEvent) {
            const now = new Date().getTime();
            const globalCooldown = storage.getNumber(GLOBAL_COOLDOWN_KEY) || 0;
            
            if (now < globalCooldown) return;

            const eventQueue = [];
            // ⚡️ INJECT 'tabKey' so the router knows where to go!
            if (activeEvent.gacha) eventQueue.push({ ...activeEvent.gacha, tabKey: 'gacha' });
            if (activeEvent.claim) eventQueue.push({ ...activeEvent.claim, tabKey: 'claim' });

            const nextPromo = eventQueue.find(evt => {
                const dismissedDate = storage.getString(`last_dismissed_${evt.id}`);
                return dismissedDate !== todayStr;
            });

            if (nextPromo) {
                setCurrentPromo(nextPromo);
                setModalMode('event');
                const timer = setTimeout(() => setVisible(true), 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [user, activeEvent, hasClaimed]);

    const handleClaimDaily = async () => {
        if (isProcessingTransaction) return;
        
        const type = targetDay === 7 ? 'daily_login_7' : 'daily_login';
        const result = await processTransaction('claim', type, null, null);
        
        if (result.success) {
            setHasClaimed(true);
            setTimeout(() => {
                setVisible(false);
            }, 1500);
        } else {
            setVisible(false);
        }
    };

    const handleDismissEvent = () => {
        if (currentPromo) {
            storage.set(`last_dismissed_${currentPromo.id}`, new Date().toDateString());
            const thirtyMinsFromNow = new Date().getTime() + (30 * 60 * 1000);
            storage.set(GLOBAL_COOLDOWN_KEY, thirtyMinsFromNow);
        }
        setVisible(false);
    };

    const handleGoToEvent = () => {
        handleDismissEvent(); 
        // ⚡️ Pass the tab target in the URL!
        const targetTab = currentPromo?.tabKey || 'gacha';
        router.push(`/screens/referralevent?tab=${targetTab}`); 
    };

    if (!visible || !modalMode) return null;

    const rewardAmount = targetDay === 7 ? 50 : 10;
    
    const eventColor = currentPromo?.themeColor || '#a855f7';
    const EventIcon = currentPromo?.icon || 'party-popper';

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/90 px-6">
                
                <View 
                    style={{ backgroundColor: '#0f172a', borderColor: modalMode === 'daily' ? THEME.accent : eventColor }} 
                    className={`w-full rounded-2xl p-6 border-2 items-center shadow-2xl ${modalMode === 'daily' ? 'shadow-blue-500/40' : 'shadow-yellow-500/30'}`}
                >
                    
                    {/* ========================================== */}
                    {/* ⚡️ MODE 1: DAILY LOGIN */}
                    {/* ========================================== */}
                    {modalMode === 'daily' && (
                        <>
                            <View className="bg-blue-500/20 px-4 py-1.5 rounded-sm border-l-2 border-r-2 border-blue-500 mb-6 flex-row items-center">
                                <Ionicons name="flame" size={14} color={THEME.accent} />
                                <Text style={{ color: THEME.accent }} className="font-black text-[10px] uppercase tracking-[0.2em] ml-1.5">
                                    Day {targetDay} Login
                                </Text>
                            </View>

                            {hasClaimed ? (
                                <View className="items-center mb-8 mt-4">
                                    <View className="w-24 h-24 bg-green-500/10 rounded-2xl items-center justify-center border border-green-500/30 mb-4 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                                        <Ionicons name="checkmark" size={50} color="#22c55e" />
                                    </View>
                                    <Text className="text-green-500 font-black text-2xl italic uppercase tracking-[0.3em]">Acquired</Text>
                                </View>
                            ) : (
                                <View className="items-center mb-8 mt-4">
                                    {/* ⚡️ FIXED: Forced text-slate-400 */}
                                    <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">
                                        Energy Payload Ready
                                    </Text>
                                    <View className="flex-row items-center gap-2">
                                        {/* ⚡️ FIXED: Forced text-white */}
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
                        </>
                    )}

                    {/* ========================================== */}
                    {/* ⚡️ MODE 2: DYNAMIC EVENT PROMO */}
                    {/* ========================================== */}
                    {modalMode === 'event' && currentPromo && (
                        <>
                            <View 
                                style={{ backgroundColor: `${eventColor}20`, borderLeftColor: eventColor, borderRightColor: eventColor }} 
                                className="px-4 py-1.5 rounded-sm border-l-2 border-r-2 mb-6 flex-row items-center"
                            >
                                <Text style={{ color: eventColor }} className="font-black text-[10px] uppercase tracking-[0.2em]">
                                    Live Event
                                </Text>
                            </View>

                            <View className="items-center mb-8 w-full">
                                <View 
                                    style={{ backgroundColor: `${eventColor}10`, borderColor: `${eventColor}40`, shadowColor: eventColor }}
                                    className="w-28 h-28 rounded-2xl items-center justify-center border-2 mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] transform rotate-3"
                                >
                                    <MaterialCommunityIcons name={EventIcon} size={60} color={eventColor} />
                                </View>
                                
                                {/* ⚡️ FIXED: Forced text-white */}
                                <Text className="text-white text-2xl font-black italic uppercase text-center tracking-tighter mb-2">
                                    {currentPromo.title}
                                </Text>
                                {/* ⚡️ FIXED: Forced text-slate-300 */}
                                <Text className="text-slate-300 text-[10px] font-bold text-center uppercase tracking-widest leading-relaxed px-4">
                                    {currentPromo.description}
                                </Text>
                            </View>

                            <TouchableOpacity 
                                onPress={handleGoToEvent}
                                style={{ backgroundColor: eventColor, shadowColor: eventColor }}
                                className="w-full h-14 rounded-xl flex-row items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                            >
                                <Text className="text-slate-900 font-black text-[13px] uppercase tracking-[0.2em]">
                                    Enter Portal
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {!hasClaimed && !isProcessingTransaction && (
                        <TouchableOpacity onPress={handleDismissEvent} className="mt-6">
                            {/* ⚡️ FIXED: Forced text-slate-400 */}
                            <Text className="text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] opacity-50 hover:opacity-100">
                                Dismiss
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}