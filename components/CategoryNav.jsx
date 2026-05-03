import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, TouchableOpacity, View } from "react-native";
import { useMMKV } from 'react-native-mmkv';
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
        case 'post_like': return { color: '#ef4444', icon: 'heart-outline' };
        case 'post_comment': return { color: '#3b82f6', icon: 'message-outline' };
        case 'post_reply': return { color: '#10b981', icon: 'reply' };
        case 'clan_post': return { color: '#f59e0b', icon: 'post-outline' };
        case 'clan_message': return { color: '#8b5cf6', icon: 'forum-outline' };
        default: return { color: '#3b82f6', icon: 'console' };
    }
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
    const navListRef = useRef(null);

    // Notification Logic
    const userId = user?._id || '';
    const clanId = userClan?.tag || '';
    const endpoint = `/message-pills?userId=${userId}&clanId=${clanId}`;
    const { data } = useSWR(endpoint, fetcher, { refreshInterval: 30000 });

    useEffect(() => {
        try {
            const stored = storage.getString('pill_views');
            setViewCounts(stored ? JSON.parse(stored) : {});
        } catch (e) { setViewCounts({}); }
    }, []);

    const rawPills = data?.pills || [];
    const activeCount = rawPills.filter(pill => (viewCounts[pill._id] || 0) < MAX_VIEWS_MARQUEE).length;

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
                    navListRef.current?.scrollToIndex({ index: activeIndex, animated: true, viewPosition: 0.5 });
                }, 100);
            }
        }
    }, [id]);

    const handleCategoryPress = useCallback((categoryId) => {
        if (id === categoryId) return;
        router.push(`/categories/${categoryId}`);
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
            <View className="flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <MaterialCommunityIcons name={themePill.icon} size={20} color={themePill.color} style={{ marginRight: 12 }} />
                <View className="flex-1">
                    <Text className="font-semibold text-sm" style={{ color: themePill.color }}>{item.text}</Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.type.replace('_', ' ').toUpperCase()} {views > 0 && ` • Viewed ${views}x`} {!isActive && ' (Inactive)'}
                    </Text>
                </View>
                {item.link && (
                    <Pressable onPress={() => { router.push(item.link); markSeen(item._id); setShowModal(false); }} className="bg-blue-500 px-4 py-2 rounded-lg">
                        <Text className="text-white font-medium text-xs">Open</Text>
                    </Pressable>
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
                contentContainerStyle={{ paddingHorizontal: 15, alignItems: 'center' }}
                renderItem={renderItem}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        navListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                    }, 100);
                }}
            />

            {/* Notification Bell Separated at the right */}
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

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)} statusBarTranslucent>
                <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowModal(false)} />
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                    <View className="bg-white dark:bg-zinc-900 rounded-t-3xl p-5 max-h-[80vh] shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-bold text-zinc-900 dark:text-white">Notifications</Text>
                            <Pressable onPress={() => setShowModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
                            </Pressable>
                        </View>
                        <FlatList
                            data={rawPills}
                            renderItem={renderPillItem}
                            keyExtractor={item => item._id}
                            showsVerticalScrollIndicator={false}
                        />
                        {activeCount > 0 && (
                            <Pressable className="bg-blue-500 py-3 px-6 rounded-2xl items-center mt-4" onPress={markAllSeen}>
                                <Text className="text-white font-semibold">Mark All Seen</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}