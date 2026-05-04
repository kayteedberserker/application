import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
// ⚡️ Removed expo-blur import
import { LinearGradient } from 'expo-linear-gradient';
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, FlatList, Modal, Pressable, TouchableOpacity, View } from "react-native";
import { useMMKV } from 'react-native-mmkv';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import useSWR from 'swr';
import { useAlert } from '../context/AlertContext';
import { useClan } from '../context/ClanContext';
import { useUser } from '../context/UserContext';
import apiFetch from '../utils/apiFetch';
import { Text } from "./Text";

const fetcher = url => apiFetch(url).then(res => res.json());
const MAX_VIEWS_MARQUEE = 3;

const categories = [
    { id: "news", name: "News", icon: "newspaper-outline", activeIcon: "newspaper" },
    { id: "memes", name: "Memes", icon: "flash-outline", activeIcon: "flash" },
    { id: "fanart", name: "Fan Art", icon: "brush-outline", activeIcon: "brush" },
    { id: "polls", name: "Polls", icon: "stats-chart-outline", activeIcon: "stats-chart" },
    { id: "review", name: "Review", icon: "star-outline", activeIcon: "star" },
    { id: "gaming", name: "Gaming", icon: "game-controller-outline", activeIcon: "game-controller" },
];

const getPillTheme = (type) => {
    switch (type) {
        case 'warning': return { color: '#ef4444', icon: 'alert-outline' };
        case 'event': return { color: '#a855f7', icon: 'calendar-star' };
        case 'achievement': return { color: '#eab308', icon: 'trophy-outline' };
        case 'drop': return { color: '#10b981', icon: 'diamond-stone' };
        case 'aura_gain': return { color: '#06b6d4', icon: 'flash' };
        case 'clan_points': return { color: '#22c55e', icon: 'shield-star' };
        case 'post_vote': return { color: '#f97316', icon: 'thumb-up-outline' };
        case 'post_like': return { color: '#ef4444', icon: 'heart-outline' };
        case 'post_comment': return { color: '#3b82f6', icon: 'message-outline' };
        case 'post_discussion': return { color: '#ec4899', icon: 'forum' };
        case 'post_reply': return { color: '#10b981', icon: 'reply' };
        case 'clan_post': return { color: '#f59e0b', icon: 'post-outline' };
        case 'clan_message': return { color: '#8b5cf6', icon: 'forum-outline' };
        case 'clan_alert': return { color: '#ef4444', icon: 'shield-alert-outline' };
        case 'clan_request': return { color: '#0ea5e9', icon: 'shield-account-outline' };
        case 'system':
        default: return { color: '#3b82f6', icon: 'console' };
    }
};

const getTypeCategory = (type) => {
    if (['clan_points', 'clan_post', 'clan_message', 'clan_alert', 'clan_request'].includes(type)) return 'Clan';
    if (['system', 'event', 'warning'].includes(type)) return 'System';
    return 'Player';
};

