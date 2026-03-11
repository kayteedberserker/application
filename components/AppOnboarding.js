import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMMKV } from "react-native-mmkv";
import { useEffect, useState } from "react";
import {
    Dimensions,
    Modal,
    TouchableOpacity,
    View
} from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    ScaleIn
} from "react-native-reanimated";
import { Text } from "./Text";

const { height } = Dimensions.get('window');

export default function AppOnboarding() {
    // 🔹 Strictly use useMMKV hook for the storage instance
    const storage = useMMKV();

    const [isVisible, setIsVisible] = useState(false);
    const [step, setStep] = useState(0);
    const [isUpdateOnly, setIsUpdateOnly] = useState(false);

    const allFeatures = [
        {
            title: "SUMMONING_&_SCROLLS",
            desc: "Welcome to Oreblogda! Submit your scrolls to the High Council. Every chapter is reviewed by THE SYSTEM to ensure it's not FILLER before being ARCHIVED.",
            icon: "sparkles",
            color: "#6366f1",
            intel: "STATUS: HERO_AWAKENED"
        },
        {
            title: "THE_NINJA_CODE",
            desc: "Keep your Spirit Streak burning by posting every 48 hours. Beware the Judgment Gate: Cursed Spirits (spam) will have their streaks sealed by THE SYSTEM.",
            icon: "shield-checkmark",
            color: "#f87171",
            intel: "MANA: CONSISTENCY_CHECK"
        },
        {
            title: "AURA_&_PRESTIGE",
            desc: "Earn Aura Points through high engagement. The top 200 legends are etched into the Hall of Fame. Stay consistent to keep your glowing badges of prestige.",
            icon: "auto-fix",
            color: "#a78bfa",
            intel: "AURA: SOUL_VIBRATION"
        },
        {
            title: "CLAN_ALLIANCES",
            desc: "Don't wander alone. Join or create a Clan to pool your power. Higher-ranked clans like the Akatsuki or Gotei 13 receive massive daily point allocations.",
            icon: "people",
            color: "#10b981",
            intel: "GUILD: CLAN_SYSTEM_ACTIVE"
        },
        {
            title: "CLAN_WARS",
            desc: "The ultimate battlefield. Compete in CLAN WARS to show off whichs the best CLAN. Rank up to unlock titles like 'The Pirate King' and 'The Pillars' for your entire alliance.",
            icon: "flash",
            color: "#f59e0b",
            intel: "WAR: TERRITORY_BATTLE"
        },
        {
            title: "CLAN_COINS_&_TREASURY",
            desc: "Amass wealth for your alliance! Use Clan Coins (CC) or OC to purchase legendary frames and premium status. Earn CC daily or through direct treasury boosts. Claim 10 OC daily and 50 every 7 days",
            icon: "diamond",
            color: "#fbbf24",
            intel: "CURRENCY: CC_SYSTEM_LOADED"
        },
        {
            title: "THE_BLACK_MARKET",
            desc: "The marketplace is open. Spend your CC/OC on Phantom-class themes, limited-edition watermarks, and tactical clan boosts to dominate the leaderboards. There are different categories of products in the store...",
            icon: "cart",
            color: "#22d3ee",
            intel: "STORE: MARKET_ACCESS_GRANTED"
        },
        // ⚡️ NEW: The Peak System Slide
        {
            title: "THE_PEAK_SYSTEM",
            desc: "Support the network and ascend! Purchasing OC contributes to your total Peak Level. Reach higher Peak Tiers to unlock exclusive 3D crests, daily claim bonuses, and elite status on the leaderboards.",
            icon: "rocket", 
            color: "#ec4899", // Magenta/Pink to make it pop
            intel: "STATUS: ASCENSION_PROTOCOL"
        },
        {
            title: "ADVENTURE_AWAITS",
            desc: "Your Mana is full. Your connection is established. The world is waiting for your story, Hero. Go beyond, Plus Ultra!",
            icon: "checkmark-done-circle",
            color: "#10b981",
            intel: "FINAL_INIT: GO_BEYOND"
        }
    ];

    // ⚡️ Show ONLY the new Peak System and Adventure Awaits for returning users
    const updateOnlyFeatures = allFeatures.slice(7, 9); 

    const currentFeatures = isUpdateOnly ? updateOnlyFeatures : allFeatures;

    useEffect(() => {
        checkOnboardingStatus();
    }, []);

    const checkOnboardingStatus = () => {
        try {
            // 🔹 Synchronous check with MMKV
            const storedUser = storage.getString("mobileUser");
            const hasSeenWelcome = storage.getString("HAS_SEEN_WELCOME");
            const hasSeenPeakUpdate = storage.getString("HAS_SEEN_PEAK_V5"); // ⚡️ New Tracker

            if (storedUser !== undefined && storedUser !== null) {
                if (!hasSeenWelcome) {
                    // Brand new user: Show everything
                    setIsUpdateOnly(false);
                    setIsVisible(true);
                } else if (!hasSeenPeakUpdate) {
                    // Returning user needs to see the new Peak system
                    setIsUpdateOnly(true);
                    setIsVisible(true);
                }
            }
        } catch (e) {
            console.log("Onboarding logic error:", e);
        }
    };

    const handleComplete = () => {
        try {
            // 🔹 Synchronous update to MMKV
            storage.set("HAS_SEEN_WELCOME", "true");
            storage.set("HAS_SEEN_CLAN_UPDATE", "true");
            storage.set("HAS_SEEN_COINS_V3", "true");
            storage.set("HAS_SEEN_STORE_V4", "true");
            storage.set("HAS_SEEN_PEAK_V5", "true"); // ⚡️ Marks the update as seen
            setIsVisible(false);
        } catch (e) {
            console.log("Error saving onboarding state:", e);
        }
    };

    const nextStep = () => {
        if (step < currentFeatures.length - 1) setStep(step + 1);
        else handleComplete();
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
    };

    if (!isVisible) return null;

    return (
        <Modal transparent visible={isVisible} animationType="none">
            <View style={{ 
                flex: 1, 
                backgroundColor: 'rgba(0,0,0,0.96)', 
                justifyContent: 'center', 
                alignItems: 'center',
                padding: 20 
            }}>
                <Animated.View entering={FadeIn} style={{ position: 'absolute', width: '100%', height: '100%' }} />

                <Animated.View 
                    entering={ScaleIn}
                    style={{ 
                        width: '100%', 
                        height: height * 0.78, 
                        backgroundColor: '#050505', 
                        borderRadius: 32, 
                        borderWidth: 1, 
                        borderColor: '#1e293b',
                        padding: 30,
                        justifyContent: 'space-between'
                    }}
                >
                    {/* --- TOP NAVIGATION BAR --- */}
                    <View style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        zIndex: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: '#111',
                        paddingBottom: 15
                    }}>
                        <View style={{ width: 80 }}> 
                            {step > 0 && (
                                <TouchableOpacity 
                                    onPress={prevStep} 
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                >
                                    <Ionicons name="chevron-back" size={14} color="#60a5fa" />
                                    <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: 'bold' }}>PREV_DATA</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        <View style={{ alignItems: 'center' }}>
                           {isUpdateOnly && <Text style={{ fontSize: 9, color: '#22d3ee', fontWeight: 'bold' }}>[ NEW_UPDATE_V5 ]</Text>}
                        </View>

                        <TouchableOpacity onPress={handleComplete}>
                            <Text style={{ fontSize: 10, color: '#475569', fontWeight: 'bold', letterSpacing: 1 }}>SKIP_SYNC_X</Text>
                        </TouchableOpacity>
                    </View>

                    <View>
                        {/* Icon Container with Glow */}
                        <Animated.View key={`icon-${step}`} entering={FadeIn} style={{ marginBottom: 30, marginTop: 10 }}>
                            <View style={{ 
                                width: 68, height: 68, borderRadius: 20, backgroundColor: '#000', 
                                borderWidth: 1, borderColor: currentFeatures[step].color, 
                                justifyContent: 'center', alignItems: 'center',
                                shadowColor: currentFeatures[step].color, shadowOpacity: 0.3, shadowRadius: 15,
                                elevation: 5
                            }}>
                                {currentFeatures[step].icon === "auto-fix" ? (
                                     <MaterialCommunityIcons name="auto-fix" size={34} color={currentFeatures[step].color} />
                                ) : (
                                    <Ionicons name={currentFeatures[step].icon} size={34} color={currentFeatures[step].color} />
                                )}
                            </View>
                        </Animated.View>

                        {/* Text Content */}
                        <Animated.View key={`text-${step}`} entering={FadeInDown}>
                            <Text style={{ fontSize: 10, color: currentFeatures[step].color, fontWeight: '900', letterSpacing: 3, marginBottom: 12 }}>
                                {currentFeatures[step].intel} // 0{step + 1}
                            </Text>
                            <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 18, lineHeight: 34 }}>
                                {currentFeatures[step].title.replace(/_/g, ' ')}
                            </Text>
                            <Text style={{ fontSize: 15, color: '#94a3b8', lineHeight: 24 }}>
                                {currentFeatures[step].desc}
                            </Text>
                        </Animated.View>
                    </View>

                    <View>
                        {/* Progress Dots */}
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 30 }}>
                            {currentFeatures.map((_, i) => (
                                <View key={i} style={{ 
                                    height: 4, width: i === step ? 24 : 6, borderRadius: 10, 
                                    backgroundColor: i === step ? currentFeatures[step].color : '#1e293b' 
                                }} />
                            ))}
                        </View>

                        {/* Main Action Button */}
                        <TouchableOpacity
                            onPress={nextStep}
                            activeOpacity={0.8}
                            style={{
                                backgroundColor: currentFeatures[step].color,
                                paddingVertical: 18, borderRadius: 18,
                                alignItems: 'center', flexDirection: 'row',
                                justifyContent: 'center', gap: 10
                            }}
                        >
                            <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={{ color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 2 }}>
                                    {step === currentFeatures.length - 1 ? "INITIALIZE_CORE" : "NEXT_SYNC_LEVEL"}
                                </Text>
                                <Ionicons 
                                    name={step === currentFeatures.length - 1 ? "flash" : "chevron-forward"} 
                                    size={20} 
                                    color="#000" 
                                />
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}