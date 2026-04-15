import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Canvas, Image, Path, Skia, useImage } from "@shopify/react-native-skia";
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import ViewShot from "react-native-view-shot";
import { Text } from "./Text";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 🎨 Expanded Color Palette
const COLORS = [
    "#ffffff", "#ef4444", "#f97316", "#facc15",
    "#22c55e", "#06b6d4", "#3b82f6", "#6366f1",
    "#a855f7", "#ec4899", "#71717a", "#000000"
];

const ImageEditorModal = ({ isVisible, onClose, imageUri, onSave }) => {
    const skiaImage = useImage(imageUri);
    const viewShotRef = React.useRef();

    // --- EDITOR STATE ---
    const [tool, setTool] = useState('brush'); // 'brush', 'crop'
    const [color, setColor] = useState(COLORS[1]);
    const [paths, setPaths] = useState([]);
    const [clipRect, setClipRect] = useState(null);

    // ⚡️ DYNAMIC DIMENSIONS: State to handle rectangular images
    const [canvasDim, setCanvasDim] = useState({ w: SCREEN_WIDTH * 0.9, h: SCREEN_WIDTH * 0.9 });
    const [isLoaded, setIsLoaded] = useState(false);

    // --- DRAWING STATE ---
    // ⚡️ STABILITY FIX: Initialize with a valid empty path. 
    // Passing null to a Skia component via a SharedValue often causes "invalid prop value" crashes.
    const emptyPath = useMemo(() => Skia.Path.Make(), []);
    const activePath = useSharedValue(emptyPath);
    const [isDrawing, setIsDrawing] = useState(false);

    // --- CROP BOX STATE ---
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
        setClipRect(null);
        setTool('brush');
        setColor(COLORS[1]);
        cropT.value = 0;
        cropL.value = 0;
        cropB.value = canvasDim.h;
        cropR.value = canvasDim.w;
    };

    // ⚡️ AUTO-RESET: Clears all previous edits whenever the modal is triggered
    useEffect(() => {
        if (isVisible) {
            resetAll();
        }
    }, [isVisible]);

    // ⚡️ ASPECT RATIO ENGINE: Adjusts the editor to fit the actual image shape
    useEffect(() => {
        if (skiaImage) {
            const imgW = skiaImage.width();
            const imgH = skiaImage.height();
            const ratio = imgW / imgH;

            let targetW = SCREEN_WIDTH * 0.9;
            let targetH = targetW / ratio;

            // Constrain height to 65% of screen to leave room for UI
            if (targetH > SCREEN_HEIGHT * 0.65) {
                targetH = SCREEN_HEIGHT * 0.65;
                targetW = targetH * ratio;
            }

            setCanvasDim({ w: targetW, h: targetH });
            cropR.value = targetW;
            cropB.value = targetH;
            setIsLoaded(true);
        }
    }, [skiaImage]);

    const cropBoxStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        top: cropT.value,
        left: cropL.value,
        width: cropR.value - cropL.value,
        height: cropB.value - cropT.value,
        borderWidth: 2,
        borderColor: 'white',
        backgroundColor: 'rgba(255,255,255,0.1)'
    }));

    const cropGesture = Gesture.Pan()
        .enabled(tool === 'crop')
        .onStart((g) => {
            cropStartT.value = cropT.value;
            cropStartL.value = cropL.value;
            cropStartB.value = cropB.value;
            cropStartR.value = cropR.value;

            const t = 30; // Threshold for touch area
            const { x, y } = g;

            const isL = Math.abs(x - cropL.value) < t;
            const isR = Math.abs(x - cropR.value) < t;
            const isT = Math.abs(y - cropT.value) < t;
            const isB = Math.abs(y - cropB.value) < t;

            // Define Handles: 1:TL, 2:TR, 3:BL, 4:BR, 5:Move, 6:Top, 7:Bottom, 8:Left, 9:Right
            if (isL && isT) cropHandle.value = 1;
            else if (isR && isT) cropHandle.value = 2;
            else if (isL && isB) cropHandle.value = 3;
            else if (isR && isB) cropHandle.value = 4;
            else if (isT) cropHandle.value = 6;
            else if (isB) cropHandle.value = 7;
            else if (isL) cropHandle.value = 8;
            else if (isR) cropHandle.value = 9;
            else if (x > cropL.value && x < cropR.value && y > cropT.value && y < cropB.value) {
                cropHandle.value = 5;
            } else {
                cropHandle.value = 0;
            }
        })
        .onUpdate((g) => {
            const minSize = 60;
            const { translationX: dx, translationY: dy } = g;

            // Corners
            if (cropHandle.value === 1) { // TL
                cropL.value = Math.min(Math.max(0, cropStartL.value + dx), cropR.value - minSize);
                cropT.value = Math.min(Math.max(0, cropStartT.value + dy), cropB.value - minSize);
            } else if (cropHandle.value === 2) { // TR
                cropR.value = Math.max(Math.min(canvasDim.w, cropStartR.value + dx), cropL.value + minSize);
                cropT.value = Math.min(Math.max(0, cropStartT.value + dy), cropB.value - minSize);
            } else if (cropHandle.value === 3) { // BL
                cropL.value = Math.min(Math.max(0, cropStartL.value + dx), cropR.value - minSize);
                cropB.value = Math.max(Math.min(canvasDim.h, cropStartB.value + dy), cropT.value + minSize);
            } else if (cropHandle.value === 4) { // BR
                cropR.value = Math.max(Math.min(canvasDim.w, cropStartR.value + dx), cropL.value + minSize);
                cropB.value = Math.max(Math.min(canvasDim.h, cropStartB.value + dy), cropT.value + minSize);
            }
            // Edges
            else if (cropHandle.value === 6) { // Top
                cropT.value = Math.min(Math.max(0, cropStartT.value + dy), cropB.value - minSize);
            } else if (cropHandle.value === 7) { // Bottom
                cropB.value = Math.max(Math.min(canvasDim.h, cropStartB.value + dy), cropT.value + minSize);
            } else if (cropHandle.value === 8) { // Left
                cropL.value = Math.min(Math.max(0, cropStartL.value + dx), cropR.value - minSize);
            } else if (cropHandle.value === 9) { // Right
                cropR.value = Math.max(Math.min(canvasDim.w, cropStartR.value + dx), cropL.value + minSize);
            }
            // Body Move
            else if (cropHandle.value === 5) {
                const w = cropStartR.value - cropStartL.value;
                const h = cropStartB.value - cropStartT.value;
                let newL = cropStartL.value + dx;
                let newT = cropStartT.value + dy;

                if (newL < 0) newL = 0;
                if (newL + w > canvasDim.w) newL = canvasDim.w - w;
                if (newT < 0) newT = 0;
                if (newT + h > canvasDim.h) newT = canvasDim.h - h;

                cropL.value = newL;
                cropR.value = newL + w;
                cropT.value = newT;
                cropB.value = newT + h;
            }
        });

    const applyCrop = () => {
        setClipRect({
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

    const finalizePath = (skPath, brushColor) => {
        if (!skPath || skPath.isEmpty()) {
            setIsDrawing(false);
            return;
        }
        setPaths(prev => [...prev, { path: skPath, color: brushColor }]);
        setIsDrawing(false);
        activePath.value = emptyPath;
    };

    const drawGesture = Gesture.Pan()
        .enabled(tool === 'brush')
        .onStart((g) => {
            const p = Skia.Path.Make();
            p.moveTo(g.x, g.y);
            activePath.value = p;
            runOnJS(setIsDrawing)(true);
        })
        .onUpdate((g) => {
            const currentP = activePath.value;
            if (currentP && currentP !== emptyPath) {
                currentP.lineTo(g.x, g.y);
                // We must update the shared value with a copy to trigger native redraws
                activePath.value = currentP.copy();
            }
        })
        .onFinalize(() => {
            if (activePath.value !== emptyPath) {
                runOnJS(finalizePath)(activePath.value.copy(), color);
            } else {
                runOnJS(setIsDrawing)(false);
            }
        });

    const handleSave = async () => {
        try {
            const uri = await viewShotRef.current.capture();
            onSave(uri);
        } catch (error) {
            console.error("Capture failed", error);
        }
    };

    const activeWidth = clipRect ? clipRect.w : canvasDim.w;
    const activeHeight = clipRect ? clipRect.h : canvasDim.h;
    const scaleFactor = Math.min((SCREEN_WIDTH * 0.9) / activeWidth, (SCREEN_HEIGHT * 0.65) / activeHeight);

    return (
        <Modal visible={isVisible} transparent animationType="fade">
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.container}>
                    {/* HEADER */}
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
                        <View style={[styles.canvasWrapper, { width: canvasDim.w, height: canvasDim.h }]}>
                            <View style={[StyleSheet.absoluteFill, {
                                width: activeWidth,
                                height: activeHeight,
                                overflow: 'hidden',
                                transform: [{ scale: scaleFactor }]
                            }]}>
                                <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ width: activeWidth, height: activeHeight }}>
                                    <GestureDetector gesture={Gesture.Race(drawGesture, cropGesture)}>
                                        <View style={[StyleSheet.absoluteFill, {
                                            width: canvasDim.w,
                                            height: canvasDim.h,
                                            transform: [
                                                { translateX: clipRect ? -clipRect.x : 0 },
                                                { translateY: clipRect ? -clipRect.y : 0 }
                                            ]
                                        }]}>
                                            <Canvas style={{ flex: 1, backgroundColor: 'transparent' }}>
                                                {skiaImage && <Image image={skiaImage} x={0} y={0} width={canvasDim.w} height={canvasDim.h} fit="fill" />}

                                                {paths.map((p, i) => (
                                                    <Path key={i} path={p.path} color={p.color} style="stroke" strokeWidth={5} strokeCap="round" />
                                                ))}

                                                {isDrawing && (
                                                    <Path path={activePath} color={color} style="stroke" strokeWidth={5} strokeCap="round" />
                                                )}
                                            </Canvas>
                                        </View>
                                    </GestureDetector>
                                </ViewShot>
                            </View>

                            {tool === 'crop' && (
                                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                                    <View style={styles.cropDim} />
                                    <Animated.View style={cropBoxStyle}>
                                        <View style={styles.cropGrid}>
                                            <View style={styles.gridLineH} />
                                            <View style={styles.gridLineH2} />
                                            <View style={styles.gridLineV} />
                                            <View style={styles.gridLineV2} />

                                            {/* Visual corner indicators */}
                                            <View style={[styles.corner, { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 }]} />
                                            <View style={[styles.corner, { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 }]} />
                                            <View style={[styles.corner, { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
                                            <View style={[styles.corner, { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 }]} />
                                        </View>
                                    </Animated.View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* CONTROLS */}
                    <View className="px-6 pb-10">
                        <View className="flex-row items-center justify-between mb-6">
                            <TouchableOpacity onPress={undo} className="bg-white/10 p-4 rounded-2xl">
                                <MaterialCommunityIcons name="undo" size={24} color="white" />
                            </TouchableOpacity>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 ml-4">
                                {COLORS.map((c) => (
                                    <TouchableOpacity
                                        key={c}
                                        onPress={() => setColor(c)}
                                        style={[styles.colorCircle, { backgroundColor: c, borderColor: color === c ? 'white' : 'transparent' }]}
                                    />
                                ))}
                            </ScrollView>

                            <TouchableOpacity onPress={resetAll} className="bg-red-500/10 p-4 rounded-2xl ml-4">
                                <Ionicons name="refresh" size={24} color="#ef4444" />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row justify-between bg-zinc-900 p-2 rounded-[30px] border border-white/5">
                            <TouchableOpacity
                                onPress={() => setTool('brush')}
                                className={`flex-1 flex-row justify-center items-center py-4 rounded-[24px] ${tool === 'brush' ? 'bg-blue-600' : ''}`}
                            >
                                <MaterialCommunityIcons name="pencil" size={22} color="white" />
                                {tool === 'brush' && <Text className="text-white font-bold ml-2">Draw</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setTool('crop')}
                                className={`flex-1 flex-row justify-center items-center py-4 rounded-[24px] ${tool === 'crop' ? 'bg-blue-600' : ''}`}
                            >
                                <MaterialCommunityIcons name="crop" size={22} color="white" />
                                {tool === 'crop' && <Text className="text-white font-bold ml-2">Crop</Text>}
                            </TouchableOpacity>

                            {tool === 'crop' && (
                                <TouchableOpacity onPress={applyCrop} className="bg-green-600 px-6 justify-center items-center rounded-[24px] ml-1">
                                    <MaterialCommunityIcons name="check" size={24} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    canvasWrapper: {
        backgroundColor: 'transparent',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    colorCircle: { width: 30, height: 30, borderRadius: 17, marginHorizontal: 6, borderWidth: 2 },
    cropDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    cropGrid: { flex: 1, position: 'relative' },
    gridLineH: { position: 'absolute', top: '33.3%', width: '100%', height: 0.5, backgroundColor: 'rgba(255,255,255,0.3)' },
    gridLineH2: { position: 'absolute', top: '66.6%', width: '100%', height: 0.5, backgroundColor: 'rgba(255,255,255,0.3)' },
    gridLineV: { position: 'absolute', left: '33.3%', height: '100%', width: 0.5, backgroundColor: 'rgba(255,255,255,0.3)' },
    gridLineV2: { position: 'absolute', left: '66.6%', height: '100%', width: 0.5, backgroundColor: 'rgba(255,255,255,0.3)' },
    corner: { position: 'absolute', width: 20, height: 20, borderColor: 'white' }
});

export default ImageEditorModal;