const NavPill = memo(({ item, isActive, isDark, onPress }) => {
    const displayName = item.name === "Review" ? "Reviews" : item.name;

    return (
        <TouchableOpacity
            onPress={() => onPress(item.id)}
            activeOpacity={0.8}
            style={{
                marginRight: 10,
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                paddingHorizontal: isActive ? 12 : 8,
                transform: [{ scale: isActive ? 1.05 : 1 }]
            }}
            className={`rounded-full ${isActive ? "bg-blue-600 shadow-lg shadow-blue-500/40" : "bg-gray-100 dark:bg-gray-800/80"}`}
        >
            <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={16}
                color={isActive ? "white" : (isDark ? "#94a3b8" : "#64748b")}
            />
            {isActive && (
                <Text className="ml-2 text-[10px] font-black uppercase tracking-tight text-white">
                    {displayName}
                </Text>
            )}
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => prevProps.isActive === nextProps.isActive && prevProps.isDark === nextProps.isDark);

export default function CategoryNav({ isDark }) {
    const { user } = useUser();
    const { userClan } = useClan();
    const CustomAlert = useAlert();
    const storage = useMMKV();
    const pathname = usePathname();
    const router = useRouter();
    const { id } = useGlobalSearchParams();

    const [showModal, setShowModal] = useState(false);
    const [viewCounts, setViewCounts] = useState({});
    const [activeTab, setActiveTab] = useState('All');
    const navListRef = useRef(null);

    // Reanimated shared value for the sync icon
    const spinValue = useSharedValue(0);

    const notificationTabs = ['All', 'Player', 'Clan', 'System'];

    const userId = user?._id || '';
    const clanId = userClan?.tag || '';
    const endpoint = `/message-pills?userId=${userId}&clanId=${clanId}`;

    // Updated SWR config: 2 minutes interval (120000ms), refocus revalidation true, and grabbed mutate to allow manual fetching
    const { data, isValidating, mutate } = useSWR(endpoint, fetcher, {
        refreshInterval: 120000,
        revalidateOnFocus: true
    });

    useEffect(() => {
        try {
            const stored = storage.getString('pill_views');
            setViewCounts(stored ? JSON.parse(stored) : {});
        } catch (e) { setViewCounts({}); }
    }, []);

    // Handle the spinning animation when isValidating is true
    useEffect(() => {
        if (isValidating) {
            spinValue.value = withRepeat(
                withTiming(360, {
                    duration: 1000,
                    easing: Easing.linear,
                }),
                -1, // infinite loop
                false // no reverse
            );
        } else {
            cancelAnimation(spinValue);
            spinValue.value = 0;
        }
    }, [isValidating, spinValue]);

    const animatedSpinStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${spinValue.value}deg` }]
        };
    });

    const rawPills = data?.pills || [];

    const activeCount = rawPills.filter(pill => (viewCounts[pill._id] || 0) < MAX_VIEWS_MARQUEE).length;

    const filteredPills = rawPills.filter(pill => {
        if (activeTab === 'All') return true;
        return getTypeCategory(pill.type) === activeTab;
    });

    const markSeen = (pillId) => {
        setViewCounts(prev => {
            const newCounts = { ...prev, [pillId]: (prev[pillId] || 0) + 1 };
            const keys = Object.keys(newCounts).slice(-50);
            const cleaned = {};
            keys.forEach(k => cleaned[k] = newCounts[k]);
            storage.set('pill_views', JSON.stringify(cleaned));
            return cleaned;
        });
    };

    const markAllSeen = () => {
        const newCounts = { ...viewCounts };
        rawPills.forEach(pill => {
            newCounts[pill._id] = Math.max(newCounts[pill._id] || 0, MAX_VIEWS_MARQUEE);
        });
        setViewCounts(newCounts);
        storage.set('pill_views', JSON.stringify(newCounts));
        CustomAlert('All notifications marked as seen!');
    };

    useEffect(() => {
        if (id && navListRef.current) {
            const activeIndex = categories.findIndex(c => c.id === id);
            if (activeIndex !== -1) {
                setTimeout(() => {
                    const position = activeIndex === 0 ? 0 : (activeIndex === categories.length - 1 ? 1 : 0.5);
                    navListRef.current?.scrollToIndex({ index: activeIndex, animated: true, viewPosition: position });
                }, 100);
            }
        }
    }, [id]);

    const handleCategoryPress = useCallback((categoryId) => {
        if (id === categoryId) return;
        DeviceEventEmitter.emit("navigateSafely", `/categories/${categoryId}`)
    }, [id, router]);

    const renderItem = useCallback(({ item }) => {
        const isActive = id === item.id;
        return <NavPill item={item} isActive={isActive} isDark={isDark} onPress={handleCategoryPress} />;
    }, [id, isDark, handleCategoryPress]);

    const renderPillItem = ({ item }) => {
        const themePill = getPillTheme(item.type);
        const views = viewCounts[item._id] || 0;
        const isActive = views < MAX_VIEWS_MARQUEE;

        return (
            <View className={`flex-row items-center p-4 mb-3 rounded-2xl border ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-white/60'} shadow-sm`}>
                <View style={{ backgroundColor: `${themePill.color}20`, padding: 10, borderRadius: 12, marginRight: 12 }}>
                    <MaterialCommunityIcons name={themePill.icon} size={22} color={themePill.color} />
                </View>
                <View className="flex-1">
                    <Text className="font-semibold text-sm" style={{ color: isDark ? '#f4f4f5' : '#18181b' }}>{item.text}</Text>
                    <View className="flex-row items-center mt-1">
                        <Text className="text-[10px] font-bold tracking-wider" style={{ color: themePill.color }}>
                            {item.type.replace('_', ' ').toUpperCase()}
                        </Text>
                        <Text className="text-[10px] text-gray-500 dark:text-gray-400 ml-2">
                            {views > 0 && `• Viewed ${views}x`} {!isActive && '• Inactive'}
                        </Text>
                    </View>
                </View>
                {item.link && (
                    <TouchableOpacity
                        onPress={() => { DeviceEventEmitter.emit("navigateSafely", item.link); markSeen(item._id); setShowModal(false); }}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={[themePill.color, `${themePill.color}80`]}
                            className="px-4 py-2 rounded-xl shadow-md"
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        >
                            <Text className="text-white font-bold text-xs">GO</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    if (pathname === "/Search") return null;

    return (
        <View
            className="flex-row items-center bg-transparent w-full"
            style={{ height: 40, borderBottomWidth: 1, borderBottomColor: isDark ? "rgba(30, 58, 138, 0.3)" : "rgba(229, 231, 235, 1)" }}
        >
            <FlatList
                ref={navListRef}
                horizontal
                data={categories}
                keyExtractor={(item) => item.id}
                extraData={id}
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                // Adjusted paddingRight down to 5 to utilize the empty space effectively before the bell icon
                contentContainerStyle={{ paddingLeft: 20, alignItems: 'center' }}
                renderItem={renderItem}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        const position = info.index === 0 ? 0 : (info.index === categories.length - 1 ? 1 : 0.5);
                        navListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: position });
                    }, 100);
                }}
            />

            <TouchableOpacity
                onPress={() => setShowModal(true)}
                style={{ paddingHorizontal: 15, height: '100%', justifyContent: 'center' }}
            >
                <View>
                    <MaterialCommunityIcons name="bell-outline" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                    {activeCount > 0 && (
                        <View className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full items-center justify-center">
                            <Text className="text-white text-[8px] font-bold">{activeCount}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)} statusBarTranslucent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowModal(false)} />

                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '85%' }}>
                    {/* ⚡️ Replaced BlurView with standard View. 
                         Used rgba backgrounds to simulate glassmorphism without native blur dependence. */}
                    <View
                        style={{
                            flex: 1,
                            borderTopLeftRadius: 30,
                            borderTopRightRadius: 30,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                            // ⚡️ Simulate glass surface with high opacity background
                            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        }}
                    >
                        <View className="p-5 flex-1">
                            <View className="flex-row justify-between items-center mb-4">
                                <View className="flex-row items-center">
                                    <Text className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">System Feed</Text>

                                    {/* 🔄 Replaced Activity Indicator with tap-to-sync Animated arrows */}
                                    <TouchableOpacity onPress={() => mutate()} activeOpacity={0.7} style={{ padding: 4, marginLeft: 6 }}>
                                        <Animated.View style={animatedSpinStyle}>
                                            <MaterialCommunityIcons
                                                name="sync"
                                                size={22}
                                                color={isValidating ? "#3b82f6" : (isDark ? "#52525b" : "#a1a1aa")}
                                            />
                                        </Animated.View>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity onPress={() => setShowModal(false)} className="bg-gray-200 dark:bg-zinc-800 p-2 rounded-full">
                                    <MaterialCommunityIcons name="close" size={20} color={isDark ? "#d4d4d8" : "#3f3f46"} />
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row mb-4 bg-gray-200/50 dark:bg-zinc-800/50 p-1 rounded-2xl">
                                {notificationTabs.map(tab => {
                                    const isTabActive = activeTab === tab;
                                    return (
                                        <TouchableOpacity
                                            key={tab}
                                            onPress={() => setActiveTab(tab)}
                                            style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12, backgroundColor: isTabActive ? (isDark ? '#3f3f46' : '#ffffff') : 'transparent' }}
                                            className={`${isTabActive ? 'shadow-sm' : ''}`}
                                        >
                                            <Text className={`text-xs font-bold ${isTabActive ? (isDark ? 'text-white' : 'text-zinc-900') : 'text-gray-500 dark:text-gray-400'}`}>
                                                {tab}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {filteredPills.length === 0 && !isValidating ? (
                                <View className="flex-1 justify-center items-center">
                                    <MaterialCommunityIcons name="bell-sleep-outline" size={60} color={isDark ? "#3f3f46" : "#d1d5db"} />
                                    <Text className="text-gray-500 dark:text-gray-400 mt-4 font-semibold text-center">No recent entries found for this sector.</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={filteredPills}
                                    renderItem={renderPillItem}
                                    keyExtractor={item => item._id}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                />
                            )}

                            {activeCount > 0 && (
                                <TouchableOpacity onPress={markAllSeen} activeOpacity={0.8} className="mt-2 mb-2">
                                    <LinearGradient
                                        colors={['#3b82f6', '#2563eb']}
                                        className="py-4 px-6 rounded-2xl items-center shadow-lg shadow-blue-500/30"
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    >
                                        <Text className="text-white font-black tracking-widest text-sm uppercase">Mark All as Synchronized</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}