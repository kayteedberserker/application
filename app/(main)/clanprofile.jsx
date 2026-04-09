import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    DeviceEventEmitter,
    Dimensions,
    Image,
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';
import { useMMKV } from "react-native-mmkv";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import ViewShot from "react-native-view-shot";

// ⚡️ Swapped to LegendList for maximum performance
import { LegendList } from "@legendapp/list";

import * as Haptics from 'expo-haptics'; // ⚡️ ADD THIS
import LottieView from 'lottie-react-native';
import { MotiView } from 'moti';
import Animated, {
    Easing, // ⚡️ ADD THIS
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import AnimeLoading from "../../components/AnimeLoading";
import { ClanBadge } from "../../components/ClanBadge";
import ClanBorder from "../../components/ClanBorder";
import ClanCard from "../../components/ClanCard";
import ClanCrest from "../../components/ClanCrest";
import CoinIcon from "../../components/ClanIcon";
import { SyncLoading } from "../../components/SyncLoading";
import { Text } from "../../components/Text";
import { useAlert } from "../../context/AlertContext";
import { useClan } from '../../context/ClanContext';
import { useCoins } from "../../context/CoinContext";
import { useUser } from '../../context/UserContext';
import apiFetch from "../../utils/apiFetch";
const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// ✍️ PREMIUM CINEMATIC WORD REVEAL
// ============================================================================
const AnimatedWord = ({ word, index, style }) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(10);

    useEffect(() => {
        // ⚡️ Haptic feedback syncs perfectly with each word appearing
        setTimeout(() => { Haptics.selectionAsync(); }, index * 60);
        opacity.value = withDelay(index * 60, withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }));
        translateY.value = withDelay(index * 60, withTiming(0, { duration: 400, easing: Easing.out(Easing.back(1.5)) }));
    }, [word]);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }]
    }));

    return <Animated.Text style={[style, animStyle, { marginRight: 6 }]}>{word}</Animated.Text>;
};

const PremiumTextReveal = ({ text, style }) => {
    const lines = text.split('\n');
    let globalWordIndex = 0;

    return (
        <View style={{ width: '100%' }}>
            {lines.map((line, lineIndex) => (
                <View key={`line-${lineIndex}`} style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: line === '' ? 12 : 0 }}>
                    {line.split(' ').map((word, wIndex) => {
                        if (word === '') return null;
                        const currentIndex = globalWordIndex++;
                        return <AnimatedWord key={`word-${currentIndex}`} word={word} index={currentIndex} style={style} />;
                    })}
                </View>
            ))}
        </View>
    );
};

// ============================================================================
// ⚡️ FULL-SCREEN CINEMATIC ONBOARDING MODAL
// ============================================================================
const CinematicClanOnboarding = ({ visible, onClose, isLeader, appBlue }) => {
    const [step, setStep] = useState(0);

    // Dynamic steps based on permissions
    const ONBOARDING_STEPS = useMemo(() => {
        const baseSteps = [
            {
                // ⚡️ Groups: Dojo Tab + Shinobi Tab
                title: "THE_SYNDICATE_DOJO",
                intel: "SYS: COMMAND_CENTER",
                desc: "Welcome to your Clan's hub. Track World Rank and Clan Funds in the Dojo, and inspect your fellow operatives in the Shinobi tab. Your alliance's strength is measured here.",
                icon: "shield", // Fixed invalid icon
                color: appBlue
            },
            {
                // ⚡️ Groups: Scrolls Tab + Hall Tab
                title: "INTEL_&_COMMS",
                intel: "SYS: NETWORK_SYNC",
                desc: "Read clan-exclusive Transmissions in the Scrolls tab. Coordinate real-time attack strategies with your allies in the Great Hall. Silence is defeat.",
                icon: "chatbubbles",
                color: "#a855f7" // Purple
            },
            {
                // ⚡️ Groups: Wars Tab + Top-Right Store/Inventory Modals
                title: "WARS_&_BLACK_MARKET",
                intel: "SYS: COMBAT_&_ASSETS",
                desc: "Review past combat history in the Wars tab. Tap the top-right icons to access the Black Market and Inventory, burning Clan Coins (CC) to unlock and equip legendary visual aesthetics.",
                icon: "flame",
                color: "#f59e0b" // Amber
            }
        ];

        // ⚡️ Only inject this step if they are a Leader / Anbu Captain
        if (isLeader) {
            baseSteps.push({
                // ⚡️ Groups: Kage Desk Tab (Admin)
                title: "THE_KAGE_DESK",
                intel: "SYS: ADMIN_AUTHORITY",
                desc: "As village brass, you control the gates. Manage recruitment, approve seekers, and banish rogues from the Kage Desk.",
                icon: "key",
                color: "#ef4444" // Red
            });
        }

        return baseSteps;
    }, [isLeader, appBlue]);

    if (!visible) return null;

    const currentStep = ONBOARDING_STEPS[step];
    const isLastStep = step === ONBOARDING_STEPS.length - 1;

    const handleNext = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (isLastStep) {
            onClose();
        } else {
            setStep(s => s + 1);
        }
    };

    const handlePrev = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (step > 0) setStep(step - 1);
    };

    return (
        <Modal transparent animationType="fade" visible={visible}>
            {/* ⚡️ TRUE FULL SCREEN: Fills the entire device, black background */}
            <View style={{ flex: 1, backgroundColor: '#050505', paddingHorizontal: 30, paddingTop: 60, paddingBottom: 40, justifyContent: 'space-between' }}>

                <Animated.View entering={FadeIn.duration(800)} style={{ position: 'absolute', width: '100%', height: '100%' }} />

                {/* --- TOP NAVIGATION BAR --- */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#1a1a1a',
                    paddingBottom: 20
                }}>
                    <View style={{ width: 80 }}>
                        {step > 0 && (
                            <TouchableOpacity
                                onPress={handlePrev}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                                <Ionicons name="chevron-back" size={14} color="#60a5fa" />
                                <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: 'bold', letterSpacing: 1 }}>PREV</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 9, color: currentStep.color, fontWeight: 'bold', letterSpacing: 2 }}>[ SYNC_PROGRESS: {step + 1}/{ONBOARDING_STEPS.length} ]</Text>
                    </View>

                    <TouchableOpacity onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onClose();
                    }}>
                        <Text style={{ fontSize: 10, color: '#475569', fontWeight: 'bold', letterSpacing: 1 }}>SKIP_SYNC_X</Text>
                    </TouchableOpacity>
                </View>

                {/* --- MAIN CONTENT AREA --- */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    {/* Icon Container with Glow */}
                    <Animated.View key={`icon-${step}`} entering={FadeIn} style={{ marginBottom: 40 }}>
                        <View style={{
                            width: 80, height: 80, borderRadius: 24, backgroundColor: '#000',
                            borderWidth: 1, borderColor: currentStep.color,
                            justifyContent: 'center', alignItems: 'center',
                            shadowColor: currentStep.color, shadowOpacity: 0.4, shadowRadius: 20,
                            elevation: 10
                        }}>
                            <Ionicons name={currentStep.icon} size={40} color={currentStep.color} />
                        </View>
                    </Animated.View>

                    {/* Text Content */}
                    <Animated.View key={`text-${step}`} entering={FadeInDown}>
                        <Text style={{ fontSize: 11, color: currentStep.color, fontWeight: '900', letterSpacing: 3, marginBottom: 16 }}>
                            {currentStep.intel}
                        </Text>
                        <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 24, lineHeight: 38, fontStyle: 'italic' }}>
                            {currentStep.title.replace(/_/g, ' ')}
                        </Text>

                        {/* ⚡️ THE CINEMATIC REVEAL */}
                        <PremiumTextReveal
                            key={step} // Forces remount to restart typing animation
                            text={currentStep.desc}
                            style={{ fontSize: 16, color: '#94a3b8', lineHeight: 26, fontWeight: '500' }}
                        />
                    </Animated.View>
                </View>

                {/* --- FOOTER CONTROLS --- */}
                <View style={{ marginTop: 20 }}>
                    {/* Progress Dots */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 40, justifyContent: 'center' }}>
                        {ONBOARDING_STEPS.map((_, i) => (
                            <View key={i} style={{
                                height: 4, width: i === step ? 32 : 8, borderRadius: 10,
                                backgroundColor: i === step ? currentStep.color : '#1e293b'
                            }} />
                        ))}
                    </View>

                    {/* Main Action Button */}
                    <TouchableOpacity
                        onPress={handleNext}
                        activeOpacity={0.8}
                        style={{
                            backgroundColor: currentStep.color,
                            paddingVertical: 20, borderRadius: 20,
                            alignItems: 'center', flexDirection: 'row',
                            justifyContent: 'center', gap: 12,
                            shadowColor: currentStep.color, shadowOpacity: 0.3, shadowRadius: 10
                        }}
                    >
                        <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 2 }}>
                                {isLastStep ? "INITIALIZE_DOJO" : "NEXT_SYNC_LEVEL"}
                            </Text>
                            <Ionicons
                                name={isLastStep ? "flash" : "chevron-forward"}
                                size={20}
                                color="#000"
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// =================================================================
// MAIN COMPONENT
// =================================================================
let HAS_SHOWN_SESSION_LOADER = false;

