import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, FlatList, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncLoading } from "../../../components/SyncLoading";
import { useStreak } from "../../../context/StreakContext";
import { useUser } from "../../../context/UserContext";
import apiFetch from '../../../utils/apiFetch';

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

    // 🔹 Pagination & Search State
    const [search, setSearch] = useState('');
    const [clans, setClans] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [showReqModal, setShowReqModal] = useState(false);
    const [userPostCount, setUserPostCount] = useState(0);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

    // Ref for debouncing search
    const searchTimeout = useRef(null);

    const showAlert = (title, message, type = 'error') => {
        setAlertConfig({ visible: true, title, message, type });
    };

    const fetchClans = async (pageNum = 1, searchQuery = '', isRefreshing = false) => {
        if (pageNum > 1) setLoadingMore(true);
        else setLoading(true);

        try {
            const res = await apiFetch(`/clans?page=${pageNum}&limit=10&search=${searchQuery}&fingerprint=${user?.deviceId || ''}`);
            const data = await res.json();
            console.log(data);
            
            if (res.ok) {
                const newClans = data.clans || [];
                
                setClans(prev => isRefreshing || pageNum === 1 ? newClans : [...prev, ...newClans]);
                setHasMore(data.hasMore)

                if (pageNum === 1 && !searchQuery) {
                    await AsyncStorage.setItem(CLANS_CACHE_KEY, JSON.stringify(newClans));
                }
            }
        } catch (err) {
            console.error("Fetch Clans Error:", err)
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // 🔹 Handle Search with Debounce
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        searchTimeout.current = setTimeout(() => {
            setPage(1);
            fetchClans(1, search);
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(searchTimeout.current);
    }, [search]);

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchClans(nextPage, search);
        }
    };

    const onRefresh = () => {
        setPage(1);
        fetchClans(1, search, true);
    };

    const fetchUserPostCount = useCallback(async () => {
        if (!user?.deviceId) return;
        try {
            const res = await apiFetch(`/posts?authorId=${user.deviceId}&limit=1`);
            const data = await res.json();
            if (data.total !== undefined) {
                setUserPostCount(data.total);
                await AsyncStorage.setItem(USER_STATS_CACHE_KEY, JSON.stringify({
                    posts: data.total,
                    timestamp: Date.now()
                }));
            }
        } catch (err) {
            console.error("Failed to fetch user post count:", err);
        }
    }, [user?.deviceId]);

    useEffect(() => {
        const init = async () => {
            const cachedClans = await AsyncStorage.getItem(CLANS_CACHE_KEY);
            if (cachedClans) setClans(JSON.parse(cachedClans));
            fetchUserPostCount();
        };
        init();
    }, [fetchUserPostCount]);

    const handlePressCreate = () => {
        const currentStreak = streakData?.streak || 0;
        if (userPostCount < MIN_POSTS_REQUIRED || currentStreak < MIN_STREAK_REQUIRED) {
            setShowReqModal(true);
        } else {
            setCreateModalVisible(true);
        }
    };

    return (
        <View className={`flex-1 ${isDark ? "bg-black" : "bg-zinc-50"}`} style={{ paddingTop: 10 }}>
            {/* HEADER */}
            <View className="flex-row items-center px-6 py-4 justify-between">
                <View className="flex-row items-center space-x-4">
                    <View>
                        <Text className={`text-2xl font-black tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>CLANS</Text>
                        <Text className="text-blue-600 text-[10px] font-black tracking-[2px] uppercase">Global Archives</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onRefresh} className={`w-11 h-11 items-center justify-center rounded-2xl ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                    <Ionicons name="refresh" size={20} color={isDark ? "#71717a" : "#a1a1aa"} />
                </TouchableOpacity>
            </View>

            {/* SEARCH BAR */}
            <View className="flex-row gap-3 px-6 space-x-3 mb-6">
                <View className={`flex-1 flex-row items-center rounded-3xl px-5 h-14 border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"}`}>
                    <Ionicons name="search" size={20} color={isDark ? "#64748b" : "#94a3b8"} />
                    <TextInput
                        placeholder="Search archives..."
                        placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                        className={`flex-1 ml-3 font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <TouchableOpacity
                    className="w-14 h-14 bg-blue-600 rounded-3xl items-center justify-center shadow-lg shadow-blue-600/30"
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
                            lbRank={((page - 1) * 10) + index + 1}
                            isDark={isDark}
                            refreshClans={onRefresh}
                            showAlert={showAlert}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    onRefresh={onRefresh}
                    refreshing={loading && clans.length > 0}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={() => loadingMore ? (
                        <View className="py-10"><ActivityIndicator color="#2563eb" /></View>
                    ) : null}
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

// ... Rest of your sub-components (CustomAlert, RequirementModal, ClanCard, CreateClanModal) remain the same

const CustomAlert = ({ config, onClose, isDark }) => {
    if (!config.visible) return null;
    return (
        <Modal transparent animationType="fade" visible={config.visible}>
            <View className="flex-1 justify-center items-center bg-black/80 px-10">
                <View className={`w-full p-8 rounded-[35px] border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                    <View className="items-center mb-6">
                        <View className={`w-14 h-14 rounded-full items-center justify-center mb-4 ${config.type === 'error' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                            <Ionicons name={config.type === 'error' ? "alert-circle" : "checkmark-circle"} size={32} color={config.type === 'error' ? "#2563eb" : "#10b981"} />
                        </View>
                        <Text className={`text-xl font-black text-center ${isDark ? "text-white" : "text-zinc-900"}`}>{config.title}</Text>
                        <Text className={`text-sm font-medium text-center mt-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{config.message}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} className="bg-zinc-800 p-5 rounded-[20px] items-center">
                        <Text className="text-white font-black uppercase tracking-widest text-[12px]">Dismiss</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const RequirementModal = ({ visible, onClose, stats, isDark }) => {
    const RequirementRow = ({ label, current, target, icon }) => (
        <View className={`mb-6 p-5 rounded-[25px] border ${isDark ? "bg-black border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
            <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center">
                    <Ionicons name={icon} size={18} color={current >= target ? "#10b981" : "#2563eb"} />
                    <Text className={`ml-2 font-black text-[10px] uppercase tracking-widest ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{label}</Text>
                </View>
                <Text className={`font-black ${current >= target ? "text-emerald-500" : "text-blue-600"}`}>
                    {current} / {target}
                </Text>
            </View>
            <View className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-zinc-900" : "bg-zinc-200"}`}>
                <View
                    style={{ width: `${Math.min((current / target) * 100, 100)}%` }}
                    className={`h-full ${current >= target ? "bg-emerald-500" : "bg-blue-600"}`}
                />
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/80 px-8">
                <View className={`w-full rounded-[40px] p-8 border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                    <View className="items-center mb-6">
                        <View className="w-16 h-16 bg-blue-600/10 rounded-full items-center justify-center mb-4">
                            <Ionicons name="lock-closed" size={32} color="#2563eb" />
                        </View>
                        <Text className={`text-2xl font-black text-center ${isDark ? "text-white" : "text-zinc-900"}`}>INSUFFICIENT LEGACY</Text>
                        <Text className="text-blue-600 font-bold text-[10px] uppercase tracking-[2px] text-center mt-1">Foundation requirements not met</Text>
                    </View>
                    <RequirementRow label="Legacy Posts" current={stats.posts} target={MIN_POSTS_REQUIRED} icon="document-text" />
                    <RequirementRow label="Active Streak" current={stats.streak} target={MIN_STREAK_REQUIRED} icon="flame" />
                    <TouchableOpacity onPress={onClose} className="bg-blue-600 p-5 rounded-[25px] items-center shadow-lg shadow-blue-600/40">
                        <Text className="text-white font-black uppercase tracking-tighter">I Understand</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const ClanCard = ({ clan, lbRank, isDark, refreshClans, showAlert }) => {
    const router = useRouter();
    const { user } = useUser();
    const [actionLoading, setActionLoading] = useState(false);

    const getRankInfo = (rank) => {
        const ranks = {
            6: { title: "The Akatsuki", color: "#2563eb" }, // Changed from red to blue
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
                refreshClans()
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
            className={`w-full rounded-[45px] border mb-8 overflow-hidden ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-xl shadow-zinc-200"}`}
            style={{ height: 380 }}
        >
            <View className="flex-row justify-between items-center p-8 pb-4">
                <View className="bg-blue-600 px-4 py-1.5 rounded-2xl flex-row items-center">
                    <Ionicons name="trophy" size={12} color="white" />
                    <Text className="text-white text-[12px] font-black ml-2 uppercase">Rank #{clan?.lbRank}</Text>
                </View>
                <View className="flex-row items-center bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-2xl">
                    <Ionicons name="shield-checkmark" size={14} color="#3b82f6" />
                    <Text className="text-blue-500 text-[12px] font-black ml-2">{clan.badges?.length || 0} Badges</Text>
                </View>
            </View>

            <View className="items-center px-8 mt-4">
                <View className={`w-24 h-24 rounded-[35px] items-center justify-center mb-5 ${isDark ? 'bg-black border border-zinc-800' : 'bg-zinc-100 border border-zinc-200'}`}>
                    <Text className={`font-black text-4xl ${isDark ? 'text-white' : 'text-zinc-900'}`}>{clan.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text numberOfLines={1} className={`text-2xl font-black text-center tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>{clan.name}</Text>
                <Text style={{ color: rankInfo.color }} className="text-[10px] font-black tracking-[3px] uppercase mt-2">{rankInfo.title}</Text>
                <View className="mt-6 items-center flex-row bg-zinc-500/5 px-4 py-2 rounded-2xl">
                    <Ionicons name="people" size={16} color={isDark ? "#52525b" : "#a1a1aa"} />
                    <Text className={`text-sm font-black ml-2 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{clan.followerCount || 0}</Text>
                    <Text className="text-[9px] text-zinc-500 uppercase font-bold ml-1">Followers</Text>
                </View>
            </View>

            <View className="mt-auto flex-row p-6 space-x-3 border-t border-zinc-500/5">
                <TouchableOpacity onPress={handleFollow} disabled={actionLoading} className="flex-1 h-14 bg-blue-600 rounded-[24px] flex-row items-center justify-center shadow-lg shadow-blue-600/30">
                    {actionLoading ? <ActivityIndicator size="small" color="white" /> : (
                        <><Ionicons name="heart" size={18} color="white" /><Text className="text-white font-black text-[12px] ml-2 uppercase">Follow</Text></>
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAuthorRequest} disabled={actionLoading} className={`flex-1 h-14 rounded-[24px] flex-row items-center justify-center border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-zinc-100 border-zinc-200"}`}>
                    {actionLoading ? <ActivityIndicator size="small" color={isDark ? "white" : "black"} /> : (
                        <><Ionicons name="create-outline" size={18} color={isDark ? "#fff" : "#000"} /><Text className={`font-black text-[12px] ml-2 uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>Apply Author</Text></>
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
                // Fixed: Explicitly handle backend error messages
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
            <View className={`flex-1 justify-end ${isDark ? "bg-black/90" : "bg-zinc-900/60"}`}>
                <View className={`rounded-t-[50px] h-[75%] border-t ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                    <View className="flex-row justify-between items-center p-10 pb-6">
                        <View>
                            <Text className={`text-3xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>FOUND CLAN</Text>
                            <Text className="text-blue-600 font-bold text-[10px] uppercase tracking-[3px]">Establish your power</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="w-12 h-12 bg-zinc-800 rounded-2xl items-center justify-center">
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView className="px-10 flex-1" showsVerticalScrollIndicator={false}>
                        <Text className="text-zinc-500 font-black mb-2 text-[10px] uppercase tracking-widest">Clan Name</Text>
                        <TextInput
                            className={`p-6 rounded-[25px] border mb-6 font-bold text-lg ${isDark ? "bg-black text-white border-zinc-800" : "bg-zinc-50 text-zinc-900 border-zinc-200"}`}
                            placeholder="e.g. Phantom Troupe"
                            placeholderTextColor="#3f3f46"
                            value={name}
                            onChangeText={setName}
                        />
                        <Text className="text-zinc-500 font-black mb-2 text-[10px] uppercase tracking-widest">Manifesto</Text>
                        <TextInput
                            className={`p-6 rounded-[25px] border mb-10 h-32 ${isDark ? "bg-black text-white border-zinc-800" : "bg-zinc-50 text-zinc-900 border-zinc-200"}`}
                            placeholder="Our mission is..."
                            placeholderTextColor="#3f3f46"
                            multiline
                            textAlignVertical="top"
                            value={desc}
                            onChangeText={setDesc}
                        />
                        <TouchableOpacity
                            className={`bg-blue-600 p-6 rounded-[30px] items-center mb-12 shadow-2xl shadow-blue-600/40 ${isCreating ? 'opacity-50' : ''}`}
                            onPress={handleCreate}
                            disabled={isCreating}
                        >
                            {isCreating ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-xl uppercase tracking-tighter">Confirm Foundation</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};