import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlayerCard from './../../../components/PlayerCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SCALE = (SCREEN_WIDTH * 0.95) / 372;

const ALL_TITLES = [
    // COMMON
    { "name": "Penny Pincher", "tier": "COMMON", "category": "Economy" },
    { "name": "Appreciated", "tier": "COMMON", "category": "Social" },
    { "name": "Night Owl", "tier": "COMMON", "category": "Milestone" },

    // RARE
    { "name": "Silver Merchant", "tier": "RARE", "category": "Economy" },
    { "name": "Active Voice", "tier": "RARE", "category": "Creator" },
    { "name": "Crowd Favorite", "tier": "RARE", "category": "Social" },
    { "name": "Topic Starter", "tier": "RARE", "category": "Discussion" },

    // EPIC
    { "name": "The Chronicler", "tier": "EPIC", "category": "Creator" },
    { "name": "Golden Soul", "tier": "EPIC", "category": "Social" },
    { "name": "Debate Master", "tier": "EPIC", "category": "Discussion" },
    { "name": "Viral Spec", "tier": "EPIC", "category": "Reach" },

    // LEGENDARY
    { "name": "Architect of Lore", "tier": "LEGENDARY", "category": "Creator" },
    { "name": "The People's Choice", "tier": "LEGENDARY", "category": "Social" },
    { "name": "The Great Orator", "tier": "LEGENDARY", "category": "Discussion" },
    { "name": "Omnipresent", "tier": "LEGENDARY", "category": "Reach" },
    { "name": "System Glitch", "tier": "LEGENDARY", "category": "Milestone" },

    // MYTHIC
    { "name": "Contributor", "tier": "MYTHIC", "category": "System" },
    { "name": "Root Access", "tier": "MYTHIC", "category": "System" }
];

export default function TitleShowcaseScene({ onBack }) {
    const [activeTitle, setActiveTitle] = useState(ALL_TITLES[0]);
    const [isCycling, setIsCycling] = useState(false);
    const animationFrameRef = useRef(null);

    const titleScale = useSharedValue(1);
    const titleOpacity = useSharedValue(1);

    const animatedTitleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: titleScale.value }],
        opacity: titleOpacity.value,
    }));

    const startTitleCycle = () => {
        if (isCycling) return;
        setIsCycling(true);

        let index = 0;
        const cycleDuration = 15000; // 8 seconds total
        const startTime = Date.now();

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / cycleDuration, 1);

            // Change title every 800ms for a fast showcase
            const nextIndex = Math.floor((elapsed / 800) % ALL_TITLES.length);

            if (nextIndex !== index) {
                index = nextIndex;
                setActiveTitle(ALL_TITLES[index]);

                // Pop animation on change
                titleScale.value = 1.2;
                titleScale.value = withTiming(1, { duration: 300 });
            }

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                setIsCycling(false);
            }
        };
        animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Card is locked to MYTHIC/MAX stats for this scene
    const showcaseUser = {
        username: "THE_SYSTEM",
        aura: 2000,
        weeklyAura: 200,
        previousRank: 99,
        currentRankLevel: 5,
        streak: 15,
        description: "Unlocking every Title in the System.",
        equippedTitle: activeTitle,
        inventory: [
            { id: 'astral_leg_hero', category: 'AVATAR', isEquipped: true, visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/hianim_avatar.json' } },
        ],
    };

    return (
        <SafeAreaView className="flex-1 bg-[#050505]">
            {!isCycling && (
                <View className="p-6">
                    <Text className="text-white text-3xl font-black italic tracking-tighter">THE SYSTEM</Text>
                    <Text className="text-purple-500 font-bold tracking-[0.3em] text-xs">TITLE SHOWCASE</Text>
                </View>
            )}

            <View className="flex-1 items-center justify-center">
                <Animated.View style={{ transform: [{ scale: CARD_SCALE }] }}>
                    <PlayerCard author={showcaseUser} totalPosts={999} isDark={true} />
                </Animated.View>

                {!isCycling && (
                    /* Visual indicator of the current Title Tier below the card */
                    <View className="mt-8 items-center">
                        <Text className={`text-[10px] font-black tracking-[0.5em] mb-2 ${activeTitle.tier === 'LEGENDARY' ? 'text-yellow-400' :
                            activeTitle.tier === 'EPIC' ? 'text-purple-500' : 'text-gray-400'
                            }`}>
                            {activeTitle.tier}
                        </Text>
                        <Text className="text-white/40 text-[10px] uppercase">{activeTitle.category} Category</Text>
                    </View>
                )}
            </View>

            {!isCycling && (
                <View className="p-8 gap-4">
                    {isCycling ? (
                        <View className="bg-white/10 py-5 rounded-2xl items-center border border-white/20">
                            <Text className="text-white/60 font-black uppercase tracking-widest italic">Cycling System...</Text>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={startTitleCycle}
                                className="bg-white py-5 rounded-2xl items-center shadow-xl"
                            >
                                <View className="flex-row items-center gap-3">
                                    <Ionicons name="flash" size={20} color="black" />
                                    <Text className="text-black font-black uppercase tracking-widest">Cycle Titles</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={onBack}
                                className="py-4 items-center"
                            >
                                <Text className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Close Showcase</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}