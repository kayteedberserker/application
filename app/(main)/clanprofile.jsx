import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    DeviceEventEmitter,
    Dimensions,
    Easing,
    FlatList,
    Image,
    Pressable,
    ScrollView,
    Share,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LevelPlayRewardedAd } from "unity-levelplay-mediation";
import AnimeLoading from "../../components/AnimeLoading";
import ClanCrest from "../../components/ClanCrest";
import { SyncLoading } from "../../components/SyncLoading";
import { Text } from "../../components/Text";
import { useClan } from '../../context/ClanContext';
import { useUser } from '../../context/UserContext';
import { AdConfig } from '../../utils/AdConfig';
import apiFetch from "../../utils/apiFetch";

const { width } = Dimensions.get("window");
const REWARDED_ID = String(AdConfig.rewarded || "0");
const ClanProfile = () => {
    const { user } = useUser();
    const { userClan, isLoading: clanLoading, canManageClan, userRole } = useClan();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [fullData, setFullData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Dojo');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', logo: '' });

    // Pagination & Posts State
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
    const [isReachingEnd, setIsReachingEnd] = useState(false);

    // War History State
    const [warHistory, setWarHistory] = useState([]);
    const [loadingWars, setLoadingWars] = useState(false);

    const APP_BLUE = "#3b82f6";

    // --- Ads Logic ---
    // 🛠️ LEVELPLAY AD STATES
    const rewardedAdRef = useRef(null);
    const retryTimerRef = useRef(null);
    const [isAdLoaded, setIsAdLoaded] = useState(false);
    const [isAdLoading, setIsAdLoading] = useState(true);
    const [ritualReady, setRitualReady] = useState(false);

    // =================================================================
    // 🔹 LEVELPLAY REWARDED LOGIC
    // =================================================================
    useEffect(() => {
        if (REWARDED_ID === "0") return;

        // 1. Create the instance
        const rewardedAd = new LevelPlayRewardedAd(REWARDED_ID);
        rewardedAdRef.current = rewardedAd;

        const listener = {
            onAdLoaded: (adInfo) => {
                console.log("Ad Loaded");
                setIsAdLoaded(true);
                setIsAdLoading(false);
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            },
            onAdLoadFailed: (error) => {
                console.warn("Ad Load Failed:", error?.errorMessage);
                setIsAdLoaded(false);
                setIsAdLoading(true); // Keep loading state for retry feedback

                // 🔄 RETRY LOGIC: Try again in 10 seconds if "No Fill"
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(() => {
                    console.log("Retrying Ad Load...");
                    rewardedAd.loadAd();
                }, 10000);
            },
            onAdAvailable: (adInfo) => {
                setIsAdLoaded(true);
                setIsAdLoading(false);
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            },
            onAdUnavailable: () => setIsAdLoaded(false),
            onAdRewarded: (reward, adInfo) => {
                console.log("Reward Earned: BUY_SLOTS", adInfo);
                
                // 🔹 PORTED ACTION LOGIC
                triggerAction("BUY_SLOTS");
                
                // Reload ad for the next use
                rewardedAd.loadAd();
            },
            onAdClosed: (adInfo) => {
                console.log(adInfo);
                
                setIsAdLoaded(false);
                rewardedAd.loadAd();
            },
            onAdShowFailed: (error, adInfo) => {
                rewardedAd.loadAd();
            }
        };

        rewardedAd.setListener(listener);
        rewardedAd.loadAd();

        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        };
    }, []);

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
            fetchFullDetails();
            fetchPosts(1);
            fetchWarHistory();
        } else if (!clanLoading) {
            setLoading(false);
        }
    }, [userClan?.tag]);

    const fetchFullDetails = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/clans/${userClan.tag}?deviceId=${user.deviceId}`);
            const data = await res.json();

            setFullData(data);
            setEditData({
                name: data.name,
                description: data.description,
                logo: data.logo
            });
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
            
            // FIX: If data is an object with a 'wars' property use it, otherwise use the array itself
            const history = Array.isArray(data) ? data : (data.wars || []);
            setWarHistory(history);
        } catch (err) {
            console.error("Fetch Wars Error:", err);
        } finally {
            setLoadingWars(false);
        }
    };

    const fetchPosts = async (pageNum = 1) => {
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
        } catch (err) {
            console.error("Fetch Posts Error:", err);
        } finally {
            setIsFetchingNextPage(false);
        }
    };

    const triggerAction = async (action, payload = {}) => {
        try {
            const res = await apiFetch(`/clans/${userClan.tag}`, {
                method: 'PATCH',
                body: JSON.stringify({ deviceId: user.deviceId, action, payload })
            });

            const data = await res.json();

            if (res.ok) {
                if (action === "EDIT_CLAN") setIsEditing(false);
                fetchFullDetails();
                if (action === "DELETE_POST") fetchPosts(1);
                Alert.alert("Success", "Jutsu successfully cast!");
            } else {
                Alert.alert("Action Failed", data.message || "Jutsu failed to activate");
            }
        } catch (err) {
            Alert.alert("Scroll Error", "Connection to the village lost.");
        }
    };

    const handleDeletePost = (postId) => {
        Alert.alert("Banish Post", "Destroy this scroll from the village archives?", [
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
            Alert.alert("Error", "Could not manifest the share scroll.");
        }
    };

    const copyLinkToClipboard = async () => {
        const shareUrl = `clans/${fullData?.tag}`;
        await Clipboard.setStringAsync(shareUrl);
        Alert.alert("Link Sealed", "Clan link copied to clipboard!");
    };
    const handleBuySlotsWithAd = async () => {
        if (rewardedAdRef.current && await rewardedAdRef.current.isAdReady()) {
            rewardedAdRef.current.showAd("");
        } else {
            Alert.alert("Ritual Not Ready", "The spirits are not yet aligned. Try again in a moment.", [
                { text: "OK", onPress: () => load() }
            ]);
        }
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
            {/* Header / Clan Crest Section */}
            <View className="p-8 items-center border-b border-gray-100 dark:border-zinc-900">
                <View className="relative">
                    <Animated.View
                        style={{
                            position: 'absolute', inset: -15, borderRadius: 100,
                            backgroundColor: APP_BLUE, opacity: 0.1,
                            transform: [{ scale: pulseAnim }]
                        }}
                    />
                    <Animated.View
                        style={{ transform: [{ rotate: spin }], borderColor: `${APP_BLUE}40` }}
                        className="absolute -inset-5 border border-dashed rounded-full"
                    />
                    <ClanCrest rank={fullData?.rank || 1} size={150} />

                    <View className="absolute bottom-0 right-0 w-12 h-12 rounded-full border-2 border-white dark:border-zinc-900 shadow-lg bg-zinc-800 overflow-hidden">
                        <Image source={{ uri: fullData?.logo || 'https://via.placeholder.com/150' }} className="w-full h-full" />
                    </View>
                </View>

                {/* Village Title Display */}
                <View className="mt-12 items-center w-full px-4">
                    {isEditing ? (
                        <View className="w-full gap-y-2">
                            <TextInput
                                value={editData.name}
                                onChangeText={(t) => setEditData({ ...editData, name: t })}
                                className="text-2xl font-black text-blue-500 text-center uppercase italic border-b border-blue-500 w-full"
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
                            <Text className="text-3xl font-black text-black dark:text-white uppercase italic tracking-tighter text-center">
                                {fullData?.name}
                            </Text>
                            <Text className="text-gray-500 dark:text-gray-400 text-xs italic mt-2 text-center px-6 leading-4">
                                "{fullData?.description || "No village motto defined."}"
                            </Text>
                        </>
                    )}

                    <View className="flex-row items-center gap-2 mt-4">
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

                {/* Badges Section */}
                <View className="w-full mt-6">
                    <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">Clan Achievements</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, flexGrow: 1, justifyContent: 'center' }}>
                        {fullData?.badges?.length > 0 ? (
                            fullData.badges.map((badge, idx) => (
                                <View key={idx} className="mr-3 items-center bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
                                    <MaterialCommunityIcons name="seal-variant" size={24} color={APP_BLUE} />
                                    <Text className="text-[8px] font-black text-blue-500 mt-1 uppercase">{badge}</Text>
                                </View>
                            ))
                        ) : (
                            <View className="items-center opacity-40 py-2">
                                <MaterialCommunityIcons name="shield-off-outline" size={20} color="#9ca3af" />
                                <Text className="text-[8px] font-bold text-gray-400 uppercase mt-1">No Achievements Yet</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>

            {/* Clan XP Progress */}
            <View className="px-6 py-6">
                <View className="flex-row justify-between items-end mb-2">
                    <Text className="text-gray-400 font-black text-[9px] uppercase tracking-widest">Clan Points</Text>
                    <Text className="text-black dark:text-white font-mono font-bold text-[10px]">
                        {fullData?.totalPoints?.toLocaleString()} / {fullData?.nextThreshold?.toLocaleString()}
                    </Text>
                </View>
                <View className="w-full h-2 bg-gray-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                    <View className="h-full" style={{ width: `${Math.min(progressToNextRank, 100)}%`, backgroundColor: APP_BLUE }} />
                </View>
            </View>

            {/* Navigation Tabs */}
            <View className="flex-row px-4 border-b border-gray-100 dark:border-zinc-900 mb-6">
                {['Dojo', 'Shinobi', 'Wars', 'Scrolls', 'Treasury', canManageClan && 'Kage Desk'].filter(Boolean).map(tab => (
                    <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} className="flex-1 items-center py-4">
                        <Text className={`font-black text-[8px] uppercase tracking-widest ${activeTab === tab ? 'text-blue-500' : 'text-gray-400'}`}>
                            {tab}
                        </Text>
                        {activeTab === tab && <View className="h-0.5 w-4 bg-blue-500 mt-1" />}
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    return (
        <FlatList
            className="flex-1 bg-white dark:bg-[#0a0a0a]"
            data={activeTab === 'Scrolls' ? posts : (activeTab === 'Wars' ? warHistory : [])}
            keyExtractor={(item) => item._id}
            ListHeaderComponent={
                <View>
                    {listHeader}
                    {activeTab === 'Dojo' && (
                        <View className="px-6">
                            <View className="flex-row flex-wrap justify-between">
                                <StatCard label="Followers" value={fullData?.followerCount} icon="account-group" />
                                <StatCard label="Clan Funds" value={fullData?.spendablePoints} icon="cash-multiple" />
                                <StatCard label="World Rank" value={`#${fullData?.rank}`} icon="seal" />
                                <StatCard label="Shinobi Count" value={`${fullData?.members?.length}/${fullData?.maxSlots}`} icon="account-multiple" />
                            </View>

                            <Text className="text-black dark:text-white font-black text-xs mt-6 mb-4 uppercase tracking-widest">Village Expansion</Text>
                            <View className="flex-row gap-x-2 mb-6">
                                <TouchableOpacity 
                                    onPress={handleShareClan}
                                    className="flex-1 bg-blue-500 p-4 rounded-3xl flex-row items-center justify-center gap-x-2 shadow-lg shadow-blue-500/40"
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
                                <ExpansionRow 
                                    icon="heart-plus-outline" 
                                    label="Follow our Village" 
                                    subLabel="Stay updated on our progress"
                                />
                                <ExpansionRow 
                                    icon="feather" 
                                    label="Join as an Author" 
                                    subLabel="Write scrolls for the clan"
                                />
                            </View>

                            <Text className="text-black dark:text-white font-black text-xs mt-2 mb-4 uppercase tracking-widest">Village Influence</Text>
                            <View className="bg-gray-50 dark:bg-zinc-950 p-2 rounded-3xl border border-gray-100 dark:border-zinc-900">
                                <StatRow label="Sightings (Views)" value={fullData?.stats?.views} />
                                <StatRow label="Respect (Likes)" value={fullData?.stats?.likes} />
                                <StatRow label="Whispers (Comments)" value={fullData?.stats?.comments} />
                                <StatRow label="Scroll Depth" value={`${fullData?.stats?.totalPosts} Posts`} highlight color={APP_BLUE} />
                            </View>
                        </View>
                    )}

                    {activeTab === 'Shinobi' && (
                        <View className="px-6">
                            {fullData?.members?.map(m => (
                                <MemberItem
                                    key={m._id}
                                    member={m}
                                    roleLabel={m._id === fullData.leader?._id ? "Kage" : (m._id === fullData.viceLeader?._id ? "Jonin" : "Genin")}
                                    canManage={canManageClan && m._id !== fullData.leader?._id}
                                    onKick={() => triggerAction("KICK_MEMBER", { userId: m._id })}
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

                    {activeTab === 'Treasury' && (
                        <View className="px-6 items-center py-10">
                            <MaterialCommunityIcons name="storefront" size={80} color={APP_BLUE} />
                            <Text className="text-black dark:text-white font-black text-xl mt-4 uppercase italic text-center">Clan Treasury</Text>
                            <Text className="text-gray-500 text-xs text-center mt-2 px-10">
                                Use Funds for village upgrades. (Admin Only)
                            </Text>

                            <View className="mt-8 w-full gap-y-4">
                                <TouchableOpacity
                                    disabled={fullData?.maxSlots >= 13 || isAdLoading}
                                    onPress={handleBuySlotsWithAd}
                                    className={`p-5 rounded-[20px] flex-row justify-between items-center border ${fullData?.maxSlots >= 13 ? 'bg-zinc-100 dark:bg-zinc-950 opacity-50 border-gray-200 dark:border-zinc-800' : 'bg-gray-100 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800'}`}
                                >
                                    <View>
                                        <Text className="text-black dark:text-white font-black uppercase text-[10px]">Expand Barracks</Text>
                                        <Text className="text-gray-500 text-[8px] uppercase">
                                            {fullData?.maxSlots >= 13 ? 'Maximum Capacity Reached' : `Currently: ${fullData?.maxSlots}/13 Slots`}
                                        </Text>
                                    </View>
                                    <View className="bg-blue-500/20 px-3 py-1.5 rounded-full">
                                    {isAdLoading ? (
                                        <ActivityIndicator size="small" color={APP_BLUE} />
                                    ) : (
                                        <Text className="text-blue-500 font-black text-[10px]">1K SP + Ad</Text>
                                    )}
                                    </View>
                                </TouchableOpacity>
                            </View>
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
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchPosts(nextPage);
                }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => (
                <View style={{ paddingBottom: insets.bottom + 100 }}>
                    {isFetchingNextPage && <SyncLoading message="Loading more battles" />}
                </View>
            )}
        />
    );
};

// --- Sub Components ---

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

const ExpansionRow = ({ icon, label, subLabel, onPress }) => (
    <TouchableOpacity 
        onPress={onPress}
        className="flex-row items-center p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-100 dark:border-zinc-800"
    >
        <View className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full items-center justify-center border border-gray-100 dark:border-zinc-700">
            <MaterialCommunityIcons name={icon} size={20} color="#3b82f6" />
        </View>
        <View className="flex-1 ml-4">
            <Text className="text-black dark:text-white font-black text-[10px] uppercase">{label}</Text>
            <Text className="text-gray-400 text-[8px] font-bold uppercase">{subLabel}</Text>
        </View>
        <Feather name="chevron-right" size={16} color="#9ca3af" />
    </TouchableOpacity>
);

const StatCard = ({ label, value, icon }) => (
    <View className="w-[48%] bg-white dark:bg-zinc-900/50 p-5 rounded-[30px] mb-4 border border-gray-100 dark:border-zinc-800 shadow-sm">
        <MaterialCommunityIcons name={icon} size={20} color="#3b82f6" />
        <Text className="text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest mt-2">{label}</Text>
        <Text className="text-lg font-black mt-1 dark:text-white">{value?.toLocaleString() || 0}</Text>
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

const MemberItem = ({ member, roleLabel, canManage, onKick, accent }) => (
    <View className="flex-row items-center mb-3 bg-white dark:bg-zinc-900/40 p-4 rounded-[24px] border border-gray-100 dark:border-zinc-800">
        <Image source={{ uri: member.profilePic?.url }} className="w-12 h-12 rounded-full border-2 border-zinc-100 dark:border-zinc-800" />
        <View className="flex-1 ml-4">
            <Text className="text-black dark:text-white font-black uppercase text-xs tracking-tight">{member.username}</Text>
            <Text style={{ color: accent }} className="text-[8px] font-black uppercase tracking-widest mt-0.5">{roleLabel}</Text>
        </View>
        {canManage && (
            <TouchableOpacity onPress={onKick} className="bg-red-500/10 px-4 py-2 rounded-xl">
                <Text className="text-red-600 dark:text-red-500 font-black text-[9px] uppercase">Banish</Text>
            </TouchableOpacity>
        )}
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

const RequestItem = ({ user, onApprove, accent }) => (
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
    </View>
);

export default ClanProfile;