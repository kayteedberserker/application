// BadgeIcon.jsx
import React from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SvgXml } from "react-native-svg";

const RemoteSvgIcon = ({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color="gray" />;
    return <SvgXml xml={xml} width={size} height={size} />;
};

// ⚡️ NEW: Helper function to determine badge background based on rarity
const getRarityColors = (rarity) => {
    switch (rarity?.toLowerCase()) {
        case 'mythic':
            return 'bg-red-500/20 border-red-500/40'; // Red
        case 'legendary':
            return 'bg-amber-500/20 border-amber-500/40'; // Gold/Amber
        case 'epic':
            return 'bg-purple-500/20 border-purple-500/40'; // Purple
        case 'rare':
            return 'bg-blue-500/20 border-blue-500/40'; // Blue
        case 'common':
        default:
            return 'bg-gray-500/20 border-gray-400/40'; // Grey
    }
};

export default function BadgeIcon({ badge, size = 25, containerStyle, isDark }) {
    if (!badge) return null;

    // Support both the old format (visualData) and the new format (visualConfig)
    const visual = badge.visualConfig || badge.visualData || {};
    
    // Check if it's a Lottie file
    const lottieData = visual.lottieJson;
    const lottieSource = visual.lottieUrl;
    const isLottie = !!(lottieData || lottieSource);

    // Get the dynamic color classes
    const rarityColors = getRarityColors(badge.rarity);
    
    return (
        <View 
            className={`${rarityColors} p-1 rounded-full border items-center justify-center ${containerStyle || ''}`}
            style={{ width: size + 8, height: size + 8 }} // Container slightly larger than icon
        >
            {isLottie ? (
                <LottieView
                    autoPlay
                    loop
                    style={{ width: size * 1.5, height: size * 1.5 }} // Scale Lottie slightly up to fill the badge circle
                    source={lottieData ? lottieData : { uri: lottieSource }}
                    resizeMode="contain"
                />
            ) : visual.svgCode ? (
                <RemoteSvgIcon xml={visual.svgCode} size={size} />
            ) : null}
        </View>
    );
}