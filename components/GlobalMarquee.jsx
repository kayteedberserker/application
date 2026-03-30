import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, View } from 'react-native';
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

// ⚡️ Max times a specific pill will loop on screen
const MAX_VIEWS = 3;

const getPillTheme = (type) => {
    switch (type) {
        case 'warning': return { color: '#ef4444', icon: 'alert-outline' };
        case 'event': return { color: '#a855f7', icon: 'calendar-star' };
        case 'achievement': return { color: '#eab308', icon: 'trophy-outline' };
        case 'drop': return { color: '#10b981', icon: 'diamond-stone' };
        case 'aura_gain': return { color: '#06b6d4', icon: 'flash' };
        case 'clan_points': return { color: '#22c55e', icon: 'shield-star' };
        case 'system':
        default: return { color: '#3b82f6', icon: 'console' };
    }
};

const IS_TESTING = false;

export default function GlobalMarquee({ isDark }) {
    const { user } = useUser();
    const { userClan } = useClan();
    const storage = useMMKV();

    const userId = user?._id || '';
    const clanId = userClan?.tag || '';
    const endpoint = `/message-pills?userId=${userId}&clanId=${clanId}`;

    const { data } = useSWR(endpoint, fetcher, { refreshInterval: 180000 });

    const [viewCounts, setViewCounts] = useState(() => {
        try {
            const stored = storage.getString('pill_views');
            return stored ? JSON.parse(stored) : {};
        } catch (e) { return {}; }
    });

    const rawPills = IS_TESTING ? TEST_PILLS : (data?.pills || []);

    const activePills = useMemo(() => {
        return rawPills.filter(pill => {
            const views = viewCounts[pill._id] || 0;
            console.log(views);

            return views < MAX_VIEWS;
        });
    }, [rawPills, viewCounts]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [textWidth, setTextWidth] = useState(0);

    const safeIndex = currentIndex % Math.max(1, activePills.length);
    const currentPill = activePills[safeIndex];
    const theme = currentPill ? getPillTheme(currentPill.type) : null;

    const translateX = useSharedValue(0);

    // ⚡️ HELPER: Manually increment views at the END of an animation cycle
    const incrementViewCount = (pillId) => {
        setViewCounts(prev => {
            const currentViews = prev[pillId] || 0;
            const newCounts = { ...prev, [pillId]: currentViews + 1 };

            // Cleanup old memory
            const keys = Object.keys(newCounts);
            if (keys.length > 50) {
                delete newCounts[keys[0]];
            }

            storage.set('pill_views', JSON.stringify(newCounts));
            return newCounts;
        });
    };

    useEffect(() => {
        if (!currentPill) return;

        let timer;
        const containerWidth = SCREEN_WIDTH - 60;

        if (textWidth > 0) {
            translateX.value = 0;

            if (textWidth <= containerWidth) {
                // ⚡️ SHORT TEXT: Display and wait
                timer = setTimeout(() => {
                    incrementViewCount(currentPill._id); // Mark viewed
                    setTextWidth(0);
                    setCurrentIndex((prev) => prev + 1);
                }, 4000);
            } else {
                // ⚡️ LONG TEXT: Ping-Pong Sequence (Read forward, pause, read backward)
                const distanceToPan = textWidth - containerWidth + 30;
                const panDuration = (distanceToPan / 35) * 1000;

                translateX.value = withSequence(
                    withTiming(0, { duration: 1500 }), // Initial Pause
                    withTiming(-distanceToPan, { duration: panDuration, easing: Easing.linear }), // Scroll Left
                    withTiming(-distanceToPan, { duration: 1500 }), // Pause at the end to read
                    withTiming(0, { duration: panDuration, easing: Easing.linear }), // Scroll Right (Back)
                    withTiming(0, { duration: 1000 }) // Brief pause before flipping out
                );

                const totalSequenceTime = 1500 + panDuration + 1500 + panDuration + 1000;

                timer = setTimeout(() => {
                    incrementViewCount(currentPill._id); // Mark viewed
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

    // ⚡️ FIX: If empty, gracefully return null to unmount and clear the space
    if (activePills.length === 0 || !currentPill) return null;

    const themeBg = isDark ? '#050505' : '#ffffff';
    const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';

    return (
        <View
            className={`w-full border-b z-[100] ${borderColor}`}
            style={{ height: 36, backgroundColor: themeBg, position: 'relative', overflow: 'hidden' }}
        >
            <Animated.View
                // ⚡️ FIX: Include currentIndex in the key so even a single pill will trigger the 3D Flip every loop!
                key={`${currentPill._id}-${currentIndex}`}
                entering={FlipInXDown.duration(600).springify()}
                exiting={FlipOutXUp.duration(500)}
                style={{ position: 'absolute', width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center' }}
            >
                <View
                    className={`px-3 h-full justify-center border-r ${borderColor}`}
                    style={{ backgroundColor: themeBg, zIndex: 10 }}
                >
                    <MaterialCommunityIcons
                        name={theme.icon}
                        size={16}
                        color={theme.color}
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
                                style={{ color: theme.color, paddingRight: 20 }}
                            >
                                {currentPill.text}
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
            </Animated.View>
        </View>
    );
}