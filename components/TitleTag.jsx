import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const TITLE_TIERS = {
    MYTHIC: { colors: ['#7f1d1d', '#dc2626'], border: '#ef4444', text: '#fee2e2', glow: '#ff0000' },
    LEGENDARY: { colors: ['#451a03', '#92400e'], border: '#fbbf24', text: '#fbbf24', glow: '#f59e0b' },
    EPIC: { colors: ['#2e1065', '#701a75'], border: '#d946ef', text: '#d946ef', glow: '#8b5cf6' },
    RARE: { colors: ['#172554', '#1e40af'], border: '#3b82f6', text: '#60a5fa', glow: '#3b82f6' },
    COMMON: { colors: ['#1f2937', '#111827'], border: '#9ca3af', text: '#9ca3af', glow: 'transparent' }
};

const TitleTag = ({
    rank = 11,
    isTop10 = false,
    auraVisuals = null,
    activeGlowColor = null,
    equippedTitle = null,
    title = null,
    tier = null,
    size = 10,
    style,
    isDark = true, // Added isDark prop for theming
    ...props
}) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const sweepAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(0);

    const finalTitle = title || equippedTitle?.name;
    const finalTier = (tier || equippedTitle?.tier || 'COMMON').toUpperCase();
    const config = useMemo(() => TITLE_TIERS[finalTier] || TITLE_TIERS.COMMON, [finalTier]);

    const isMythic = finalTier === 'MYTHIC';
    const isLegendary = finalTier === 'LEGENDARY';
    const isEpic = finalTier === 'EPIC';
    const isRare = finalTier === 'RARE';

    // Animation Flag Logic - Memoized for optimization
    const animFlags = useMemo(() => ({
        hasSweep: isMythic || isLegendary || (isTop10 && rank <= 5),
        hasPulse: isMythic || isEpic || isRare || (isTop10 && (rank <= 2 || (rank >= 6 && rank <= 10)))
    }), [isMythic, isLegendary, isEpic, isRare, isTop10, rank]);

    const scale = size / 10;
    const paddingX = isMythic ? 22 * scale : 14 * scale;
    const paddingY = 6.5 * scale;
    const minContainerHeight = size * 2.3;
    const iconSize = size + 2;
    const letterSpacing = isMythic ? 1.2 * scale : 0.5 * scale;

    useEffect(() => {
        if (animFlags.hasSweep) {
            sweepAnim.value = withRepeat(
                withTiming(1, { duration: isMythic ? 2000 : 3000, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
                -1,
                false
            );
        } else {
            sweepAnim.value = 0;
        }

        if (animFlags.hasPulse) {
            pulseAnim.value = withRepeat(
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
                -1,
                true
            );
        } else {
            pulseAnim.value = 0;
        }
    }, [animFlags, isMythic]);

    const paths = useMemo(() => {
        if (dimensions.width === 0) return { main: '', hex: '' };

        const getPathData = (w, h, m, type) => {
            const s = 6 * scale;
            const width = w - m * 2;
            const height = h - m * 2;

            if (isMythic && type === 'hex') {
                const horizPadding = 2 * scale;
                const hS = 8 * scale;
                const hexW = width - (horizPadding * 2);
                const startX = m + horizPadding;
                return `M ${hS + startX},${m} L ${hexW - hS + startX},${m} L ${hexW + startX},${height / 2 + m} L ${hexW - hS + startX},${height + m} L ${hS + startX},${height + m} L ${startX},${height / 2 + m} Z`;
            }

            if (isMythic || isLegendary || isEpic || isTop10) {
                return `M ${s + m},${m} L ${width - s + m},${m} L ${width + m},${height * 0.3 + m} L ${width - (s / 2) + m},${height / 2 + m} L ${width + m},${height * 0.7 + m} L ${width - s + m},${height + m} L ${s + m},${height + m} L ${m},${height * 0.7 + m} L ${s / 2 + m},${height / 2 + m} L ${m},${height * 0.3 + m} Z`;
            } else if (isRare) {
                return `M ${s + m},${m} L ${width + m},${m} L ${width - s + m},${height / 2 + m} L ${width + m},${height + m} L ${m},${height + m} L ${s + m},${height / 2 + m} L ${m},${m} Z`;
            }
            return `M ${m},${m} L ${width - s + m},${m} L ${width + m},${height / 2 + m} L ${width - s + m},${height + m} L ${m},${height + m} L ${s / 2 + m},${height / 2 + m} Z`;
        };

        const hexM = isMythic ? 2.5 * scale : 0;
        return {
            main: getPathData(dimensions.width, dimensions.height, 3, 'main'),
            hex: getPathData(dimensions.width, dimensions.height, hexM, 'hex')
        };
    }, [dimensions, isMythic, isLegendary, isEpic, isRare, isTop10, scale]);

    const pulseStyle = useAnimatedStyle(() => {
        if (!animFlags.hasPulse) return {};
        return {
            transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.04]) }],
            opacity: interpolate(pulseAnim.value, [0, 1], [0.9, 1]),
        };
    });

    const animatedShineProps = useAnimatedProps(() => ({
        x: interpolate(sweepAnim.value, [0, 1], [-dimensions.width, dimensions.width])
    }));

    const FrameBase = ({ color, children }) => {
        // Theme-aware colors
        const bgThemeColor = isDark ? "rgba(10, 10, 10, 0.92)" : "rgba(245, 245, 245, 0.95)";
        const innerStrokeColor = isDark ? "#0a0a0a" : "#ffffff";
        const strokeColor = color || (isDark ? '#ffffff' : '#000000');

        return (
            <View style={styles.frameWrapper}>
                <View style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
                    {dimensions.width > 0 && (
                        <Svg width={dimensions.width} height={dimensions.height}>
                            <Defs>
                                <Mask id="shapeMask">
                                    <Path d={isMythic ? paths.hex : paths.main} fill="white" />
                                </Mask>
                                <LinearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
                                    <Stop offset="0" stopColor="white" stopOpacity="0" />
                                    <Stop offset="0.5" stopColor="white" stopOpacity={isMythic ? 0.6 : 0.4} />
                                    <Stop offset="1" stopColor="white" stopOpacity="0" />
                                </LinearGradient>
                                <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                                    <Stop offset="0" stopColor={config.colors[0]} />
                                    <Stop offset="1" stopColor={config.colors[1]} />
                                </LinearGradient>
                            </Defs>

                            {/* Background Layers */}
                            <Path d={isMythic ? paths.hex : paths.main} fill="url(#bgGrad)" mask="url(#shapeMask)" />
                            <Path d={isMythic ? paths.hex : paths.main} fill={bgThemeColor} mask="url(#shapeMask)" />

                            {/* Hex Border for Mythic */}
                            {isMythic && (
                                <Path d={paths.hex} fill="none" stroke={strokeColor} strokeWidth={1.5 * scale} opacity={0.8} />
                            )}

                            {/* Main Borders */}
                            <Path d={paths.main} fill="none" stroke={strokeColor} strokeWidth={3 * scale} opacity={0.6} />
                            <Path d={paths.main} fill="none" stroke={innerStrokeColor} strokeWidth={1.8 * scale} />
                            <Path d={paths.main} fill="none" stroke={strokeColor} strokeWidth={0.8 * scale} />

                            {/* Shine Effect */}
                            {animFlags.hasSweep && (
                                <G mask="url(#shapeMask)">
                                    <AnimatedRect
                                        width={dimensions.width / 2}
                                        height={dimensions.height}
                                        fill="url(#shineGrad)"
                                        animatedProps={animatedShineProps}
                                    />
                                </G>
                            )}
                        </Svg>
                    )}
                </View>
                {children}
            </View>
        );
    };

    if (auraVisuals) {
        if (auraVisuals.label == "PLAYER") {
            return null;
        }
    }

    if (isTop10 && auraVisuals) {
        const finalColor = activeGlowColor || auraVisuals.color || '#fbbf24';
        return (
            <Animated.View
                onLayout={(e) => setDimensions({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                style={[
                    styles.outerContainer,
                    {
                        shadowColor: finalColor,
                        shadowOpacity: 0.5,
                        elevation: 8,
                        shadowRadius: 4 * scale
                    },
                    pulseStyle,
                    style
                ]}
                {...props}
            >
                <FrameBase color={finalColor}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: paddingX, paddingVertical: paddingY, minHeight: minContainerHeight }}>
                        {auraVisuals.icon && <MaterialCommunityIcons name={auraVisuals.icon} size={iconSize} color={finalColor} style={{ marginRight: 4 }} />}
                        <Text style={[styles.textBase, { color: finalColor, fontSize: size, lineHeight: size * 1.3, letterSpacing, textShadowColor: finalColor, textShadowRadius: 2 }]}>
                            {auraVisuals.label.toUpperCase()}
                        </Text>
                    </View>
                </FrameBase>
            </Animated.View>
        );
    }

    if (finalTitle) {
        return (
            <Animated.View
                onLayout={(e) => setDimensions({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                style={[
                    styles.outerContainer,
                    pulseStyle,
                    {
                        shadowColor: config.glow || 'transparent',
                        shadowOpacity: (isMythic || isLegendary || isEpic) ? 0.8 : 0,
                        elevation: (isMythic || isLegendary || isEpic) ? 12 : 0,
                        shadowRadius: isMythic ? 8 * scale : 3 * scale
                    },
                    style
                ]}
                {...props}
            >
                <FrameBase color={config.border}>
                    <View style={[styles.tagContainer, { paddingHorizontal: paddingX, paddingVertical: paddingY, minHeight: minContainerHeight }]}>
                        <Text style={[
                            styles.textBase,
                            {
                                color: config.text,
                                fontSize: size,
                                lineHeight: size * 1.3,
                                letterSpacing,
                                textShadowColor: config.glow || 'transparent',
                                textShadowRadius: (isMythic || isLegendary || isEpic) ? 8 : 2
                            }
                        ]}>
                            {finalTitle.toUpperCase()}
                        </Text>
                    </View>
                </FrameBase>
            </Animated.View>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    outerContainer: { alignSelf: 'flex-start', overflow: 'visible' },
    frameWrapper: { alignItems: 'center', justifyContent: 'center' },
    tagContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    textBase: { fontWeight: '900' }
});

export default TitleTag;