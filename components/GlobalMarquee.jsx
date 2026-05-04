import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, Dimensions, Pressable, ScrollView, View } from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const fetcher = url => apiFetch(url).then(res => res.json());

// ⚡️ Logic Constants
const MAX_VIEWS_MARQUEE = 1; // Show each pill exactly once
const BATCH_SIZE = 5;        // Show 5 pills per session
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown

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

export default function GlobalMarquee({ isDark }) {
    const { user } = useUser();
    const { userClan } = useClan();
    const storage = useMMKV();

    const userId = user?._id || '';
    const clanId = userClan?.tag || '';
    const endpoint = `/message-pills?userId=${userId}&clanId=${clanId}`;

    const { data } = useSWR(endpoint, fetcher, { refreshInterval: 30000 });

    const [viewCounts, setViewCounts] = useState({});
    const [batchCount, setBatchCount] = useState(0);
    const [nextAvailableTime, setNextAvailableTime] = useState(0);
    const [marqueeVisible, setMarqueeVisible] = useState(false);

    // Load persisted state (Views, Current Batch Count, and Cooldown Timestamp)
    useEffect(() => {
        try {
            const storedViews = storage.getString('pill_views');
            const storedBatch = storage.getNumber('pill_batch_count');
            const storedCooldown = storage.getNumber('pill_cooldown_time');

            setViewCounts(storedViews ? JSON.parse(storedViews) : {});
            setBatchCount(storedBatch || 0);
            setNextAvailableTime(storedCooldown || 0);
        } catch (e) {
            setViewCounts({});
        }
    }, []);

    // ⚡️ Derived Logic: Is the cooldown currently active?
    const isCoolingDown = Date.now() < nextAvailableTime;

    const rawPills = data?.pills || [];

    // Filter for pills never seen before
    const activePills = useMemo(() =>
        rawPills.filter(pill => (viewCounts[pill._id] || 0) < MAX_VIEWS_MARQUEE)
        , [rawPills, viewCounts]);

    // Handle visibility based on cooldown and batch status
    useEffect(() => {
        if (activePills.length === 0 || isCoolingDown) {
            setMarqueeVisible(false);
        } else {
            setMarqueeVisible(true);
        }
    }, [activePills.length, isCoolingDown]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [textWidth, setTextWidth] = useState(0);

    const safeIndex = currentIndex % Math.max(1, activePills.length);
    const currentPill = activePills[safeIndex];
    const theme = currentPill ? getPillTheme(currentPill.type) : null;

    const translateX = useSharedValue(0);

    // Mark pill as seen and track batch progress
    const markSeen = (pillId) => {
        // 1. Mark individual pill as seen
        const newViews = { ...viewCounts, [pillId]: (viewCounts[pillId] || 0) + 1 };
        const keys = Object.keys(newViews).slice(-50);
        const cleanedViews = {};
        keys.forEach(k => cleanedViews[k] = newViews[k]);

        setViewCounts(cleanedViews);
        storage.set('pill_views', JSON.stringify(cleanedViews));

        // 2. Update Batch logic
        const newBatchCount = batchCount + 1;

        if (newBatchCount >= BATCH_SIZE) {
            // Batch limit reached: Start 5 min cooldown
            const cooldownExpiry = Date.now() + COOLDOWN_MS;
            setBatchCount(0);
            setNextAvailableTime(cooldownExpiry);

            storage.set('pill_batch_count', 0);
            storage.set('pill_cooldown_time', cooldownExpiry);
        } else {
            setBatchCount(newBatchCount);
            storage.set('pill_batch_count', newBatchCount);
        }
    };

    // Marquee animation logic
    useEffect(() => {
        if (!currentPill || !marqueeVisible) return;

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
    }, [textWidth, safeIndex, activePills.length, currentPill, marqueeVisible]);

    const panStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    if (!marqueeVisible || !currentPill) return null;

    const themeBg = isDark ? '#050505' : '#ffffff';
    const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';

    return (
        <View
            className={`w-full border-b z-[100] ${borderColor}`}
            style={{
                height: 45,
                backgroundColor: themeBg,
                position: 'absolute',
                top: 85,
                left: 0,
                right: 0,
                overflow: 'hidden'
            }}
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
                            DeviceEventEmitter.emit("navigateSafely", currentPill.link)
                            markSeen(currentPill._id);
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
            </Animated.View>
        </View>
    );
}