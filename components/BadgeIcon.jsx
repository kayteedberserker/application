// BadgeIcon.jsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import React, { useMemo } from 'react'; // Added useMemo
import { View } from 'react-native';
import { SvgXml } from "react-native-svg";

// 1. Optimized RemoteSvgIcon
// Added useMemo to handle potential color logic and ensure stability
const RemoteSvgIcon = React.memo(({ xml, size = 50, color }) => {
    const processedXml = useMemo(() => {
        if (!xml || typeof xml !== 'string' || !xml.includes('<svg')) return null;
        // Even if you don't use 'currentColor' now, keeping this logic 
        // memoized prevents re-parsing the XML string on every render.
        return color ? xml.replace(/currentColor/g, color) : xml;
    }, [xml, color]);

    if (!processedXml) {
        return <MaterialCommunityIcons name="help-circle-outline" size={size} color="gray" />;
    }

    return <SvgXml xml={processedXml} width={size} height={size} />;
});

// 2. Memoized Rarity Logic
// Wrapping this in a helper is good, but we want to make sure it doesn't 
// create new strings constantly if not needed.
const getRarityColors = (rarity) => {
    switch (rarity?.toLowerCase()) {
        case 'mythic': return 'bg-red-500/20 border-red-500/40';
        case 'legendary': return 'bg-amber-500/20 border-amber-500/40';
        case 'epic': return 'bg-purple-500/20 border-purple-500/40';
        case 'rare': return 'bg-blue-500/20 border-blue-500/40';
        default: return 'bg-gray-500/20 border-gray-400/40';
    }
};

export default function BadgeIcon({ badge, size = 25, containerStyle, isDark }) {
    if (!badge) return null;

    // 3. Memoize the Visual Data lookup
    // This prevents the object lookups from running on every single frame during a scroll.
    const visual = useMemo(() => badge.visualConfig || badge.visualData || {}, [badge]);

    const lottieData = visual.lottieJson;
    const lottieSource = visual.lottieUrl;

    // 4. Memoize Lottie Source Object
    // IMPORTANT: Providing { uri: lottieSource } directly in the prop creates 
    // a NEW object on every render. This forces Lottie to re-load/flicker.
    const source = useMemo(() => {
        if (lottieData) return lottieData;
        if (lottieSource) return { uri: lottieSource };
        return null;
    }, [lottieData, lottieSource]);

    const isLottie = !!source;

    return (
        <View style={containerStyle}>
            {isLottie ? (
                <LottieView
                    autoPlay
                    loop
                    renderMode="hardware" // 🔥 Essential for Infinix GPU performance
                    style={{ width: size * 1.5, height: size * 1.5 }}
                    source={source}
                    resizeMode="contain"
                />
            ) : visual.svgCode ? (
                <RemoteSvgIcon xml={visual.svgCode} size={size} />
            ) : null}
        </View>
    );
}