import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';
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

// ⚡️ Max times a specific pill loops in marquee before being hidden from the bar
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
        case 'post_rejection': return { color: '#ef4444', icon: 'alert-outline' };
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
    const [marqueeVisible, setMarqueeVisible] = useState(true);

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

    // Update marquee visibility
    useEffect(() => {
        if (activePills.length === 0) {
            setMarqueeVisible(false);
        } else {
            setMarqueeVisible(true);
        }
    }, [activePills.length]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [textWidth, setTextWidth] = useState(0);

    const safeIndex = currentIndex % Math.max(1, activePills.length);
    const currentPill = activePills[safeIndex];
    const theme = currentPill ? getPillTheme(currentPill.type) : null;

    const translateX = useSharedValue(0);

    // Mark pill as seen (increments the marquee loop count)
    const markSeen = (pillId) => {
        setViewCounts(prev => {
            const newCounts = { ...prev, [pillId]: (prev[pillId] || 0) + 1 };
            // Cleanup logic to prevent local storage bloat
            const keys = Object.keys(newCounts).slice(-50);
            const cleaned = {};
            keys.forEach(k => cleaned[k] = newCounts[k]);
            return cleaned;
        });
    };

    // Marquee animation logic
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

    if (!marqueeVisible) return null;

    const themeBg = isDark ? '#050505' : '#ffffff';
    const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';

    return (
        <View
            className={`w-full border-b z-[100] ${borderColor}`}
            style={{
                height: 45, backgroundColor: themeBg, position: 'absolute', top: 85,               // ⬅️ Ensure it starts at the top of its parent
                left: 0,
                right: 0, overflow: 'hidden'
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
                            router.push(currentPill.link);
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