import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation, // ⚡️ ADDED: For thread cleanup
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ⚡️ PERFORMANCE FIX 1: Memoize the entire component
const ClanBorder = React.memo(({
    color = "#ff0000",
    secondaryColor = null,
    animationType = "singleSnake",
    snakeLength = 120,
    duration = 3000,
    children
}) => {
    const [layout, setLayout] = useState({ w: 0, h: 0 });

    const linearProgress = useSharedValue(0);
    const yoyoProgress = useSharedValue(0);

    const perimeter = useMemo(() => {
        if (layout.w === 0) return 0;
        return 2 * (layout.w + layout.h);
    }, [layout.w, layout.h]);

    useEffect(() => {
        if (perimeter > 0) {
            linearProgress.value = 0;
            yoyoProgress.value = 0;

            linearProgress.value = withRepeat(
                withTiming(1, { duration: duration, easing: Easing.linear }),
                -1,
                false
            );

            yoyoProgress.value = withRepeat(
                withTiming(1, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        }

        // ⚡️ PERFORMANCE FIX 2: Cleanup animations on unmount
        // This is vital for maintaining 60fps on your Infinix device
        return () => {
            cancelAnimation(linearProgress);
            cancelAnimation(yoyoProgress);
        };
    }, [perimeter, duration, animationType]);

    // ---------------------------------------------------------
    // ANIMATED PROPS (Offsets derived from the master progress)
    // ---------------------------------------------------------

    const clockwiseProps = useAnimatedProps(() => ({
        strokeDashoffset: linearProgress.value * -perimeter,
    }));

    const counterClockwiseProps = useAnimatedProps(() => ({
        strokeDashoffset: linearProgress.value * perimeter,
    }));

    const fastClockwiseProps = useAnimatedProps(() => ({
        strokeDashoffset: linearProgress.value * -(perimeter * 2),
    }));

    const breathingProps = useAnimatedProps(() => ({
        strokeDashoffset: yoyoProgress.value * (perimeter / 2),
    }));

    // ⚡️ PERFORMANCE FIX 3: Optimized Layout Guard
    const onLayout = (event) => {
        const { width, height } = event.nativeEvent.layout;
        const roundedW = Math.round(width);
        const roundedH = Math.round(height);

        // Only update state if the dimensions actually changed to avoid thrashing
        if (roundedW !== layout.w || roundedH !== layout.h) {
            setLayout({ w: roundedW, h: roundedH });
        }
    };

    const strokeWidth = 3;
    const radius = 28;
    const safePerimeter = Math.max(perimeter, 1000);

    const renderAnimatedPaths = () => {
        const baseProps = {
            x: strokeWidth / 2, y: strokeWidth / 2,
            width: layout.w - strokeWidth, height: layout.h - strokeWidth,
            rx: radius, ry: radius,
            stroke: color, strokeWidth: strokeWidth, fill: "none",
            strokeLinecap: "round"
        };

        switch (animationType) {
            case 'tripleChaser': {
                const dash = perimeter / 6;
                return (
                    <AnimatedRect {...baseProps}
                        strokeDasharray={`${dash} ${dash}`}
                        animatedProps={clockwiseProps}
                    />
                );
            }
            case 'clash': {
                const dash = perimeter / 6;
                const secColor = secondaryColor || color;
                return (
                    <>
                        <AnimatedRect {...baseProps}
                            strokeDasharray={`${dash} ${dash}`}
                            animatedProps={clockwiseProps}
                        />
                        <AnimatedRect {...baseProps}
                            stroke={secColor}
                            strokeOpacity={0.8}
                            strokeDasharray={`${dash} ${dash}`}
                            animatedProps={counterClockwiseProps}
                        />
                    </>
                );
            }
            case 'pulseCircuit': {
                return (
                    <AnimatedRect {...baseProps}
                        strokeDasharray={`10 15 30 15 5 20`}
                        animatedProps={fastClockwiseProps}
                    />
                );
            }
            case 'breathingYoyo': {
                const dash = perimeter / 8;
                return (
                    <AnimatedRect {...baseProps}
                        strokeDasharray={`${dash} ${dash}`}
                        animatedProps={breathingProps}
                    />
                );
            }
            case 'singleSnake':
            default: {
                return (
                    <>
                        <AnimatedRect {...baseProps}
                            strokeWidth={strokeWidth + 2} strokeOpacity={0.3}
                            strokeDasharray={`${snakeLength} ${safePerimeter}`}
                            animatedProps={clockwiseProps}
                        />
                        <AnimatedRect {...baseProps}
                            strokeDasharray={`${snakeLength} ${safePerimeter}`}
                            animatedProps={clockwiseProps}
                        />
                    </>
                );
            }
        }
    };

    return (
        <View onLayout={onLayout} style={styles.container}>
            {layout.w > 0 && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Svg width={layout.w} height={layout.h}>
                        <Rect
                            x={strokeWidth / 2}
                            y={strokeWidth / 2}
                            width={layout.w - strokeWidth}
                            height={layout.h - strokeWidth}
                            rx={radius}
                            ry={radius}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeOpacity={0.1}
                            fill="none"
                        />
                        {renderAnimatedPaths()}
                    </Svg>
                </View>
            )}
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: '100%',
        position: 'relative',
    },
    content: {
        width: '100%',
        padding: 4,
    },
});

export default ClanBorder;