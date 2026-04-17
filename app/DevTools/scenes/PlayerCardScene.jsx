import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlayerCard from './../../../components/PlayerCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_SCALE = (SCREEN_WIDTH * 0.85) / 372;
const FINAL_SCALE = (SCREEN_WIDTH * 0.95) / 372;

const AURA_THRESHOLDS = [
    { level: 1, req: 0 },
    { level: 2, req: 100 },
    { level: 3, req: 300 },
    { level: 4, req: 700 },
    { level: 5, req: 1500 },
    { level: 6, req: 3000 },
    { level: 7, req: 6000 },
    { level: 8, req: 12000 },
];

export default function PlayerCardScene({ onBack }) {
    const [demoPhase, setDemoPhase] = useState('BASIC');
    const [displayAura, setDisplayAura] = useState(100);
    const [displayRankLevel, setDisplayRankLevel] = useState(1);
    const [displayRank, setDisplayRank] = useState(15);
    const [displayWeekly, setDisplayWeekly] = useState(0);
    const [displayPosts, setDisplayPosts] = useState(1);
    const [displayStreak, setDisplayStreak] = useState(0);
    const [buttonsVisible, setButtonsVisible] = useState(true);
    const [saveShareVisible, setSaveShareVisible] = useState(false);
    const [saveState, setSaveState] = useState('idle');

    const animationFrameRef = useRef(null);
    const scrollRef = useRef(null);
    const cardScale = useSharedValue(BASE_SCALE);
    const glowIntensity = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        shadowOpacity: glowIntensity.value * 0.8,
        shadowRadius: glowIntensity.value * 30,
        shadowColor: demoPhase === 'MYTHIC' ? '#a855f7' : '#fbbf24',
        elevation: glowIntensity.value * 20,
    }));

    const calculateLevel = (aura) => {
        for (let i = AURA_THRESHOLDS.length - 1; i >= 0; i--) {
            if (aura >= AURA_THRESHOLDS[i].req) return AURA_THRESHOLDS[i].level;
        }
        return 1;
    };

    const handleReset = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setDemoPhase('BASIC');
        setDisplayAura(100);
        setDisplayRankLevel(1);
        setDisplayRank(15);
        setDisplayWeekly(0);
        setDisplayPosts(1);
        setDisplayStreak(0);
        setButtonsVisible(true);
        setSaveShareVisible(false);
        setSaveState('idle');
        cardScale.value = withTiming(BASE_SCALE, { duration: 500 });
        glowIntensity.value = withTiming(0, { duration: 500 });
    };

    const startCinematic = () => {
        handleReset();
        setButtonsVisible(false);
        setSaveShareVisible(false);
        setSaveState('idle');
        const duration = 12000;
        const startTime = Date.now();

        cardScale.value = withTiming(FINAL_SCALE, { duration, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
        glowIntensity.value = withTiming(1, { duration });

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const auraProgress = Math.pow(progress, 2.5);

            const newAura = Math.floor(100 + (15750 - 100) * auraProgress);
            const level = calculateLevel(newAura);
            const newRank = Math.max(1, 15 - (level - 1) * 2);

            setDisplayAura(newAura);
            setDisplayRank(newRank);
            setDisplayRankLevel(level);
            setDisplayWeekly(Math.floor(0 + (5420 - 0) * auraProgress));
            setDisplayPosts(Math.floor(1 + (994 - 5) * auraProgress));
            setDisplayStreak(Math.floor(0 + (365 - 0) * auraProgress));

            if (progress > 0.4 && progress < 0.8) {
                setDemoPhase('EVOLVING');
            } else if (progress >= 0.8) {
                setDemoPhase('MYTHIC');
            }

            if (progress >= 1) {
                setSaveShareVisible(true);
                setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                    setTimeout(() => {
                        setSaveState('saving');
                        setTimeout(() => {
                            setSaveState('saved');
                            setTimeout(() => setButtonsVisible(true), 3000);
                        }, 1000);
                    }, 500);
                }, 100);
            } else {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };
        animationFrameRef.current = requestAnimationFrame(animate);
    };

    const buildInventory = () => {
        const inv = [];
        if (demoPhase === 'EVOLVING' || demoPhase === 'MYTHIC') {
            inv.push({
                id: 'astral_leg_hero',
                category: 'AVATAR',
                isEquipped: true,
                visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/hianim_avatar.json' }
            });
            inv.push({
                id: 'badge_1',
                category: 'BADGE',
                isEquipped: true,
                visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/srank_badge.json' }
            });
        }
        if (displayRank === 1) {
            inv.push({ category: 'GLOW', isEquipped: true, visualConfig: { primaryColor: '#fbbf24' } });
        }
        if (demoPhase === 'MYTHIC') {
            inv.push({
                id: 'astral_mythic_susanoo',
                category: 'WATERMARK',
                isEquipped: true,
                visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/astralfire_vfx_wm.json', primaryColor: "#a855f7" }
            });
            inv.push({
                id: 'astral_mythic_petals',
                category: 'AVATAR_VFX',
                isEquipped: true,
                visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/blossom_vfx.json', zoom: 0.9 }
            });
            inv.push({
                category: 'BORDER',
                isEquipped: true,
                visualConfig: { primaryColor: '#a855f7', secondaryColor: '#fbbf24', animationType: 'doubleSnake' }
            });
        }
        return inv;
    };

    const mannequinUser = {
        username: demoPhase === 'BASIC' ? "LEVEL_1_ROOKIE" : "THE_SYSTEM",
        aura: displayAura,
        weeklyAura: displayWeekly,
        previousRank: displayRank,
        currentRankLevel: displayRankLevel,
        streak: displayStreak,
        description: demoPhase === 'MYTHIC' ? "Domain Expansion: Infinite Aura." : "Building the future...",
        preferences: { favCharacter: demoPhase === 'MYTHIC' ? "UCHIHA MADARA" : "NONE" },
        inventory: buildInventory(),
    };

    return (
        <SafeAreaView className="flex-1 bg-[#050505]">
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-1 items-center justify-center min-h-screen">
                    <Animated.View style={animatedStyle}>
                        <PlayerCard author={mannequinUser} totalPosts={displayPosts} isDark={true} />
                    </Animated.View>
                </View>

                {saveShareVisible && !buttonsVisible && (
                    <View className="flex-row justify-center gap-6 opacity-40 mb-6">
                        <TouchableOpacity
                            onPress={() => { }}
                            className="px-6 py-3 bg-white/5 rounded-full border border-white/10"
                        >
                            {saveState === 'saving' ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <View className="flex-row items-center gap-2">
                                    {saveState === 'saved' ? (
                                        <Ionicons name="checkmark" size={20} color="white" />
                                    ) : (
                                        <Feather name="download" size={20} color="white" />
                                    )}
                                    <Text className="text-white text-[10px] font-black uppercase tracking-widest">Save</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { }}
                            className="px-6 py-3 bg-white/5 rounded-full border border-white/10"
                        >
                            <View className="flex-row items-center gap-3">
                                <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                                <Text className="text-white text-[10px] font-black uppercase tracking-widest">Share</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {buttonsVisible && (
                    <>
                        <View className="flex-row justify-center gap-6 opacity-40 mb-6">
                            <TouchableOpacity
                                onPress={onBack}
                                className="px-6 py-3 bg-white/5 rounded-full border border-white/10"
                            >
                                <Text className="text-white text-[10px] font-black uppercase tracking-widest">Back to Hub</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleReset}
                                className="px-6 py-3 bg-white/5 rounded-full border border-white/10"
                            >
                                <Text className="text-white text-[10px] font-black uppercase tracking-widest">Reset</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={startCinematic}
                            className="px-12 py-5 bg-purple-600 rounded-full shadow-2xl shadow-purple-500 mb-6"
                        >
                            <Text className="text-white font-black uppercase tracking-[0.2em] text-lg">Ignite Flex</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}