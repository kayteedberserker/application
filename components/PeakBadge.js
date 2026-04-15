import {
    Canvas,
    Group,
    LinearGradient,
    Mask,
    Path,
    Rect,
    Shadow,
    vec
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import {
    Easing,
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

// Automatically determines the color tier based on the user's Peak Level
const getBadgeTheme = (level) => {
    if (level < 3) return { name: 'Bronze', main: '#d97743', light: '#fca5a5', dark: '#7f1d1d' };
    if (level < 5) return { name: 'Silver', main: '#94a3b8', light: '#f8fafc', dark: '#334155' };
    if (level < 7) return { name: 'Gold', main: '#eab308', light: '#fef08a', dark: '#713f12' };
    if (level < 9) return { name: 'Amethyst', main: '#a855f7', light: '#e9d5ff', dark: '#4c1d95' };
    return { name: 'Emerald', main: '#22c55e', light: '#bbf7d0', dark: '#14532d' };
};

// ⚡️ HELPER: Generates a thick Chevron "V" shape path (Top origin)
const createChevronPath = (x, y, w, h) => {
    return `M ${x - w / 2} ${y} L ${x} ${y + h * 0.6} L ${x + w / 2} ${y} L ${x + w / 2} ${y + h * 0.4} L ${x} ${y + h} L ${x - w / 2} ${y + h * 0.4} Z`;
};

// ⚡️ HELPER: Generates a sharp Diamond path (Center origin)
const createDiamondPath = (x, y, r) => {
    return `M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`;
};

// Define the core component as a standard function first
function PeakBadgeComponent({ level = 1, size = 32, isFeed = false }) {
    const safeLevel = Math.max(1, level);

    // Memoize the theme selection
    const theme = useMemo(() => getBadgeTheme(safeLevel), [safeLevel]);

    const progress = useSharedValue(-0.5);

    useEffect(() => {
        if (isFeed) {
            progress.value = 0.5; // Freeze the light sweep in the center
            return;
        }

        progress.value = withRepeat(
            withTiming(1.5, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            -1,
            false
        );
    }, [progress, isFeed]);

    // ⚡️ DYNAMIC DIMENSION MATH & PATH GENERATION (MEMOIZED)
    const layout = useMemo(() => {
        const w = size;
        const h = size * 1.2;

        let widthMultiplier = 1.0;
        if (safeLevel >= 9) widthMultiplier = 1.8;
        else if (safeLevel >= 3) widthMultiplier = 1.6;

        const cw = size * widthMultiplier;
        const offsetX = (cw - w) / 2;
        const cx = cw / 2;
        const cy = h / 2;

        const hexPath = `M ${offsetX + w / 2} 0 L ${offsetX + w} ${h * 0.25} L ${offsetX + w} ${h * 0.75} L ${offsetX + w / 2} ${h} L ${offsetX} ${h * 0.75} L ${offsetX} ${h * 0.25} Z`;

        const inset = size * 0.15;
        const innerH = h - inset * 2;
        const innerHexPath = `M ${offsetX + w / 2} ${inset} L ${offsetX + w - inset} ${inset + innerH * 0.25} L ${offsetX + w - inset} ${inset + innerH * 0.75} L ${offsetX + w / 2} ${h - inset} L ${offsetX + inset} ${inset + innerH * 0.75} L ${offsetX + inset} ${inset + innerH * 0.25} Z`;

        let wingsPath = '';
        if (safeLevel >= 3) {
            wingsPath += `M ${cx} ${cy - h * 0.2} L ${cx + w * 0.8} ${cy - h * 0.5} L ${cx + w * 0.6} ${cy} L ${cx} ${cy + h * 0.1} Z `;
            wingsPath += `M ${cx} ${cy - h * 0.2} L ${cx - w * 0.8} ${cy - h * 0.5} L ${cx - w * 0.6} ${cy} L ${cx} ${cy + h * 0.1} Z `;
        }
        if (safeLevel >= 7) {
            wingsPath += `M ${cx} ${cy} L ${cx + w * 0.7} ${cy + h * 0.2} L ${cx + w * 0.5} ${cy + h * 0.5} L ${cx} ${cy + h * 0.2} Z `;
            wingsPath += `M ${cx} ${cy} L ${cx - w * 0.7} ${cy + h * 0.2} L ${cx - w * 0.5} ${cy + h * 0.5} L ${cx} ${cy + h * 0.2} Z `;
        }
        if (safeLevel >= 9) {
            wingsPath += `M ${cx} ${cy - h * 0.1} L ${cx + w * 0.9} ${cy - h * 0.2} L ${cx + w * 0.8} ${cy - h * 0.1} L ${cx} ${cy} Z `;
            wingsPath += `M ${cx} ${cy - h * 0.1} L ${cx - w * 0.9} ${cy - h * 0.2} L ${cx - w * 0.8} ${cy - h * 0.1} L ${cx} ${cy} Z `;
        }

        // ====================================================================
        // ⚡️ DYNAMIC LAYOUT ENGINE (Smart Scaling & Grids)
        // ====================================================================
        const chevronCount = Math.floor(safeLevel / 5);
        const diamondCount = safeLevel % 5;

        // 1. Calculate Rows
        const rows = [];
        for (let i = 0; i < chevronCount; i++) rows.push({ type: 'chevron' });

        if (diamondCount === 1) rows.push({ type: 'diamond', count: 1 });
        else if (diamondCount === 2) rows.push({ type: 'diamond', count: 2 });
        else if (diamondCount === 3) { rows.push({ type: 'diamond', count: 2 }); rows.push({ type: 'diamond', count: 1 }); }
        else if (diamondCount === 4) { rows.push({ type: 'diamond', count: 2 }); rows.push({ type: 'diamond', count: 2 }); }

        const totalRowsCount = rows.length;

        // 2. Determine Scale based on total elements
        let scaleMultiplier = 1.0;
        if (totalRowsCount === 1) scaleMultiplier = 1.25; // Massive single indicator
        else if (totalRowsCount === 2) scaleMultiplier = 0.95; // Side by side or 2 rows
        else if (totalRowsCount === 3) scaleMultiplier = 0.75; // Triangle + Chevron
        else scaleMultiplier = 0.6; // Heavy stacking

        // 3. Size variables with scaling applied
        const chevronW = size * 0.5 * scaleMultiplier;
        const chevronH = size * 0.2 * scaleMultiplier;
        const diamondR = size * 0.12 * scaleMultiplier;
        const gap = size * 0.08 * scaleMultiplier;
        const diamondSpacing = diamondR * 2.2; // Space between side-by-side diamonds

        // 4. Calculate Total Height to perfectly vertically center the cluster
        let totalStackHeight = 0;
        rows.forEach(row => {
            totalStackHeight += (row.type === 'chevron' ? chevronH : diamondR * 2) + gap;
        });
        totalStackHeight -= gap; // Remove trailing gap

        let currentY = cy - (totalStackHeight / 2);
        let indicatorPaths = '';

        // 5. Draw the Rows
        rows.forEach(row => {
            if (row.type === 'chevron') {
                indicatorPaths += createChevronPath(cx, currentY, chevronW, chevronH) + ' ';
                currentY += chevronH + gap;
            } else {
                if (row.count === 1) {
                    indicatorPaths += createDiamondPath(cx, currentY + diamondR, diamondR) + ' ';
                } else if (row.count === 2) {
                    indicatorPaths += createDiamondPath(cx - diamondSpacing / 2, currentY + diamondR, diamondR) + ' ';
                    indicatorPaths += createDiamondPath(cx + diamondSpacing / 2, currentY + diamondR, diamondR) + ' ';
                }
                currentY += (diamondR * 2) + gap;
            }
        });

        return { cw, h, w, offsetX, wingsPath, hexPath, innerHexPath, indicatorPaths };
    }, [safeLevel, size]);

    // Extract layout values
    const { cw, h, w, offsetX, wingsPath, hexPath, innerHexPath, indicatorPaths } = layout;

    const startPos = useDerivedValue(() => {
        return { x: progress.value * cw, y: 0 };
    });

    const endPos = useDerivedValue(() => {
        return { x: (progress.value + 0.3) * cw, y: h };
    });

    return (
        <View style={{ width: cw, height: h, justifyContent: 'center', alignItems: 'center' }}>
            <Canvas style={{ width: cw, height: h }}>

                {/* ⚡️ THE WINGS */}
                {safeLevel >= 3 && (
                    <Path path={wingsPath}>
                        <LinearGradient
                            start={vec(0, 0)}
                            end={vec(cw, 0)}
                            colors={[theme.dark, theme.main, theme.dark]}
                        />
                    </Path>
                )}

                {/* Outer Bevel */}
                <Path path={hexPath}>
                    <LinearGradient
                        start={vec(offsetX, 0)}
                        end={vec(offsetX + w, h)}
                        colors={[theme.light, theme.dark]}
                    />
                </Path>

                {/* Inner Core */}
                <Path path={innerHexPath}>
                    <LinearGradient
                        start={vec(offsetX + w, 0)}
                        end={vec(offsetX, h)}
                        colors={[theme.main, theme.dark]}
                    />
                </Path>

                {/* ⚡️ THE DYNAMIC INSIGNIAS */}
                <Path path={indicatorPaths} color="#FFFFFF">
                    <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.5)" />
                </Path>

                {/* Mask for the sweeping light effect */}
                <Mask mode="luminance" mask={
                    <Group>
                        {safeLevel >= 3 && <Path path={wingsPath} color="white" opacity={0.6} />}
                        <Path path={hexPath} color="white" />
                        <Path path={indicatorPaths} color="white" />
                    </Group>
                }>
                    <Rect x={0} y={0} width={cw} height={h}>
                        <LinearGradient
                            start={startPos}
                            end={endPos}
                            colors={['transparent', 'rgba(255,255,255,0.7)', 'transparent']}
                        />
                    </Rect>
                </Mask>

                {/* Soft highlight */}
                <Path path={innerHexPath} opacity={0.3}>
                    <LinearGradient
                        start={vec(offsetX, 0)}
                        end={vec(offsetX, h / 2)}
                        colors={['#ffffff', 'transparent']}
                    />
                </Path>
            </Canvas>
        </View>
    );
}

// Export the memoized version of the component safely
export default memo(PeakBadgeComponent);