import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, FlatList, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncLoading } from "../../components/SyncLoading";
import { useStreak } from "../../context/StreakContext";
import { useUser } from "../../context/UserContext";
import apiFetch from '../../utils/apiFetch';

// 🧠 Tier 1: Memory Cache (Instant load when navigating back/forth)
let CLANS_MEMORY_CACHE = [];
let USER_STATS_MEMORY_CACHE = null;

const CLANS_CACHE_KEY = 'cached_clans_list';
const USER_STATS_CACHE_KEY = 'clan_user_stats_cache';
const MIN_POSTS_REQUIRED = 50;
const MIN_STREAK_REQUIRED = 10;

export default function ClanDiscover() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const { user } = useUser();
    const { streak: streakData } = useStreak();

    // 🔹 Initialize state with Memory Cache for 0ms UI pop
    const [clans, setClans] = useState(CLANS_MEMORY_CACHE);
    const [userPostCount, setUserPostCount] = useState(USER_STATS_MEMORY_CACHE?.posts || 0);
    
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [showReqModal, setShowReqModal] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

    const searchTimeout = useRef(null);

    const showAlert = (title, message, type = 'error') => {
        setAlertConfig({ visible: true, title, message, type });
    };

    // 🛡️ Save to AsyncStorage (Tier 2)
    const saveToDisk = async (key, data) => {
        try {
            await AsyncStorage.setItem(key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error("Cache Save Error", e);
        }
    };

    const fetchClans = async (pageNum = 1, searchQuery = '', isRefreshing = false) => {
        if (pageNum > 1) setLoadingMore(true);
        else if (!isRefreshing && clans.length === 0) setLoading(true);

        try {
            const res = await apiFetch(`/clans?page=${pageNum}&limit=10&search=${searchQuery}&fingerprint=${user?.deviceId || ''}`);
            const data = await res.json();
            
            if (res.ok) {
                const newClans = data.clans || [];
                
                setClans(prev => {
                    const updatedList = isRefreshing || pageNum === 1 ? newClans : [...prev, ...newClans];
                    
                    // 💾 Update Tier 1 & Tier 2 for global list (no search)
                    if (!searchQuery && pageNum === 1) {
                        CLANS_MEMORY_CACHE = updatedList;
                        saveToDisk(CLANS_CACHE_KEY, updatedList);
                    }
                    return updatedList;
                });
                
                setHasMore(data.hasMore);
                setPage(pageNum);
            }
        } catch (err) {
            console.error("Fetch Clans Error:", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const fetchUserPostCount = useCallback(async () => {
        if (!user?.deviceId) return;
        try {
            const res = await apiFetch(`/posts?authorId=${user.deviceId}&limit=1`);
            const data = await res.json();
            if (data.total !== undefined) {
                setUserPostCount(data.total);
                // 💾 Update Tiers
                USER_STATS_MEMORY_CACHE = { posts: data.total };
                saveToDisk(USER_STATS_CACHE_KEY, { posts: data.total });
            }
        } catch (err) {
            console.error("Failed to fetch user post count:", err);
        }
    }, [user?.deviceId]);

    // ⚡ HYBRID INIT: Memory -> Disk -> API
    useEffect(() => {
        const init = async () => {
            // 1. Check Disk if Memory is empty
            if (CLANS_MEMORY_CACHE.length === 0) {
                const cached = await AsyncStorage.getItem(CLANS_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    CLANS_MEMORY_CACHE = parsed.data || [];
                    setClans(CLANS_MEMORY_CACHE);
                }
            }

            if (!USER_STATS_MEMORY_CACHE) {
                const cachedStats = await AsyncStorage.getItem(USER_STATS_CACHE_KEY);
                if (cachedStats) {
                    const parsed = JSON.parse(cachedStats);
                    USER_STATS_MEMORY_CACHE = parsed.data;
                    setUserPostCount(USER_STATS_MEMORY_CACHE.posts);
                }
            }

            // 2. Background Revalidate
            fetchClans(1, search, true);
            fetchUserPostCount();
        };
        init();
    }, [fetchUserPostCount]);

    // 🔹 Handle Search with Debounce
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            fetchClans(1, search, true);
        }, 500);
        return () => clearTimeout(searchTimeout.current);
    }, [search]);

    const handleLoadMore = () => {
        if (!loadingMore && hasMore && !loading) {
            fetchClans(page + 1, search);
        }
    };

    const onRefresh = () => {
        fetchClans(1, search, true);
    };

    const handlePressCreate = () => {
        const currentStreak = streakData?.streak || 0;
        if (userPostCount < MIN_POSTS_REQUIRED || currentStreak < MIN_STREAK_REQUIRED) {
            setShowReqModal(true);
        } else {
            setCreateModalVisible(true);
        }
    };

    return (
        <View className={`flex-1 ${isDark ? "bg-black" : "bg-zinc-50"}`} style={{ paddingTop: insets.top }}>
            {/* HEADER */}
            <View className="flex-row items-center px-6 py-4 justify-between">
                <View>
                    <Text className={`text-3xl font-black tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>CLANS</Text>
                    <View className="flex-row items-center">
                        <View className="h-[2px] w-4 bg-blue-600 mr-2" />
                        <Text className="text-blue-600 text-[10px] font-black tracking-[2px] uppercase">Global Archives</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    onPress={onRefresh} 
                    className={`w-12 h-12 items-center justify-center rounded-2xl border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"}`}
                >
                    <Ionicons name="refresh" size={20} color={isDark ? "#fff" : "#000"} />
                </TouchableOpacity>
            </View>

            {/* SEARCH BAR */}
            <View className="flex-row gap-3 px-6 mb-6">
                <View className={`flex-1 flex-row items-center rounded-3xl px-5 h-16 border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-100 shadow-sm"}`}>
                    <Ionicons name="search" size={20} color={isDark ? "#475569" : "#94a3b8"} />
                    <TextInput
                        placeholder="Search archives..."
                        placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                        className={`flex-1 ml-3 font-bold text-base ${isDark ? "text-white" : "text-zinc-900"}`}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <TouchableOpacity
                    className="w-16 h-16 bg-blue-600 rounded-3xl items-center justify-center shadow-xl shadow-blue-600/40"
                    onPress={handlePressCreate}
                >
                    <Ionicons name="add" size={32} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading && clans.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                    <SyncLoading message='Scanning Records...' />
                </View>
            ) : (
                <FlatList
                    data={clans}
                    keyExtractor={(item) => item.tag}
                    renderItem={({ item, index }) => (
                        <ClanCard
                            clan={item}
                            lbRank={item.lbRank || index + 1}
                            isDark={isDark}
                            refreshClans={onRefresh}
                            showAlert={showAlert}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120, paddingTop: 10 }}
                    showsVerticalScrollIndicator={false}
                    onRefresh={onRefresh}
                    refreshing={loading && clans.length > 0}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={() => loadingMore ? (
                        <View className="py-10"><ActivityIndicator color="#2563eb" /></View>
                    ) : (
                        <View className="h-20" />
                    )}
                />
            )}

            {/* MODALS */}
            <RequirementModal
                visible={showReqModal}
                onClose={() => setShowReqModal(false)}
                stats={{ posts: userPostCount, streak: streakData?.streak || 0 }}
                isDark={isDark}
            />

            <CreateClanModal
                visible={isCreateModalVisible}
                isDark={isDark}
                onClose={() => setCreateModalVisible(false)}
                showAlert={showAlert}
                onSuccess={(newClan) => {
                    setClans(prev => [newClan, ...prev]);
                    setCreateModalVisible(false);
                }}
            />

            <CustomAlert
                config={alertConfig}
                onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
                isDark={isDark}
            />
        </View>
    );
}

