import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState, memo, useCallback } from 'react';
import {
    ActivityIndicator,
    Animated,
    DeviceEventEmitter,
    Dimensions,
    Easing,
    FlatList,
    Image,
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

// 🔹 Global session tracker
let HAS_SHOWN_SESSION_LOADER = false;

// --- Optimized Sub-Components ---

const RemoteSvgIcon = memo(({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    return <SvgXml xml={xml} width={size} height={size} color={color} />;
});

const StatCard = memo(({ label, value, icon, isCoin, glowColor }) => (
    <View className="w-[48%] bg-white dark:bg-zinc-900/50 p-5 rounded-[30px] mb-4 border border-gray-100 dark:border-zinc-800 shadow-sm">
        <MaterialCommunityIcons name={icon} size={20} color={glowColor || "#3b82f6"} />
        <Text className="text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest mt-2">{label}</Text>
        <View className="flex-row items-center mt-1">
            <Text style={isCoin ? { color: "#9333ea" } : null} className="text-lg font-black mt-1 dark:text-white">{value?.toLocaleString() || 0} </Text>
            {isCoin && <CoinIcon size={20} type="CC" />}
        </View>
    </View>
));

const StatRow = memo(({ label, value, highlight, color }) => (
    <View className="flex-row justify-between px-4 py-4 border-b border-gray-100 dark:border-zinc-900/50 last:border-0">
        <Text className="text-gray-500 dark:text-gray-400 font-bold text-[11px] uppercase">{label}</Text>
        <Text className={`font-black text-xs ${highlight ? '' : 'text-black dark:text-white'}`} style={highlight ? { color: color } : {}}>
            {value || 0}
        </Text>
    </View>
));

const MemberItem = memo(({ member, roleLabel, canManage, isLeader, onKick, onAppoint, accent }) => (
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
));

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

    const [storeModalVisible, setStoreModalVisible] = useState(false);
    const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const isDark = useColorScheme() === "dark";

    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
    const [isReachingEnd, setIsReachingEnd] = useState(false);
    const [cardPreviewVisible, setCardPreviewVisible] = useState(false);
    const clanCardRef = useRef(null);

    const [warHistory, setWarHistory] = useState([]);
    const [loadingWars, setLoadingWars] = useState(false);

    const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins();
    const CACHE_KEY = `@clan_data_${userClan?.tag}`;

    // --- ANIMATIONS ---
    const scanAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const progressToNextRank = useMemo(() => {
        if (!fullData || !fullData.nextThreshold) return 0;
        return (fullData.totalPoints / fullData.nextThreshold) * 100;
    }, [fullData]);

    useEffect(() => {
        const rotation = Animated.loop(
            Animated.timing(scanAnim, {
                toValue: 1,
                duration: 10000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        );

        rotation.start();
        pulse.start();

        return () => {
            rotation.stop();
            pulse.stop();
        };
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
            fetchFullDetails();
        }
    };

    let equippedGlow;
    if (fullData) {
        equippedGlow = fullData.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped) || {};
    }
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;
    const APP_BLUE = activeGlowColor || "#3b82f6";

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
                if (action === "LEAVE_CLAN") {
                    await AsyncStorage.removeItem(CACHE_KEY);
                    router.replace('/clans');
                }
                fetchFullDetails();
            } else {
                CustomAlert("Action Failed", data.message || "Jutsu failed");
            }
        } catch (err) {
            CustomAlert("Scroll Error", "Connection lost.");
        } finally {
            setIsProcessingAction(false);
        }
    };

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

    const handleLeaveClan = () => {
        CustomAlert("Leave Village", "Abandon your clan?", [
            { text: "Cancel", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: () => triggerAction("LEAVE_CLAN") }
        ]);
    };

    if (loading || clanLoading) {
        return <AnimeLoading message="Syncing Bloodline" subMessage="Consulting the Elder Scrolls..." />;
    }

    if (!userClan) {
        return (
            <View className="flex-1 justify-center items-center bg-white dark:bg-[#0a0a0a] p-6">
                <MaterialCommunityIcons name="sword-cross" size={64} color={APP_BLUE} />
                <Text className="text-gray-500 dark:text-gray-400 text-center text-lg font-black uppercase mt-4">Rogue Ninja Detected</Text>
            </View>
        );
    }

    // --- Memoized Header ---
    const listHeader = useMemo(() => (
        <View>
            <View style={{ position: 'absolute', left: -10000, opacity: 0 }} pointerEvents="none">
                <ViewShot ref={clanCardRef} options={{ format: "png", quality: 0.8 }}>
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
                        <ClanCrest glowColor={activeGlowColor} rank={fullData?.rank || 1} size={120} />
                    </View>

                    <View className="absolute right-0 flex flex-col justify-between items-center gap-2">
                        {[
                            { icon: "card-outline", onPress: () => setCardPreviewVisible(true), lib: Ionicons },
                            { icon: "bag-personal-outline", onPress: () => setInventoryModalVisible(true), lib: MaterialCommunityIcons },
                            { icon: "storefront-outline", onPress: () => setStoreModalVisible(true), lib: MaterialCommunityIcons }
                        ].map((btn, i) => (
                            <TouchableOpacity key={i} onPress={btn.onPress} className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-full border border-gray-200 dark:border-zinc-700">
                                <btn.lib name={btn.icon} size={24} color={APP_BLUE} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View className="mt-12 items-center w-full px-4">
                    {isEditing ? (
                        <View className="w-full gap-y-2">
                            <TextInput
                                value={editData.name}
                                onChangeText={(t) => setEditData({ ...editData, name: t })}
                                className="text-1xl font-black text-blue-500 text-center uppercase italic border-b border-blue-500 w-full"
                            />
                            <TextInput
                                value={editData.description}
                                onChangeText={(t) => setEditData({ ...editData, description: t })}
                                multiline
                                className="text-gray-600 dark:text-gray-300 text-xs italic text-center p-2 border border-blue-200 rounded-lg"
                            />
                        </View>
                    ) : (
                        <>
                            <Text className="text-2xl font-black text-black dark:text-white uppercase italic tracking-tighter text-center">
                                {fullData?.name}
                            </Text>
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
                    <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">Achievements</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, flexGrow: 1, justifyContent: 'center' }}>
                        {fullData?.badges?.length > 0 ? (
                            fullData.badges.map((badge, idx) => <ClanBadge key={idx} badgeName={badge} size="md" />)
                        ) : (
                            <Text className="text-[10px] text-gray-400">No Achievements Yet</Text>
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
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    ), [fullData, activeTab, isEditing, editData, isDark, spin, pulseAnim]);

    const renderItem = useCallback(({ item }) => {
        if (activeTab === 'Scrolls') {
            return (
                <View className="px-6 mb-4">
                    <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-2xl flex-row justify-between items-center">
                        <Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/post/${item.slug || item._id}`)} className="flex-1 pr-4">
                            <Text className="font-black text-sm uppercase tracking-tight text-gray-800 dark:text-gray-200" numberOfLines={1}>{item.title || item.message}</Text>
                        </Pressable>
                        {canManageClan && (
                            <TouchableOpacity onPress={() => triggerAction("DELETE_POST", { postId: item._id })} className="p-3 bg-red-500/10 rounded-xl">
                                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            );
        }
        if (activeTab === 'Wars') return <WarHistoryItem war={item} clanTag={userClan.tag} />;
        return null;
    }, [activeTab, canManageClan]);

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
                                
                                <View className="bg-gray-50 dark:bg-zinc-950 p-2 rounded-3xl border border-gray-100 dark:border-zinc-900 mt-6">
                                    <StatRow label="Sightings (Views)" value={fullData?.stats?.views} />
                                    <StatRow label="Respect (Likes)" value={fullData?.stats?.likes} />
                                    <StatRow label="Whispers (Comments)" value={fullData?.stats?.comments} />
                                    <StatRow label="Scroll Depth" value={`${fullData?.stats?.totalPosts} Posts`} highlight color={APP_BLUE} />
                                </View>

                                <TouchableOpacity onPress={handleLeaveClan} className="mt-8 bg-red-500/10 p-4 rounded-3xl items-center">
                                    <Text className="text-red-500 font-black text-[10px] uppercase">Desert Village</Text>
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
                    </View>
                }
                renderItem={renderItem}
                onEndReached={() => activeTab === 'Scrolls' && !isReachingEnd && fetchPosts(page + 1)}
                onEndReachedThreshold={0.5}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={5}
                removeClippedSubviews={true}
                ListFooterComponent={() => (
                    <View style={{ paddingBottom: insets.bottom + 100 }}>
                        {isFetchingNextPage && <SyncLoading message="Loading more scrolls" />}
                    </View>
                )}
            />

            {/* Modals rendered separately to keep main thread light */}
            <ClanStoreModal fetchFullDetails={fetchFullDetails} isDark={isDark} onClose={() => setStoreModalVisible(false)} visible={storeModalVisible} />
            <ClanInventoryModal visible={inventoryModalVisible} onClose={() => setInventoryModalVisible(false)} clan={fullData} isDark={isDark} user={user} fetchFullDetails={fetchFullDetails} />
            
            <Modal visible={cardPreviewVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/95">
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <Pressable onPress={() => setCardPreviewVisible(false)} className="absolute top-10 right-10 w-12 h-12 bg-white/10 rounded-full items-center justify-center z-50">
                            <Ionicons name="close" size={28} color="white" />
                        </Pressable>
                        <ClanCard clan={fullData} isDark={isDark} forSnapshot={true} />
                        <TouchableOpacity onPress={captureAndShare} style={{ backgroundColor: APP_BLUE }} className="flex-row items-center justify-center gap-3 w-full h-16 rounded-[30px] mt-10">
                            <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                            <Text className="text-white font-black uppercase italic">Dispatch Scroll</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>
        </>
    );
};

// --- Store & Inventory Modals ---

const ClanStoreModal = ({ visible, fetchFullDetails, onClose, isDark }) => {
    const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins();
    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState({ themes: [], standaloneItems: [] });
    const CustomAlert = useAlert();

    useEffect(() => {
        if (visible) fetchStoreData();
    }, [visible]);

    const fetchStoreData = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/store?type=clan`);
            const data = await res.json();
            if (data.success) setCatalog({ themes: data.catalog.themes || [], standaloneItems: data.catalog.standaloneItems || [] });
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (item) => {
        const currentBalance = item.currency === 'CC' ? clanCoins : coins;
        if (currentBalance < item.price) return CustomAlert("Insufficient Funds", "Need more coins.");

        CustomAlert("Confirm", `Buy ${item.name}?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Purchase",
                onPress: async () => {
                    const result = await processTransaction('buy_item', item.category, { itemId: item.id, price: item.price, name: item.name, category: item.category, currency: item.currency || 'CC', visualData: item.visualData });
                    if (result.success) fetchFullDetails();
                }
            }
        ]);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-[#0a0a0a] h-[85%] rounded-t-[40px] p-6 border-t-4 border-green-500">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-2xl font-black uppercase dark:text-white">Black Market</Text>
                        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={isDark ? "white" : "black"} /></TouchableOpacity>
                    </View>
                    {loading ? (
                        <SyncLoading message="Fetching Goods..." />
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {catalog.standaloneItems.map(item => (
                                <TouchableOpacity key={item.id} onPress={() => handlePurchase(item)} className="w-full bg-gray-100 dark:bg-[#1a1a1a] mb-3 p-4 rounded-3xl flex-row items-center">
                                    <View className="h-16 w-16 bg-black/40 rounded-2xl items-center justify-center mr-4">
                                        <RemoteSvgIcon xml={item.visualData?.svgCode} color={item.visualData?.primaryColor} size={40} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="dark:text-white font-black">{item.name}</Text>
                                        <Text className="text-green-500 font-bold">{item.price} {item.currency}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const ClanInventoryModal = ({ visible, onClose, fetchFullDetails, clan, isDark, user }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const CustomAlert = useAlert();
    const inventory = clan?.specialInventory || [];

    const handleEquipToggle = async (selectedItem) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            const res = await apiFetch(`/clans/${clan.tag}`, {
                method: 'PATCH',
                body: JSON.stringify({ deviceId: user.deviceId, action: "EQUIP_ITEM", payload: { itemId: selectedItem.itemId } })
            });
            if (res.ok) fetchFullDetails();
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-[#0d1117] h-[85%] rounded-t-[40px] p-6 border-t-4 border-blue-500">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-2xl font-black uppercase dark:text-white">Arsenal</Text>
                        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={isDark ? "white" : "black"} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {inventory.map((item, idx) => (
                            <View key={idx} className={`flex-row items-center p-4 rounded-3xl mb-3 border ${item.isEquipped ? 'bg-blue-500/10 border-blue-500' : 'bg-gray-50 dark:bg-[#161b22] border-gray-800'}`}>
                                <View className="h-16 w-16 bg-black/20 items-center justify-center rounded-2xl mr-4">
                                    <RemoteSvgIcon xml={item.visualConfig?.svgCode} color={item.visualConfig?.primaryColor} size={40} />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-black dark:text-white uppercase">{item.name}</Text>
                                    <Text className="text-[9px] text-gray-500 uppercase">{item.category}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleEquipToggle(item)} className={`px-6 py-3 rounded-xl ${item.isEquipped ? 'bg-green-500' : 'bg-blue-600'}`}>
                                    {isUpdating ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white text-[10px] font-black">{item.isEquipped ? 'Active' : 'Equip'}</Text>}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const WarHistoryItem = memo(({ war, clanTag }) => {
    const isWinner = war.winner === clanTag;
    const opponent = war.challengerTag === clanTag ? war.defenderTag : war.challengerTag;
    const challengerScore = war.currentProgress?.challengerScore || 0;
    const defenderScore = war.currentProgress?.defenderScore || 0;

    return (
        <View className="px-6 mb-4">
            <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-3xl">
                <Text className={`font-black uppercase text-[10px] ${isWinner ? 'text-yellow-500' : 'text-red-500'}`}>
                    {isWinner ? "Victory" : "Defeated"}
                </Text>
                <View className="flex-row justify-between items-center bg-gray-50 dark:bg-zinc-950 p-4 rounded-2xl mt-2">
                    <View className="items-center flex-1">
                        <Text className="dark:text-white font-black">{clanTag}</Text>
                        <Text className="text-blue-500 font-bold">{war.challengerTag === clanTag ? challengerScore : defenderScore}</Text>
                    </View>
                    <Text className="text-gray-400 italic">VS</Text>
                    <View className="items-center flex-1">
                        <Text className="dark:text-white font-black">{opponent}</Text>
                        <Text className="text-gray-400 font-bold">{war.challengerTag === clanTag ? defenderScore : challengerScore}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
});

export default ClanProfile;
