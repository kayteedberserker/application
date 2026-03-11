import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
    Canvas,
    Path,
    LinearGradient,
    vec,
    Mask
} from '@shopify/react-native-skia';
import {
    useSharedValue,
    withRepeat,
    withTiming,
    Easing,
    useDerivedValue
} from 'react-native-reanimated';

// Automatically determines the color tier based on the user's Peak Level
const getBadgeTheme = (level) => {
    if (level < 3) return { name: 'Bronze', main: '#d97743', light: '#fca5a5', dark: '#7f1d1d' };
    if (level < 5) return { name: 'Silver', main: '#94a3b8', light: '#f8fafc', dark: '#334155' };
    if (level < 7) return { name: 'Gold',   main: '#eab308', light: '#fef08a', dark: '#713f12' };
    if (level < 9) return { name: 'Amethyst', main: '#a855f7', light: '#e9d5ff', dark: '#4c1d95' };
    return { name: 'Emerald', main: '#22c55e', light: '#bbf7d0', dark: '#14532d' };
};

export default function PeakBadge({ level = 1, size = 32 }) {
    const theme = getBadgeTheme(level);

    // Reanimated value for the shine effect (-0.5 starts it off-screen to the left)
    const progress = useSharedValue(-0.5);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1.5, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            -1, // Infinite loop
            false // Don't reverse, just restart
        );
    }, [progress]);

    // ⚡️ STRETCHED HEXAGON
    // By setting height to size * 1.2, it becomes a taller, more elegant shield shape
    const w = size;
    const h = size * 1.2; 
    
    // Outer Hexagon
    const hexPath = `M ${w/2} 0 L ${w} ${h*0.25} L ${w} ${h*0.75} L ${w/2} ${h} L 0 ${h*0.75} L 0 ${h*0.25} Z`;
    
    // Inner Hexagon for the bevel effect
    const inset = size * 0.15;
    const innerH = h - inset*2;
    const innerHexPath = `M ${w/2} ${inset} L ${w-inset} ${inset + innerH*0.25} L ${w-inset} ${inset + innerH*0.75} L ${w/2} ${h-inset} L ${inset} ${inset + innerH*0.75} L ${inset} ${inset + innerH*0.25} Z`;

    // ⚡️ SAFE ANIMATION FIX: Return pure {x, y} objects instead of using vec() which causes crashes in some Skia versions
    const startPos = useDerivedValue(() => {
        return { x: progress.value * w, y: 0 };
    });

    const endPos = useDerivedValue(() => {
        return { x: (progress.value + 0.3) * w, y: h };
    });

    return (
        // Wrapper View matches the new elongated height (size * 1.2)
        <View style={{ width: size, height: size * 1.2, justifyContent: 'center', alignItems: 'center' }}>
            
            <Canvas style={{ position: 'absolute', width: '100%', height: '100%' }}>
                
                {/* Outer Bevel (The Metallic Rim) */}
                <Path path={hexPath}>
                    <LinearGradient
                        start={vec(0, 0)}
                        end={vec(w, h)}
                        colors={[theme.light, theme.dark]}
                    />
                </Path>

                {/* Inner Core (The colored crystal) */}
                <Path path={innerHexPath}>
                    <LinearGradient
                        start={vec(w, 0)}
                        end={vec(0, h)}
                        colors={[theme.main, theme.dark]}
                    />
                </Path>

                {/* ⚡️ The Skia Masked Glint (The shining light beam) */}
                <Mask mask={<Path path={innerHexPath} color="white" />}>
                    <Path path={innerHexPath}>
                        <LinearGradient
                            start={startPos}
                            end={endPos}
                            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)']}
                        />
                    </Path>
                </Mask>

                {/* Top-down soft highlight for glassmorphism */}
                <Path path={innerHexPath} opacity={0.3}>
                    <LinearGradient
                        start={vec(0, 0)}
                        end={vec(0, h/2)}
                        colors={['#ffffff', 'rgba(255,255,255,0)']}
                    />
                </Path>
            </Canvas>

            {/* ⚡️ REACT NATIVE LAYER: Highly styled default text floating over the canvas */}
            <Text 
                style={[
                    styles.badgeText, 
                    { 
                        fontSize: size * 0.45,
                        textShadowColor: theme.dark // Uses the crest's dark color to create the shadow
                    }
                ]}
            >
                {level}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badgeText: {
        color: '#FFFFFF',
        fontWeight: '900', // Maximum thickness
        fontStyle: 'italic', // Gives it that forward-leaning gaming aesthetic
        textAlign: 'center',
        // Deep drop shadow makes it look embossed into the metal
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 1,
        letterSpacing: -0.5,
    }
});