const CustomAlert = ({ config, onClose, isDark }) => {
    if (!config.visible) return null;
    return (
        <Modal transparent animationType="fade" visible={config.visible}>
            <View className="flex-1 justify-center items-center bg-black/80 px-10">
                <View className={`w-full p-8 rounded-[40px] border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                    <View className="items-center mb-6">
                        <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${config.type === 'error' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                            <Ionicons name={config.type === 'error' ? "alert-circle" : "checkmark-circle"} size={36} color={config.type === 'error' ? "#ef4444" : "#10b981"} />
                        </View>
                        <Text className={`text-2xl font-black text-center tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>{config.title}</Text>
                        <Text className={`text-sm font-bold text-center mt-2 px-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{config.message}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} className="bg-blue-600 p-5 rounded-[22px] items-center shadow-lg shadow-blue-600/30">
                        <Text className="text-white font-black uppercase tracking-widest text-[12px]">Dismiss</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const RequirementModal = ({ visible, onClose, stats, isDark }) => {
    const RequirementRow = ({ label, current, target, icon }) => (
        <View className={`mb-6 p-5 rounded-[30px] border ${isDark ? "bg-black border-zinc-800" : "bg-zinc-50 border-zinc-200 shadow-sm"}`}>
            <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center">
                    <View className={`w-8 h-8 rounded-full items-center justify-center ${current >= target ? "bg-emerald-500/10" : "bg-blue-600/10"}`}>
                        <Ionicons name={icon} size={16} color={current >= target ? "#10b981" : "#2563eb"} />
                    </View>
                    <Text className={`ml-3 font-black text-[11px] uppercase tracking-widest ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{label}</Text>
                </View>
                <Text className={`font-black text-base ${current >= target ? "text-emerald-500" : "text-blue-600"}`}>
                    {current}<Text className="text-zinc-500 font-medium text-xs"> / {target}</Text>
                </Text>
            </View>
            <View className={`h-2 w-full rounded-full overflow-hidden ${isDark ? "bg-zinc-900" : "bg-zinc-200"}`}>
                <View
                    style={{ width: `${Math.min((current / target) * 100, 100)}%` }}
                    className={`h-full rounded-full ${current >= target ? "bg-emerald-500" : "bg-blue-600"}`}
                />
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/90 px-8">
                <View className={`w-full rounded-[45px] p-8 border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                    <View className="items-center mb-8">
                        <View className="w-20 h-20 bg-blue-600/10 rounded-full items-center justify-center mb-4 border border-blue-600/20">
                            <Ionicons name="lock-closed" size={38} color="#2563eb" />
                        </View>
                        <Text className={`text-2xl font-black text-center tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>INSUFFICIENT LEGACY</Text>
                        <Text className="text-blue-600 font-bold text-[10px] uppercase tracking-[2px] text-center mt-1">Foundational requirements not met</Text>
                    </View>
                    <RequirementRow label="Legacy Posts" current={stats.posts} target={MIN_POSTS_REQUIRED} icon="document-text" />
                    <RequirementRow label="Active Streak" current={stats.streak} target={MIN_STREAK_REQUIRED} icon="flame" />
                    <TouchableOpacity onPress={onClose} className="bg-blue-600 p-6 rounded-[28px] items-center shadow-xl shadow-blue-600/40 mt-2">
                        <Text className="text-white font-black uppercase tracking-widest text-xs">I Understand</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const ClanCard = ({ clan, lbRank, isDark, refreshClans, showAlert }) => {
    const { user } = useUser();
    const [actionLoading, setActionLoading] = useState(false);

    const getRankInfo = (rank) => {
        const ranks = {
            6: { title: "The Akatsuki", color: "#2563eb" }, 
            5: { title: "The Espada", color: "#6366f1" },
            4: { title: "Phantom Troupe", color: "#a855f7" },
            3: { title: "Upper Moon", color: "#f59e0b" },
            2: { title: "Squad 13", color: "#10b981" },
            1: { title: "Wandering Ron'ins", color: "#71717a" }
        };
        return ranks[rank] || ranks[1];
    };
    
    const rankInfo = getRankInfo(clan.rank);

    const handleFollow = async () => {
        if (!user) return;
        setActionLoading(true);
        try {
            const res = await apiFetch("/clans/follow", {
                method: "POST",
                body: JSON.stringify({ clanTag: clan.tag, deviceId: user.deviceId, action: "follow" })
            });
            if (res.ok) {
                refreshClans();
            } else {
                const data = await res.json();
                showAlert("ACTION FAILED", data.message || "Could not follow clan.");
            }
        } catch (err) {
            showAlert("CONNECTION ERROR", "Backend is not responding.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleAuthorRequest = async () => {
        if (!user) return;
        setActionLoading(true);
        try {
            const res = await apiFetch(`/clans/${clan.tag}/join`, {
                method: "POST",
                body: JSON.stringify({ deviceId: user.deviceId, username: user.username })
            });
            const data = await res.json();
            if (res.ok) {
                showAlert("REQUEST SENT", "Your application is under review.", "success");
            } else {
                showAlert("REQUEST FAILED", data.message || "Requirement not met.");
            }
        } catch (err) {
            showAlert("CONNECTION ERROR", "Backend is not responding.");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => DeviceEventEmitter.emit("navigateSafely", `/clans/${clan.tag}`)}
            className={`w-full rounded-[50px] border mb-8 overflow-hidden ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-2xl shadow-zinc-300"}`}
            style={{ height: 400 }}
        >
            <View className="flex-row justify-between items-center p-8 pb-4">
                <View className="bg-blue-600 px-4 py-2 rounded-2xl flex-row items-center">
                    <Ionicons name="trophy" size={12} color="white" />
                    <Text className="text-white text-[11px] font-black ml-2 uppercase">Rank #{lbRank}</Text>
                </View>
                <View className="flex-row items-center bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-2xl">
                    <Ionicons name="shield-checkmark" size={14} color="#3b82f6" />
                    <Text className="text-blue-500 text-[11px] font-black ml-2">{clan.badges?.length || 0} Badges</Text>
                </View>
            </View>

            <View className="items-center px-8 mt-4">
                <View className={`w-28 h-28 rounded-[40px] items-center justify-center mb-6 ${isDark ? 'bg-black border border-zinc-800 shadow-2xl' : 'bg-zinc-50 border border-zinc-200 shadow-sm'}`}>
                    <Text className={`font-black text-5xl ${isDark ? 'text-white' : 'text-zinc-900'}`}>{clan.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text numberOfLines={1} className={`text-3xl font-black text-center tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>{clan.name}</Text>
                <View className="flex-row items-center mt-2">
                    <View className="h-[1px] w-3 bg-zinc-500/30 mr-2" />
                    <Text style={{ color: rankInfo.color }} className="text-[10px] font-black tracking-[4px] uppercase">{rankInfo.title}</Text>
                    <View className="h-[1px] w-3 bg-zinc-500/30 ml-2" />
                </View>
                <View className="mt-6 items-center flex-row bg-zinc-500/10 px-5 py-2.5 rounded-2xl">
                    <Ionicons name="people" size={16} color={isDark ? "#a1a1aa" : "#71717a"} />
                    <Text className={`text-sm font-black ml-2 ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{clan.followerCount || 0}</Text>
                    <Text className="text-[10px] text-zinc-500 uppercase font-black ml-1.5 tracking-wider">Followers</Text>
                </View>
            </View>

            <View className="mt-auto flex-row p-6 gap-3 border-t border-zinc-500/10 bg-zinc-500/5">
                <TouchableOpacity 
                    onPress={handleFollow} 
                    disabled={actionLoading} 
                    className="flex-1 h-16 bg-blue-600 rounded-[28px] flex-row items-center justify-center shadow-lg shadow-blue-600/40"
                >
                    {actionLoading ? <ActivityIndicator size="small" color="white" /> : (
                        <><Ionicons name="heart" size={18} color="white" /><Text className="text-white font-black text-[13px] ml-2 uppercase tracking-tight">Follow</Text></>
                    )}
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={handleAuthorRequest} 
                    disabled={actionLoading} 
                    className={`flex-1 h-16 rounded-[28px] flex-row items-center justify-center border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200"}`}
                >
                    {actionLoading ? <ActivityIndicator size="small" color={isDark ? "white" : "black"} /> : (
                        <><Ionicons name="create-outline" size={18} color={isDark ? "#fff" : "#000"} /><Text className={`font-black text-[13px] ml-2 uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>Apply</Text></>
                    )}
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const CreateClanModal = ({ visible, onClose, onSuccess, isDark, showAlert }) => {
    const { user } = useUser();
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!name || !user) return;
        setIsCreating(true);
        try {
            const res = await apiFetch("/clans/create", {
                method: "POST",
                body: JSON.stringify({ name, description: desc, deviceId: user.deviceId })
            });
            const data = await res.json();

            if (res.ok) {
                onSuccess(data.clan);
                setName(''); setDesc('');
            } else {
                showAlert("CREATION DENIED", data.message || "This clan name might be taken.");
            }
        } catch (err) {
            showAlert("NETWORK ERROR", "Failed to reach the Archives. Check your connection.");
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className={`flex-1 justify-end ${isDark ? "bg-black/95" : "bg-zinc-900/70"}`}>
                <View className={`rounded-t-[60px] h-[85%] border-t ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                    <View className="w-16 h-1.5 bg-zinc-500/20 rounded-full self-center mt-4" />
                    
                    <View className="flex-row justify-between items-center px-10 pt-8 pb-6">
                        <View>
                            <Text className={`text-4xl font-black tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>FOUND CLAN</Text>
                            <Text className="text-blue-600 font-bold text-[11px] uppercase tracking-[4px]">Establish your power</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className={`w-14 h-14 rounded-3xl items-center justify-center border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-zinc-100 border-zinc-200"}`}>
                            <Ionicons name="close" size={28} color={isDark ? "#fff" : "#000"} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="px-10 flex-1" showsVerticalScrollIndicator={false}>
                        <View className="mb-8 mt-4">
                            <Text className="text-zinc-500 font-black mb-3 text-[11px] uppercase tracking-[2px] ml-2">Clan Identity</Text>
                            <TextInput
                                className={`p-7 rounded-[30px] border font-black text-xl ${isDark ? "bg-black text-white border-zinc-800" : "bg-zinc-50 text-zinc-900 border-zinc-200"}`}
                                placeholder="e.g. Phantom Troupe"
                                placeholderTextColor={isDark ? "#3f3f46" : "#a1a1aa"}
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View className="mb-10">
                            <Text className="text-zinc-500 font-black mb-3 text-[11px] uppercase tracking-[2px] ml-2">The Manifesto</Text>
                            <TextInput
                                className={`p-7 rounded-[30px] border h-44 font-bold text-lg ${isDark ? "bg-black text-white border-zinc-800" : "bg-zinc-50 text-zinc-900 border-zinc-200"}`}
                                placeholder="State your mission..."
                                placeholderTextColor={isDark ? "#3f3f46" : "#a1a1aa"}
                                multiline
                                textAlignVertical="top"
                                value={desc}
                                onChangeText={setDesc}
                            />
                        </View>

                        <TouchableOpacity
                            className={`bg-blue-600 p-7 rounded-[35px] items-center mb-12 shadow-2xl shadow-blue-600/50 ${isCreating ? 'opacity-70' : ''}`}
                            onPress={handleCreate}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <View className="flex-row items-center">
                                    <Text className="text-white font-black text-xl uppercase tracking-tighter mr-2">Confirm Foundation</Text>
                                    <Ionicons name="chevron-forward" size={20} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};