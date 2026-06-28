import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    Canvas,
    Group,
    Line,
    LinearGradient,
    Path,
    RoundedRect,
    Shadow,
    vec
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

export default function AnimatedItemIcon({ itemId, primaryColor, secondaryColor, size = 80 }) {

    // ⚡️ STRICT COLOR SANITIZATION (Prevents SkColor Native Crash)
    const safePrimary = (primaryColor && typeof primaryColor === 'string' && primaryColor.startsWith('#')) ? primaryColor : '#3b82f6';
    const safeSecondary = (secondaryColor && typeof secondaryColor === 'string' && secondaryColor.startsWith('#')) ? secondaryColor : '#1e1b4b';

    // --- REANIMATED SHARED VALUES ---
    const pulse = useSharedValue(1);
    const hardPulse = useSharedValue(1);
    const rotation = useSharedValue(0);

    // --- START ANIMATIONS ON MOUNT ---
    useEffect(() => {
        let isMounted = true;

        // ⚡️ De-couple from the render thread to stop "Should not already be working" crash
        requestAnimationFrame(() => {
            if (!isMounted) return;

            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.08, { duration: 1200 }),
                    withTiming(1, { duration: 1200 })
                ),
                -1,
                true
            );

            hardPulse.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 400 }),
                    withTiming(0.95, { duration: 400 })
                ),
                -1,
                true
            );

            rotation.value = withRepeat(
                withTiming(360, { duration: 3000, easing: Easing.linear }),
                -1,
                false
            );
        });

        return () => {
            isMounted = false;
            cancelAnimation(pulse);
            cancelAnimation(hardPulse);
            cancelAnimation(rotation);
        };
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
    const hardPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: hardPulse.value }] }));
    const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${rotation.value}deg` }] }));

    const scale = size / 100;

    const renderGraphic = () => {
        switch (itemId) {
            case 'streak_freeze':
                return (
                    <Animated.View style={[pulseStyle, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="flame" size={size * 0.9} color={safePrimary} style={styles.glow} />
                        <Animated.View style={[spinStyle, { position: 'absolute', top: -size * 0.01, right: -size * 0.01 }]}>
                            <Ionicons name="snow" size={size * 0.45} color="#ffffff" style={styles.sharpShadow} />
                        </Animated.View>
                    </Animated.View>
                );

            case 'streak_restore':
                return (
                    <Animated.View style={[hardPulseStyle, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="flame" size={size} color={safeSecondary} style={styles.heavyGlow} />
                        <View style={{ position: 'absolute', bottom: size * 0.1 }}>
                            <Ionicons name="flame" size={size * 0.6} color={safePrimary} />
                        </View>
                    </Animated.View>
                );

            case 'name_change_card':
                return (
                    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                        <Canvas style={{ width: size, height: size }}>
                            <Group transform={[{ scale }]}>
                                {/* Personal Identity Card Layout */}
                                <RoundedRect x={15} y={25} width={70} height={50} r={8} color={safePrimary}>
                                    <Shadow dx={0} dy={0} blur={15} color={safePrimary} />
                                    <LinearGradient start={vec(15, 25)} end={vec(85, 75)} colors={[safePrimary, safeSecondary]} />
                                </RoundedRect>
                                <RoundedRect x={25} y={45} width={15} height={10} r={2} color={safeSecondary} />
                                <Line p1={vec(45, 48)} p2={vec(75, 48)} color="#ffffff" style="stroke" strokeWidth={3} strokeCap="round" opacity={0.5} />
                                <Line p1={vec(45, 56)} p2={vec(65, 56)} color="#ffffff" style="stroke" strokeWidth={3} strokeCap="round" opacity={0.5} />
                            </Group>
                        </Canvas>
                    </View>
                );

            case 'clan_name_change':
                return (
                    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                        <Canvas style={{ width: size, height: size }}>
                            <Group transform={[{ scale }]}>
                                {/* 🛡️ Faction Master ID Card Base - Talled up slightly to 56px for breathing room */}
                                <RoundedRect x={15} y={22} width={70} height={56} r={10} color={safePrimary}>
                                    <Shadow dx={0} dy={0} blur={15} color={safePrimary} />
                                    <LinearGradient start={vec(15, 22)} end={vec(85, 78)} colors={[safeSecondary, safePrimary]} />
                                </RoundedRect>

                                {/* ⚡️ HAND-DRAWN VECCY "CLAN" TEXT (Re-spaced and perfectly centered vertically) */}
                                <Group color="#ffffff" style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round">
                                    {/* C */}
                                    <Path path="M 25 39 L 21 39 L 21 31 L 25 31" opacity={0.95} />
                                    {/* L */}
                                    <Path path="M 29 30 L 29 40 L 34 40" opacity={0.95} />
                                    {/* A */}
                                    <Path path="M 38 40 L 41 30 L 44 40 M 39.5 36 L 43 36" opacity={0.95} />
                                    {/* N */}
                                    <Path path="M 48 40 L 48 30 L 54 40 L 54 30" opacity={0.95} />
                                </Group>

                                {/* Tech Accent Diamond next to text to balance header geometry */}
                                <Path path="M 72 35 L 76 31 L 80 35 L 76 39 Z" color="#ffffff" opacity={0.4} style="fill" />

                                {/* System Divider Ribbon Line - Moved up for precise sectional symmetry */}
                                <Line p1={vec(15, 47)} p2={vec(85, 47)} color="#ffffff" style="stroke" strokeWidth={1} opacity={0.15} />

                                {/* Sub-array data logs - Configured with clean paddings away from edge bounds */}
                                <RoundedRect x={20} y={56} width={10} height={10} r={2.5} color={safePrimary} opacity={0.8} />
                                <Line p1={vec(36, 60)} p2={vec(79, 60)} color="#ffffff" style="stroke" strokeWidth={3.5} strokeCap="round" opacity={0.5} />
                                <Line p1={vec(36, 68)} p2={vec(66, 68)} color="#ffffff" style="stroke" strokeWidth={2.5} strokeCap="round" opacity={0.3} />
                            </Group>
                        </Canvas>
                    </View>
                );

            case 'name_lock':
                return (
                    <Animated.View style={[pulseStyle, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
                        <MaterialCommunityIcons name="link-variant" size={size * 0.8} color={safePrimary} style={styles.heavyGlow} />
                    </Animated.View>
                );

            case 'clan_name_lock':
                return (
                    <Animated.View style={[pulseStyle, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
                        <MaterialCommunityIcons name="link-variant" size={size * 0.8} color={safePrimary} style={styles.heavyGlow} />
                    </Animated.View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            {renderGraphic()}
        </View>
    );
}

const styles = StyleSheet.create({
    glow: {
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 10,
    },
    heavyGlow: {
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 15,
    },
    sharpShadow: {
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 5,
        elevation: 5,
    }
});