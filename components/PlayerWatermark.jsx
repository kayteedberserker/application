import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import LottieView from 'lottie-react-native';
import { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native'; // ⚡️ ADDED: Image
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { SvgXml } from "react-native-svg";

const PlayerWatermark = memo(({ equippedWatermark, isDark, isFeed = false }) => {

    const animation = useRef(null);
    const entranceOpacity = useSharedValue(0);

    useEffect(() => {
        entranceOpacity.value = withTiming(1, {
            duration: 1000,
            easing: Easing.out(Easing.exp)
        });

        return () => {
            cancelAnimation(entranceOpacity);
        };
    }, []);

    // ⚡️ Safely extract visual config values up here using optional chaining
    const watermarkVisual = equippedWatermark?.visualConfig || {};
    const imageUrl = equippedWatermark?.url || watermarkVisual.imageUrl;

    const lottieData = watermarkVisual.lottieJson;
    const lottieSource = watermarkVisual.lottieUrl;
    const hasLottie = !!(lottieData || lottieSource);

    const iconSize = watermarkVisual.size || 220;
    const iconColor = watermarkVisual.color || (isDark ? 'white' : 'black');

    // ⚡️ HOOKS MOVED TO THE TOP (Must run unconditionally on every single render)
    const memoizedLottieSource = useMemo(() =>
        lottieData ? lottieData : { uri: lottieSource },
        [lottieData, lottieSource]
    );

    const processedSvg = useMemo(() => {
        if (!watermarkVisual.svgCode) return null;
        return watermarkVisual.svgCode.replace(/currentColor/g, iconColor);
    }, [watermarkVisual.svgCode, iconColor]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: entranceOpacity.value * (watermarkVisual.opacity || 0.5)
    }));

    // ⚡️ EARLY RETURNS (Placed strictly AFTER all hook calls)
    if (!equippedWatermark) return null;

    if (!imageUrl && !hasLottie && !watermarkVisual.svgCode && !watermarkVisual.icon) {
        return null;
    }

    return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 0 }]} pointerEvents="none">
            <Animated.View
                className="absolute"
                style={[
                    animatedStyle,
                    {
                        bottom: -20,
                        right: -20,
                        transform: [
                            { rotate: watermarkVisual.rotation || '-15deg' },
                            { scale: watermarkVisual.zoom || 1 }
                        ]
                    }
                ]}
            >
                {/* 1. STATIC IMAGE (WebP/Cloudinary) - Prioritize over Lottie/SVG */}
                {imageUrl ? (
                    <Image
                        source={{ uri: imageUrl }}
                        style={{
                            width: iconSize,
                            height: iconSize,
                        }}
                        resizeMode="contain"
                    />
                ) : hasLottie ? (
                    <LottieView
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

export default PlayerWatermark;