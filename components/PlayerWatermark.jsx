import React, { useRef } from 'react';
import { View } from 'react-native';
import { SvgXml } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';

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
        <View 
            className="absolute" 
            style={{ 
                bottom: -20, // Pushed a bit further for better "corner" look
                right: -20, 
                opacity: watermarkVisual.opacity || 0.5, 
                transform: [
                    { rotate: watermarkVisual.rotation || '-15deg' },
                    { scale: watermarkVisual.scale || 1 }
                ]
            }} 
            pointerEvents="none"
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
    );
}