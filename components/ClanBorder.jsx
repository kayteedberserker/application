import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const ClanBorder = ({ 
    color = "#ff0000", 
    secondaryColor = null, // Used for clashes
    animationType = "singleSnake", // singleSnake, tripleChaser, clash, pulseCircuit, breathingYoyo
    snakeLength = 120, 
    duration = 3000,
    children 
}) => {
    const [layout, setLayout] = useState({ w: 0, h: 0 });
    
    // We use two master values. One loops 0 -> 1 continuously. One loops 0 -> 1 -> 0 (yoyo).
    const linearProgress = useSharedValue(0);
    const yoyoProgress = useSharedValue(0);

    // Calculate perimeter: 2 * (width + height)
    const perimeter = useMemo(() => {
        if (layout.w === 0) return 0;
        return 2 * (layout.w + layout.h);
    }, [layout]);

    useEffect(() => {
        if (perimeter > 0) {
            // Reset
            linearProgress.value = 0;
            yoyoProgress.value = 0;

            // Continuous loop
            linearProgress.value = withRepeat(
                withTiming(1, { duration: duration, easing: Easing.linear }),
                -1,
                false
            );

            // Back and forth loop
            yoyoProgress.value = withRepeat(
                withTiming(1, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) }),
                -1,
                true // true makes it yoyo (reverse)
            );
        }
    }, [perimeter, duration, animationType]);

    // ---------------------------------------------------------
    // ANIMATED PROPS (Offsets derived from the master progress)
    // ---------------------------------------------------------
    
    // Standard clockwise movement
    const clockwiseProps = useAnimatedProps(() => ({
        strokeDashoffset: linearProgress.value * -perimeter,
    }));

    // Counter-clockwise movement
    const counterClockwiseProps = useAnimatedProps(() => ({
        strokeDashoffset: linearProgress.value * perimeter,
    }));

    // Fast movement for circuits
    const fastClockwiseProps = useAnimatedProps(() => ({
        strokeDashoffset: linearProgress.value * -(perimeter * 2), // 2x speed
    }));

    // Yoyo movement (back and forth)
    const breathingProps = useAnimatedProps(() => ({
        strokeDashoffset: yoyoProgress.value * (perimeter / 2),
    }));

    const onLayout = (event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setLayout({ w: Math.round(width), h: Math.round(height) });
        }
    };

    // UI Tuning
    const strokeWidth = 3; 
    const radius = 28;
    const safePerimeter = Math.max(perimeter, 1000);

    // ---------------------------------------------------------
    // RENDER FACTORY FOR DIFFERENT ANIMATION TYPES
    // ---------------------------------------------------------
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
                // 3 evenly spaced lines
                const dash = perimeter / 6; 
                return (
                    <AnimatedRect {...baseProps} 
                        strokeDasharray={`${dash} ${dash}`} 
                        animatedProps={clockwiseProps} 
                    />
                );
            }
            case 'clash': {
                // 3 lines going clockwise, 3 lines going counter-clockwise
                const dash = perimeter / 6;
                const secColor = secondaryColor || color;
                return (
                    <>
                        {/* Clockwise layer */}
                        <AnimatedRect {...baseProps} 
                            strokeDasharray={`${dash} ${dash}`} 
                            animatedProps={clockwiseProps} 
                        />
                        {/* Counter-Clockwise intersecting layer */}
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
                // Asymmetrical dashes moving fast
                return (
                    <AnimatedRect {...baseProps} 
                        strokeDasharray={`10 15 30 15 5 20`} 
                        animatedProps={fastClockwiseProps} 
                    />
                );
            }
            case 'breathingYoyo': {
                // Lines that meet and retreat
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
                // Original single snake + glow
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
                <View style={StyleSheet.absoluteFill}>
                    <Svg width={layout.w} height={layout.h}>
                        {/* Subtle Background Path (Ghost line) */}
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
};

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