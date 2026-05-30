import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LegendList } from "@legendapp/list";
import { Canvas, Rect, LinearGradient as SkiaLinearGradient, vec } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useMMKV } from 'react-native-mmkv';
import Animated, {
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming
} from "react-native-reanimated";

import { useRouter } from 'expo-router';
import apiFetch from "../utils/apiFetch";
import ClanCrest from './ClanCrest';
import { SyncLoading } from './SyncLoading';

const TABS = [
    { id: 'USER_GIVEN', label: 'TOP HYPERS' },
    { id: 'USER_RECEIVED', label: 'S-CLASS' },
    { id: 'CLAN_RECEIVED', label: 'ELITE CLANS' },
];

const getRankTheme = (index, isDark) => {
    switch (index) {
        case 0: return { color: '#ef4444', bg: isDark ? '#450a0a' : '#fef2f2', label: 'MYTHIC' };
        case 1: return { color: '#f59e0b', bg: isDark ? '#451a03' : '#fffbeb', label: 'GOLD' };
        case 2: return { color: '#a855f7', bg: isDark ? '#3b0764' : '#faf5ff', label: 'EPIC' };
        case 3: return { color: '#3b82f6', bg: isDark ? '#172554' : '#eff6ff', label: 'RARE' };
        case 4: return { color: '#10b981', bg: isDark ? '#064e3b' : '#ecfdf5', label: 'UNCOMMON' };
        default: return { color: '#64748b', bg: isDark ? '#0f172a' : '#f8fafc', label: 'BASE' };
    }
};

const SkiaShineOverlay = ({ width, height, delay = 0 }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(
            delay,
            withRepeat(withTiming(1, { duration: 2500 }), -1, false)
        );
    }, [delay]);

    const startX = useDerivedValue(() => progress.value * (width * 2) - width);
    const endX = useDerivedValue(() => startX.value + (width * 0.4));

    if (!width || !height) return null;

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Rect x={0} y={0} width={width} height={height}>
                <SkiaLinearGradient
                    start={useDerivedValue(() => vec(startX.value, 0))}
                    end={useDerivedValue(() => vec(endX.value, 0))}
                    colors={["transparent", "rgba(255,255,255,0.3)", "transparent"]}
                />
            </Rect>
        </Canvas>
    );
};

const MetricBadge = ({ icon, value, color, isDark }) => (
    <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 6,
        borderWidth: 1,
        borderColor: `${color}40`
    }}>
        <MaterialCommunityIcons name={icon} size={14} color={color} />
        <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: isDark ? '#fff' : '#000', fontSize: 13, fontWeight: '900', marginLeft: 4 }}
        >
            {value}
        </Text>
    </View>
);

// 🧱 UNIFIED INTERACTIVE CARD (Shine enabled for Top 5)
const LeaderboardCard = ({ item, index, activeTab, maxScore, isDark, onPress }) => {
    const theme = getRankTheme(index, isDark);

    // Ranks #1 through #5 get the luxury animation treatment
    const deservesShine = index < 5;
    const isHero = index === 0;

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const itemScore = item.score || 0;
    const widthPercentage = maxScore > 0 ? Math.max(70, (itemScore / maxScore) * 100) : 100;

    const renderMetrics = () => {
        if (activeTab === 'USER_GIVEN') {
            return (
                <>
                    <MetricBadge isDark={isDark} icon="lightning-bolt" value={itemScore.toLocaleString()} color="#38bdf8" />
                    <MetricBadge isDark={isDark} icon="fire" value={item.megaHypesCount || 0} color="#f43f5e" />
                </>
            );
        }
        if (activeTab === 'USER_RECEIVED') {
            return (
                <>
                    <MetricBadge isDark={isDark} icon="heart-pulse" value={itemScore.toLocaleString()} color="#10b981" />
                    <MetricBadge isDark={isDark} icon="trending-up" value={`+${item.positionsGained || 1}`} color="#f59e0b" />
                </>
            );
        }
        return (
            <>
                <MetricBadge isDark={isDark} icon="shield-half-full" value={itemScore.toLocaleString()} color="#8b5cf6" />
                <MetricBadge isDark={isDark} icon="account-group" value={item.memberCount || 0} color="#64748b" />
            </>
        );
    };

    return (
        <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', delay: index * 50 }}
            style={{ marginBottom: 12, alignItems: 'flex-start' }}
        >
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onPress}
                onLayout={(e) => setDimensions({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                style={{
                    width: `${widthPercentage}%`,
                    backgroundColor: theme.bg,
                    borderColor: theme.color,
                    borderWidth: isHero ? 2 : 1,
                    borderRadius: 12,
                    padding: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    overflow: 'hidden',
                    borderLeftWidth: isHero ? 6 : 2
                }}
            >
                {/* ✨ FIXED: Now checking deservesShine (index < 5) instead of just isHero */}
                {dimensions.width > 0 && deservesShine && (
                    <SkiaShineOverlay
                        width={dimensions.width}
                        height={dimensions.height}
                        // Delay staggers them safely so they don't sync up perfectly down the screen
                        delay={index * 250}
                    />
                )}

                {/* Minimalist Rank Indicator */}
                <View style={{ width: 26, alignItems: 'center', marginRight: 6 }}>
                    <Text
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={{ fontSize: isHero ? 18 : 14, fontWeight: '900', color: theme.color, fontStyle: 'italic', opacity: isHero ? 1 : 0.7 }}
                    >
                        #{index + 1}
                    </Text>
                </View>

                {/* Avatar / Crest */}
                {activeTab === 'CLAN_RECEIVED' ? (
                    <View style={{ marginRight: 8 }}>
                        <ClanCrest rank={item.rank} size={34} isFeed={true} />
                    </View>
                ) : (
                    <Image
                        source={{ uri: item.avatar || 'https://via.placeholder.com/100' }}
                        style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: theme.color, marginRight: 8 }}
                    />
                )}

                {/* Identity & Metrics Container */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={{ color: isDark ? '#fff' : '#0f172a', fontSize: 14, fontWeight: '900', flexShrink: 1 }}
                        >
                            {item.name?.toUpperCase()}
                        </Text>

                        {item.clanTag && activeTab !== 'CLAN_RECEIVED' && (
                            <View style={{ backgroundColor: theme.color, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginLeft: 6 }}>
                                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>[{item.clanTag}]</Text>
                            </View>
                        )}
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'nowrap', overflow: 'hidden' }}>
                        {renderMetrics()}
                    </View>
                </View>
            </TouchableOpacity>
        </MotiView>
    );
};

