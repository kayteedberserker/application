import {
    Canvas,
    Group,
    LinearGradient,
    Mask,
    Path,
    Rect,
    Skia,
    vec
} from '@shopify/react-native-skia';
import { AnimatePresence, MotiView } from 'moti';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useCoins } from '../context/CoinContext';
import { useUser } from '../context/UserContext';
import CoinIcon from './ClanIcon';

// ⚡️ RARITY CONFIG WITH ABBREVIATIONS (SKIA SHAPES REMOVED)
const HYPE_TIERS = {
    FREE: {
        cost: 0, points: 50,
        label: 'FREE HYPE', rarity: 'COMMON', abbr: 'FH',
        colors: ['#475569', '#1e293b', '#0f172a'],
        glow: '#94a3b8'
    },
    STANDARD: {
        cost: 20, points: 100,
        label: 'STANDARD', rarity: 'RARE', abbr: 'SH',
        colors: ['#0284c7', '#0369a1', '#082f49'],
        glow: '#38bdf8'
    },
    SUPER: {
        cost: 100, points: 600,
        label: 'SUPER HYPE', rarity: 'EPIC', abbr: 'SP',
        colors: ['#9333ea', '#6b21a8', '#3b0764'],
        glow: '#c084fc'
    },
    MEGA: {
        cost: 400, points: 3000,
        label: 'MEGA BLAST', rarity: 'LEGENDARY', abbr: 'ME',
        colors: ['#d97706', '#92400e', '#451a03'],
        glow: '#fbbf24'
    }
};

// Array reference optimized to bypass inline processing allocation overheads
const HYPE_TIERS_ENTRIES = Object.entries(HYPE_TIERS);

// ⚡️ CLEAN SKIA CARD FRAME - TEXT ONLY (FILLS ~70% AREA)
const MiniSkiaCard = memo(({ colors, glow, abbr, width = 36, height = 48, isDark }) => {
    const progress = useSharedValue(-0.5);

    useEffect(() => {
        cancelAnimation(progress);
        progress.value = withRepeat(
            withTiming(1.5, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
            -1,
            false
        );
        return () => cancelAnimation(progress);
    }, [progress]);

    const layout = useMemo(() => {
        const cut = 6;
        const inset = 2;

        const outerStr = `M ${cut} 0 L ${width} 0 L ${width} ${height - cut} L ${width - cut} ${height} L 0 ${height} L 0 ${cut} Z`;
        const innerStr = `M ${cut + inset / 2} ${inset} L ${width - inset} ${inset} L ${width - inset} ${height - cut - inset / 2} L ${width - cut - inset / 2} ${height - inset} L ${inset} ${height - inset} L ${inset} ${cut + inset / 2} Z`;

        return {
            outerPath: Skia.Path.MakeFromSVGString(outerStr),
            innerPath: Skia.Path.MakeFromSVGString(innerStr)
        };
    }, [width, height]);

    const startPos = useDerivedValue(() => ({ x: progress.value * width, y: 0 }));
    const endPos = useDerivedValue(() => ({ x: (progress.value + 0.5) * width, y: height }));

    return (
        <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
            <Canvas style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            }}>
                {/* Background Gradient */}
                <Path path={layout.outerPath}>
                    <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={colors} />
                </Path>

                {/* Inner Border Constraint */}
                <Path path={layout.innerPath} color={glow} style="stroke" strokeWidth={0.5} opacity={0.3} />

                {/* Animated Scanner Sweep */}
                <Mask mode="luminance" mask={<Group><Path path={layout.outerPath} color="white" /></Group>}>
                    <Rect x={0} y={0} width={width} height={height}>
                        <LinearGradient
                            start={startPos}
                            end={endPos}
                            colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                        />
                    </Rect>
                </Mask>
            </Canvas>

            {/* HIGH-IMPACT MAXI-TEXT (Fills approx 70% of the 36x48 container) */}
            <Text style={{
                position: 'absolute',
                fontSize: 18,
                fontWeight: '900',
                color: '#ffffff',
                letterSpacing: 0.5,
                textAlign: 'center',
                textShadowColor: 'rgba(0,0,0,0.75)',
                textShadowOffset: { width: 0, height: 1.5 },
                textShadowRadius: 2.5,
            }}>
                {abbr}
            </Text>
        </View>
    );
});

