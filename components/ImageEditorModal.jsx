import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Canvas, ColorMatrix, Group, Image, PaintStyle, Path, Rect, Skia, Text as SkiaText, useFont, useImage } from "@shopify/react-native-skia";
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { makeMutable, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue } from "react-native-reanimated";
import ViewShot from "react-native-view-shot";
import { Text } from "./Text";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = [
    "#ffffff", "#ef4444", "#f97316", "#facc15",
    "#22c55e", "#06b6d4", "#3b82f6", "#6366f1",
    "#a855f7", "#ec4899", "#71717a", "#000000"
];

// --- ⚡️ Color Matrices ---
const GRAYSCALE = [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
];

const SEPIA = [
    0.393, 0.769, 0.189, 0, 0,
    0.349, 0.686, 0.168, 0, 0,
    0.272, 0.534, 0.131, 0, 0,
    0, 0, 0, 1, 0,
];

const WARM = [
    1.2, 0, 0, 0, 0,
    0, 1.0, 0, 0, 0,
    0, 0, 0.8, 0, 0,
    0, 0, 0, 1, 0,
];

const COOL = [
    0.8, 0, 0, 0, 0,
    0, 1.0, 0, 0, 0,
    0, 0, 1.2, 0, 0,
    0, 0, 0, 1, 0,
];

const VINTAGE = [
    0.9, 0.5, 0.1, 0, 0,
    0.3, 0.8, 0.1, 0, 0,
    0.2, 0.3, 0.5, 0, 0,
    0, 0, 0, 1, 0,
];

const FILTER_OPTIONS = [
    { id: 'none', label: 'Normal', matrix: null, icon: 'cancel' },
    { id: 'grayscale', label: 'B&W', matrix: GRAYSCALE, icon: 'image-filter-black-white' },
    { id: 'sepia', label: 'Sepia', matrix: SEPIA, icon: 'image-filter-vintage' },
    { id: 'warm', label: 'Warm', matrix: WARM, icon: 'white-balance-sunny' },
    { id: 'cool', label: 'Cool', matrix: COOL, icon: 'snowflake' },
    { id: 'vintage', label: 'Vintage', matrix: VINTAGE, icon: 'camera-gopro' },
];

// --- ⚡️ Font Assets ---
const fontAssets = [
    require('../assets/fonts/SpaceGrotesk.ttf'),
    require('../assets/fonts/Caveat-Regular.ttf'),
    require('../assets/fonts/GreatVibes-Regular.ttf'),
    require('../assets/fonts/ArchitectsDaughter-Regular.ttf'),
    require('../assets/fonts/Monofett-Regular.ttf'),
];

const BASE_FONT_SIZE = 40;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;

// ⚡️ Sub-Component Optimized for Scaling and Performance
const CanvasTextBlock = ({ tb, fonts, isSelected, selectionPaint, handlePaint }) => {
    const fontToUse = fonts[tb.fontIndex] || fonts[0];
    const padding = 10;
    const handleSize = 8;

    // Moving the entire group handles scaling smoothly without double-offsetting coordinates
    const transform = useDerivedValue(() => [
        { translateX: tb.x.value },
        { translateY: tb.y.value },
        { scale: tb.scale.value }
    ]);

    const rectX = -padding;
    const rectY = -tb.th - padding;
    const rectW = tb.baseWidth + padding * 2;
    const rectH = tb.th + tb.descent + padding * 2;

    const h1x = rectX - handleSize / 2;
    const h1y = rectY - handleSize / 2;
    const h2x = rectX + rectW - handleSize / 2;
    const h2y = rectY - handleSize / 2;
    const h3x = rectX - handleSize / 2;
    const h3y = rectY + rectH - handleSize / 2;
    const h4x = rectX + rectW - handleSize / 2;
    const h4y = rectY + rectH - handleSize / 2;

    return (
        <Group transform={transform}>
            <SkiaText font={fontToUse} x={0} y={0} text={tb.text} color={tb.color} />
            {isSelected && (
                <Group>
                    <Rect x={rectX} y={rectY} width={rectW} height={rectH} paint={selectionPaint} />
                    <Rect x={h1x} y={h1y} width={handleSize} height={handleSize} paint={handlePaint} />
                    <Rect x={h2x} y={h2y} width={handleSize} height={handleSize} paint={handlePaint} />
                    <Rect x={h3x} y={h3y} width={handleSize} height={handleSize} paint={handlePaint} />
                    <Rect x={h4x} y={h4y} width={handleSize} height={handleSize} paint={handlePaint} />
                </Group>
            )}
        </Group>
    );
};

