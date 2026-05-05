import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';
import { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation // ⚡️ ADDED: For thread cleanup
    ,

    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { SvgXml } from "react-native-svg";

const PlayerWatermark = memo(({ equippedWatermark, isDark, isFeed = false }) => {
    const animation = useRef(null);
    const entranceOpacity = useSharedValue(0); // ⚡️ Entrance animation (Loading state)

    useEffect(() => {
        // ⚡️ Entrance animation serves as our "loading to ready" transition
        entranceOpacity.value = withTiming(1, {
            duration: 1000,
            easing: Easing.out(Easing.exp)
        });

        // ⚡️ CLEANUP: Cancel the entrance animation if the component unmounts
        // This prevents the UI thread from working on a component that's no longer on screen.
        return () => {
            cancelAnimation(entranceOpacity);
        };
    }, []);

    if (!equippedWatermark) return null;

    const watermarkVisual = equippedWatermark.visualConfig || {};

    const lottieData = watermarkVisual.lottieJson;
    const lottieSource = watermarkVisual.lottieUrl;
    const hasLottie = !!(lottieData || lottieSource);

    if (!hasLottie && !watermarkVisual.svgCode && !watermarkVisual.icon) {
        return null;
    }

    const iconSize = watermarkVisual.size || 220;
    const iconColor = watermarkVisual.color || (isDark ? 'white' : 'black');

    // ⚡️ PERFORMANCE: Memoize Lottie source to prevent heavy re-parsing
    const memoizedLottieSource = useMemo(() =>
        lottieData ? lottieData : { uri: lottieSource },
        [lottieData, lottieSource]
    );

    // ⚡️ PERFORMANCE: Memoize SVG string replacement
    const processedSvg = useMemo(() => {
        if (!watermarkVisual.svgCode) return null;
        return watermarkVisual.svgCode.replace(/currentColor/g, iconColor);
    }, [watermarkVisual.svgCode, iconColor]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: entranceOpacity.value * (watermarkVisual.opacity || 0.5)
    }));

    return (
        // ⚡️ FIX 1: The outer wrapper strictly fills the card background and hides any overflow
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 0 }]} pointerEvents="none">

            {/* ⚡️ FIX 2: The actual watermark sits safely inside without stretching the layout box */}
            <Animated.View
                className="absolute"
                style={[
                    animatedStyle,
                    {
                        bottom: -20,
                        right: -20,
                        transform: [
                            { rotate: watermarkVisual.rotation || '-15deg' },
                            { scale: watermarkVisual.scale || 1 }
                        ]
                    }
                ]}
            >
                {hasLottie ? (
                    <LottieView
                        // ⚡️ Only animate if we aren't in the feed to keep scrolling smooth
                        autoPlay={!isFeed}
                        loop={!isFeed}
                        ref={animation}
                        renderMode="hardware"
                        style={{
                            width: iconSize * 1.2,
                            height: iconSize * 1.2,
                        }}
                        source={memoizedLottieSource}
                        colorFilters={watermarkVisual.applyThemeColor ? [
                            { keypath: "**", color: iconColor }
                        ] : []}
                    />
                ) : processedSvg ? (
                    <SvgXml
                        xml={processedSvg}
                        width={iconSize}
                        height={iconSize}
                    />
                ) : watermarkVisual.icon ? (
                    <MaterialCommunityIcons
                        name={watermarkVisual.icon}
                        size={iconSize}
                        color={iconColor}
                    />
                ) : null}
            </Animated.View>
        </View>
    );
});

PlayerWatermark.displayName = 'PlayerWatermark';

export default PlayerWatermark;