export default function HypeLeaderboard() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const storage = useMMKV();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('USER_GIVEN');
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);

    const tabIndex = TABS.findIndex(t => t.id === activeTab);
    const tabOffset = useSharedValue(0);
    const tabWidth = containerWidth / TABS.length;

    const maxScore = useMemo(() => {
        return leaderboard.length > 0 ? (leaderboard[0].score || 1) : 1;
    }, [leaderboard]);

    useEffect(() => {
        if (containerWidth > 0) {
            tabOffset.value = withSpring(tabIndex * tabWidth, { damping: 20, stiffness: 90 });
        }
    }, [activeTab, tabIndex, tabWidth, containerWidth]);

    const animatedSliderStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tabOffset.value }],
        width: tabWidth - 8,
    }));

    useEffect(() => {
        const cachedData = storage.getString(`leaderboard_${activeTab}`);
        if (cachedData) setLeaderboard(JSON.parse(cachedData));
        else setLeaderboard([]);
        fetchData(activeTab);
    }, [activeTab]);

    const fetchData = async (type) => {
        const hasCache = storage.contains(`leaderboard_${type}`);
        if (!hasCache) setLoading(true);

        try {
            const response = await apiFetch(`/leaderboard/hype?type=${type}`);
            const data = await response.json();
            if (data.success) {
                setLeaderboard(data.leaderboard);
                storage.set(`leaderboard_${type}`, JSON.stringify(data.leaderboard));
            }
        } catch (error) {
            console.error("Error fetching matrix leaderboard:", error);
        } finally {
            setLoading(false);
        }
    };

    // 🧭 CENTRALIZED ROUTING ROUTINE
    const handleCardPress = (item) => {
        if (activeTab === 'CLAN_RECEIVED') {
            // 🛡️ Replace with your navigation action (e.g., router.push or navigation.navigate)
            router.push(`/clans/${item.tag || item._id}`);
        } else {
            // 👤 Replace with your user profile routing action
            router.push(`/author/${item.userId || item._id}`);
        }
    };

    return (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Dynamic Width Tab Container */}
            <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)} style={{ backgroundColor: isDark ? '#0f172a' : '#e2e8f0', borderRadius: 16, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#cbd5e1', height: 48, justifyContent: 'center' }}>
                {containerWidth > 0 && (
                    <Animated.View style={[animatedSliderStyle, { position: 'absolute', height: 40, borderRadius: 12, left: 4 }]}>
                        <LinearGradient colors={isDark ? ['#4338ca', '#312e81'] : ['#6366f1', '#4f46e5']} style={{ flex: 1, borderRadius: 12 }} />
                    </Animated.View>
                )}
                <View style={{ flexDirection: 'row', height: '100%', zIndex: 20 }}>
                    {TABS.map((tab) => (
                        <TouchableOpacity key={tab.id} activeOpacity={0.9} onPress={() => setActiveTab(tab.id)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontWeight: '900', fontSize: 11, letterSpacing: 0.5, color: activeTab === tab.id ? '#fff' : (isDark ? '#94a3b8' : '#475569') }}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* List States */}
            {loading && leaderboard.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <SyncLoading message='Syncing Data' />
                </View>
            ) : leaderboard.length === 0 ? (
                <MotiView from={{ opacity: 0 }} animate={{ opacity: 0.7 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="database-off" size={50} color="#a855f7" />
                    <Text style={{ color: '#64748b', fontWeight: '900', marginTop: 12, letterSpacing: 2, fontSize: 12 }}>NO DATA SYNCED</Text>
                </MotiView>
            ) : (
                <LegendList
                    data={leaderboard}
                    keyExtractor={(item, idx) => `${activeTab}_${item._id || idx}`}
                    recycleItems={true}
                    renderItem={({ item, index }) => (
                        <LeaderboardCard
                            item={item}
                            index={index}
                            activeTab={activeTab}
                            maxScore={maxScore}
                            isDark={isDark}
                            onPress={() => handleCardPress(item)} // Passed action here
                        />
                    )}
                    estimatedItemSize={70}
                    drawDistance={300}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            )}
        </View>
    );
}