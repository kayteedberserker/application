import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from 'expo-clipboard';
import { Image } from "expo-image";
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing'; // Ensure this is imported
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    DeviceEventEmitter,
    Dimensions,
    Easing,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    Share,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import ViewShot from "react-native-view-shot";
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

// 🔹 Global session tracker to ensure heavy loading only shows once per app run
let HAS_SHOWN_SESSION_LOADER = false;

const ClanProfile = () => {
    const CustomAlert = useAlert();
    const { user } = useUser();
    const { userClan, isLoading: clanLoading, canManageClan, userRole } = useClan();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [fullData, setFullData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Dojo');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', logo: '' });

    // Modals
    const [storeModalVisible, setStoreModalVisible] = useState(false);
    const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const { colorScheme } = useColorScheme();
    const isDark = useColorScheme() === "dark";


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

    // =================================================================
    // 🔹 ANIMATION LOGIC
    // =================================================================
    const scanAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const progressToNextRank = useMemo(() => {
        if (!fullData || !fullData.nextThreshold) return 0;
        return (fullData.totalPoints / fullData.nextThreshold) * 100;
    }, [fullData]);

    useEffect(() => {
        Animated.loop(
            Animated.timing(scanAnim, {
                toValue: 1,
                duration: 10000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 2500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const spin = scanAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    useEffect(() => {
        if (userClan?.tag) {
            initializeClanData();
            fetchPosts(1);
            fetchWarHistory();
        } else if (!clanLoading) {
            setLoading(false);
        }
    }, [userClan?.tag]);

    const initializeClanData = async () => {
        try {
            const cachedData = await AsyncStorage.getItem(CACHE_KEY);
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                setFullData(parsed);
                setEditData({ name: parsed.name, description: parsed.description, logo: parsed.logo });
                if (HAS_SHOWN_SESSION_LOADER) {
                    setLoading(false);
                }
            }
            await fetchFullDetails();
        } catch (err) {
            console.error("Cache Initialization Error:", err);
            fetchFullDetails();
        }
    };
    let equippedGlow
    let verifiedTier
    if (fullData) {
        equippedGlow = fullData.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped) || {}
        verifiedTier = fullData.activeCustomizations?.verifiedTier
    }
    const verifiedColor = verifiedTier == "premium" ? "#facc15" : verifiedTier == "standard" ? "#ef4444" : "#3b82f6"
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;
    //   console.log(activeGlowColor);
    const APP_BLUE = activeGlowColor || verifiedColor || "#3b82f6";

    const fetchFullDetails = async () => {
        const shouldShowHeavyLoader = !fullData && !HAS_SHOWN_SESSION_LOADER;
        if (shouldShowHeavyLoader) setLoading(true);
        try {
            const res = await apiFetch(`/clans/${userClan.tag}?deviceId=${user.deviceId}`);
            const data = await res.json();
            setFullData(data);
            setEditData({ name: data.name, description: data.description, logo: data.logo });
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
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
                    await AsyncStorage.removeItem(CACHE_KEY);
                    CustomAlert("Deserted", "You have left the village.");
                    router.replace('/clans');
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

    if (loading || clanLoading) {
        return <AnimeLoading message="Syncing Bloodline" subMessage="Consulting the Elder Scrolls..." />;
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
            {/* Hidden Capture Layer for ViewShot */}
            <View style={{ position: 'absolute', left: -10000, opacity: 0 }} pointerEvents="none">
                <ViewShot ref={clanCardRef} options={{ format: "png", quality: 1 }}>
                    <ClanCard clan={fullData} isDark={isDark} forSnapshot={true} />
                </ViewShot>
            </View>

            <View className="p-8 px-2 mt-10 items-center border-b border-gray-100 dark:border-zinc-900">
                <View className="w-full flex-row justify-center items-center relative">
                    <View className="relative">
                        <Animated.View
                            style={{
                                position: 'absolute', inset: -15, borderRadius: 100,
                                backgroundColor: activeGlowColor || APP_BLUE, opacity: 0.1,
                                transform: [{ scale: pulseAnim }]
                            }}
                        />
                        <Animated.View
                            style={{ transform: [{ rotate: spin }], borderColor: `${activeGlowColor || APP_BLUE}40` }}
                            className="absolute -inset-5 border border-dashed rounded-full"
                        />
                        <ClanCrest glowColor={activeGlowColor || verifiedColor} rank={fullData?.rank || 1} size={120} />
                    </View>

                    {/* Top Actions Column */}
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
                            <RemoteSvgIcon size={30} xml={fullData?.activeCustomizations?.verifiedBadgeXml}/>
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
                {['Dojo', 'Shinobi', 'Wars', 'Scrolls', canManageClan && 'Kage Desk'].filter(Boolean).map(tab => (
                    <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} className="flex-1 items-center py-4">
                        <Text style={{ color: activeTab === tab ? APP_BLUE : '#9ca3af' }} className={`font-black text-[8px] uppercase tracking-widest`}>
                            {tab}
                        </Text>
                        {activeTab === tab && <View style={{ backgroundColor: APP_BLUE }} className="h-0.5 w-4 mt-1" />}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Clan Card Preview Modal */}
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
        </View>
    );

    return (
        <>
            <FlatList
                className="flex-1 bg-white dark:bg-[#0a0a0a]"
                data={activeTab === 'Scrolls' ? posts : (activeTab === 'Wars' ? warHistory : [])}
                keyExtractor={(item) => item._id}
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
                    return null;
                }}
                onEndReached={() => {
                    if (activeTab === 'Scrolls' && !isReachingEnd && !isFetchingNextPage) {
                        fetchPosts(page + 1);
                    }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => (
                    <View style={{ paddingBottom: insets.bottom + 100 }}>
                        {isFetchingNextPage && <SyncLoading message="Loading more scrolls" />}
                    </View>
                )}
            />
            <ClanStoreModal fetchFullDetails={fetchFullDetails} isDark={isDark} onClose={() => setStoreModalVisible(false)} visible={storeModalVisible} />
            <ClanInventoryModal
                visible={inventoryModalVisible}
                onClose={() => setInventoryModalVisible(false)}
                clan={fullData}
                isDark={isDark}
                clanCoins={clanCoins}
                user={user}
                fetchFullDetails={fetchFullDetails}
            />
        </>
    );
};

// 🎨 --- RENDERER FOR BACKEND SVGS ---
const RemoteSvgIcon = ({ xml, size = 150, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    return <SvgXml xml={xml} width={size} height={size} color={color} />;
};

const ClanStoreModal = ({ visible, fetchFullDetails, onClose, isDark }) => {
const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins();
const [loading, setLoading] = useState(true);
const [catalog, setCatalog] = useState({ themes: [], standaloneItems: [] });
const [selectedTheme, setSelectedTheme] = useState(null);
const CustomAlert = useAlert();

useEffect(() => {
if (visible) {
fetchStoreData();
} else {
setSelectedTheme(null);
}
}, [visible]);

const fetchStoreData = async () => {
try {
setLoading(true);
const res = await apiFetch(`/store?type=clan`);
const data = await res.json();

if (data.success && data.catalog) {
setCatalog({
themes: data.catalog.themes || [],
standaloneItems: data.catalog.standaloneItems || []
});
}
} catch (e) {
console.error("Store fetch error:", e);
} finally {
setLoading(false);
}
};

const handlePurchase = async (item) => {
const currentBalance = item.currency === 'CC' ? clanCoins : coins;
const currencyName = item.currency === 'CC' ? "ClanCoins" : "OreCoins";

if (currentBalance < item.price) {
CustomAlert("Insufficient Funds", `You need more ${currencyName}.`);
return;
}

CustomAlert(
"Confirm Purchase",
`Buy ${item.name} for ${item.price} ${item.currency || 'CC'}?`,
[
{ text: "Cancel", style: "cancel" },
{
text: "Purchase",
onPress: async () => {
const result = await processTransaction('buy_item', item.category, {
itemId: item.id,
price: item.price,
name: item.name,
category: item.category,
currency: item.currency || 'CC',
visualData: item.visualData
});
if (result.success) {
CustomAlert("Success", "Item added to your inventory!");
if (typeof fetchFullDetails === 'function') {
fetchFullDetails();
}
} else {
CustomAlert("Error", result.error || "Transaction failed");
}
}
}
]
);
};

// 1. STANDALONE ITEM CARD (Rectangular, 100% width, column layout)
const renderStandaloneCard = (item) => {
const visual = item.visualData || {};
const isBorder = item.category === 'BORDER';

return (
<TouchableOpacity
key={item.id}
onPress={() => handlePurchase(item)}
className="w-full bg-gray-100 dark:bg-[#1a1a1a] mb-3 p-4 rounded-3xl border border-green-900/20 flex-row items-center"
>
<View className="h-20 w-20 bg-black/40 rounded-2xl items-center justify-center overflow-hidden border border-white/5 mr-4">
{isBorder ? (
<ClanBorder
color={visual.primaryColor || visual.color || "#ff0000"}
secondaryColor={visual.secondaryColor}
animationType={visual.animationType}
>
<View className="p-2">
<Text className="text-[8px] dark:text-white/50 text-center">Border</Text>
</View>
</ClanBorder>
) : (
<RemoteSvgIcon xml={visual.svgCode} color={visual.glowColor || visual.primaryColor || visual.color} size={45} />
)}
</View>

<View className="flex-1 justify-center">
<Text className="text-gray-500 font-black text-[8px] uppercase tracking-tighter mb-1">{item.category}</Text>
<Text className="dark:text-white font-black text-base uppercase" numberOfLines={1}>{item.name}</Text>
<View className="flex-row items-center mt-1">
<Text className="text-green-500 font-black text-sm mr-1">{item.price}</Text>
<CoinIcon type={item.currency || "CC"} size={14} />
</View>
</View>

<View className="bg-green-500 p-3 rounded-2xl">
<Ionicons name="cart" size={18} color="white" />
</View>
</TouchableOpacity>
);
};

// 2. THEMED ITEM CARD (Square, used inside horizontal FlatLists within themes)
const renderThemedItemCard = (item) => {
const visual = item.visualData || {};
const isBorder = item.category === 'BORDER';

return (
<TouchableOpacity
key={item.id}
onPress={() => handlePurchase(item)}
className="bg-gray-100 dark:bg-[#1a1a1a] mr-4 p-4 rounded-3xl w-44 border border-green-900/30"
>
<View className="mb-3">
<View className="h-28 w-full bg-black/40 rounded-2xl items-center justify-center overflow-hidden border border-white/5">
{isBorder ? (
<ClanBorder
color={visual.primaryColor || visual.color || "#ff0000"}
secondaryColor={visual.secondaryColor}
animationType={visual.animationType}
>
<View className="h-10 flex justify-center items-center rounded-sm">
<Text className="text-[10px] dark:text-white/50">Banner</Text>
</View>
</ClanBorder>
) : (
<RemoteSvgIcon xml={visual.svgCode} color={visual.glowColor || visual.primaryColor || visual.color} size={60} />
)}
</View>
</View>
<Text className="dark:text-white font-bold text-xs uppercase" numberOfLines={1}>{item.name}</Text>
<View className="flex-row items-center mt-2 justify-between">
<View className="flex-row items-center">
<Text className="text-green-500 font-black text-xs mr-1">{item.price}</Text>
<CoinIcon type={item.currency || "CC"} size={12} />
</View>
<View className="bg-green-500/10 p-1 rounded-full">
<Ionicons name="cart" size={12} color="#22c55e" />
</View>
</View>
</TouchableOpacity>
);
};

return (
<Modal visible={visible} animationType="slide" transparent>
<View className="flex-1 bg-black/60 justify-end">
<View className="bg-white dark:bg-[#0a0a0a] h-[85%] rounded-t-[40px] p-6 border-t-4 border-green-500">

{/* Header */}
<View className="flex-row justify-between items-center mb-6">
<View>
<TouchableOpacity
onPress={() => selectedTheme ? setSelectedTheme(null) : null}
className="flex-row items-center"
disabled={!selectedTheme}
>
{selectedTheme && <Ionicons name="chevron-back" size={20} color="#22c55e" />}
<Text className="text-2xl font-black uppercase italic dark:text-white">
{selectedTheme ? selectedTheme.label : "Black Market"}
</Text>
</TouchableOpacity>
<View className="flex-row items-center">
<Text className="text-green-500 font-black text-[10px] uppercase mr-1">CC: {clanCoins || 0}</Text>
<CoinIcon type="CC" size={12} />
<Text className="text-gray-500 font-black text-[10px] uppercase mx-2">|</Text>
<Text className="text-blue-500 font-black text-[10px] uppercase mr-1">OC: {coins || 0}</Text>
<CoinIcon type="OC" size={12} />
</View>
</View>
<TouchableOpacity onPress={onClose}>
<Ionicons name="close" size={28} color={isDark ? "white" : "black"} />
</TouchableOpacity>
</View>

{/* Content */}
{loading ? (
<View className="flex-1 justify-center items-center">
<ActivityIndicator size="large" color="#22c55e" />
<Text className="text-green-500 font-black uppercase text-[10px] mt-4 tracking-widest">Downloading Assets...</Text>
</View>
) : (
<ScrollView showsVerticalScrollIndicator={false}>
{!selectedTheme ? (
<View>
{/* --- STANDALONE ITEMS SECTION (COLUMN LAYOUT - 100% WIDTH) --- */}
{catalog.standaloneItems.length > 0 && (
<View className="mb-8">
<Text className="text-gray-500 font-black uppercase text-xs mb-4 tracking-widest">Village Upgrades</Text>
{catalog.standaloneItems.map(item => renderStandaloneCard(item))}
</View>
)}

{/* --- THEMES SECTION (GRID LAYOUT) --- */}
<Text className="text-gray-500 font-black uppercase text-xs mb-4 tracking-widest">Thematic Collections</Text>
<View className="flex-row flex-wrap justify-between">
{catalog.themes.map((theme) => (
<TouchableOpacity
key={theme.id}
onPress={() => setSelectedTheme(theme)}
className="w-[48%] bg-gray-100 dark:bg-[#1a1a1a] p-6 rounded-3xl mb-4 items-center border border-gray-800"
>
{/* Remote SVG for Theme Icon */}
<View className="mb-2">
<RemoteSvgIcon xml={theme.iconsvg} color="#22c55e" size={120} />
</View>
<Text className="dark:text-white font-black uppercase mt-1 text-center text-xs">{theme.label}</Text>
<Text className="text-gray-500 text-[8px] uppercase">{theme.items?.length || 0} Items</Text>
</TouchableOpacity>
))}
</View>
</View>
) : (
<View>
{/* --- ITEMS INSIDE SELECTED THEME (HORIZONTAL ROWS) --- */}
{['VERIFIED', 'UPGRADE', 'BADGE', 'THEME', 'BACKGROUND', "WATERMARK", 'EFFECT', 'GLOW', 'BORDER'].map((cat) => {
const items = selectedTheme.items?.filter(i => i.category?.toUpperCase() === cat) || [];
if (items.length === 0) return null;

return (
<View key={cat} className="mb-6">
<Text className="text-gray-500 font-black uppercase text-xs mb-3 tracking-widest">{cat}S</Text>
<FlatList
data={items}
horizontal
showsHorizontalScrollIndicator={false}
keyExtractor={item => item.id}
renderItem={({ item }) => renderThemedItemCard(item)}
/>
</View>
);
})}
</View>
)}
</ScrollView>
)}

{isProcessingTransaction && (
<View className="absolute inset-0 bg-black/60 items-center justify-center rounded-t-[40px]">
<ActivityIndicator size="large" color="#22c55e" />
<Text className="text-green-500 font-black uppercase text-[10px] mt-4">Syncing with Chain...</Text>
</View>
)}
</View>
</View>
</Modal>
);
};

const ClanInventoryModal = ({ visible, onClose, fetchFullDetails, clan, isDark, user }) => {
const [filter, setFilter] = useState('ALL');
const [isUpdating, setIsUpdating] = useState(false);
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
const expiry = new Date(clan.verifiedUntil);

// 🛠️ LOGIC: Construct the "Virtual" Verified Item
const getVerifiedItem = () => {
if (!clan?.verifiedUntil) return null;

const now = new Date();
const expiry = new Date(clan.verifiedUntil);
if (expiry < now) return null; // Don't show if expired

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

// Prepare Inventory
let inventory = clan?.specialInventory ? [...clan.specialInventory] : [];

// Inject the verified badge if active
const verifiedItem = getVerifiedItem();
if (verifiedItem) {
inventory.unshift(verifiedItem); // Put it at the very top
}

const categories = ['ALL', 'VERIFIED', 'WATERMARK', 'BADGE', "BACKGROUND", 'GLOW', 'BORDER'];

const handleEquipToggle = async (selectedItem) => {
// Prevent interaction with the "Status" badge
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
if (typeof fetchFullDetails === 'function') {
fetchFullDetails();
}
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

{/* Header */}
<View className="flex-row justify-between items-center mb-4">
<View>
<Text className="text-2xl font-black uppercase italic dark:text-white">Arsenal</Text>
<Text className="text-blue-500 font-black text-[10px] uppercase tracking-widest">
{expiry > now  ? clan?.specialInventory?.length + 1 || 1 : clan?.specialInventory?.length || 0} Collectibles Owned
</Text>
</View>
<TouchableOpacity onPress={onClose}>
<Ionicons name="close" size={28} color={isDark ? "white" : "black"} />
</TouchableOpacity>
</View>

{/* Category Tabs */}
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

{/* Inventory List */}
<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
{filteredInventory.length > 0 ? (
filteredInventory.map((item, idx) => {
const expiration = getExpirationText(item.expiresAt);
const isExpired = expiration === "Expired";
const isBorder = item.category === 'BORDER';
const isStatusBadge = item.itemId === 'active_verification_status';
const visual = item.visualConfig || {};

const PreviewIcon = (
<View className={`w-20 h-20 bg-black/20 items-center justify-center rounded-2xl overflow-hidden ${isBorder ? '' : 'border border-white/5'}`}>
<RemoteSvgIcon xml={visual.svgCode} color={visual.primaryColor} size={60} />
</View>
);

return (
<View
key={item.itemId || idx}
className={`flex-row items-center p-4 rounded-3xl mb-3 border ${item.isEquipped
? 'bg-blue-500/10 border-blue-500'
: 'bg-gray-50 dark:bg-[#161b22] border-gray-100 dark:border-gray-800'
} ${isExpired ? 'opacity-50' : ''}`}
>
{/* Icon Container */}
<View className="mr-4">
{isBorder ? (
<ClanBorder
color={visual.primaryColor || visual.color || "#ff0000"}
secondaryColor={visual.secondaryColor}
animationType={visual.animationType}
duration={visual.duration}
>
<View className="h-10 w-20 flex justify-center items-center rounded-sm">
<Text className="text-[8px] font-black dark:text-white uppercase">Preview</Text>
</View>
</ClanBorder>
) : (
PreviewIcon
)}
</View>

{/* Info Container */}
<View className="flex-1">
<Text className="font-black dark:text-white text-sm uppercase italic">
{item.name}
</Text>

<View className="flex-row mt-2 items-center">
<View className={`px-2 py-0.5 rounded-md ${isStatusBadge ? 'bg-blue-500' : 'bg-gray-700'}`}>
<Text className="text-[8px] text-white uppercase font-black tracking-widest">
{item.category}
</Text>
</View>

{expiration && (
<>
<Text className="text-gray-600 dark:text-gray-400 text-[9px] mx-1">•</Text>
<View className="flex-row items-center">
<MaterialCommunityIcons
name="clock-outline"
size={10}
color={isExpired ? "#ef4444" : "#6b7280"}
/>
<Text className={`text-[9px] font-bold ml-1 ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
{expiration}
</Text>
</View>
</>
)}
</View>
</View>

{/* Action Button */}
{!isStatusBadge ? (
<TouchableOpacity
disabled={isUpdating}
onPress={() => handleEquipToggle(item)}
className={`px-6 py-3 rounded-xl ${item.isEquipped ? 'bg-green-500' : 'bg-blue-600'
} ${isUpdating ? 'opacity-50' : ''}`}
>
{isUpdating ? (
<ActivityIndicator size="small" color="white" />
) : (
<Text className="text-white text-[10px] font-black uppercase">
{item.isEquipped ? 'Active' : 'Equip'}
</Text>
)}
</TouchableOpacity>
) : (
<View className="px-4 py-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
<Text className="text-blue-500 text-[10px] font-black uppercase italic">In Effect</Text>
</View>
)}

{/* Show 'Void' if expired */}
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
<Text className="mt-4 font-black uppercase text-xs tracking-widest dark:text-white">
No {filter === 'ALL' ? '' : filter} items
</Text>
</View>
)}
</ScrollView>
</View>
</View>
</Modal>
);
};
// --- Sub Components

const WarHistoryItem = ({ war, clanTag }) => {
    const isWinner = war.winner === clanTag;
    const isDraw = war.winner === "DRAW";
    const opponent = war.challengerTag === clanTag ? war.defenderTag : war.challengerTag;

    // FIX: Use currentProgress as finalSnapshot is not in the response
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

const MemberItem = ({ member, roleLabel, canManage, isLeader, onKick, onAppoint, accent }) => (
    <View className="flex-row items-center mb-3 bg-white dark:bg-zinc-900/40 p-4 rounded-[24px] border border-gray-100 dark:border-zinc-800">
        <Image source={{ uri: member.profilePic?.url }} className="w-12 h-12 rounded-full border-2 border-zinc-100 dark:border-zinc-800" />
        <View className="flex-1 ml-4">
            <Text className="text-black dark:text-white font-black uppercase text-xs tracking-tight">{member.username}</Text>
            <Text style={{ color: accent }} className="text-[8px] font-black uppercase tracking-widest mt-0.5">{roleLabel}</Text>
        </View>
        <View className="flex-row gap-x-2">
            {isLeader && roleLabel !== "Kage" && roleLabel !== "Jonin" && (
                <TouchableOpacity onPress={onAppoint} className="bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
                    <Text className="text-blue-600 dark:text-blue-400 font-black text-[9px] uppercase">Appoint Jonin</Text>
                </TouchableOpacity>
            )}
            {canManage && (
                <TouchableOpacity onPress={onKick} className="bg-red-500/10 px-4 py-2 rounded-xl">
                    <Text className="text-red-600 dark:text-red-500 font-black text-[9px] uppercase">Banish</Text>
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

const RequestItem = ({ user, onApprove, onDecline, accent }) => (
    <View className="flex-row items-center mb-3 bg-white dark:bg-zinc-900 p-4 rounded-[24px] border border-gray-100 dark:border-zinc-800">
        <Image source={{ uri: user?.profilePic?.url }} className="w-10 h-10 rounded-full" />
        <View className="flex-1 ml-4">
            <Text className="text-black dark:text-white font-black text-xs">{user?.username || 'Rogue'}</Text>
            <Text className="text-gray-500 text-[8px] font-bold uppercase">Awaiting Authorization</Text>
        </View>
        <TouchableOpacity
            onPress={onApprove}
            style={{ backgroundColor: accent }}
            className="px-5 py-2.5 rounded-2xl"
        >
            <Text className="text-white font-black text-[10px] uppercase italic">Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
            onPress={onDecline}
            style={{ backgroundColor: "red" }}
            className="px-5 py-2.5 rounded-2xl ml-2"
        >
            <Text className="text-white font-black text-[10px] uppercase italic">Decline</Text>
        </TouchableOpacity>
    </View>
);

export default ClanProfile;