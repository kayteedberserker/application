import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme as useNativeWind } from "nativewind";
import { useCallback, useEffect, useState } from 'react';
import {
    DeviceEventEmitter,
    Dimensions,
    Modal,
    ScrollView,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// ⚡️ Swapped FlashList for LegendList
import { LegendList } from "@legendapp/list";
import { useMMKV } from 'react-native-mmkv';

import ClanCrest from '../../components/ClanCrest';
import { SyncLoading } from '../../components/SyncLoading';
import { Text } from '../../components/Text';
import { useAlert } from '../../context/AlertContext';
import { useClan } from '../../context/ClanContext';
import { useCoins } from '../../context/CoinContext';
import apiFetch from '../../utils/apiFetch';

const { width } = Dimensions.get('window');

const WAR_METRICS = [
    { id: 'POINTS', label: 'Points', icon: 'star-circle' },
    { id: 'LIKES', label: 'Likes', icon: 'heart' },
    { id: 'COMMENTS', label: 'Comments', icon: 'chat' },
];

const TABS = [
    { id: 'ACTIVE', label: 'Live', icon: 'flash' },
    { id: 'PENDING', label: 'Inbox', icon: 'email' },
    { id: 'NEGOTIATING', label: 'Deals', icon: 'handshake' },
];

// Profile cache can stay global
let PROFILE_MEMORY_CACHE = {};

const ClanWarPage = () => {
    const CustomAlert = useAlert();
    const insets = useSafeAreaInsets();
    const { userClan, canManageClan } = useClan();
    const { colorScheme } = useNativeWind();
    const isDark = colorScheme === "dark";

    const storage = useMMKV();

    const [activeTab, setActiveTab] = useState('ACTIVE');

    // ⚡️ Cache Keys
    const activeKey = 'WARS_GLOBAL_ACTIVE';
    const pendingKey = userClan?.tag ? `WARS_${userClan.tag}_PENDING` : null;
    const negotiatingKey = userClan?.tag ? `WARS_${userClan.tag}_NEGOTIATING` : null;
    const cacheKeyProfile = userClan?.tag ? `CLAN_PROFILE_${userClan.tag}` : null;

    // ⚡️ 3 Separate State Buckets (Instantly populated from MMKV on mount)
    const [warData, setWarData] = useState(() => {
        try {
            const aStr = storage.getString(activeKey);
            const pStr = pendingKey ? storage.getString(pendingKey) : null;
            const nStr = negotiatingKey ? storage.getString(negotiatingKey) : null;
            return {
                ACTIVE: aStr ? JSON.parse(aStr) : [],
                PENDING: pStr ? JSON.parse(pStr) : [],
                NEGOTIATING: nStr ? JSON.parse(nStr) : []
            };
        } catch (e) {
            return { ACTIVE: [], PENDING: [], NEGOTIATING: [] };
        }
    });

    const [pages, setPages] = useState({ ACTIVE: 1, PENDING: 1, NEGOTIATING: 1 });
    const [totalPages, setTotalPages] = useState({ ACTIVE: 1, PENDING: 1, NEGOTIATING: 1 });

    const [clanPoints, setClanPoints] = useState(cacheKeyProfile && PROFILE_MEMORY_CACHE[cacheKeyProfile] ? PROFILE_MEMORY_CACHE[cacheKeyProfile] : 0);
    const [clanRank, setClanRank] = useState(0);

    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    const [pendingCount, setPendingCount] = useState(warData.PENDING.length);
    const [negotiationCount, setNegotiationCount] = useState(warData.NEGOTIATING.length);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isNegotiatingMode, setIsNegotiatingMode] = useState(false);
    const [editingWarId, setEditingWarId] = useState(null);

    const [targetTag, setTargetTag] = useState('');
    const [stake, setStake] = useState('');
    const [duration, setDuration] = useState(3);
    const [winCondition, setWinCondition] = useState('FULL');
    const [selectedMetric, setSelectedMetric] = useState('POINTS');
    const { coins, processTransaction } = useCoins();

    // ⚡️ Focused Fetch Logic: Only updates the specific bucket requested
    const fetchWars = useCallback(async (tabToFetch, pageNum = 1) => {
        if (tabToFetch !== 'ACTIVE' && !userClan?.tag) return;

        try {
            const tagQuery = (tabToFetch !== 'ACTIVE' && userClan?.tag) ? `&tag=${userClan.tag}` : '';
            const url = `/clans/wars?status=${tabToFetch}${tagQuery}&page=${pageNum}&limit=10`;

            const res = await apiFetch(url);

            if (res.ok) {
                const data = await res.json();

                // Update State Bucket
                setWarData(prev => {
                    const updatedArray = pageNum === 1 ? data.wars : [...prev[tabToFetch], ...data.wars];

                    // Update Disk Cache (Page 1 only)
                    if (pageNum === 1) {
                        const key = tabToFetch === 'ACTIVE' ? activeKey : tabToFetch === 'PENDING' ? pendingKey : negotiatingKey;
                        if (key) storage.set(key, JSON.stringify(updatedArray));
                    }

                    return { ...prev, [tabToFetch]: updatedArray };
                });

                // Update Pagination Trackers
                setTotalPages(prev => ({ ...prev, [tabToFetch]: data.totalPages }));
                setPages(prev => ({ ...prev, [tabToFetch]: pageNum }));

                setIsOffline(false);
            } else {
                setIsOffline(true);
            }
        } catch (e) {
            console.error(e);
            setIsOffline(true);
        }
    }, [userClan?.tag, activeKey, pendingKey, negotiatingKey, storage]);

    const fetchClanProfile = useCallback(async () => {
        if (!userClan?.tag) return;
        try {
            // Also grab profile from MMKV on mount
            if (cacheKeyProfile && !PROFILE_MEMORY_CACHE[cacheKeyProfile]) {
                const cachedPoints = storage.getString(cacheKeyProfile);
                if (cachedPoints) {
                    setClanPoints(JSON.parse(cachedPoints));
                }
            }

            const res = await apiFetch(`/clans/${userClan.tag}`);
            if (res.ok) {
                const data = await res.json();
                const points = data.totalPoints || 0;
                setClanPoints(points);
                setClanRank(data.rank || 0);
                if (cacheKeyProfile) {
                    PROFILE_MEMORY_CACHE[cacheKeyProfile] = points;
                    storage.set(cacheKeyProfile, JSON.stringify(points));
                }
            }
        } catch (e) { console.error(e); }
    }, [userClan?.tag, cacheKeyProfile, storage]);

    const updateIndicators = useCallback(async () => {
        if (!userClan?.tag) return;
        try {
            const [pRes, nRes] = await Promise.all([
                apiFetch(`/clans/wars?status=PENDING&tag=${userClan.tag}&limit=1`),
                apiFetch(`/clans/wars?status=NEGOTIATING&tag=${userClan.tag}&limit=1`)
            ]);
            if (pRes.ok) {
                const d = await pRes.json();
                setPendingCount(d.totalWars);
            }
            if (nRes.ok) {
                const d = await nRes.json();
                setNegotiationCount(d.totalWars);
            }
        } catch (e) { console.error(e); }
    }, [userClan?.tag]);

    // ⚡️ Background Sync when tab changes
    useEffect(() => {
        // Silently fetch fresh data for the active tab in the background
        fetchWars(activeTab, 1);

        // Pre-fetch metrics and profile info independently
        if (userClan?.tag) {
            fetchClanProfile();
            updateIndicators();
        }
    }, [activeTab, userClan?.tag, fetchWars, fetchClanProfile, updateIndicators]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchWars(activeTab, 1);
        if (userClan?.tag) await updateIndicators();
        setRefreshing(false);
    };

    const handleLoadMore = () => {
        if (pages[activeTab] < totalPages[activeTab] && !isOffline) {
            fetchWars(activeTab, pages[activeTab] + 1);
        }
    };

    const handleOpenNegotiation = (war) => {
        setEditingWarId(war.warId);
        setTargetTag(war.challengerTag === userClan.tag ? war.defenderTag : war.challengerTag);
        setStake(war.prizePool?.toString() || '0');
        setDuration(war.durationDays || 3);
        setWinCondition(war.winCondition || 'FULL');
        setSelectedMetric(war.warType || 'POINTS');
        setIsNegotiatingMode(true);
        setShowCreateModal(true);
    };

    const handleAcceptWar = async (warId) => {
        if (!userClan?.tag) return;
        setRefreshing(true);
        try {
            const response = await apiFetch('/clans/wars/accept', {
                method: 'POST',
                body: JSON.stringify({ warId, userClanTag: userClan.tag })
            });

            if (response.ok) {
                CustomAlert("Success", "War is now ACTIVE!");
                setActiveTab('ACTIVE');
                // Refresh both the Inbox and the Live tab
                fetchWars('ACTIVE', 1);
                fetchWars('PENDING', 1);
                updateIndicators();
            } else {
                const err = await response.json();
                CustomAlert("Failed", err.message || "Could not accept war");
            }
        } catch (error) { console.error(error); }
        finally { setRefreshing(false); }
    };

    const handleDeclineWar = async (warId) => {
        CustomAlert(
            "Decline Challenge",
            "Are you sure you want to decline this war?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Decline",
                    style: "destructive",
                    onPress: async () => {
                        setRefreshing(true);
                        try {
                            const response = await apiFetch('/clans/wars/decline', {
                                method: 'POST',
                                body: JSON.stringify({ warId })
                            });

                            if (response.ok) {
                                CustomAlert("Declined", "Challenge has been dismissed.");
                                fetchWars(activeTab, 1);
                                updateIndicators();
                            } else {
                                const err = await response.json();
                                CustomAlert("Error", err.message || "Could not decline war");
                            }
                        } catch (error) { console.error(error); }
                        finally { setRefreshing(false); }
                    }
                }
            ]
        );
    };

    const handleTransmitChallenge = async () => {
        if (!canManageClan) return;
        if (parseInt(stake) > clanPoints) {
            CustomAlert("Insufficient Points", `Only ${clanPoints.toLocaleString()} points available.`);
            return;
        }
        setRefreshing(true);
        if (coins < 20) {
            CustomAlert("Insufficient Coins", "You need at least 20 OC to send/negotiate a challenge.");
            setRefreshing(false);
            return;
        }

        try {
            const result = await processTransaction('spend', 'clan_war');
            if (!result.success) {
                CustomAlert("System Notification", result.error || "Unable to make challenge.");
                return;
            }
            const endpoint = isNegotiatingMode ? '/clans/wars/counter' : '/clans/wars/declare';

            const response = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    warId: editingWarId,
                    senderTag: userClan.tag,
                    challengerTag: userClan.tag,
                    targetTag,
                    stake: parseInt(stake),
                    duration,
                    winCondition,
                    metrics: selectedMetric,
                })
            });

            if (response.ok) {
                setShowCreateModal(false);
                setTargetTag('');
                setStake('');
                setIsNegotiatingMode(false);
                CustomAlert("Success", isNegotiatingMode ? "Counter-offer sent!" : "Challenge Sent!");
                fetchWars('NEGOTIATING', 1);
                updateIndicators();
            } else {
                const err = await response.json();
                processTransaction('refund', 'clan_war');
                CustomAlert("Error", err.message || "Action failed, OC refunded");
            }
        } catch (error) { console.error(error); }
        finally { setRefreshing(false); }
    };

    const navigateToClan = (tag) => {
        DeviceEventEmitter.emit("navigateSafely", `/clans/${tag}`);
    };

    const TabIndicator = ({ count, color }) => {
        if (!count || count <= 0) return null;
        return (
            <View className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 ${color}`} />
        );
    };

    const AnimatedProgressBar = ({ scoreA, scoreB }) => {
        const total = scoreA + scoreB || 1;
        const pctA = (scoreA / total) * 100;
        const glowValue = useSharedValue(0);

        useEffect(() => {
            glowValue.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
        }, []);

        const glowStyle = useAnimatedStyle(() => ({
            opacity: interpolate(glowValue.value, [0, 1], [0.6, 1]),
        }));

        return (
            <View className="mt-6">
                <View className="h-5 flex-row rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                    <Animated.View className="h-full bg-blue-500" style={[{ width: `${pctA}%` }, pctA > 50 ? glowStyle : null]} />
                    <Animated.View className="h-full bg-red-600" style={[{ width: `${100 - pctA}%` }]} />
                </View>
                <View className="flex-row justify-between mt-2 px-1">
                    <Text className="text-blue-500 dark:text-blue-400 font-black italic text-lg">{Math.round(pctA)}%</Text>
                    <Text className="text-red-600 dark:text-red-500 font-black italic text-lg">{Math.round(100 - pctA)}%</Text>
                </View>
            </View>
        );
    };

    const PendingRequestCard = ({ item }) => {
        const isNegotiation = item.status === 'NEGOTIATING';
        const amIChallenger = item.challengerTag === userClan?.tag;
        const opponent = amIChallenger ? item.defenderTag : item.challengerTag;
        const isWaitingForOpponent = item.lastUpdatedByCustomTag === userClan?.tag;

        return (
            <View className={`bg-white dark:bg-slate-900 border-2 ${isNegotiation ? 'border-blue-500/30' : 'border-amber-500/30'} rounded-[32px] p-5 mb-4 mx-5 shadow-sm`}>
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-row items-center flex-1">
                        <View className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl items-center justify-center">
                            <MaterialCommunityIcons name={isNegotiation ? "handshake" : "sword-cross"} size={24} color={isNegotiation ? "#3b82f6" : "#f59e0b"} />
                        </View>
                        <View className="ml-3">
                            <Text className="text-slate-900 dark:text-white font-black text-lg italic uppercase">{opponent}</Text>
                            <Text className={`${isNegotiation ? 'text-blue-500' : 'text-amber-600'} text-[10px] font-bold uppercase`}>
                                {isNegotiation ? (isWaitingForOpponent ? 'Awaiting response' : 'Counter-Offer') : 'Incoming Challenge'}
                            </Text>
                        </View>
                    </View>
                    <View className="bg-slate-100 dark:bg-slate-950 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800">
                        <Text className="text-slate-900 dark:text-white font-black text-[12px]">{item.prizePool?.toLocaleString()} PTS</Text>
                    </View>
                </View>

                <View className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-800/50">
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-slate-500 text-[10px] font-black uppercase">Duration</Text>
                        <Text className="text-slate-800 dark:text-slate-200 text-[10px] font-black">{item.durationDays} Days</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-slate-500 text-[10px] font-black uppercase">Metrics</Text>
                        <Text className="text-slate-800 dark:text-slate-200 text-[10px] font-black uppercase">{item.warType}</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-slate-500 text-[10px] font-black uppercase">Win Condition</Text>
                        <Text className="text-amber-600 dark:text-amber-500 text-[10px] font-black uppercase">
                            {item.winCondition === 'FULL' ? 'Winner Takes All' : 'Proportional'}
                        </Text>
                    </View>
                </View>

                <View className="flex-row gap-2">
                    {canManageClan && (
                        <TouchableOpacity
                            onPress={() => handleDeclineWar(item.warId)}
                            className="w-12 h-12 bg-slate-100 dark:bg-slate-800 items-center justify-center rounded-2xl border-b-4 border-slate-300 dark:border-slate-950 active:border-b-0"
                        >
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={() => handleOpenNegotiation(item)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 h-12 items-center justify-center rounded-2xl border-b-4 border-slate-300 dark:border-slate-950 active:border-b-0"
                    >
                        <Text className="text-slate-900 dark:text-white font-black text-[12px] uppercase">
                            {isWaitingForOpponent ? 'Update Offer' : 'Negotiate'}
                        </Text>
                    </TouchableOpacity>
                    {!isWaitingForOpponent && (
                        <TouchableOpacity
                            onPress={() => handleAcceptWar(item.warId)}
                            className={`flex-1 ${isNegotiation ? 'bg-blue-600 border-blue-800' : 'bg-amber-500 border-amber-700'} h-12 items-center justify-center rounded-2xl border-b-4 active:border-b-0`}
                        >
                            <Text className="text-white dark:text-black font-black text-[12px] uppercase">Accept War</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const WarCard = ({ item }) => (
        <View className="bg-white dark:bg-slate-900/90 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 mb-6 mx-5 shadow-sm">
            <View className="flex-row justify-between items-center mb-2">
                <TouchableOpacity onPress={() => navigateToClan(item.challengerTag)} className="items-center">
                    <ClanCrest rank={item.challengerClan?.rank || 1} isFeed={true} size={80} />
                    <Text className="text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase mt-2">{item.challengerTag}</Text>
                </TouchableOpacity>
                <View className="items-center">
                    <Text className="text-slate-900 dark:text-white font-black text-2xl italic">VS</Text>
                    <View className="bg-amber-500 px-4 py-1 rounded-full mt-2">
                        <Text className="text-black text-[12px] font-black uppercase">{(item.prizePool * 2)?.toLocaleString()} PTS</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => navigateToClan(item.defenderTag)} className="items-center">
                    <ClanCrest rank={item.defenderClan?.rank || 1} isFeed={true} size={80} />
                    <Text className="text-red-600 dark:text-red-500 font-black text-[10px] uppercase mt-2">{item.defenderTag}</Text>
                </TouchableOpacity>
            </View>
            <AnimatedProgressBar scoreA={item.currentProgress?.challengerScore || 0} scoreB={item.currentProgress?.defenderScore || 0} />
            <View className="flex-row items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                <View className="flex-row items-center bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800">
                    <Ionicons name="time" size={12} color={isDark ? "#64748b" : "#94a3b8"} />
                    <Text className="text-slate-600 dark:text-slate-300 text-[10px] ml-1 uppercase font-black tracking-widest">ACTIVE</Text>
                </View>
                <View className="flex-1" />
                <Text className="text-amber-600 dark:text-amber-500 text-[10px] font-black italic uppercase">
                    {item.winCondition === 'FULL' ? 'Winner Takes All' : 'Proportional Split'}
                </Text>
            </View>
        </View>
    );

    // ⚡️ Memoized render function for LegendList
    const renderItem = useCallback(({ item }) => {
        return activeTab === 'ACTIVE'
            ? <WarCard item={item} />
            : <PendingRequestCard item={item} />;
    }, [activeTab, canManageClan, userClan]);

    return (
        <View style={{ paddingTop: insets.top }} className="flex-1 bg-white dark:bg-slate-950">
            <View className="px-6 py-4 flex-row justify-between items-center">
                <View>
                    <Text className="text-slate-950 dark:text-white text-4xl font-black italic tracking-tighter uppercase">Clan Wars</Text>
                    <View className="flex-row items-center mt-1">
                        <View className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'} mr-2`} />
                        <Text className={`${isOffline ? 'text-red-500' : 'text-slate-500'} text-[10px] font-black uppercase tracking-widest`}>
                            {isOffline ? 'Offline - Cached Data' : 'Active Warfronts'}
                        </Text>
                    </View>
                </View>

                {userClan?.tag && (
                    <TouchableOpacity
                        onPress={() => {
                            setIsNegotiatingMode(false);
                            setEditingWarId(null);
                            setTargetTag('');
                            setStake('');
                            setSelectedMetric('POINTS');
                            canManageClan ? setShowCreateModal(true) : CustomAlert("Restricted", "Leaders only.");
                        }}
                        className={`${canManageClan ? 'bg-red-600' : 'bg-slate-200 dark:bg-slate-800'} w-14 h-14 rounded-[20px] items-center justify-center border-b-4 ${canManageClan ? 'border-red-800' : 'border-slate-300 dark:border-slate-900'} active:border-b-0`}
                    >
                        <MaterialCommunityIcons name={canManageClan ? "sword-cross" : "lock"} size={28} color={canManageClan ? "white" : (isDark ? "white" : "black")} />
                    </TouchableOpacity>
                )}
            </View>

            {isOffline && (
                <View className="mx-6 mb-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-500/30 p-2 rounded-xl items-center flex-row justify-center gap-2">
                    <MaterialCommunityIcons name="wifi-off" size={14} color={isDark ? "#fca5a5" : "#ef4444"} />
                    <Text className="text-red-700 dark:text-red-200 text-[10px] font-black uppercase">Connection Lost • Showing saved wars</Text>
                </View>
            )}

            <View className="flex-row px-5 mb-6 gap-2">
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => setActiveTab(tab.id)}
                        className={`flex-1 py-4 rounded-2xl flex-row items-center justify-center border-b-2 ${activeTab === tab.id ? 'bg-slate-100 dark:bg-slate-900 border-blue-500' : 'bg-transparent border-transparent'}`}
                    >
                        <MaterialCommunityIcons
                            name={tab.icon}
                            size={18}
                            color={activeTab === tab.id ? '#3b82f6' : (isDark ? '#475569' : '#94a3b8')}
                        />
                        <Text className={`ml-2 font-black uppercase text-[10px] ${activeTab === tab.id ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                            {tab.label}
                        </Text>
                        {tab.id === 'PENDING' && <TabIndicator count={pendingCount} color="bg-amber-500" />}
                        {tab.id === 'NEGOTIATING' && <TabIndicator count={negotiationCount} color="bg-blue-500" />}
                    </TouchableOpacity>
                ))}
            </View>

            {warData[activeTab].length === 0 && refreshing ? (
                <View className="flex-1 justify-center items-center">
                    <SyncLoading message="Scouting Battlefield..." />
                </View>
            ) : (
                // ⚡️ Swapped to LegendList
                <LegendList
                    data={warData[activeTab]}
                    keyExtractor={item => item.warId || item._id}
                    renderItem={renderItem}
                    removeClippedSubviews={true}

                    // ⚡️ LegendList Performance Props
                    estimatedItemSize={250}
                    drawDistance={2000} // Pre-renders further ahead
                    recycleItems={true} // Essential for dynamic layout lists

                    onRefresh={handleRefresh}
                    refreshing={refreshing}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View className="items-center mt-32 opacity-40 px-10">
                            <MaterialCommunityIcons name={activeTab === 'ACTIVE' ? "sword-cross" : "sleep"} size={80} color={isDark ? "#64748b" : "#94a3b8"} />
                            <Text className="text-slate-500 dark:text-slate-400 mt-4 font-black italic uppercase text-center text-xs">
                                {isOffline ? 'No cached records found' :
                                    !userClan?.tag && activeTab !== 'ACTIVE' ? 'You must be aligned with a clan to access this sector.' :
                                        'The battlefield is currently silent.'}
                            </Text>
                        </View>
                    }
                />
            )}

            <Modal visible={showCreateModal} animationType="slide" transparent={true} statusBarTranslucent>
                <View className="flex-1 bg-black/90 justify-end">
                    <View className="bg-white dark:bg-slate-900 rounded-t-[48px] p-8 border-t-2 border-slate-200 dark:border-slate-700" style={{ maxHeight: '90%' }}>
                        <View className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full self-center mb-6" />
                        <View className="flex-row justify-between items-center mb-8">
                            <Text className="text-slate-950 dark:text-white text-3xl font-black italic uppercase">
                                {isNegotiatingMode ? 'Negotiate' : 'Declare War'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)} className="bg-slate-100 dark:bg-slate-800 w-10 h-10 items-center justify-center rounded-2xl">
                                <Ionicons name="close" size={20} color={isDark ? "white" : "black"} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="mb-6">
                                <Text className="text-slate-500 dark:text-slate-400 font-black mb-2 uppercase text-[10px] ml-1">Target Clan Tag</Text>
                                <TextInput
                                    className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 p-5 rounded-[24px] text-slate-950 dark:text-white font-black text-lg"
                                    placeholder="AKAT"
                                    placeholderTextColor={isDark ? "#334155" : "#cbd5e1"}
                                    editable={!isNegotiatingMode}
                                    value={targetTag}
                                    onChangeText={setTargetTag}
                                    autoCapitalize="characters"
                                />
                            </View>

                            <View className="mb-6">
                                <View className="flex-row justify-between px-1 mb-2">
                                    <Text className="text-slate-500 dark:text-slate-400 font-black uppercase text-[10px]">Staked Points</Text>
                                    <Text className="text-blue-600 dark:text-blue-500 font-black uppercase text-[10px]">Available: {clanPoints.toLocaleString()}</Text>
                                </View>
                                <TextInput
                                    className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 p-5 rounded-[24px] text-slate-950 dark:text-white font-black text-lg"
                                    placeholder="1,000"
                                    placeholderTextColor={isDark ? "#334155" : "#cbd5e1"}
                                    keyboardType="numeric"
                                    value={stake}
                                    onChangeText={setStake}
                                />
                            </View>

                            <Text className="text-slate-500 dark:text-slate-400 font-black mb-2 uppercase text-[10px] ml-1">Prize Distribution</Text>
                            <View className="flex-row gap-3 mb-6">
                                {[
                                    { id: 'FULL', label: 'Winner Takes All', icon: 'trophy' },
                                    { id: 'PERCENTAGE', label: 'Proportional Split', icon: 'chart-pie' }
                                ].map(item => (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => setWinCondition(item.id)}
                                        className={`flex-1 p-4 rounded-[24px] border-2 items-center ${winCondition === item.id ? 'border-amber-500 bg-amber-500/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}`}
                                    >
                                        <MaterialCommunityIcons name={item.icon} size={20} color={winCondition === item.id ? '#f59e0b' : '#475569'} />
                                        <Text className={`text-center font-black uppercase text-[10px] mt-1 ${winCondition === item.id ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text className="text-slate-500 dark:text-slate-400 font-black mb-2 uppercase text-[10px] ml-1">Compete On</Text>
                            <View className="flex-row flex-wrap gap-2 mb-6">
                                {WAR_METRICS.map((metric) => (
                                    <TouchableOpacity
                                        key={metric.id}
                                        onPress={() => setSelectedMetric(metric.id)}
                                        className={`flex-row items-center px-4 py-3 rounded-2xl border-2 ${selectedMetric === metric.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}`}
                                    >
                                        <MaterialCommunityIcons
                                            name={metric.icon}
                                            size={16}
                                            color={selectedMetric === metric.id ? '#3b82f6' : '#475569'}
                                        />
                                        <Text className={`ml-2 text-[12px] font-black uppercase ${selectedMetric === metric.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {metric.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text className="text-slate-500 dark:text-slate-400 font-black mb-2 uppercase text-[10px] ml-1">War Duration</Text>
                            <View className="flex-row gap-3 mb-6">
                                {[3, 5, 7].map(d => (
                                    <TouchableOpacity
                                        key={d}
                                        onPress={() => setDuration(d)}
                                        className={`flex-1 p-5 rounded-[24px] border-2 ${duration === d ? 'border-red-500 bg-red-500/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}`}
                                    >
                                        <Text className={`text-center font-black italic text-lg ${duration === d ? 'text-red-600 dark:text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>{d}D</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={handleTransmitChallenge}
                                disabled={refreshing || !targetTag || !stake}
                                className="bg-red-600 p-6 rounded-[28px] border-b-[6px] border-red-800 items-center mb-12 active:border-b-0 disabled:opacity-50"
                            >
                                <Text className="text-white font-black italic uppercase text-xl">
                                    {isNegotiatingMode ? 'Transmit Counter-Offer' : 'Transmit Challenge'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default ClanWarPage;