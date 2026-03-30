import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native'; // ⚡️ Added StyleSheet
import { SvgXml } from "react-native-svg";

export default function PlayerWatermark({ equippedWatermark, isDark }) {
    const animation = useRef(null);

    if (!equippedWatermark) return null;

    const watermarkVisual = equippedWatermark.visualConfig || {};
    const iconSize = watermarkVisual.size || 220;

    // Default color logic
    const iconColor = watermarkVisual.color || (isDark ? 'white' : 'black');

    // Determine if we are rendering Lottie, SVG, or an Icon
    const lottieData = watermarkVisual.lottieJson; // The JSON object itself
    const lottieSource = watermarkVisual.lottieUrl; // Or a link to the JSON file
    const isLottie = !!(lottieData || lottieSource);

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
                {isLottie ? (
                    <LottieView
                        autoPlay
                        loop
                        ref={animation}
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
                ) : (
                    <MaterialCommunityIcons
                        name={watermarkVisual.icon || 'fountain-pen-tip'}
                        size={iconSize}
                        color={iconColor}
                    />
                )}
            </View>
        </View>
    );
}