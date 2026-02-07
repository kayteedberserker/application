import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added for caching
import { useColorScheme as useNativeWind } from "nativewind";
import { useEffect, useState } from 'react';
import {
    Alert,
    DeviceEventEmitter,
    Dimensions,
    FlatList,
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
import AnimeLoading from '../../../components/AnimeLoading';
import ClanCrest from '../../../components/ClanCrest';
import { SyncLoading } from '../../../components/SyncLoading';
import { Text } from '../../../components/Text';
import { useClan } from '../../../context/ClanContext';
import apiFetch from '../../../utils/apiFetch';

const { width } = Dimensions.get('window');

// Updated to include ALL and fixed the singular selection logic
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

const ClanWarPage = () => {
    const insets = useSafeAreaInsets();
    const { userClan, isInClan, canManageClan } = useClan();
    const { colorScheme } = useNativeWind();
    const isDark = colorScheme === "dark";

    const [activeTab, setActiveTab] = useState('ACTIVE');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [clanPoints, setClanPoints] = useState(0);
    const [wars, setWars] = useState([]);

    // Offline State
    const [isOffline, setIsOffline] = useState(false);

    const [pendingCount, setPendingCount] = useState(0);
    const [negotiationCount, setNegotiationCount] = useState(0);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isNegotiatingMode, setIsNegotiatingMode] = useState(false);
    const [editingWarId, setEditingWarId] = useState(null);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [targetTag, setTargetTag] = useState('');
    const [stake, setStake] = useState('');
    const [duration, setDuration] = useState(3);
    const [winCondition, setWinCondition] = useState('FULL');

    // Changed from array to string. Default is POINTS.
    const [selectedMetric, setSelectedMetric] = useState('POINTS');

    useEffect(() => {
        fetchInitialData();
    }, [activeTab]);

    const fetchInitialData = async () => {
        // Only show full screen loading if we don't have cached data to show immediately
        // We attempt to load cache first
        const hasCache = await loadFromCache();

        if (!hasCache) {
            setLoading(true);
        }

        await Promise.all([
            fetchWars(1),
            fetchClanProfile(),
            updateIndicators()
        ]);

        setLoading(false);
    };

    // New function to load data from storage immediately
    const loadFromCache = async () => {
        if (!userClan?.tag) return false;
        try {
            const cacheKeyWars = `WARS_${userClan.tag}_${activeTab}`;
            const cacheKeyProfile = `CLAN_PROFILE_${userClan.tag}`;

            const [cachedWars, cachedProfile] = await Promise.all([
                AsyncStorage.getItem(cacheKeyWars),
                AsyncStorage.getItem(cacheKeyProfile)
            ]);

            let hasData = false;

            if (cachedWars) {
                setWars(JSON.parse(cachedWars));
                hasData = true;
            }

            if (cachedProfile) {
                setClanPoints(JSON.parse(cachedProfile));
            }

            return hasData;
        } catch (e) {
            console.error("Cache load error", e);
            return false;
        }
    };

    const updateIndicators = async () => {
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
    }

    const fetchWars = async (pageNum = 1) => {
        try {
            const url = `/clans/wars?status=${activeTab}&tag=${userClan?.tag || ''}&page=${pageNum}&limit=10`;
            const res = await apiFetch(url);

            if (res.ok) {
                const data = await res.json();
                const newWars = pageNum === 1 ? data.wars : [...wars, ...data.wars];

                setWars(newWars);
                setTotalPages(data.totalPages);
                setPage(pageNum);
                setIsOffline(false); // Network success

                // Cache the first page of results
                if (pageNum === 1 && userClan?.tag) {
                    await AsyncStorage.setItem(`WARS_${userClan.tag}_${activeTab}`, JSON.stringify(data.wars));
                }
            } else {
                // If API fails, we rely on whatever was in cache (loaded in fetchInitialData)
                setIsOffline(true);
            }
        } catch (e) {
            console.error(e);
            setIsOffline(true);
        }
    };

    const fetchClanProfile = async () => {
        if (!userClan?.tag) return;
        try {
            const res = await apiFetch(`/clans/${userClan.tag}`);
            if (res.ok) {
                const data = await res.json();
                const points = data.totalPoints || 0;
                setClanPoints(points);

                // Cache profile points
                await AsyncStorage.setItem(`CLAN_PROFILE_${userClan.tag}`, JSON.stringify(points));
            }
        } catch (e) { console.error(e); }
    };

    const handleLoadMore = () => {
        if (page < totalPages && !isOffline) { // Don't load more if offline
            fetchWars(page + 1);
        }
    };

    const handleOpenNegotiation = (war) => {
        setEditingWarId(war.warId);
        setTargetTag(war.challengerTag === userClan.tag ? war.defenderTag : war.challengerTag);
        setStake(war.prizePool?.toString() || '0');
        setDuration(war.durationDays || 3);
        setWinCondition(war.winCondition || 'FULL');
        // Schema is string, so we pick the string value
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
                Alert.alert("Success", "War is now ACTIVE!");
                setActiveTab('ACTIVE');
                fetchInitialData();
            } else {
                const err = await response.json();
                Alert.alert("Failed", err.message || "Could not accept war");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleDeclineWar = async (warId) => {
        Alert.alert(
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
                                Alert.alert("Declined", "Challenge has been dismissed.");
                                fetchInitialData();
                            } else {
                                const err = await response.json();
                                Alert.alert("Error", err.message || "Could not decline war");
                            }
                        } catch (error) {
                            console.error(error);
                        } finally {
                            setRefreshing(false);
                        }
                    }
                }
            ]
        );
    };

    const handleTransmitChallenge = async () => {
        if (!canManageClan) return;
        if (parseInt(stake) > clanPoints) {
            Alert.alert("Insufficient Points", `Only ${clanPoints.toLocaleString()} points available.`);
            return;
        }

        setRefreshing(true);
        try {
            const endpoint = isNegotiatingMode ? '/clans/wars/counter' : '/clans/wars/declare';

            const response = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    warId: editingWarId,
                    senderTag: userClan.tag, // Matches the backend's expected logic
                    challengerTag: userClan.tag,
                    targetTag,
                    stake: parseInt(stake),
                    duration,
                    winCondition,
                    metrics: selectedMetric, // Sending as a single string
                })
            });

            if (response.ok) {
                setShowCreateModal(false);
                setTargetTag('');
                setStake('');
                setIsNegotiatingMode(false);
                Alert.alert("Success", isNegotiatingMode ? "Counter-offer sent!" : "Challenge Sent!");
                fetchInitialData();
            } else {
                const err = await response.json();
                Alert.alert("Error", err.message || "Action failed");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
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
        const amIChallenger = item.challengerTag === userClan.tag;
        const opponent = amIChallenger ? item.defenderTag : item.challengerTag;

        // Block button if I am the one who last updated it
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
                    <ClanCrest rank={item.challengerRank || 1} size={80} />
                    <Text className="text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase mt-2">{item.challengerTag}</Text>
                </TouchableOpacity>
                <View className="items-center">
                    <Text className="text-slate-900 dark:text-white font-black text-2xl italic">VS</Text>
                    <View className="bg-amber-500 px-4 py-1 rounded-full mt-2">
                        <Text className="text-black text-[12px] font-black uppercase">{(item.prizePool * 2)?.toLocaleString()} PTS</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => navigateToClan(item.defenderTag)} className="items-center">
                    <ClanCrest rank={item.defenderRank || 1} size={80} />
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

    if (loading && !refreshing) return <AnimeLoading />;

    return (
        <View style={{ paddingTop: insets.top }} className="flex-1 bg-white dark:bg-slate-950">
            {refreshing && <SyncLoading />}

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

                <TouchableOpacity
                    onPress={() => {
                        setIsNegotiatingMode(false);
                        setEditingWarId(null);
                        setTargetTag('');
                        setStake('');
                        setSelectedMetric('POINTS');
                        canManageClan ? setShowCreateModal(true) : Alert.alert("Restricted", "Leaders only.");
                    }}
                    className={`${canManageClan ? 'bg-red-600' : 'bg-slate-200 dark:bg-slate-800'} w-14 h-14 rounded-[20px] items-center justify-center border-b-4 ${canManageClan ? 'border-red-800' : 'border-slate-300 dark:border-slate-900'} active:border-b-0`}
                >
                    <MaterialCommunityIcons name={canManageClan ? "sword-cross" : "lock"} size={28} color={canManageClan ? "white" : (isDark ? "white" : "black")} />
                </TouchableOpacity>
            </View>

            {/* Offline Mode Indicator */}
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

            <FlatList
                data={wars}
                keyExtractor={item => item.warId}
                renderItem={({ item }) => (
                    activeTab === 'ACTIVE'
                        ? <WarCard item={item} />
                        : <PendingRequestCard item={item} />
                )}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                    <View className="items-center mt-32 opacity-20">
                        <MaterialCommunityIcons name="sword-cross" size={80} color={isDark ? "#64748b" : "#94a3b8"} />
                        <Text className="text-slate-500 mt-4 font-black italic uppercase text-center px-10">
                            {isOffline ? 'No cached wars found' : 'The battlefield is silent.'}
                        </Text>
                    </View>
                }
            />

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