import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native'; // ⚡️ Added StyleSheet
import { SvgXml } from "react-native-svg";

export default function PlayerWatermark({ equippedWatermark, isDark, isFeed = false }) {
    const animation = useRef(null);

    if (!equippedWatermark) return null;

    const watermarkVisual = equippedWatermark.visualConfig || {};

    // Determine if we have Lottie data
    const lottieData = watermarkVisual.lottieJson;
    const lottieSource = watermarkVisual.lottieUrl;
    const hasLottie = !!(lottieData || lottieSource);

    // If there's no Lottie, no SVG, and no icon name provided, return null to avoid the fountain-pen fallback
    if (!hasLottie && !watermarkVisual.svgCode && !watermarkVisual.icon) {
        return null;
    }

    const iconSize = watermarkVisual.size || 220;
    const iconColor = watermarkVisual.color || (isDark ? 'white' : 'black');

    return (
        // ⚡️ FIX 1: The outer wrapper strictly fills the card background and hides any overflow
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 0 }]} pointerEvents="none">

            {/* ⚡️ FIX 2: The actual watermark sits safely inside without stretching the layout box */}
            <View
                className="absolute"
                style={{
                    bottom: -20,
                    right: -20,
                    opacity: watermarkVisual.opacity || 0.5,
                    transform: [
                        { rotate: watermarkVisual.rotation || '-15deg' },
                        { scale: watermarkVisual.scale || 1 }
                    ]
                }}
            >
                {hasLottie ? (
                    <LottieView
                        autoPlay={!isFeed}
                        loop={!isFeed}
                        ref={animation}
                        renderMode="hardware"
                        style={{
                            width: iconSize * 1.2,
                            height: iconSize * 1.2,
                        }}
                        // Load from JSON object or URL
                        source={lottieData ? lottieData : { uri: lottieSource }}
                        // Some Lotties allow color filters, but it depends on how the JSON was made
                        colorFilters={watermarkVisual.applyThemeColor ? [
                            { keypath: "**", color: iconColor }
                        ] : []}
                    />
                ) : watermarkVisual.svgCode ? (
                    <SvgXml
                        xml={watermarkVisual.svgCode.replace(/currentColor/g, iconColor)}
                        width={iconSize}
                        height={iconSize}
                    />
                ) : watermarkVisual.icon ? (
                    // Only render the icon if a specific name is provided in visualConfig
                    <MaterialCommunityIcons
                        name={watermarkVisual.icon}
                        size={iconSize}
                        color={iconColor}
                    />
                ) : null}
            </View>
        </View>
    );
}