// ⚡️ MEMOIZED ROW ITEM (Prevents complete re-rendering on parent updates)
const InteractiveRow = memo(({ data, inventoryCount, isLoading, onPress, coins, isDark }) => {
    const scale = useSharedValue(1);
    const hasTokens = inventoryCount > 0;
    const isFree = data.cost === 0;

    const isLockedFree = isFree && !hasTokens;
    const cannotAfford = !isFree && !hasTokens && coins < data.cost;
    const isDisabled = isLoading || isLockedFree || cannotAfford;

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    return (
        <View style={[
            styles.rowContainer,
            {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(241, 245, 249, 0.85)',
                borderColor: isDark ? '#1e293b' : '#cbd5e1'
            }
        ]}>
            {/* 1. TEXT-ONLY SKIA CARD */}
            <MiniSkiaCard
                colors={data.colors}
                glow={data.glow}
                abbr={data.abbr}
                isDark={isDark}
            />

            {/* 2. DETAILS AREA */}
            <View style={styles.detailsColumn}>
                <Text style={[styles.rarityText, { color: data.glow }]}>{data.rarity}</Text>
                <Text style={[styles.productLabel, { color: isDark ? '#ffffff' : '#0f172a' }]}>{data.label}</Text>
                <Text style={[styles.pointsIndicator, { color: isDark ? '#94a3b8' : '#64748b' }]}>+{data.points} PT</Text>
                <View style={styles.inventoryStatus}>
                    <View style={[styles.statusDot, { backgroundColor: hasTokens ? data.glow : '#475569' }]} />
                    <Text style={[styles.inventoryText, { color: hasTokens ? (isDark ? '#f8fafc' : '#334155') : '#64748b' }]}>
                        {inventoryCount} IN VAULT
                    </Text>
                </View>
            </View>

            {/* 3. ACTION BUTTON */}
            <Pressable
                onPressIn={() => !isDisabled && (scale.value = withTiming(0.95, { duration: 90 }))}
                onPressOut={() => !isDisabled && (scale.value = withSequence(withSpring(1.04), withSpring(1)))}
                onPress={onPress}
                disabled={isDisabled}
                style={styles.actionContainer}
            >
                <MotiView style={[
                    styles.actionButton,
                    {
                        borderColor: data.glow,
                        opacity: isDisabled ? 0.35 : 1,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)'
                    },
                    animatedStyle
                ]}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color={data.glow} />
                    ) : hasTokens ? (
                        <Text style={[styles.actionText, { color: data.glow }]}>USE</Text>
                    ) : isLockedFree ? (
                        <Text style={styles.lockedText}>LOCKED</Text>
                    ) : (
                        <View style={styles.priceRow}>
                            <CoinIcon type="OC" size={10} />
                            <Text style={[styles.priceText, { color: isDark ? '#ffffff' : '#0f172a' }]}>{data.cost}</Text>
                        </View>
                    )}
                </MotiView>
            </Pressable>
        </View>
    );
});