const ClanProfile = () => {
    const storage = useMMKV();

    const CustomAlert = useAlert();
    const { user } = useUser();
    const { userClan, isLoading: clanLoading, canManageClan, userRole, hasUnreadChat, markChatAsRead } = useClan();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [fullData, setFullData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Dojo');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', logo: '' });

    // 💬 Chat State
    const [localMessages, setLocalMessages] = useState([]);
    const flatListRef = useRef(null);
    const [showTopButton, setShowTopButton] = useState(false);

    // Modals
    const [storeModalVisible, setStoreModalVisible] = useState(false);
    const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    // ⚡️ ONBOARDING STATE
    const [showOnboarding, setShowOnboarding] = useState(false);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    // Pagination & Posts State
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
    const [isReachingEnd, setIsReachingEnd] = useState(false);
    const [cardPreviewVisible, setCardPreviewVisible] = useState(false);
    const clanCardRef = useRef(null);

    const captureAndShare = async () => {
        try {
            if (clanCardRef.current) {
                const uri = await clanCardRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                }
            }
        } catch (error) {
            console.error("Capture Error:", error);
        }
    };

    // War History State
    const [warHistory, setWarHistory] = useState([]);
    const [loadingWars, setLoadingWars] = useState(false);

    const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins();

    const CACHE_KEY = `@clan_data_${userClan?.tag}`;
    const ONBOARDING_KEY = `@has_seen_clan_onboarding_${userClan?.tag}`;

    useEffect(() => {
        if (fullData?.messages) {
            setLocalMessages(fullData.messages);
        }

        // ⚡️ Check Onboarding exactly when fullData is ready
        if (fullData && !loading) {
            const hasSeenOnboarding = storage.getBoolean(ONBOARDING_KEY);
            if (!hasSeenOnboarding) {
                setShowOnboarding(true);
            }
        }
    }, [fullData, loading]);

    const finishOnboarding = () => {
        storage.set(ONBOARDING_KEY, true);
        setShowOnboarding(false);
    };

    useEffect(() => {
        if (activeTab === 'Hall') {
            markChatAsRead();
        }
    }, [activeTab, localMessages, markChatAsRead]);

    // =================================================================
    // ⚡️ UPGRADED REANIMATED LOGIC (Zero JS Thread Blocking)
    // =================================================================
    const scanAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(1);

    const progressToNextRank = useMemo(() => {
        if (!fullData || !fullData.nextThreshold) return 0;
        return (fullData.totalPoints / fullData.nextThreshold) * 100;
    }, [fullData]);

    useEffect(() => {
        scanAnim.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.linear }), -1, false);
        pulseAnim.value = withRepeat(
            withSequence(withTiming(1.05, { duration: 2500 }), withTiming(1, { duration: 2500 })),
            -1, false
        );
    }, []);

    const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${scanAnim.value * 360}deg` }] }));
    const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));

    // =================================================================

    useEffect(() => {
        if (userClan?.tag) {
            initializeClanData();
            fetchPosts(1);
            fetchWarHistory();
        } else if (!clanLoading) {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userClan?.tag]);

    const initializeClanData = async () => {
        try {
            const cachedData = storage.getString(CACHE_KEY);
            if (cachedData && cachedData !== "") {
                const parsed = JSON.parse(cachedData);
                setFullData(parsed);
                setLocalMessages(parsed.messages || []);
                setEditData({ name: parsed.name, description: parsed.description, logo: parsed.logo });
                if (HAS_SHOWN_SESSION_LOADER) {
                    setLoading(false);
                }
            }
            await fetchFullDetails();
        } catch (err) {
            fetchFullDetails();
        }
    };

    let equippedGlow;
    let verifiedTier;
    if (fullData) {
        equippedGlow = fullData.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped) || {};
        verifiedTier = fullData.activeCustomizations?.verifiedTier;
    }
    const verifiedColor = verifiedTier === "premium" ? "#facc15" : verifiedTier === "standard" ? "#ef4444" : verifiedTier === "basic" ? "#3b82f6" : "";
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;
    const APP_BLUE = activeGlowColor || verifiedColor || "#3b82f6";

    const fetchFullDetails = async () => {
        const shouldShowHeavyLoader = !fullData && !HAS_SHOWN_SESSION_LOADER;
        if (shouldShowHeavyLoader) setLoading(true);
        try {
            const res = await apiFetch(`/clans/${userClan.tag}?deviceId=${user.deviceId}`);
            const data = await res.json();
            setFullData(data);
            setEditData({ name: data.name, description: data.description, logo: data.logo });
            storage.set(CACHE_KEY, JSON.stringify(data));
            HAS_SHOWN_SESSION_LOADER = true;
        } catch (err) {
            console.error("Fetch Details Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchWarHistory = async () => {
        setLoadingWars(true);
        try {
            const res = await apiFetch(`/clans/wars?clanTag=${userClan.tag}&status=COMPLETED`);
            const data = await res.json();
            const history = Array.isArray(data) ? data : (data.wars || []);
            setWarHistory(history);
        } catch (err) {
            console.error("Fetch Wars Error:", err);
        } finally {
            setLoadingWars(false);
        }
    };

    const fetchPosts = async (pageNum = 1) => {
        if (isFetchingNextPage || (pageNum > 1 && isReachingEnd)) return;
        if (pageNum > 1) setIsFetchingNextPage(true);
        try {
            const res = await apiFetch(`/posts?clanId=${userClan.tag}&page=${pageNum}&limit=10`);
            const text = await res.text();
            if (!text) {
                if (pageNum === 1) setPosts([]);
                return;
            }
            const data = JSON.parse(text);
            const postsArray = Array.isArray(data) ? data : (data.posts || []);
            if (postsArray.length < 10) setIsReachingEnd(true);
            setPosts(prev => pageNum === 1 ? postsArray : [...prev, ...postsArray]);
            setPage(pageNum);
        } catch (err) {
            console.error("Fetch Posts Error:", err);
        } finally {
            setIsFetchingNextPage(false);
        }
    };

    const triggerAction = async (action, payload = {}) => {
        setIsProcessingAction(true);
        if (action == "EDIT_CLAN") {
            if (clanCoins < 200) {
                CustomAlert("Insufficient Funds", "The village treasury is empty.");
                setIsProcessingAction(false);
                return;
            }
            CustomAlert("Confirm Purchase", `Spend 200 CC on Changing Clan Info?`, [
                { text: "Cancel", style: "cancel", onPress: () => setIsProcessingAction(false) },
                {
                    text: "Purchase",
                    style: "default",
                    onPress: async () => {
                        const result = await processTransaction('spend', 'change_name_desc', "CC", userClan.tag);
                        if (result.success) {
                            const res = await apiFetch(`/clans/${userClan.tag}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ deviceId: user.deviceId, action, payload })
                            });
                            if (!res.ok) {
                                await processTransaction('refund', 'change_name_desc', "CC");
                            } else {
                                CustomAlert("Transaction Done", "Clan Info Updated.");
                                fetchFullDetails();
                            }
                        } else {
                            CustomAlert("Transaction Failed", result.error || "The scroll could not be processed.");
                        }
                        setIsProcessingAction(false);
                    }
                }
            ]);
            setIsEditing(false);
            return;
        }
        try {
            const res = await apiFetch(`/clans/${userClan.tag}`, {
                method: 'PATCH',
                body: JSON.stringify({ deviceId: user.deviceId, action, payload })
            });
            const data = await res.json();
            if (res.ok) {
                if (action === "EDIT_CLAN") setIsEditing(false);
                if (action === "BUY_STORE_ITEM") CustomAlert("Success", `'${payload.itemName || 'Item'}' applied to the village.`);
                if (action === "LEAVE_CLAN") {
                    storage.set(CACHE_KEY, "");
                    storage.set(ONBOARDING_KEY, false); // Clean up onboarding flag on leave
                    CustomAlert("Deserted", "You have left the village.");
                    router.replace('/screens/discover');
                }
                fetchFullDetails();
                if (action === "DELETE_POST") {
                    setPosts(prev => prev.filter(p => p._id !== payload.postId));
                }
            } else {
                CustomAlert("Action Failed", data.message || "Jutsu failed to activate");
                if (action === "BUY_STORE_ITEM" && payload.itemId) {
                    await processTransaction('refund', payload.itemId, "CC");
                }
            }
        } catch (err) {
            CustomAlert("Scroll Error", "Connection to the village lost.");
            if (action === "BUY_STORE_ITEM" && payload.itemId) {
                await processTransaction('refund', payload.itemId, "CC");
            }
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleDeletePost = (postId) => {
        CustomAlert("Banish Post", "Destroy this scroll from the village archives?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Destroy",
                style: "destructive",
                onPress: () => triggerAction("DELETE_POST", { postId })
            }
        ]);
    };

    const handleShareClan = async () => {
        const shareUrl = `https://oreblogda.com/clans/${fullData?.tag}`;
        try {
            await Share.share({
                message: `Join my clan ${fullData?.name} on the app! Local Tag: #${fullData?.tag}\nLink: ${shareUrl}`,
            });
        } catch (error) {
            CustomAlert("Error", "Could not manifest the share scroll.");
        }
    };

    const copyLinkToClipboard = async () => {
        const shareUrl = `clans/${fullData?.tag}`;
        await Clipboard.setStringAsync(shareUrl);
        CustomAlert("Link Sealed", "Clan link copied to clipboard!");
    };

    const handleLeaveClan = () => {
        CustomAlert("Leave Village", "Are you sure you want to abandon your clan? This action cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Leave",
                style: "destructive",
                onPress: () => triggerAction("LEAVE_CLAN")
            }
        ]);
    };

    const handleSendMessage = async (text) => {
        const tempId = Date.now().toString();
        const newMessage = {
            _id: tempId,
            authorId: user.deviceId,
            authorName: user.username,
            text,
            date: new Date().toISOString()
        };

        setLocalMessages(prev => [...prev, newMessage]);

        try {
            await apiFetch(`/clans/${userClan.tag}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    deviceId: user.deviceId,
                    action: 'SEND_MESSAGE',
                    payload: { text }
                })
            });
        } catch (err) {
            console.error("Failed to send message", err);
        }
    };

    const scrollToTop = () => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    const handleScroll = (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        if (offsetY > 500) {
            if (!showTopButton) setShowTopButton(true);
        } else {
            if (showTopButton) setShowTopButton(false);
        }
    };

    if (loading || clanLoading) {
        return <AnimeLoading tipType={"clan"} message="Syncing Bloodline" subMessage="Consulting the Elder Scrolls..." />;
    }

    if (!userClan) {
        return (
            <View className="flex-1 justify-center items-center bg-white dark:bg-[#0a0a0a] p-6">
                <MaterialCommunityIcons name="sword-cross" size={64} color={APP_BLUE} />
                <Text className="text-gray-500 dark:text-gray-400 text-center text-lg font-black uppercase mt-4">
                    Rogue Ninja Detected
                </Text>
                <Text className="text-gray-400 text-center text-xs font-bold mt-2">
                    You belong to no village. Join a clan to build your legacy.
                </Text>
            </View>
        );
    }

    const listHeader = (
        <View>
            <View style={{ position: 'absolute', left: -10000, opacity: 0 }} pointerEvents="none">
                <ViewShot ref={clanCardRef} options={{ format: "png", quality: 1 }}>
                    <ClanCard clan={fullData} isDark={isDark} forSnapshot={true} />
                </ViewShot>
            </View>

            <View className="p-8 px-2 mt-10 items-center border-b border-gray-100 dark:border-zinc-900">
                <View className="w-full flex-row justify-center items-center relative">
                    <View className="relative">
                        <Animated.View
                            style={[
                                {
                                    position: 'absolute', inset: -15, borderRadius: 100,
                                    backgroundColor: activeGlowColor || APP_BLUE, opacity: 0.1,
                                },
                                pulseStyle
                            ]}
                        />
                        <Animated.View
                            style={[
                                { borderColor: `${activeGlowColor || APP_BLUE}40` },
                                spinStyle
                            ]}
                            className="absolute -inset-5 border border-dashed rounded-full"
                        />
                        <ClanCrest glowColor={activeGlowColor || verifiedColor} rank={fullData?.rank || 1} size={120} />
                    </View>

                    <View className="absolute right-0 flex flex-col justify-between items-center gap-2">
                        <TouchableOpacity
                            onPress={() => setCardPreviewVisible(true)}
                            className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-full z-10 border border-gray-200 dark:border-zinc-700"
                        >
                            <Ionicons name="card-outline" size={24} color={APP_BLUE} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setInventoryModalVisible(true)}
                            className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-full z-10 border border-gray-200 dark:border-zinc-700"
                        >
                            <MaterialCommunityIcons name="bag-personal-outline" size={24} color={APP_BLUE} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setStoreModalVisible(true)}
                            className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-full z-10 border border-gray-200 dark:border-zinc-700"
                        >
                            <MaterialCommunityIcons name="storefront-outline" size={24} color={APP_BLUE} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="mt-12 items-center w-full px-4">
                    {isEditing ? (
                        <View className="w-full gap-y-2">
                            <TextInput
                                value={editData.name}
                                onChangeText={(t) => setEditData({ ...editData, name: t })}
                                className="text-1xl font-black text-blue-500 text-center uppercase italic border-b border-blue-500 w-full"
                                placeholder="Clan Name"
                            />
                            <TextInput
                                value={editData.description}
                                onChangeText={(t) => setEditData({ ...editData, description: t })}
                                multiline
                                className="text-gray-600 dark:text-gray-300 text-xs italic text-center p-2 border border-blue-200 rounded-lg"
                                placeholder="Village Motto..."
                            />
                        </View>
                    ) : (
                        <>
                            <View className="flex flex-row gap-2 items-center">
                                <Text className="text-2xl font-black text-black dark:text-white uppercase italic tracking-tighter text-center">
                                    {fullData?.name}
                                </Text>
                                <RemoteSvgIcon size={30} xml={fullData?.activeCustomizations?.verifiedBadgeXml} />
                            </View>
                            <Text className="text-gray-500 dark:text-gray-400 text-xs italic mt-2 text-center px-6 leading-4">
                                "{fullData?.description || "No village motto defined."}"
                            </Text>
                        </>
                    )}

                    <View className="flex-row items-center gap-2 mt-1">
                        <Text style={{ color: APP_BLUE }} className="font-black tracking-[0.3em] text-xs">#{fullData?.tag}</Text>
                        <View className="h-1 w-1 rounded-full bg-gray-400" />
                        <Text className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase">
                            {userRole === 'leader' ? 'Village Head' : userRole === 'viceLeader' ? 'Anbu Captain' : 'Shinobi'}
                        </Text>
                    </View>

                    {canManageClan && (
                        <TouchableOpacity
                            onPress={() => isEditing ? triggerAction("EDIT_CLAN", editData) : setIsEditing(true)}
                            className="absolute right-0 top-0 p-3 bg-gray-100 dark:bg-zinc-800 rounded-full"
                        >
                            <Feather name={isEditing ? "check" : "edit-3"} size={18} color={APP_BLUE} />
                        </TouchableOpacity>
                    )}
                </View>

                <View className="w-full mt-3">
                    <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">Clan Achievements</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: 10,
                            flexGrow: 1,
                            justifyContent: fullData?.badges?.length > 0 ? 'flex-start' : 'center',
                            alignItems: 'center'
                        }}
                    >
                        {fullData?.badges?.length > 0 ? (
                            fullData.badges.map((badge, idx) => (
                                <ClanBadge key={`${badge}-${idx}`} badgeName={badge} size="md" />
                            ))
                        ) : (
                            <View className="items-center opacity-40 py-2">
                                <View className="bg-gray-500/10 p-4 rounded-full mb-2">
                                    <MaterialCommunityIcons name="shield-off-outline" size={24} color="#9ca3af" />
                                </View>
                                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    No Achievements Yet
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>

            <View className="px-6 py-6">
                <View className="flex-row justify-between items-end mb-2">
                    <Text className="text-gray-400 font-black text-[9px] uppercase tracking-widest">Clan Points</Text>
                    <Text className="text-black dark:text-white font-mono font-bold text-[10px]">
                        {fullData?.totalPoints?.toLocaleString()} / {fullData?.nextThreshold?.toLocaleString()}
                    </Text>
                </View>
                <View className="w-full h-2 bg-gray-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                    <View className="h-full" style={{ width: `${Math.min(progressToNextRank, 100)}%`, backgroundColor: activeGlowColor || APP_BLUE }} />
                </View>
            </View>

            <View className="flex-row px-4 border-b border-gray-100 dark:border-zinc-900 mb-6">
                {['Dojo', 'Shinobi', 'Wars', 'Scrolls', "Hall", canManageClan && 'Kage Desk'].filter(Boolean).map(tab => {
                    const isHallUnread = tab === 'Hall' && hasUnreadChat && activeTab !== 'Hall';
                    const hasJoinReqs = tab === 'Kage Desk' && fullData?.joinRequests?.length > 0;

                    return (
                        <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} className="flex-1 items-center py-4 relative">
                            <View className="relative">
                                <Text style={{ color: activeTab === tab ? APP_BLUE : '#9ca3af' }} className={`font-black text-[8px] uppercase tracking-widest`}>
                                    {tab}
                                </Text>
                                {isHallUnread && (
                                    <View className="absolute -top-1 -right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                                )}
                                {hasJoinReqs && (
                                    <View className="absolute -top-1.5 -right-3 bg-red-500 rounded-full px-1 min-w-[12px] items-center justify-center">
                                        <Text className="text-[6px] text-white font-black">{fullData.joinRequests.length}</Text>
                                    </View>
                                )}
                            </View>
                            {activeTab === tab && <View style={{ backgroundColor: APP_BLUE }} className="h-0.5 w-4 mt-1" />}
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Modal visible={cardPreviewVisible} transparent animationType="slide">
                <View className="flex-1 bg-black/95">
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View className="w-full items-center">
                            <View className="w-full flex-row justify-between items-center pt-10">
                                <View>
                                    <Text className="text-white font-black text-xl italic uppercase tracking-widest">Clan Scroll</Text>
                                    <Text className="text-gray-500 font-bold text-[9px] uppercase tracking-[0.4em] mt-1">Official Manifest</Text>
                                </View>
                                <Pressable onPress={() => setCardPreviewVisible(false)} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center">
                                    <Ionicons name="close" size={28} color="white" />
                                </Pressable>
                            </View>
                            <View style={{ transform: [{ scale: Math.min(1, (width - 40) / 380) }], width: 380, alignItems: 'center' }}>
                                <ClanCard clan={fullData} isDark={isDark} forSnapshot={true} />
                            </View>
                            <View className="w-full">
                                <TouchableOpacity
                                    onPress={captureAndShare}
                                    style={{ backgroundColor: APP_BLUE }}
                                    className="flex-row items-center justify-center gap-3 w-full h-16 rounded-[30px] shadow-lg"
                                >
                                    <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                                    <Text className="text-white font-black uppercase tracking-[0.2em] text-sm italic">Dispatch Scroll</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
            {activeTab === 'Hall' && (
                <View className="px-4 pb-4">
                    <ClanChatInput onSend={handleSendMessage} isDark={isDark} appBlue={APP_BLUE} />
                </View>
            )}
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <LegendList
                ref={flatListRef}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={{ flex: 1, backgroundColor: isDark ? "#0a0a0a" : "#fff" }}
                data={
                    activeTab === 'Scrolls' ? posts :
                        activeTab === 'Wars' ? warHistory :
                            activeTab === 'Hall' ? [...localMessages].reverse() : []
                }
                keyExtractor={(item) => item._id}
                estimatedItemSize={120}
                recycleItems={true}
                contentContainerStyle={{
                    paddingBottom: insets.bottom + 100
                }}
                ListHeaderComponent={
                    <View>
                        {listHeader}
                        {activeTab === 'Dojo' && (
                            <View className="px-6 pb-10">
                                <View className="flex-row flex-wrap justify-between">
                                    <StatCard glowColor={activeGlowColor} label="Followers" value={fullData?.followerCount} icon="account-group" />
                                    <StatCard glowColor={activeGlowColor} label="Clan Funds" value={fullData?.spendablePoints} isCoin={true} icon="cash-multiple" />
                                    <StatCard glowColor={activeGlowColor} label="World Rank" value={`#${fullData?.rank}`} icon="seal" />
                                    <StatCard glowColor={activeGlowColor} label="Shinobi Count" value={`${fullData?.members?.length}/${fullData?.maxSlots}`} icon="account-multiple" />
                                </View>

                                <Text className="text-black dark:text-white font-black text-xs mt-6 mb-4 uppercase tracking-widest">Village Expansion</Text>
                                <View className="flex-row gap-x-2 mb-6">
                                    <TouchableOpacity
                                        onPress={handleShareClan}
                                        style={{ backgroundColor: APP_BLUE }}
                                        className="flex-1 p-4 rounded-3xl flex-row items-center justify-center gap-x-2 shadow-lg shadow-blue-500/40"
                                    >
                                        <Feather name="share-2" size={16} color="white" />
                                        <Text className="text-white font-black text-[10px] uppercase italic">Summon Allies</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={copyLinkToClipboard}
                                        className="bg-gray-100 dark:bg-zinc-900 p-4 rounded-3xl border border-gray-200 dark:border-zinc-800"
                                    >
                                        <Feather name="copy" size={16} color={APP_BLUE} />
                                    </TouchableOpacity>
                                </View>

                                <View className="gap-y-3 mb-6">
                                    <ExpansionRow glowColor={APP_BLUE} icon="heart-plus-outline" label="Follow our Village" subLabel="Stay updated on our progress" />
                                    <ExpansionRow glowColor={APP_BLUE} icon="feather" label="Join as an Author" subLabel="Write scrolls for the clan" />
                                </View>

                                <Text className="text-black dark:text-white font-black text-xs mt-2 mb-4 uppercase tracking-widest">Village Influence</Text>
                                <View className="bg-gray-50 dark:bg-zinc-950 p-2 rounded-3xl border border-gray-100 dark:border-zinc-900">
                                    <StatRow label="Sightings (Views)" value={fullData?.stats?.views} />
                                    <StatRow label="Respect (Likes)" value={fullData?.stats?.likes} />
                                    <StatRow label="Whispers (Comments)" value={fullData?.stats?.comments} />
                                    <StatRow label="Scroll Depth" value={`${fullData?.stats?.totalPosts} Posts`} highlight color={APP_BLUE} />
                                </View>

                                <TouchableOpacity onPress={handleLeaveClan} className="mt-8 bg-red-500/10 p-4 rounded-3xl items-center border border-red-500/20">
                                    <Text className="text-red-500 font-black text-[10px] uppercase tracking-widest">Desert Village</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {activeTab === 'Shinobi' && (
                            <View className="px-6 pb-10">
                                {fullData?.members?.map(m => (
                                    <MemberItem
                                        key={m._id}
                                        member={m}
                                        roleLabel={m._id === fullData.leader?._id ? "Kage" : (m._id === fullData.viceLeader?._id ? "Jonin" : "Genin")}
                                        canManage={canManageClan && m._id !== fullData.leader?._id}
                                        isLeader={userRole === 'leader'}
                                        onKick={() => triggerAction("KICK_MEMBER", { userId: m._id })}
                                        onAppoint={() => triggerAction("APPOINT_VICE", { userId: m._id })}
                                        isProcessingAction={isProcessingAction}
                                        accent={APP_BLUE}
                                    />
                                ))}
                            </View>
                        )}

                        {activeTab === 'Wars' && (
                            <View className="px-6">
                                <Text className="text-black dark:text-white font-black text-xs mb-4 uppercase tracking-widest italic">Great Ninja War Archives</Text>
                                {loadingWars && <SyncLoading message="Loading Wars..." />}
                                {warHistory.length === 0 && !loadingWars && (
                                    <View className="p-10 bg-gray-50 dark:bg-zinc-900 rounded-[30px] items-center border border-dashed border-gray-200 dark:border-zinc-800">
                                        <MaterialCommunityIcons name="sword-cross" size={32} color="#9ca3af" />
                                        <Text className="text-[10px] font-black text-gray-400 uppercase mt-2">No past conflicts recorded</Text>
                                    </View>
                                )}
                            </View>
                        )}
                        {activeTab === 'Kage Desk' && canManageClan && (
                            <View className="px-6">
                                <AdminToggle
                                    label="Open Village Gates"
                                    status={fullData.isRecruiting ? "OPEN" : "CLOSED"}
                                    onPress={() => triggerAction("TOGGLE_RECRUIT")}
                                    accent={APP_BLUE}
                                />
                                <View className="mt-8">
                                    <Text className="text-black dark:text-white font-black text-xs mb-4 uppercase tracking-widest italic">Seekers of the Leaf</Text>
                                    {fullData.joinRequests?.length > 0 ? (
                                        fullData.joinRequests.map(req => (
                                            <RequestItem
                                                key={req.userId?._id || Math.random()}
                                                isProcessingAction={isProcessingAction}
                                                user={req.userId}
                                                onApprove={() => triggerAction("APPROVE_MEMBER", { userId: req.userId?._id })}
                                                onDecline={() => triggerAction("DECLINE_MEMBER", { userId: req.userId?._id })}
                                                accent={APP_BLUE}
                                            />
                                        ))
                                    ) : (
                                        <View className="p-12 items-center bg-gray-50 dark:bg-zinc-900/50 rounded-[40px] border border-dashed border-gray-100 dark:border-zinc-800">
                                            <Feather name="user-plus" size={24} color="#4b5563" />
                                            <Text className="text-gray-400 font-bold uppercase text-[9px] mt-4 tracking-widest">No seekers found</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                }
                renderItem={({ item }) => {
                    if (activeTab === 'Scrolls') {
                        return (
                            <View className="px-6 mb-4">
                                <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-2xl flex-row justify-between items-center">
                                    <Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/post/${item.slug || item._id}`)} className="flex-1 pr-4">
                                        <Text className="font-black text-sm uppercase tracking-tight text-gray-800 dark:text-gray-200" numberOfLines={1}>
                                            {item.title || item.message}
                                        </Text>
                                        <Text className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </Text>
                                    </Pressable>
                                    {canManageClan && (
                                        <TouchableOpacity onPress={() => handleDeletePost(item._id)} className="p-3 bg-red-500/10 rounded-xl">
                                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    }
                    if (activeTab === 'Wars') {
                        return <WarHistoryItem war={item} clanTag={userClan.tag} />;
                    }
                    if (activeTab === 'Hall') {
                        return <ClanMessageItem message={item} isDark={isDark} isMe={item.authorId === user.deviceId} appBlue={APP_BLUE} />;
                    }
                    return null;
                }}
                onEndReached={() => {
                    if (activeTab === 'Scrolls' && !isReachingEnd && !isFetchingNextPage) {
                        fetchPosts(page + 1);
                    }
                }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={() => {
                    if (activeTab === 'Hall' && localMessages.length === 0) {
                        return (
                            <View className="items-center justify-center py-20 opacity-50">
                                <Ionicons name="chatbubbles-outline" size={60} color={isDark ? "#52525b" : "#d1d5db"} />
                                <Text className="text-zinc-500 font-black uppercase text-xs tracking-widest mt-4">The Hall is Silent</Text>
                            </View>
                        )
                    }
                    return null;
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => (
                    <View style={{ paddingBottom: insets.bottom + 100 }}>
                        {isFetchingNextPage && <SyncLoading message="Loading more scrolls" />}
                    </View>
                )}
            />

            {activeTab === 'Hall' && showTopButton && (
                <TouchableOpacity
                    onPress={scrollToTop}
                    activeOpacity={0.8}
                    style={{
                        position: 'absolute',
                        bottom: insets.bottom + 80,
                        left: 20,
                        backgroundColor: APP_BLUE,
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        justifyContent: 'center',
                        alignItems: 'center',
                        elevation: 5,
                        shadowColor: APP_BLUE,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10
                    }}
                >
                    <Ionicons name="arrow-up" size={24} color="white" />
                </TouchableOpacity>
            )}

            <ClanStoreModal fetchFullDetails={fetchFullDetails} isDark={isDark} onClose={() => setStoreModalVisible(false)} visible={storeModalVisible} />
            <ClanInventoryModal
                visible={inventoryModalVisible}
                onClose={() => setInventoryModalVisible(false)}
                clan={fullData}
                isDark={isDark}
                user={user}
                fetchFullDetails={fetchFullDetails}
            />

            {/* ⚡️ MOUNT THE CINEMATIC ONBOARDING MODAL */}
            <CinematicClanOnboarding
                visible={showOnboarding}
                onClose={finishOnboarding}
                isLeader={canManageClan}
                appBlue={APP_BLUE}
            />
        </View>
    );
};


// 💬 --- CHAT SUBCOMPONENTS ---

const ClanChatInput = ({ onSend, isDark, appBlue }) => {
    const [text, setText] = useState('');

    return (
        <View className={`p-2 rounded-[30px] border ${isDark ? 'bg-[#111] border-zinc-800' : 'bg-gray-50 border-gray-200'} flex-row items-center`}>
            <TextInput
                className={`flex-1 min-h-[44px] max-h-32 px-5 py-3 font-bold text-sm ${isDark ? 'text-white' : 'text-black'}`}
                placeholder="Speak to the village..."
                placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
                multiline
                value={text}
                onChangeText={setText}
                keyboardAppearance={isDark ? "dark" : "light"}
            />
            <TouchableOpacity
                onPress={() => {
                    if (text.trim()) {
                        onSend(text.trim());
                        setText('');
                        Keyboard.dismiss();
                    }
                }}
                style={{ backgroundColor: text.trim() ? appBlue : (isDark ? '#27272a' : '#e4e4e7') }}
                className="w-12 h-12 rounded-full items-center justify-center ml-2"
            >
                <Ionicons name="send" size={16} color={text.trim() ? 'white' : (isDark ? '#52525b' : '#a1a1aa')} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
        </View>
    );
};

const ClanMessageItem = ({ message, isMe, isDark, appBlue }) => {
    return (
        <View className={`px-6 py-1.5 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
            <View
                className={`max-w-[80%] px-4 py-3 ${isMe ? 'rounded-3xl rounded-tr-sm' : 'rounded-3xl rounded-tl-sm'}`}
                style={{ backgroundColor: isMe ? appBlue : (isDark ? '#18181b' : '#f4f4f5') }}
            >
                {!isMe && (
                    <Text className={`text-[10px] font-black mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {message.authorName?.toUpperCase()}
                    </Text>
                )}
                <Text className={`text-sm font-medium ${isMe ? 'text-white' : (isDark ? 'text-zinc-200' : 'text-zinc-800')}`}>
                    {message.text}
                </Text>
                <Text className={`text-[8px] font-black mt-1 ${isMe ? 'text-blue-200 text-right' : (isDark ? 'text-zinc-600 text-left' : 'text-zinc-400 text-left')}`}>
                    {new Date(message.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
    );
};

// 🎨 --- RENDERER FOR BACKEND SVGS ---
const RemoteSvgIcon = ({ xml, size = 150, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    return <SvgXml xml={xml} width={size} height={size} color={color} />;
};

const getRarityColor = (rarity) => {
    switch (rarity?.toUpperCase()) {
        case 'MYTHIC': return '#ef4444'; // Red
        case 'LEGENDARY': return '#fbbf24'; // Gold
        case 'EPIC': return '#a855f7'; // Purple
        case 'RARE': return '#3b82f6'; // Blue
        case 'COMMON': default: return '#9ca3af'; // Gray
    }
};

// 🔹 1. CLAN ITEM PREVIEW MODAL
const ClanItemPreviewModal = ({
    isVisible,
    onClose,
    currentClan,
    selectedProduct,
    onAction,
    isProcessing,
    actionType = "buy"
}) => {

    const previewClan = useMemo(() => {
        if (!selectedProduct) return null;

        const baseClan = currentClan || {
            name: "Preview Clan",
            tag: "PRVW",
            description: "Previewing clan cosmetics.",
            totalPoints: 9999,
            rank: 1,
            members: [],
            specialInventory: []
        };

        const filteredInventory = (baseClan.specialInventory || []).map(item => {
            if (item.category === selectedProduct.category) {
                return { ...item, isEquipped: false };
            }
            return item;
        });

        const normalizedProduct = {
            ...selectedProduct,
            itemId: selectedProduct.id || selectedProduct.itemId,
            isEquipped: true,
            visualConfig: selectedProduct.visualConfig || selectedProduct.visualData || {}
        };

        return {
            ...baseClan,
            specialInventory: [
                ...filteredInventory,
                normalizedProduct
            ]
        };
    }, [currentClan, selectedProduct]);

    if (!isVisible || !selectedProduct) return null;

    const rarityColor = getRarityColor(selectedProduct.rarity);
    const itemCurrency = selectedProduct.currency || 'CC';
    const isCurrentlyEquipped = currentClan?.specialInventory?.find(i => i.itemId === (selectedProduct.id || selectedProduct.itemId))?.isEquipped;

    // ⚡️ Check if this is an item that actually changes the visual look of the card
    const isVisualCosmetic = ['BORDER', 'BACKGROUND', 'GLOW', 'WATERMARK'].includes(selectedProduct.category?.toUpperCase());

    return (
        <View style={previewStyles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} disabled={isProcessing} />

            <MotiView
                from={{ opacity: 0, translateY: 100, scale: 0.9 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                exit={{ opacity: 0, translateY: 100, scale: 0.9 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                style={[previewStyles.modalCard, { borderColor: rarityColor, borderWidth: 1 }]}
            >
                <TouchableOpacity onPress={onClose} style={previewStyles.closeButton} disabled={isProcessing}>
                    <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>

                <View style={previewStyles.header}>
                    <MaterialCommunityIcons name="star-four-points" size={16} color={rarityColor} />
                    <Text style={[previewStyles.rarityText, { color: rarityColor }]}>
                        {selectedProduct.rarity?.toUpperCase() || 'COMMON'} {selectedProduct.category === 'UPGRADE' ? 'UPGRADE' : 'ARTIFACT'}
                    </Text>
                </View>

                {/* ⚡️ THE STAGE: Uses ClanCard or a big Icon depending on category */}
                <View style={previewStyles.stage}>
                    {isVisualCosmetic ? (
                        // ⚡️ Increased scale from 0.70 to 0.85
                        <View style={{ transform: [{ scale: 0.85 }], alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            {previewClan && (
                                <ClanCard
                                    clan={previewClan}
                                    isDark={true}
                                />
                            )}
                        </View>
                    ) : (
                        // Fallback for Upgrades or Badges that don't need a full card preview
                        <View style={{ backgroundColor: `${rarityColor}15`, borderColor: `${rarityColor}50` }} className="w-40 h-40 rounded-3xl items-center justify-center border-2 shadow-xl">
                            {selectedProduct.visualConfig?.svgCode ? (
                                <RemoteSvgIcon xml={selectedProduct.visualConfig.svgCode} size={80} color={selectedProduct.visualConfig.primaryColor} />
                            ) : (
                                <MaterialCommunityIcons name={selectedProduct.visualConfig?.icon || 'arrow-up-bold-circle'} size={80} color={rarityColor} />
                            )}
                        </View>
                    )}
                </View>

                <View style={previewStyles.detailsContainer}>
                    <Text className="text-2xl font-black text-white text-center mb-1">
                        {selectedProduct.name}
                    </Text>
                    {selectedProduct.expiresInDays && actionType === "buy" && (
                        <Text className="text-xs font-medium text-gray-400 text-center mb-6 uppercase tracking-widest">
                            Duration: {selectedProduct.expiresInDays} Days
                        </Text>
                    )}
                    {actionType === "equip" && (
                        <Text className="text-xs font-medium text-gray-400 text-center mb-6 uppercase tracking-widest">
                            Previewing Artifact
                        </Text>
                    )}

                    <TouchableOpacity
                        disabled={isProcessing}
                        onPress={() => onAction(selectedProduct)}
                        style={[
                            previewStyles.purchaseButton,
                            isProcessing && { opacity: 0.5 },
                            actionType === "equip" && { backgroundColor: isCurrentlyEquipped ? '#ef4444' : '#22c55e' }
                        ]}
                    >
                        {isProcessing ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <>
                                {actionType === "buy" ? (
                                    <>
                                        <Ionicons name="flash" size={18} color="#000" />
                                        <Text className="text-base font-black text-black ml-2 uppercase">
                                            Acquire for {selectedProduct.price} {itemCurrency}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name={isCurrentlyEquipped ? "shield-remove" : "shield-check"} size={18} color="#fff" />
                                        <Text className="text-base font-black text-white ml-2 uppercase">
                                            {isCurrentlyEquipped ? 'Unequip Artifact' : 'Equip Artifact'}
                                        </Text>
                                    </>
                                )}
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </MotiView>
        </View>
    );
};

const previewStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
    },
    modalCard: {
        width: width * 0.95,
        backgroundColor: '#111827',
        borderRadius: 32,
        overflow: 'hidden',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 100,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        gap: 6,
    },
    rarityText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
    },
    stage: {
        height: 380, // Kept this tall so the scaled-up ClanCard fits!
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },
    detailsContainer: {
        padding: 24,
        backgroundColor: '#1f2937',
        borderTopWidth: 1,
        borderColor: '#374151',
    },
    purchaseButton: {
        flexDirection: 'row',
        backgroundColor: '#fbbf24',
        paddingVertical: 16,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    }
});


// 🔹 2. CLAN STORE MODAL
const ClanStoreModal = ({ visible, fetchFullDetails, onClose, isDark, clan }) => {
    const storage = useMMKV();
    const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins();

    const CustomAlert = useAlert();

    // ⚡️ CACHE CONFIGURATION
    const CACHE_KEY = "CLAN_STORE_CATALOG";
    const hasFetchedThisSession = useRef(false);

    // ⚡️ FIXED: Synchronously initialize from MMKV so there is zero flicker!
    const [catalog, setCatalog] = useState(() => {
        try {
            const cached = storage.getString(CACHE_KEY);
            return cached ? JSON.parse(cached) : { themes: [], standaloneItems: [] };
        } catch {
            return { themes: [], standaloneItems: [] };
        }
    });

    // ⚡️ FIXED: Only start with loading screen if the cache is completely empty
    const [loading, setLoading] = useState(() => {
        try {
            const cached = storage.getString(CACHE_KEY);
            const parsed = cached ? JSON.parse(cached) : null;
            return !(parsed && (parsed.themes?.length > 0 || parsed.standaloneItems?.length > 0));
        } catch {
            return true;
        }
    });

    const [selectedTheme, setSelectedTheme] = useState(null);
    const [itemToPreview, setItemToPreview] = useState(null);

    useEffect(() => {
        if (visible) {
            fetchStoreData();
        } else {
            setSelectedTheme(null);
            setItemToPreview(null);
        }
    }, [visible]);

    const fetchStoreData = async () => {
        // We already loaded the cache synchronously in useState!
        // Now, we just check if we need to fetch fresh data in the background.
        if (!hasFetchedThisSession.current) {
            try {
                // Failsafe: just in case the catalog is empty
                if (catalog.themes.length === 0 && catalog.standaloneItems.length === 0) {
                    setLoading(true);
                }

                const res = await apiFetch(`/store?type=clan`);
                const data = await res.json();

                if (data.success && data.catalog) {
                    const newCatalog = {
                        themes: data.catalog.themes || [],
                        standaloneItems: data.catalog.standaloneItems || []
                    };

                    setCatalog(newCatalog);
                    storage.set(CACHE_KEY, JSON.stringify(newCatalog));
                    hasFetchedThisSession.current = true;
                }
            } catch (e) {
                console.error("Store fetch error:", e);
            } finally {
                setLoading(false);
            }
        }
    };

    // ⚡️ CRITICAL FIX: Add a Confirmation Alert before purchasing!
    const handlePurchase = async (item) => {
        const itemCurrency = item.currency || 'CC';
        const currentBalance = itemCurrency === 'CC' ? clanCoins : coins;

        if (currentBalance < item.price) {
            CustomAlert("Insufficient Funds", `The treasury requires more ${itemCurrency === 'CC' ? "CC" : "OC"}.`);
            return;
        }

        // ⚡️ Show a confirmation dialog before doing the transaction
        CustomAlert(
            "Confirm Acquisition",
            `Do you want to unlock ${item.name} for ${item.price} ${itemCurrency}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unlock",
                    style: "default",
                    onPress: async () => {
                        const result = await processTransaction('buy_item', item.category, {
                            itemId: item.id,
                            price: item.price,
                            name: item.name,
                            category: item.category,
                            currency: itemCurrency,
                            visualConfig: item.visualData || item.visualConfig,
                            expiresInDays: item.expiresInDays,
                            rarity: item.rarity
                        });

                        if (result.success) {
                            CustomAlert("Success", "Artifact added to village inventory.");
                            if (typeof fetchFullDetails === 'function') fetchFullDetails();
                            setItemToPreview(null);
                        } else {
                            CustomAlert("Error", result.error || "Transaction failed");
                        }
                    }
                }
            ]
        );
    };

    const groupedStandaloneItems = useMemo(() => {
        return catalog.standaloneItems.reduce((groups, item) => {
            const category = item.category || 'MISC';
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
            return groups;
        }, {});
    }, [catalog.standaloneItems]);

    const renderCompactCard = (item) => {
        const visual = item.visualData || item.visualConfig || {};
        const isBorder = item.category === 'BORDER';
        const isLottie = !!(visual.lottieUrl || visual.lottieJson);
        const cardRarityColor = getRarityColor(item.rarity);

        // ⚡️ Check if it's a category that shouldn't open the preview modal
        const isDirectPurchase = ['VERIFIED', 'UPGRADE'].includes(item.category?.toUpperCase());

        return (
            <TouchableOpacity
                key={item.id}
                // ⚡️ Trigger direct purchase flow if it's an upgrade or verified badge
                onPress={() => isDirectPurchase ? handlePurchase(item) : setItemToPreview(item)}
                className="bg-gray-100 dark:bg-[#1a1a1a] mr-4 p-4 rounded-3xl w-40 border shadow-sm mb-4"
                style={{ borderColor: `${cardRarityColor}40` }}
            >
                <View className="mb-3">
                    <View
                        className="h-24 w-full bg-black/10 dark:bg-black/40 rounded-2xl items-center justify-center overflow-hidden border dark:border-white/5 relative"
                        style={{ borderColor: `${cardRarityColor}20` }}
                    >
                        {isBorder ? (
                            <ClanBorder
                                color={visual.primaryColor || visual.color || "#ff0000"}
                                secondaryColor={visual.secondaryColor}
                                animationType={visual.animationType}
                                duration={visual.duration}
                            >
                                <View className="h-10 flex justify-center items-center rounded-sm">
                                    <Text className="text-[10px] dark:text-white/50 font-black uppercase tracking-tighter">Frame</Text>
                                </View>
                            </ClanBorder>
                        ) : isLottie ? (
                            <LottieView
                                source={visual.lottieJson ? visual.lottieJson : { uri: visual.lottieUrl }}
                                autoPlay
                                renderMode="hardware"
                                loop
                                style={{ width: '120%', height: '120%', position: 'absolute' }}
                                resizeMode="contain"
                            />
                        ) : visual.svgCode ? (
                            <RemoteSvgIcon xml={visual.svgCode} color={visual.glowColor || visual.primaryColor || visual.color} size={50} />
                        ) : (
                            <MaterialCommunityIcons name={visual.icon || 'star'} size={40} color={visual.color || (isDark ? 'white' : 'black')} />
                        )}
                        <View style={{ backgroundColor: cardRarityColor }} className="absolute top-2 right-2 w-2 h-2 rounded-full shadow-lg" />
                    </View>
                </View>
                <Text className="dark:text-white font-black text-[11px] uppercase tracking-tight" numberOfLines={1}>{item.name}</Text>
                <View className="flex-row items-center mt-2 justify-between">
                    <View className="flex-row items-center bg-green-500/10 px-2 py-0.5 rounded-lg">
                        <Text className="text-green-600 dark:text-green-500 font-black text-[10px] mr-1">{item.price}</Text>
                        <CoinIcon type={item.currency || "CC"} size={10} />
                    </View>
                    <View style={{ backgroundColor: cardRarityColor }} className="p-1.5 rounded-full shadow-lg shadow-blue-500/30">
                        {/* ⚡️ Change icon based on action */}
                        <Ionicons name={isDirectPurchase ? "cart" : "eye"} size={12} color="white" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-[#0a0a0a] h-[85%] rounded-t-[40px] p-6 border-t-4 border-green-500">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <TouchableOpacity
                                onPress={() => selectedTheme ? setSelectedTheme(null) : null}
                                className="flex-row items-center"
                                disabled={!selectedTheme}
                            >
                                {selectedTheme && <Ionicons name="chevron-back" size={20} color="#22c55e" />}
                                <Text className="text-2xl font-black uppercase italic dark:text-white">
                                    {selectedTheme ? selectedTheme.label : "Clan Market"}
                                </Text>
                            </TouchableOpacity>
                            <View className="flex-row items-center mt-1 bg-gray-100 dark:bg-zinc-900 self-start px-3 py-1.5 rounded-full">
                                <Text className="text-green-500 font-black text-[10px] uppercase mr-1">CC: {clanCoins || 0}</Text>
                                <CoinIcon type="CC" size={10} />
                                <Text className="text-gray-400 font-black text-[10px] uppercase mx-2">|</Text>
                                <Text className="text-blue-500 font-black text-[10px] uppercase mr-1">OC: {coins || 0}</Text>
                                <CoinIcon type="OC" size={10} />
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-gray-100 dark:bg-zinc-900 p-3 rounded-full">
                            <Ionicons name="close" size={24} color={isDark ? "white" : "black"} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#22c55e" />
                            <Text className="text-green-500 font-black uppercase text-[10px] mt-4 tracking-widest">Downloading Assets...</Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                            {!selectedTheme ? (
                                <View>
                                    {Object.entries(groupedStandaloneItems).map(([category, items]) => (
                                        <View key={category} className="">
                                            <View className="flex-row items-center mb-3">
                                                <View className="w-1 h-3 bg-green-500 rounded-full mr-2" />
                                                <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">{category}S</Text>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: items.length > 1 ? 380 : 180 }} contentContainerStyle={{ flexDirection: 'column', flexWrap: 'wrap' }}>
                                                {items.map(item => renderCompactCard(item))}
                                            </ScrollView>
                                        </View>
                                    ))}
                                    {catalog.themes?.length > 0 && (
                                        <View>
                                            <View className="flex-row items-center mb-4 mt-2">
                                                <View className="w-1 h-3 bg-blue-500 rounded-full mr-2" />
                                                <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">Thematic Collections</Text>
                                            </View>
                                            <View className="flex-row flex-wrap justify-between">
                                                {catalog.themes.map((theme) => (
                                                    <TouchableOpacity key={theme.id} onPress={() => setSelectedTheme(theme)} className="w-[48%] bg-gray-100 dark:bg-[#1a1a1a] p-6 rounded-3xl mb-4 items-center border border-gray-200 dark:border-gray-800 shadow-sm">
                                                        <View className="mb-3">
                                                            <RemoteSvgIcon xml={theme.iconsvg} color="#22c55e" size={80} />
                                                        </View>
                                                        <Text className="dark:text-white font-black uppercase mt-1 text-center text-xs">{theme.label}</Text>
                                                        <View className="bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded-md mt-2">
                                                            <Text className="text-gray-500 text-[8px] uppercase font-bold">{theme.items?.length || 0} Items</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    {['BADGE', 'THEME', 'BACKGROUND', "WATERMARK", 'EFFECT', 'GLOW', 'BORDER'].map((cat) => {
                                        const themeItems = selectedTheme.items?.filter(i => i.category?.toUpperCase() === cat) || [];
                                        if (themeItems.length === 0) return null;
                                        return (
                                            <View key={cat} className="mb-6">
                                                <View className="flex-row items-center mb-3">
                                                    <View className="w-1 h-3 bg-green-500 rounded-full mr-2" />
                                                    <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">{cat}S</Text>
                                                </View>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: themeItems.length > 1 ? 380 : 180 }} contentContainerStyle={{ flexDirection: 'column', flexWrap: 'wrap' }}>
                                                    {themeItems.map(item => renderCompactCard(item))}
                                                </ScrollView>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* ⚡️ Clan Item Preview Modal */}
            <ClanItemPreviewModal
                isVisible={!!itemToPreview}
                onClose={() => setItemToPreview(null)}
                currentClan={clan}
                selectedProduct={itemToPreview}
                onAction={handlePurchase}
                isProcessing={isProcessingTransaction}
                actionType="buy"
            />
        </Modal>
    );
};

// 🔹 3. CLAN INVENTORY MODAL
const ClanInventoryModal = ({ visible, onClose, fetchFullDetails, clan, isDark, user }) => {
    const [filter, setFilter] = useState('ALL');
    const [isUpdating, setIsUpdating] = useState(false);
    const [itemToPreview, setItemToPreview] = useState(null);
    const CustomAlert = useAlert();

    const getExpirationText = (expiry) => {
        if (!expiry) return null;
        const now = new Date();
        const end = new Date(expiry);
        const diff = end - now;

        if (diff <= 0) return "Expired";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days}d remaining`;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        return `${hours}h remaining`;
    };

    const now = new Date();
    const expiry = new Date(clan?.verifiedUntil);

    const getVerifiedItem = () => {
        if (!clan?.verifiedUntil || expiry < now) return null;

        return {
            itemId: 'active_verification_status',
            name: `${clan.activeCustomizations?.verifiedTier || 'Clan'} Verification`,
            category: 'VERIFIED',
            isEquipped: true,
            expiresAt: clan.verifiedUntil,
            visualConfig: {
                svgCode: clan.activeCustomizations?.verifiedBadgeXml,
                primaryColor: clan.activeCustomizations?.verifiedTier === 'premium' ? '#facc15' :
                    clan.activeCustomizations?.verifiedTier === 'standard' ? '#ef4444' : '#3b82f6'
            }
        };
    };

    let inventory = clan?.specialInventory ? [...clan.specialInventory] : [];
    const verifiedItem = getVerifiedItem();
    if (verifiedItem) inventory.unshift(verifiedItem);

    const categories = ['ALL', 'VERIFIED', 'WATERMARK', 'BADGE', "BACKGROUND", 'GLOW', 'BORDER'];

    const handleEquipToggle = async (selectedItem) => {
        if (selectedItem.itemId === 'active_verification_status') return;
        if (isUpdating) return;
        setIsUpdating(true);

        try {
            const res = await apiFetch(`/clans/${clan.tag}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: user.deviceId,
                    action: "EQUIP_ITEM",
                    payload: { itemId: selectedItem.itemId }
                })
            });

            const data = await res.json();
            if (res.ok) {
                if (typeof fetchFullDetails === 'function') fetchFullDetails();
                setItemToPreview(null); // Close modal on success
            } else {
                throw new Error(data.message || "Jutsu failed to activate");
            }
        } catch (err) {
            console.error("Equip Error:", err);
            CustomAlert("Scroll Error", "Connection to the village lost.");
        } finally {
            setIsUpdating(false);
        }
    };

    const filteredInventory = filter === 'ALL'
        ? inventory
        : inventory.filter(item => item.category === filter);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-[#0d1117] h-[85%] rounded-t-[40px] p-6 border-t-4 border-blue-500">
                    <View className="flex-row justify-between items-center mb-4">
                        <View>
                            <Text className="text-2xl font-black uppercase italic dark:text-white">Arsenal</Text>
                            <Text className="text-blue-500 font-black text-[10px] uppercase tracking-widest">
                                {expiry > now ? clan?.specialInventory?.length + 1 || 1 : clan?.specialInventory?.length || 0} Collectibles Owned
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color={isDark ? "white" : "black"} />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row mb-6">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => setFilter(cat)}
                                    className={`mr-2 px-4 py-2 rounded-full border ${filter === cat ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-gray-700'}`}
                                >
                                    <Text className={`text-[10px] font-black uppercase ${filter === cat ? 'text-white' : 'text-gray-500'}`}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map((item, idx) => {
                                const expiration = getExpirationText(item.expiresAt);
                                const isExpired = expiration === "Expired";
                                const isBorder = item.category === 'BORDER';
                                const isStatusBadge = item.itemId === 'active_verification_status';
                                const visual = item.visualConfig || {};
                                const rowRarityColor = getRarityColor(item.rarity);
                                const isLottie = !!(visual.lottieUrl || visual.lottieJson);

                                return (
                                    <View
                                        key={item.itemId || idx}
                                        className={`flex-row items-center p-4 rounded-3xl mb-3 border ${item.isEquipped
                                            ? 'bg-blue-500/10 border-blue-500'
                                            : 'bg-gray-50 dark:bg-[#161b22]'
                                            } ${isExpired ? 'opacity-50 border-red-500/30' : 'border-gray-100 dark:border-gray-800'}`}
                                    >
                                        {/* ⚡️ Tap the Icon to Preview */}
                                        <TouchableOpacity onPress={() => setItemToPreview(item)} className="mr-4">
                                            <View className={`w-16 h-16 bg-black/20 items-center justify-center rounded-2xl overflow-hidden ${isBorder ? '' : 'border relative'}`} style={{ borderColor: `${rowRarityColor}40` }}>
                                                {isBorder ? (
                                                    <ClanBorder
                                                        color={visual.primaryColor || visual.color || "#ff0000"}
                                                        secondaryColor={visual.secondaryColor}
                                                        animationType={visual.animationType}
                                                        duration={visual.duration}
                                                    >
                                                        <View className="h-6 w-6 flex justify-center items-center">
                                                            <Text className="text-[6px] dark:text-white/40 font-black uppercase">Frame</Text>
                                                        </View>
                                                    </ClanBorder>
                                                ) : isLottie ? (
                                                    <LottieView renderMode="hardware" source={visual.lottieJson ? visual.lottieJson : { uri: visual.lottieUrl }} autoPlay loop style={{ width: '140%', height: '140%', position: 'absolute' }} resizeMode="contain" />
                                                ) : visual.svgCode ? (
                                                    <RemoteSvgIcon xml={visual.svgCode} size={40} color={visual.primaryColor || visual.color} />
                                                ) : (
                                                    <MaterialCommunityIcons name={visual.icon || 'star'} size={30} color={visual.primaryColor || visual.color || 'white'} />
                                                )}
                                                <View style={{ backgroundColor: rowRarityColor }} className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full shadow-sm" />
                                            </View>
                                        </TouchableOpacity>

                                        <View className="flex-1">
                                            <Text className="font-black dark:text-white text-sm uppercase italic">{item.name}</Text>
                                            <View className="flex-row mt-2 items-center">
                                                <Text style={{ color: rowRarityColor }} className="text-[9px] uppercase font-bold tracking-widest">
                                                    {item.rarity || 'COMMON'} {item.category}
                                                </Text>
                                                {expiration && (
                                                    <>
                                                        <Text className="text-gray-600 dark:text-gray-400 text-[9px] mx-1">•</Text>
                                                        <View className="flex-row items-center">
                                                            <MaterialCommunityIcons name="clock-outline" size={10} color={isExpired ? "#ef4444" : "#6b7280"} />
                                                            <Text className={`text-[9px] font-bold ml-1 ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>{expiration}</Text>
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        </View>

                                        {!isExpired && !isStatusBadge && (
                                            <TouchableOpacity
                                                disabled={isUpdating}
                                                onPress={() => handleEquipToggle(item)}
                                                className={`px-6 py-3 rounded-xl ${item.isEquipped ? 'bg-green-500' : 'bg-blue-600'} ${isUpdating ? 'opacity-50' : ''}`}
                                            >
                                                {isUpdating ? <ActivityIndicator size="small" color="white" /> : (
                                                    <Text className="text-white text-[10px] font-black uppercase">{item.isEquipped ? 'Active' : 'Equip'}</Text>
                                                )}
                                            </TouchableOpacity>
                                        )}

                                        {isExpired && !isStatusBadge && (
                                            <View className="px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/20 ml-2">
                                                <Text className="text-red-500 text-[10px] font-black uppercase">Void</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        ) : (
                            <View className="items-center mt-20 opacity-30">
                                <MaterialCommunityIcons name="package-variant" size={80} color="gray" />
                                <Text className="mt-4 font-black uppercase text-xs tracking-widest dark:text-white">No {filter === 'ALL' ? '' : filter} items</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>

            {/* ⚡️ Clan Item Preview Modal */}
            <ClanItemPreviewModal
                isVisible={!!itemToPreview}
                onClose={() => setItemToPreview(null)}
                currentClan={clan}
                selectedProduct={itemToPreview}
                onAction={handleEquipToggle} // Passes the Equip function
                isProcessing={isUpdating}
                actionType="equip"
            />
        </Modal>
    );
};

// --- Sub Components

const WarHistoryItem = ({ war, clanTag }) => {
    const isWinner = war.winner === clanTag;
    const isDraw = war.winner === "DRAW";
    const opponent = war.challengerTag === clanTag ? war.defenderTag : war.challengerTag;

    const challengerScore = war.currentProgress?.challengerScore || 0;
    const defenderScore = war.currentProgress?.defenderScore || 0;

    return (
        <View className="px-6 mb-4">
            <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-3xl">
                <View className="flex-row justify-between items-center mb-4">
                    <View className="flex-row items-center gap-x-2">
                        <MaterialCommunityIcons
                            name={isDraw ? "scale-balance" : (isWinner ? "trophy-outline" : "skull-outline")}
                            size={20}
                            color={isDraw ? "#9ca3af" : (isWinner ? "#eab308" : "#ef4444")}
                        />
                        <Text className={`font-black uppercase text-[10px] ${isDraw ? 'text-gray-400' : (isWinner ? 'text-yellow-500' : 'text-red-500')}`}>
                            {isDraw ? "Stalemate" : (isWinner ? "Victory" : "Defeated")}
                        </Text>
                    </View>
                    <Text className="text-gray-400 font-bold text-[8px] uppercase">
                        {new Date(war.updatedAt).toLocaleDateString()}
                    </Text>
                </View>

                <View className="flex-row justify-between items-center bg-gray-50 dark:bg-zinc-950 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                    <View className="items-center flex-1">
                        <Text className="text-black dark:text-white font-black text-xs uppercase">{clanTag}</Text>
                        <Text className="text-blue-500 font-black text-sm mt-1">
                            {war.challengerTag === clanTag ? challengerScore : defenderScore}
                        </Text>
                    </View>
                    <Text className="px-4 text-gray-400 font-black italic">VS</Text>
                    <View className="items-center flex-1">
                        <Text className="text-black dark:text-white font-black text-xs uppercase">{opponent}</Text>
                        <Text className="text-gray-400 font-black text-sm mt-1">
                            {war.challengerTag === clanTag ? defenderScore : challengerScore}
                        </Text>
                    </View>
                </View>

                <View className="mt-4 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-x-1">
                        <MaterialCommunityIcons name="sword-cross" size={12} color="#6b7280" />
                        <Text className="text-gray-500 font-bold text-[8px] uppercase tracking-widest">{war.warType} WAR</Text>
                    </View>
                    <View className="bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                        <Text className="text-blue-500 font-black text-[9px] uppercase">
                            Prize: {war.prizePool * 2} Points
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const ExpansionRow = ({ icon, glowColor, label, subLabel, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-100 dark:border-zinc-800"
    >
        <View className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full items-center justify-center border border-gray-100 dark:border-zinc-700">
            <MaterialCommunityIcons name={icon} size={20} color={glowColor} />
        </View>
        <View className="flex-1 ml-4">
            <Text className="text-black dark:text-white font-black text-[10px] uppercase">{label}</Text>
            <Text className="text-gray-400 text-[8px] font-bold uppercase">{subLabel}</Text>
        </View>
        <Feather name="chevron-right" size={16} color="#9ca3af" />
    </TouchableOpacity>
);

const StatCard = ({ label, value, icon, isCoin, glowColor }) => (
    <View className="w-[48%] bg-white dark:bg-zinc-900/50 p-5 rounded-[30px] mb-4 border border-gray-100 dark:border-zinc-800 shadow-sm">
        <MaterialCommunityIcons name={icon} size={20} color={glowColor || "#3b82f6"} />
        <Text className="text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest mt-2">{label}</Text>
        <View className="flex-row items-center mt-1">
            <Text style={isCoin ? { color: "#9333ea" } : null} className="text-lg font-black mt-1 dark:text-white">{value?.toLocaleString() || 0} </Text>
            {isCoin && <CoinIcon size={20} type="CC" />}
        </View>
    </View>
);

const StatRow = ({ label, value, highlight, color }) => (
    <View className="flex-row justify-between px-4 py-4 border-b border-gray-100 dark:border-zinc-900/50 last:border-0">
        <Text className="text-gray-500 dark:text-gray-400 font-bold text-[11px] uppercase">{label}</Text>
        <Text className={`font-black text-xs ${highlight ? '' : 'text-black dark:text-white'}`} style={highlight ? { color: color } : {}}>
            {value || 0}
        </Text>
    </View>
);

const MemberItem = ({ member, roleLabel, canManage, isLeader, onKick, onAppoint, accent, isProcessingAction }) => (
    <View className="flex-row items-center mb-3 bg-white dark:bg-zinc-900/40 p-4 rounded-[24px] border border-gray-100 dark:border-zinc-800">
        {/* ⚡️ Explicit width, height, and contentFit fix invisible expo-image bug */}
        <Image
            source={{ uri: member.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
            contentFit="cover"
            style={{ width: 48, height: 48 }}
            className="rounded-full border-2 border-zinc-100 dark:border-zinc-800"
        />
        <View className="flex-1 ml-4">
            <Text className="text-black dark:text-white font-black uppercase text-xs tracking-tight">{member.username}</Text>
            <Text style={{ color: accent }} className="text-[8px] font-black uppercase tracking-widest mt-0.5">{roleLabel}</Text>
        </View>
        <View className="flex-row gap-x-2">
            {isLeader && roleLabel !== "Kage" && roleLabel !== "Jonin" && (
                <TouchableOpacity onPress={onAppoint} disabled={isProcessingAction} className="bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
                    <Text className="text-blue-600 dark:text-blue-400 font-black text-[9px] uppercase">{isProcessingAction ? "Appointing..." : "Appoint Jonin"}</Text>
                </TouchableOpacity>
            )}
            {canManage && (
                <TouchableOpacity onPress={onKick} disabled={isProcessingAction} className="bg-red-500/10 px-4 py-2 rounded-xl">
                    <Text className="text-red-600 dark:text-red-500 font-black text-[9px] uppercase">{isProcessingAction ? "Banishing..." : "Banish"}</Text>
                </TouchableOpacity>
            )}
        </View>
    </View>
);

const AdminToggle = ({ label, status, onPress, accent }) => (
    <TouchableOpacity
        onPress={onPress}
        className="p-6 bg-zinc-900 rounded-[30px] flex-row justify-between items-center border border-zinc-800 shadow-2xl"
    >
        <View>
            <Text className="text-white font-black uppercase text-[10px] tracking-widest">{label}</Text>
            <Text className="text-zinc-500 text-[8px] font-bold uppercase mt-1">Manage Gate Access</Text>
        </View>
        <View className={`px-4 py-2 rounded-xl ${status === 'OPEN' ? 'bg-green-500' : 'bg-red-500'}`}>
            <Text className="text-white font-black text-[10px] uppercase">{status}</Text>
        </View>
    </TouchableOpacity>
);

const RequestItem = ({ user, onApprove, onDecline, accent, isProcessingAction }) => (
    <View className="flex-row items-center mb-3 bg-white dark:bg-zinc-900 p-4 rounded-[24px] border border-gray-100 dark:border-zinc-800">
        {/* ⚡️ Explicit width, height, and contentFit fix invisible expo-image bug */}
        <Image
            source={{ uri: user?.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
            contentFit="cover"
            style={{ width: 40, height: 40 }}
            className="rounded-full"
        />
        <View className="flex-1 ml-4">
            <Text className="text-black dark:text-white font-black text-xs">{user?.username || 'Rogue'}</Text>
            <Text className="text-gray-500 text-[8px] font-bold uppercase">Awaiting Authorization</Text>
        </View>
        <TouchableOpacity
            onPress={onApprove}
            style={{ backgroundColor: accent }}
            className="px-5 py-2.5 rounded-2xl"
            disabled={isProcessingAction}
        >
            <Text className="text-white font-black text-[10px] uppercase italic">{isProcessingAction ? 'Accepting...' : 'Accept'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
            onPress={onDecline}
            style={{ backgroundColor: "red" }}
            className="px-5 py-2.5 rounded-2xl ml-2"
            disabled={isProcessingAction}
        >
            <Text className="text-white font-black text-[10px] uppercase italic">{isProcessingAction ? 'Declining...' : 'Decline'}</Text>
        </TouchableOpacity>
    </View>
);

export default ClanProfile;