const ImageEditorModal = ({ isVisible, onClose, imageUri, onSave }) => {
    const skiaImage = useImage(imageUri);
    const viewShotRef = React.useRef();

    const font0 = useFont(fontAssets[0], BASE_FONT_SIZE);
    const font1 = useFont(fontAssets[1], BASE_FONT_SIZE);
    const font2 = useFont(fontAssets[2], BASE_FONT_SIZE);
    const font3 = useFont(fontAssets[3], BASE_FONT_SIZE);
    const font4 = useFont(fontAssets[4], BASE_FONT_SIZE);

    const fonts = useMemo(() => [font0, font1, font2, font3, font4].filter(f => f !== null), [font0, font1, font2, font3, font4]);

    const [tool, setTool] = useState('brush');
    const [brushColor, setBrushColor] = useState(COLORS[1]);
    const [filter, setFilter] = useState('none');
    const [paths, setPaths] = useState([]);

    const [textBlocks, setTextBlocks] = useState([]);
    const [isTextPromptVisible, setIsTextPromptVisible] = useState(false);
    const [isEditingExisting, setIsEditingExisting] = useState(false);
    const [newTextInput, setNewTextInput] = useState('');

    const selectedTextId = useSharedValue(null);
    const activeTextOffset = useSharedValue({ x: 0, y: 0 });
    const startScale = useSharedValue(1);

    // New shared values for directional corner scaling
    const isResizingText = useSharedValue(false);
    const textCenterStart = useSharedValue({ x: 0, y: 0 });
    const textStartVector = useSharedValue({ x: 0, y: 0 });

    const [selectedTextIdState, setSelectedTextIdState] = useState(null);

    const [baseDim, setBaseDim] = useState({ w: 0, h: 0 });
    const [cropState, setCropState] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const [isLoaded, setIsLoaded] = useState(false);

    const emptyPath = useMemo(() => Skia.Path.Make(), []);
    const activePath = useSharedValue(emptyPath);
    const [isDrawing, setIsDrawing] = useState(false);

    const cropT = useSharedValue(0);
    const cropL = useSharedValue(0);
    const cropB = useSharedValue(0);
    const cropR = useSharedValue(0);

    const cropStartT = useSharedValue(0);
    const cropStartL = useSharedValue(0);
    const cropStartB = useSharedValue(0);
    const cropStartR = useSharedValue(0);
    const cropHandle = useSharedValue(0);

    const resetAll = () => {
        setPaths([]);
        setTextBlocks([]);
        setTool('brush');
        setBrushColor(COLORS[1]);
        setFilter('none');
        selectedTextId.value = null;
        setSelectedTextIdState(null); // Fix: removed invalid runOnJS wrapper
        if (baseDim.w > 0) {
            setCropState({ x: 0, y: 0, w: baseDim.w, h: baseDim.h });
            const INSET = 20;
            cropL.value = INSET;
            cropT.value = INSET;
            cropR.value = baseDim.w - INSET;
            cropB.value = baseDim.h - INSET;
        }
    };

    useEffect(() => {
        if (isVisible) resetAll();
    }, [isVisible]);

    useEffect(() => {
        if (skiaImage) {
            const imgW = skiaImage.width();
            const imgH = skiaImage.height();
            const ratio = imgW / imgH;

            let targetW = SCREEN_WIDTH * 0.9;
            let targetH = targetW / ratio;

            if (targetH > SCREEN_HEIGHT * 0.65) {
                targetH = SCREEN_HEIGHT * 0.65;
                targetW = targetH * ratio;
            }

            setBaseDim({ w: targetW, h: targetH });
            setCropState({ x: 0, y: 0, w: targetW, h: targetH });

            const INSET = 20;
            cropL.value = INSET;
            cropT.value = INSET;
            cropR.value = targetW - INSET;
            cropB.value = targetH - INSET;

            setIsLoaded(true);
        }
    }, [skiaImage]);

    const isCropping = tool === 'crop';
    const activeW = isCropping ? baseDim.w : cropState.w;
    const activeH = isCropping ? baseDim.h : cropState.h;

    let displayW = SCREEN_WIDTH * 0.9;
    let displayH = SCREEN_HEIGHT * 0.65;
    let visualScale = 1;

    if (activeW > 0 && activeH > 0) {
        const activeRatio = activeW / activeH;
        displayH = displayW / activeRatio;

        if (displayH > SCREEN_HEIGHT * 0.65) {
            displayH = SCREEN_HEIGHT * 0.65;
            displayW = displayH * activeRatio;
        }
        visualScale = displayW / activeW;
    }

    const dimTop = useAnimatedStyle(() => ({
        position: 'absolute', top: 0, left: 0, right: 0, height: cropT.value * visualScale, backgroundColor: 'rgba(0,0,0,0.6)'
    }));
    const dimBottom = useAnimatedStyle(() => ({
        position: 'absolute', bottom: 0, left: 0, right: 0, height: (baseDim.h - cropB.value) * visualScale, backgroundColor: 'rgba(0,0,0,0.6)'
    }));
    const dimLeft = useAnimatedStyle(() => ({
        position: 'absolute', top: cropT.value * visualScale, bottom: (baseDim.h - cropB.value) * visualScale, left: 0, width: cropL.value * visualScale, backgroundColor: 'rgba(0,0,0,0.6)'
    }));
    const dimRight = useAnimatedStyle(() => ({
        position: 'absolute', top: cropT.value * visualScale, bottom: (baseDim.h - cropB.value) * visualScale, right: 0, width: (baseDim.w - cropR.value) * visualScale, backgroundColor: 'rgba(0,0,0,0.6)'
    }));

    const cropBoxStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        top: cropT.value * visualScale,
        left: cropL.value * visualScale,
        width: Math.max((cropR.value - cropL.value) * visualScale, 0),
        height: Math.max((cropB.value - cropT.value) * visualScale, 0),
        borderWidth: 2,
        borderColor: 'white',
        backgroundColor: 'rgba(255,255,255,0.1)'
    }));

    const cropGesture = Gesture.Pan()
        .enabled(isCropping)
        .onStart((g) => {
            cropStartT.value = cropT.value;
            cropStartL.value = cropL.value;
            cropStartB.value = cropB.value;
            cropStartR.value = cropR.value;

            const touchX = g.x / visualScale;
            const touchY = g.y / visualScale;
            const t = 40 / visualScale;

            const isL = Math.abs(touchX - cropL.value) < t;
            const isR = Math.abs(touchX - cropR.value) < t;
            const isT = Math.abs(touchY - cropT.value) < t;
            const isB = Math.abs(touchY - cropB.value) < t;

            if (isL && isT) cropHandle.value = 1;
            else if (isR && isT) cropHandle.value = 2;
            else if (isL && isB) cropHandle.value = 3;
            else if (isR && isB) cropHandle.value = 4;
            else if (isT) cropHandle.value = 6;
            else if (isB) cropHandle.value = 7;
            else if (isL) cropHandle.value = 8;
            else if (isR) cropHandle.value = 9;
            else if (touchX > cropL.value && touchX < cropR.value && touchY > cropT.value && touchY < cropB.value) {
                cropHandle.value = 5;
            } else {
                cropHandle.value = 0;
            }
        })
        .onUpdate((g) => {
            const minSize = 60;
            const dx = g.translationX / visualScale;
            const dy = g.translationY / visualScale;

            if (cropHandle.value === 1) {
                cropL.value = Math.min(Math.max(0, cropStartL.value + dx), cropR.value - minSize);
                cropT.value = Math.min(Math.max(0, cropStartT.value + dy), cropB.value - minSize);
            } else if (cropHandle.value === 2) {
                cropR.value = Math.max(Math.min(baseDim.w, cropStartR.value + dx), cropL.value + minSize);
                cropT.value = Math.min(Math.max(0, cropStartT.value + dy), cropB.value - minSize);
            } else if (cropHandle.value === 3) {
                cropL.value = Math.min(Math.max(0, cropStartL.value + dx), cropR.value - minSize);
                cropB.value = Math.max(Math.min(baseDim.h, cropStartB.value + dy), cropT.value + minSize);
            } else if (cropHandle.value === 4) {
                cropR.value = Math.max(Math.min(baseDim.w, cropStartR.value + dx), cropL.value + minSize);
                cropB.value = Math.max(Math.min(baseDim.h, cropStartB.value + dy), cropT.value + minSize);
            }
            else if (cropHandle.value === 6) {
                cropT.value = Math.min(Math.max(0, cropStartT.value + dy), cropB.value - minSize);
            } else if (cropHandle.value === 7) {
                cropB.value = Math.max(Math.min(baseDim.h, cropStartB.value + dy), cropT.value + minSize);
            } else if (cropHandle.value === 8) {
                cropL.value = Math.min(Math.max(0, cropStartL.value + dx), cropR.value - minSize);
            } else if (cropHandle.value === 9) {
                cropR.value = Math.max(Math.min(baseDim.w, cropStartR.value + dx), cropL.value + minSize);
            }
            else if (cropHandle.value === 5) {
                const w = cropStartR.value - cropStartL.value;
                const h = cropStartB.value - cropStartT.value;
                let newL = cropStartL.value + dx;
                let newT = cropStartT.value + dy;

                if (newL < 0) newL = 0;
                if (newL + w > baseDim.w) newL = baseDim.w - w;
                if (newT < 0) newT = 0;
                if (newT + h > baseDim.h) newT = baseDim.h - h;

                cropL.value = newL;
                cropR.value = newL + w;
                cropT.value = newT;
                cropB.value = newT + h;
            }
        });

    const applyCrop = () => {
        setCropState({
            x: cropL.value,
            y: cropT.value,
            w: cropR.value - cropL.value,
            h: cropB.value - cropT.value
        });
        setTool('brush');
    };

    const undo = () => {
        setPaths(prev => prev.slice(0, -1));
    };

    const finalizePath = (skPath, colorVal) => {
        if (!skPath || skPath.isEmpty()) {
            setIsDrawing(false);
            return;
        }
        setPaths(prev => [...prev, { path: skPath, color: colorVal }]);
        setIsDrawing(false);
        activePath.value = emptyPath;
    };

    const drawGesture = Gesture.Pan()
        .enabled(tool === 'brush')
        .onStart((g) => {
            const p = Skia.Path.Make();
            const mapX = (g.x / visualScale) + (isCropping ? 0 : cropState.x);
            const mapY = (g.y / visualScale) + (isCropping ? 0 : cropState.y);
            p.moveTo(mapX, mapY);
            activePath.value = p;
            runOnJS(setIsDrawing)(true); // Correct: Inside worklet
        })
        .onUpdate((g) => {
            const currentP = activePath.value;
            if (currentP && currentP !== emptyPath) {
                const mapX = (g.x / visualScale) + (isCropping ? 0 : cropState.x);
                const mapY = (g.y / visualScale) + (isCropping ? 0 : cropState.y);
                currentP.lineTo(mapX, mapY);
                activePath.value = currentP.copy();
            }
        })
        .onFinalize(() => {
            if (activePath.value !== emptyPath) {
                runOnJS(finalizePath)(activePath.value.copy(), brushColor); // Correct
            } else {
                runOnJS(setIsDrawing)(false); // Correct
            }
        });

    const textGestDrag = Gesture.Pan()
        .enabled(tool === 'text')
        .onStart((g) => {
            if (fonts.length === 0 || textBlocks.length === 0) return;

            const mapX = (g.x / visualScale) + (isCropping ? 0 : cropState.x);
            const mapY = (g.y / visualScale) + (isCropping ? 0 : cropState.y);

            isResizingText.value = false;

            // 1. Check if we hit the handles of the CURRENTLY selected text to initiate resizing
            if (selectedTextId.value) {
                const currentTb = textBlocks.find(t => t.id === selectedTextId.value);
                if (currentTb) {
                    const scale = currentTb.scale.value;
                    const p = 10; // Matches padding in CanvasTextBlock

                    const left = currentTb.x.value - (p * scale);
                    const right = currentTb.x.value + (currentTb.baseWidth + p) * scale;
                    const top = currentTb.y.value - (currentTb.th + p) * scale;
                    const bottom = currentTb.y.value + (currentTb.descent + p) * scale;

                    const handleHitRadius = 35 / visualScale; // Forgiving touch target for corners

                    const hitTL = Math.hypot(mapX - left, mapY - top) < handleHitRadius;
                    const hitTR = Math.hypot(mapX - right, mapY - top) < handleHitRadius;
                    const hitBL = Math.hypot(mapX - left, mapY - bottom) < handleHitRadius;
                    const hitBR = Math.hypot(mapX - right, mapY - bottom) < handleHitRadius;

                    if (hitTL || hitTR || hitBL || hitBR) {
                        isResizingText.value = true;

                        // Accurately pinpoint the center of the bounding box
                        const boxTop = currentTb.y.value - (currentTb.th * scale);
                        const boxBottom = currentTb.y.value + (currentTb.descent * scale);

                        textCenterStart.value = {
                            x: currentTb.x.value + (currentTb.baseWidth * scale) / 2,
                            y: (boxTop + boxBottom) / 2
                        };

                        // Record the initial directional vector from the center to the touched handle
                        textStartVector.value = {
                            x: mapX - textCenterStart.value.x,
                            y: mapY - textCenterStart.value.y
                        };

                        startScale.value = scale;
                        return; // We hit a handle, so don't check for standard dragging
                    }
                }
            }

            // 2. Normal drag selection check if we didn't hit a handle
            let foundId = null;
            let grabOffsetX = 0;
            let grabOffsetY = 0;

            for (let i = textBlocks.length - 1; i >= 0; i--) {
                const tb = textBlocks[i];
                const scale = tb.scale.value;
                const p = 25 / visualScale;

                const left = tb.x.value - p * scale;
                const right = tb.x.value + (tb.baseWidth + p) * scale;
                const top = tb.y.value - (tb.th + p) * scale;
                const bottom = tb.y.value + (tb.descent + p) * scale;

                const isInside = mapX > left && mapX < right && mapY > top && mapY < bottom;

                if (isInside) {
                    foundId = tb.id;
                    grabOffsetX = mapX - tb.x.value;
                    grabOffsetY = mapY - tb.y.value;
                    break;
                }
            }

            selectedTextId.value = foundId;
            activeTextOffset.value = { x: grabOffsetX, y: grabOffsetY };
            runOnJS(setSelectedTextIdState)(foundId); // Correct
        })
        .onUpdate((g) => {
            const currentId = selectedTextId.value;
            if (!currentId) return;

            const mapX = (g.x / visualScale) + (isCropping ? 0 : cropState.x);
            const mapY = (g.y / visualScale) + (isCropping ? 0 : cropState.y);

            const tb = textBlocks.find(t => t.id === currentId);
            if (!tb) return;

            if (isResizingText.value) {
                // Calculate the current directional vector
                const currentVecX = mapX - textCenterStart.value.x;
                const currentVecY = mapY - textCenterStart.value.y;

                const startVecX = textStartVector.value.x;
                const startVecY = textStartVector.value.y;

                // Use the Dot Product to calculate scaling relative to the specific corner's quadrant!
                const dotProduct = (currentVecX * startVecX) + (currentVecY * startVecY);
                const startDistSq = (startVecX * startVecX) + (startVecY * startVecY);

                if (startDistSq > 0) {
                    const scaleFactor = dotProduct / startDistSq;
                    let nextScale = startScale.value * scaleFactor;
                    nextScale = Math.max(MIN_SCALE, Math.min(nextScale, MAX_SCALE));
                    tb.scale.value = nextScale;
                }
            } else {
                // Normal drag updates
                const newX = mapX - activeTextOffset.value.x;
                const newY = mapY - activeTextOffset.value.y;
                tb.x.value = newX;
                tb.y.value = newY;
            }
        });

    const textGestTap = Gesture.Tap()
        .enabled(tool === 'text')
        .onStart((g) => {
            if (fonts.length === 0 || textBlocks.length === 0) return;

            const mapX = (g.x / visualScale) + (isCropping ? 0 : cropState.x);
            const mapY = (g.y / visualScale) + (isCropping ? 0 : cropState.y);

            let foundId = null;

            for (let i = textBlocks.length - 1; i >= 0; i--) {
                const tb = textBlocks[i];
                const scale = tb.scale.value;
                const p = 15 / visualScale;

                const left = tb.x.value - p * scale;
                const right = tb.x.value + (tb.baseWidth + p) * scale;
                const top = tb.y.value - (tb.th + p) * scale;
                const bottom = tb.y.value + (tb.descent + p) * scale;

                const isInside = mapX > left && mapX < right && mapY > top && mapY < bottom;

                if (isInside) {
                    foundId = tb.id;
                    break;
                }
            }

            if (foundId) {
                selectedTextId.value = foundId; // Still mutate shared value on UI thread
                runOnJS(setSelectedTextIdState)(foundId) // Call combined JS handler once
            } else {
                selectedTextId.value = null;
                runOnJS(setSelectedTextIdState)(null); // Correct usage
            }
        });

    const handleTextTap = React.useCallback((id) => {
        // Call both state setter and editor prompt on the JS thread
        setSelectedTextIdState(id);

        // This part should also have been using a stable reference but for now we look into finding the tb
        const tb = textBlocks.find(t => t.id === id);

        if (!tb) return;

        setNewTextInput(tb.text);
        setIsEditingExisting(true);
        setIsTextPromptVisible(true);
    }, [textBlocks]); // Depends only on textBlocks state

    // Removed pinch, updated exclusive gesture tree
    const textGestures = Gesture.Exclusive(
        textGestTap,
        textGestDrag
    );

    const openAddPrompt = () => {
        setSelectedTextIdState(null); // Fix: Removed runOnJS
        selectedTextId.value = null;
        setNewTextInput('');
        setIsEditingExisting(false);
        setIsTextPromptVisible(true);
    };

    const openEditPrompt = React.useCallback((id) => {
        // textBlocks can still be accessed, just make sure to add it as a dependency
        const tb = textBlocks.find(b => b.id === id);
        if (tb) {
            setNewTextInput(tb.text);
            setIsEditingExisting(true);
            setIsTextPromptVisible(true);
        }
    }, [textBlocks]); // Add dependencies that, when changed, should recreate the function

    const confirmAddOrEdit = () => {
        if (!newTextInput || newTextInput.trim() === '') {
            if (isEditingExisting) deleteSelectedText();
            setIsTextPromptVisible(false);
            return;
        }

        // Fix: Guard against missing fonts
        if (!fonts || fonts.length === 0) {
            setIsTextPromptVisible(false);
            return;
        }

        const fontIndex = isEditingExisting ? (textBlocks.find(t => t.id === selectedTextId.value)?.fontIndex || 0) : 0;
        const fontToUse = fonts[fontIndex] || fonts[0];

        const tw = fontToUse.getTextWidth(newTextInput);
        const th = BASE_FONT_SIZE * 0.8;
        const descent = BASE_FONT_SIZE * 0.2;

        if (isEditingExisting) {
            const currentId = selectedTextId.value;
            setTextBlocks(prev => prev.map(tb =>
                tb.id === currentId ? { ...tb, text: newTextInput, baseWidth: tw, th, descent } : tb
            ));
        } else {
            const newText = {
                id: Date.now(),
                text: newTextInput,
                x: makeMutable(cropState.x + (cropState.w / 2) - (tw / 2)),
                y: makeMutable(cropState.y + (cropState.h / 2)),
                color: '#ffffff',
                scale: makeMutable(1),
                fontIndex: 0,
                baseWidth: tw,
                th,
                descent
            };
            setTextBlocks(prev => [...prev, newText]);
            const newId = newText.id;
            selectedTextId.value = newId;
            setSelectedTextIdState(newId); // Fix: Removed runOnJS
        }
        setIsTextPromptVisible(false);
    };

    const deleteSelectedText = () => {
        const currentId = selectedTextId.value;
        if (!currentId) return;
        setTextBlocks(prev => prev.filter(tb => tb.id !== currentId));
        selectedTextId.value = null;
        setSelectedTextIdState(null); // Fix: Removed runOnJS
    };

    const changeSelectedTextColor = (colorVal) => {
        const currentId = selectedTextId.value;
        if (!currentId) {
            setBrushColor(colorVal);
            return;
        }
        setTextBlocks(prev => prev.map(tb =>
            tb.id === currentId ? { ...tb, color: colorVal } : tb
        ));
    };

    const changeSelectedTextFont = () => {
        const currentId = selectedTextId.value;
        if (!currentId || fonts.length <= 1) return;
        setTextBlocks(prev => prev.map(tb => {
            if (tb.id === currentId) {
                const nextFontIndex = (tb.fontIndex + 1) % fonts.length;
                const nextFont = fonts[nextFontIndex] || fonts[0];
                const newWidth = nextFont.getTextWidth(tb.text);
                return { ...tb, fontIndex: nextFontIndex, baseWidth: newWidth };
            }
            return tb;
        }));
    };

    const handleSave = async () => {
        selectedTextId.value = null;
        setSelectedTextIdState(null); // Fix: Removed runOnJS

        if (!viewShotRef.current) return;

        // Fix: Give the UI one frame to actually hide the selection box before saving
        await new Promise(resolve => requestAnimationFrame(resolve));

        try {
            const uri = await viewShotRef.current.capture();
            onSave(uri);
        } catch (error) {
            console.error("Capture failed", error);
        }
    };

    const selectionPaint = useMemo(() => {
        const p = Skia.Paint();
        p.setColor(Skia.Color("white"));
        p.setStyle(PaintStyle.Stroke);
        p.setStrokeWidth(2);
        const effect = Skia.PathEffect.MakeDash([10, 5], 0);
        p.setPathEffect(effect);
        return p;
    }, []);

    const handlePaint = useMemo(() => {
        const p = Skia.Paint();
        p.setColor(Skia.Color("white"));
        p.setStyle(PaintStyle.Fill);
        return p;
    }, []);

    return (
        <Modal visible={isVisible} transparent animationType="fade">
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.container}>

                    <View className="flex-row justify-between items-center px-6 pt-14 pb-4">
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                        <Text className="text-white font-black uppercase italic text-sm">Forge Artifact</Text>
                        <TouchableOpacity onPress={handleSave} className="bg-blue-600 px-6 py-2 rounded-full">
                            <Text className="text-white font-black uppercase text-xs">Save</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="flex-1 justify-center items-center">
                        {!isLoaded && (
                            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', zIndex: 10 }]}>
                                <ActivityIndicator size="large" color="#ffffff" />
                            </View>
                        )}

                        <View style={[styles.canvasWrapper, { width: displayW, height: displayH }]}>
                            {isLoaded && skiaImage && (
                                <ViewShot
                                    ref={viewShotRef}
                                    options={{ format: 'jpg', quality: 1.0 }}
                                    style={{ width: displayW, height: displayH, backgroundColor: '#000', overflow: 'hidden' }}
                                >
                                    <GestureDetector gesture={Gesture.Race(textGestures, drawGesture, cropGesture)}>
                                        <View style={{ width: displayW, height: displayH }}>
                                            <Canvas style={{ width: displayW, height: displayH, backgroundColor: 'transparent' }}>
                                                <Group transform={[{ scale: visualScale }]}>
                                                    <Group transform={[
                                                        { translateX: isCropping ? 0 : -cropState.x },
                                                        { translateY: isCropping ? 0 : -cropState.y }
                                                    ]}>

                                                        {filter === 'none' ? (
                                                            <Image image={skiaImage} x={0} y={0} width={baseDim.w} height={baseDim.h} fit="fill" />
                                                        ) : (
                                                            <Image image={skiaImage} x={0} y={0} width={baseDim.w} height={baseDim.h} fit="fill">
                                                                <ColorMatrix matrix={FILTER_OPTIONS.find(f => f.id === filter)?.matrix || GRAYSCALE} />
                                                            </Image>
                                                        )}

                                                        {paths.map((p, i) => (
                                                            <Path key={i} path={p.path} color={p.color} style="stroke" strokeWidth={5} strokeCap="round" />
                                                        ))}

                                                        {isDrawing && (
                                                            <Path path={activePath} color={brushColor} style="stroke" strokeWidth={5} strokeCap="round" />
                                                        )}

                                                        {fonts.length > 0 && textBlocks.map((tb) => (
                                                            <CanvasTextBlock
                                                                key={tb.id}
                                                                tb={tb}
                                                                fonts={fonts}
                                                                isSelected={tb.id === selectedTextIdState}
                                                                selectionPaint={selectionPaint}
                                                                handlePaint={handlePaint}
                                                            />
                                                        ))}

                                                    </Group>
                                                </Group>
                                            </Canvas>

                                            {isCropping && (
                                                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                                                    <Animated.View style={dimTop} />
                                                    <Animated.View style={dimBottom} />
                                                    <Animated.View style={dimLeft} />
                                                    <Animated.View style={dimRight} />

                                                    <Animated.View style={cropBoxStyle}>
                                                        <View style={styles.cropGrid}>
                                                            <View style={styles.gridLineH} />
                                                            <View style={styles.gridLineH2} />
                                                            <View style={styles.gridLineV} />
                                                            <View style={styles.gridLineV2} />

                                                            <View style={[styles.corner, { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 }]} />
                                                            <View style={[styles.corner, { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 }]} />
                                                            <View style={[styles.corner, { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
                                                            <View style={[styles.corner, { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 }]} />
                                                        </View>
                                                    </Animated.View>
                                                </View>
                                            )}
                                        </View>
                                    </GestureDetector>
                                </ViewShot>
                            )}
                        </View>
                    </View>

                    <View className="px-6 pb-10">
                        <View className="flex-row items-center justify-between mb-6">

                            {tool === 'brush' && (
                                <>
                                    <TouchableOpacity onPress={undo} className="bg-white/10 p-4 rounded-2xl">
                                        <MaterialCommunityIcons name="undo" size={24} color="white" />
                                    </TouchableOpacity>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 ml-4">
                                        {COLORS.map((c) => (
                                            <TouchableOpacity
                                                key={c}
                                                onPress={() => setBrushColor(c)}
                                                style={[styles.colorCircle, { backgroundColor: c, borderColor: brushColor === c ? 'white' : 'transparent' }]}
                                            />
                                        ))}
                                    </ScrollView>
                                    <TouchableOpacity onPress={resetAll} className="bg-red-500/10 p-4 rounded-2xl ml-4">
                                        <Ionicons name="refresh" size={24} color="#ef4444" />
                                    </TouchableOpacity>
                                </>
                            )}

                            {tool === 'text' && (
                                <>
                                    {selectedTextIdState ? (
                                        <>
                                            <TouchableOpacity onPress={deleteSelectedText} className="bg-red-500/10 p-4 rounded-2xl">
                                                <MaterialCommunityIcons name="delete" size={24} color="#ef4444" />
                                            </TouchableOpacity>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 ml-4">
                                                {COLORS.map((c) => (
                                                    <TouchableOpacity
                                                        key={c}
                                                        onPress={() => changeSelectedTextColor(c)}
                                                        style={[styles.colorCircle, { backgroundColor: c, borderColor: 'transparent' }]}
                                                    />
                                                ))}
                                            </ScrollView>
                                            <TouchableOpacity onPress={changeSelectedTextFont} className="bg-white/10 p-4 rounded-2xl ml-4">
                                                <MaterialCommunityIcons name="format-italic" size={24} color="white" />
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <>
                                            <TouchableOpacity onPress={openAddPrompt} className="bg-blue-600 px-6 py-4 rounded-full flex-row items-center">
                                                <MaterialCommunityIcons name="format-text-wrapping-overflow" size={20} color="white" />
                                                <Text className="text-white font-bold text-xs ml-2">Add Text</Text>
                                            </TouchableOpacity>
                                            <View style={{ flex: 1 }} />
                                            <TouchableOpacity onPress={resetAll} className="bg-red-500/10 p-4 rounded-2xl ml-4">
                                                <Ionicons name="refresh" size={24} color="#ef4444" />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </>
                            )}

                            {tool === 'filter' && (
                                <View className="flex-row items-center justify-between w-full">
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                                        {FILTER_OPTIONS.map((f) => (
                                            <TouchableOpacity
                                                key={f.id}
                                                onPress={() => setFilter(f.id)}
                                                className="items-center mr-5"
                                            >
                                                <View
                                                    className={`w-14 h-14 rounded-full items-center justify-center mb-2 ${filter === f.id ? 'border-2 border-white' : 'border border-white/20'}`}
                                                    style={{ backgroundColor: '#2a2a2e' }}
                                                >
                                                    <MaterialCommunityIcons name={f.icon} size={24} color={filter === f.id ? 'white' : '#a1a1aa'} />
                                                </View>
                                                <Text className={`text-[10px] uppercase font-bold ${filter === f.id ? 'text-white' : 'text-zinc-400'}`}>
                                                    {f.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {tool === 'crop' && (
                                <View style={{ height: 56 }} />
                            )}
                        </View>

                        <View className="flex-row justify-between bg-zinc-900 p-2 rounded-[30px] border border-white/5 gap-x-2">
                            <TouchableOpacity
                                onPress={() => { setTool('brush'); selectedTextId.value = null; setSelectedTextIdState(null); }}
                                className={`flex-1 flex-row justify-center items-center py-4 rounded-[24px] ${tool === 'brush' ? 'bg-blue-600' : ''}`}
                            >
                                <MaterialCommunityIcons name="pencil" size={20} color="white" />
                                {tool === 'brush' && <Text className="text-white font-bold ml-2">Draw</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => { setTool('filter'); selectedTextId.value = null; setSelectedTextIdState(null); }}
                                className={`flex-1 flex-row justify-center items-center py-4 rounded-[24px] ${tool === 'filter' ? 'bg-purple-600' : ''}`}
                            >
                                <MaterialCommunityIcons name="auto-fix" size={20} color="white" />
                                {tool === 'filter' && <Text className="text-white font-bold ml-2">Filter</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setTool('text')}
                                className={`flex-1 flex-row justify-center items-center py-4 rounded-[24px] ${tool === 'text' ? 'bg-blue-600' : ''}`}
                            >
                                <MaterialCommunityIcons name={selectedTextIdState ? "format-size" : "format-text"} size={20} color="white" />
                                {tool === 'text' && <Text className="text-white font-bold ml-2">{selectedTextIdState ? "Edit" : "Text"}</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => { setTool('crop'); selectedTextId.value = null; setSelectedTextIdState(null); }}
                                className={`flex-1 flex-row justify-center items-center py-4 rounded-[24px] ${tool === 'crop' ? 'bg-blue-600' : ''}`}
                            >
                                <MaterialCommunityIcons name="crop" size={20} color="white" />
                                {tool === 'crop' && <Text className="text-white font-bold ml-2">Crop</Text>}
                            </TouchableOpacity>

                            {tool === 'crop' && (
                                <TouchableOpacity onPress={applyCrop} className="bg-green-600 px-6 justify-center items-center rounded-[24px]">
                                    <MaterialCommunityIcons name="check" size={24} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                <Modal visible={isTextPromptVisible} transparent animationType="fade" onRequestClose={() => setIsTextPromptVisible(false)}>
                    <View style={styles.promptOverlay}>
                        <View style={styles.promptBox}>
                            <Text className="text-white font-bold mb-4 text-lg">{isEditingExisting ? "Edit Text" : "Add New Text"}</Text>
                            <TextInput
                                style={styles.promptInput}
                                value={newTextInput}
                                onChangeText={setNewTextInput}
                                placeholder="Enter your text..."
                                placeholderTextColor="#a1a1aa"
                                autoFocus
                                multiline
                                textAlignVertical="top"
                            />
                            <View className="flex-row justify-end mt-4">
                                <TouchableOpacity onPress={() => setIsTextPromptVisible(false)} className="p-3 px-5">
                                    <Text className="text-white">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={confirmAddOrEdit} className="p-3 bg-blue-600 rounded-xl ml-3 px-8">
                                    <Text className="text-white font-bold">{isEditingExisting ? "Save" : "Add"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    canvasWrapper: {
        backgroundColor: '#000',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    colorCircle: { width: 30, height: 30, borderRadius: 17, marginHorizontal: 6, borderWidth: 2 },
    cropGrid: { flex: 1, position: 'relative' },
    gridLineH: { position: 'absolute', top: '33.3%', width: '100%', height: 0.5, backgroundColor: 'rgba(255,255,255,0.5)' },
    gridLineH2: { position: 'absolute', top: '66.6%', width: '100%', height: 0.5, backgroundColor: 'rgba(255,255,255,0.5)' },
    gridLineV: { position: 'absolute', left: '33.3%', height: '100%', width: 0.5, backgroundColor: 'rgba(255,255,255,0.5)' },
    gridLineV2: { position: 'absolute', left: '66.6%', height: '100%', width: 0.5, backgroundColor: 'rgba(255,255,255,0.5)' },
    corner: { position: 'absolute', width: 20, height: 20, borderColor: 'white' },
    promptOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    promptBox: {
        backgroundColor: '#1c1c1f',
        width: '85%',
        padding: 24,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    promptInput: {
        backgroundColor: '#2a2a2e',
        color: 'white',
        padding: 18,
        borderRadius: 14,
        minHeight: 100,
        maxHeight: 200,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    }
});

export default ImageEditorModal;