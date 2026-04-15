import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, Pressable, ScrollView, View } from 'react-native';
import { useMMKV } from 'react-native-mmkv';
import Animated, {
    Easing,
    FlipInXDown,
    FlipOutXUp,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import useSWR from 'swr';
import apiFetch from '../utils/apiFetch';
import { Text } from './Text';

import { useClan } from '../context/ClanContext';
import { useUser } from '../context/UserContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const fetcher = url => apiFetch(url).then(res => res.json());

// ⚡️ Max times a specific pill loops in marquee
const MAX_VIEWS_MARQUEE = 3;

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
        case 'system':
        default: return { color: '#3b82f6', icon: 'console' };
    }
};

export default function GlobalMarquee({ isDark }) {
    const { user } = useUser();
    const { userClan } = useClan();
    const storage = useMMKV();
    const router = useRouter();

    const userId = user?._id || '';
    const clanId = userClan?.tag || '';
    const endpoint = `/message-pills?userId=${userId}&clanId=${clanId}`;

    const { data } = useSWR(endpoint, fetcher, { refreshInterval: 30000 });

    const [viewCounts, setViewCounts] = useState({});
    const [showModal, setShowModal] = useState(false);

    // Load view counts
    useEffect(() => {
        try {
            const stored = storage.getString('pill_views');
            setViewCounts(stored ? JSON.parse(stored) : {});
        } catch (e) {
            setViewCounts({});
        }
    }, []);

    // Save view counts every 5s
    useEffect(() => {
        const timer = setTimeout(() => {
            storage.set('pill_views', JSON.stringify(viewCounts));
        }, 5000);
        return () => clearTimeout(timer);
    }, [viewCounts]);

    const rawPills = data?.pills || [];
    const activePills = useMemo(() =>
        rawPills.filter(pill => (viewCounts[pill._id] || 0) < MAX_VIEWS_MARQUEE)
        , [rawPills, viewCounts]);

    // 🔔 Bell badge: active only count
    const activeCount = activePills.length;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [textWidth, setTextWidth] = useState(0);

    const safeIndex = currentIndex % Math.max(1, activePills.length);
    const currentPill = activePills[safeIndex];
    const theme = currentPill ? getPillTheme(currentPill.type) : null;

    const translateX = useSharedValue(0);

    // Mark pill as seen
    const markSeen = (pillId) => {
        setViewCounts(prev => {
            const newCounts = { ...prev, [pillId]: (prev[pillId] || 0) + 1 };
            // Cleanup old (>50)
            const keys = Object.keys(newCounts).slice(-50);
            const cleaned = {};
            keys.forEach(k => cleaned[k] = newCounts[k]);
            return cleaned;
        });
    };

    // Mark all seen
    const markAllSeen = () => {
        const newCounts = { ...viewCounts };
        rawPills.forEach(pill => {
            newCounts[pill._id] = Math.max(newCounts[pill._id] || 0, MAX_VIEWS_MARQUEE);
        });
        setViewCounts(newCounts);
        Alert.alert('All notifications marked as seen!');
    };

    // Marquee animation logic (unchanged)
    useEffect(() => {
        if (!currentPill) return;

        let timer;
        const containerWidth = SCREEN_WIDTH - 60;

        if (textWidth > 0) {
            translateX.value = 0;

            if (textWidth <= containerWidth) {
                timer = setTimeout(() => {
                    markSeen(currentPill._id);
                    setTextWidth(0);
                    setCurrentIndex((prev) => prev + 1);
                }, 4000);
            } else {
                const distanceToPan = textWidth - containerWidth + 30;
                const panDuration = (distanceToPan / 35) * 1000;

                translateX.value = withSequence(
                    withTiming(0, { duration: 1500 }),
                    withTiming(-distanceToPan, { duration: panDuration, easing: Easing.linear }),
                    withTiming(-distanceToPan, { duration: 1500 }),
                    withTiming(0, { duration: panDuration, easing: Easing.linear }),
                    withTiming(0, { duration: 1000 })
                );

                const totalSequenceTime = 1500 + panDuration + 1500 + panDuration + 1000;

                timer = setTimeout(() => {
                    markSeen(currentPill._id);
                    setTextWidth(0);
                    setCurrentIndex((prev) => prev + 1);
                }, totalSequenceTime);
            }
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [textWidth, safeIndex, activePills.length, currentPill]);

    const panStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    if (activePills.length === 0) return null;

    const themeBg = isDark ? '#050505' : '#ffffff';
    const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';

    // 🔔 Modal render item
    const renderPillItem = ({ item }) => {
        const themePill = getPillTheme(item.type);
        const views = viewCounts[item._id] || 0;
        const isActive = views < MAX_VIEWS_MARQUEE;
        const hasLink = !!item.link;

        return (
            <View className="flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <MaterialCommunityIcons
                    name={themePill.icon}
                    size={20}
                    color={themePill.color}
                    style={{ marginRight: 12 }}
                />
                <View className="flex-1">
                    <Text className="font-semibold text-sm" style={{ color: themePill.color }}>
                        {item.text}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.type.replace('_', ' ').toUpperCase()}
                        {views > 0 && ` • Viewed ${views}x`}
                        {!isActive && ' (Inactive)'}
                    </Text>
                </View>
                {hasLink && (
                    <Pressable
                        onPress={() => {
                            router.push(item.link);
                            markSeen(item._id);
                        }}
                        className="bg-blue-500 px-4 py-2 rounded-lg"
                    >
                        <Text className="text-white font-medium text-xs">Open</Text>
                    </Pressable>
                )}
            </View>
        );
    };

    return (
        <View>
            {/* 🔔 Existing Marquee (unchanged behavior) */}
            <View
                className={`w-full border-b z-[100] ${borderColor}`}
                style={{ height: 36, backgroundColor: themeBg, position: 'relative', overflow: 'hidden' }}
            >
                <Animated.View
                    key={`${currentPill?._id}-${currentIndex}`}
                    entering={FlipInXDown.duration(600).springify()}
                    exiting={FlipOutXUp.duration(500)}
                    style={{ position: 'absolute', width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center' }}
                >
                    <Pressable
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%' }}
                        onPress={() => {
                            if (currentPill?.link) {
                                router.push(currentPill.link);
                                markSeen(currentPill._id); // Mark seen on marquee click too
                            }
                        }}
                    >
                        <View
                            className={`px-3 h-full justify-center border-r ${borderColor}`}
                            style={{ backgroundColor: themeBg, zIndex: 10 }}
                        >
                            <MaterialCommunityIcons
                                name={theme?.icon}
                                size={16}
                                color={theme?.color}
                            />
                        </View>

                        <View style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', justifyContent: 'center' }}>
                            <ScrollView
                                horizontal
                                scrollEnabled={false}
                                showsHorizontalScrollIndicator={false}
                                style={{ flex: 1 }}
                                contentContainerStyle={{ alignItems: 'center' }}
                            >
                                <Animated.View style={[{ flexDirection: 'row', paddingLeft: 10 }, panStyle]}>
                                    <Text
                                        onLayout={(e) => {
                                            if (textWidth === 0) setTextWidth(e.nativeEvent.layout.width);
                                        }}
                                        numberOfLines={1}
                                        ellipsizeMode="clip"
                                        className={`font-black uppercase tracking-[0.2em] text-[10px]`}
                                        style={{ color: theme?.color, paddingRight: 20 }}
                                    >
                                        {currentPill?.text}
                                    </Text>
                                </Animated.View>
                            </ScrollView>

                            <LinearGradient
                                colors={[`${themeBg}00`, themeBg]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 25 }}
                            />
                        </View>
                    </Pressable>

                    {/* 🔔 NEW: Bell icon right side */}
                    <Pressable
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20"
                        onPress={() => setShowModal(true)}
                        style={{ padding: 8 }}
                    >
                        <MaterialCommunityIcons
                            name="bell-outline"
                            size={20}
                            color="#6b7280"
                        />
                        {activeCount > 0 && (
                            <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                                <Text className="text-white text-xs font-bold">{activeCount}</Text>
                            </View>
                        )}
                    </Pressable>
                </Animated.View>
            </View>

            {/* 🔔 NEW: Notification Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white dark:bg-zinc-900 rounded-t-3xl p-5 max-h-[80%]">
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
                            ListEmptyComponent={
                                <View className="py-8 items-center">
                                    <MaterialCommunityIcons name="bell-off" size={48} color="#9ca3af" />
                                    <Text className="mt-2 text-gray-500 dark:text-gray-400">No notifications</Text>
                                </View>
                            }
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />

                        {activeCount > 0 && (
                            <Pressable
                                className="bg-blue-500 py-3 px-6 rounded-2xl items-center mt-4"
                                onPress={markAllSeen}
                            >
                                <Text className="text-white font-semibold">Mark All Seen</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