// ⚡️ MAIN DRAWER MODULE WITH AUTOMATIC COIN BALANCING REFRESH
const HypeDrawer = ({ visible, onClose, onHype, isDark = true }) => {
    const { user, syncProfile } = useUser();
    const { coins, fetchCoins } = useCoins();
    const [activeTier, setActiveTier] = useState(null);

    // Store profile synchronization target in a mutable ref to lock execution loop safely
    const syncProfileRef = useRef(syncProfile);

    useEffect(() => {
        syncProfileRef.current = syncProfile;
    }, [syncProfile]);

    // 📡 SYNC PROFILE AND INVENTORY ON OPEN PROTOCOL ONLY (Fires strictly on explicit transition)
    useEffect(() => {
        if (visible) {
            syncProfileRef.current();
        }
    }, [visible]);

    const inventoryCounts = useMemo(() => {
        const counts = { FREE: 0, STANDARD: 0, SUPER: 0, MEGA: 0 };
        if (!user?.inventory) return counts;

        const len = user.inventory.length;
        for (let i = 0; i < len; i++) {
            const item = user.inventory[i];
            if (item.hypeType && counts[item.hypeType] !== undefined) {
                counts[item.hypeType] += (item.itemCount || 1);
            }
        }
        return counts;
    }, [user?.inventory]);

    const handleExecuteHype = async (tierKey) => {
        if (activeTier) return;
        setActiveTier(tierKey);
        try {
            await onHype(tierKey);
            // 🔄 Sync and force updates down from API/MMKV context immediately
            await fetchCoins();
            await syncProfileRef.current();
        } catch (err) {
            console.error("Execution error during burnout sequence:", err);
        } finally {
            setActiveTier(null);
            onClose();
        }
    };

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <AnimatePresence>
                    {visible && (
                        <MotiView
                            from={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 150 }}
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: 0,
                                bottom: 0
                            }}
                        >
                            <Pressable
                                style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(4,6,10,0.82)' : 'rgba(15,23,42,0.5)' }]}
                                onPress={onClose}
                            />
                        </MotiView>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {visible && (
                        <MotiView
                            from={{ opacity: 0, translateY: 300 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            exit={{ opacity: 0, translateY: 300 }}
                            transition={{ type: 'spring', damping: 26, stiffness: 180 }}
                            style={[
                                styles.drawerContainer,
                                {
                                    backgroundColor: isDark ? '#090d14' : '#ffffff',
                                    borderColor: isDark ? '#1e293b' : '#e2e8f0'
                                }
                            ]}
                        >
                            <View style={styles.header}>
                                <View style={styles.headerBrackets}>
                                    <Text style={[styles.bracketText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>[</Text>
                                    <View style={styles.titleColumn}>
                                        <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>ENGAGE HYPE MODULE</Text>
                                        <Text style={[styles.subtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>SELECT BURNOUT PROTOCOL</Text>
                                    </View>
                                    <Text style={[styles.bracketText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>]</Text>
                                </View>
                            </View>

                            <View style={styles.list}>
                                {HYPE_TIERS_ENTRIES.map(([key, data]) => (
                                    <InteractiveRow
                                        key={key}
                                        data={data}
                                        inventoryCount={inventoryCounts[key] || 0}
                                        isLoading={activeTier === key}
                                        coins={coins}
                                        isDark={isDark}
                                        onPress={() => handleExecuteHype(key)}
                                    />
                                ))}
                            </View>

                            <Pressable style={styles.cancelWrapper} onPress={onClose}>
                                <Text style={styles.cancelText}>&lt;&lt; ABORT TRANSMISSION &gt;&gt;</Text>
                            </Pressable>
                        </MotiView>
                    )}
                </AnimatePresence>
            </View>
        </Modal>
    );
};

export default React.memo(HypeDrawer)

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
    },
    drawerContainer: {
        borderTopWidth: 1.5,
        paddingHorizontal: 12,
        paddingBottom: 20,
        paddingTop: 12,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 12,
    },
    headerBrackets: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    bracketText: {
        fontSize: 20,
        fontWeight: '300',
        opacity: 0.8,
    },
    titleColumn: {
        alignItems: 'center',
    },
    title: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    subtitle: {
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 2,
    },
    list: {
        gap: 6,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    detailsColumn: {
        flex: 1,
        paddingLeft: 10,
        justifyContent: 'center',
    },
    rarityText: {
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 1,
    },
    productLabel: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    pointsIndicator: {
        fontSize: 9,
        fontWeight: '700',
        marginTop: 1,
    },
    inventoryStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
        gap: 4,
    },
    statusDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    inventoryText: {
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    actionContainer: {
        marginLeft: 6,
    },
    actionButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        minWidth: 64,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopLeftRadius: 6,
        borderBottomRightRadius: 6,
    },
    actionText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    lockedText: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '900',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    priceText: {
        fontSize: 10,
        fontWeight: '900',
    },
    cancelWrapper: {
        marginTop: 16,
        paddingVertical: 8,
        alignItems: 'center',
    },
    cancelText: {
        color: '#ef4444',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
    }
});