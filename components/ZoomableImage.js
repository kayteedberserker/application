import { Image } from 'expo-image';
import { memo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    cancelAnimation,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDecay,
    withSpring,
    withTiming
} from 'react-native-reanimated';
// Ensure your LightboxVideoPlayer, SyncLoading, and THEME are imported here as well

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedImage = Animated.createAnimatedComponent(Image);
const springConfig = { damping: 25, stiffness: 220, mass: 0.6 };
const MAX_SCALE = 8;

const ZoomableImage = memo(({ uri, onClose, setAssetLoading, isScrollEnabledUI }) => {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const pinchFocalX = useSharedValue(0);
    const pinchFocalY = useSharedValue(0);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    // Track the actual rendered dimensions of the image to fix panning bounds on wide/tall media
    const imageRenderWidth = useSharedValue(SCREEN_WIDTH);
    const imageRenderHeight = useSharedValue(SCREEN_HEIGHT);

    const getBounds = (currentScale) => {
        'worklet';
        const scaledWidth = imageRenderWidth.value * currentScale;
        const scaledHeight = imageRenderHeight.value * currentScale;
        const maxTx = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
        const maxTy = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);
        return { maxTx, maxTy };
    };

    // 2. PINCH TO ZOOM
    const pinch = Gesture.Pinch()
        .onStart((e) => {
            // Eliminate jumpiness by aggressively cancelling lingering animations
            cancelAnimation(scale);
            cancelAnimation(translateX);
            cancelAnimation(translateY);

            savedScale.value = scale.value;
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;

            pinchFocalX.value = e.focalX - SCREEN_WIDTH / 2;
            pinchFocalY.value = e.focalY - SCREEN_HEIGHT / 2;

            isScrollEnabledUI.value = false;
        })
        .onUpdate((e) => {
            let nextScale = savedScale.value * e.scale;
            // FIX: Lowered minimum scale from 0.8 to 0.5 for a squishier, more natural pinch-out feel
            nextScale = Math.max(0.5, Math.min(nextScale, MAX_SCALE));

            const scaleDelta = nextScale / savedScale.value;
            scale.value = nextScale;

            // RESTORED: Absolute delta-scale formula tracking focal point offsets accurately without drift
            let nextTranslateX = savedTranslateX.value * scaleDelta - pinchFocalX.value * (scaleDelta - 1);
            let nextTranslateY = savedTranslateY.value * scaleDelta - pinchFocalY.value * (scaleDelta - 1);

            // Clamp mid-pinch to avoid massive rubber-banding outside the image layout
            const { maxTx, maxTy } = getBounds(nextScale);
            translateX.value = Math.min(Math.max(nextTranslateX, -maxTx), maxTx);
            translateY.value = Math.min(Math.max(nextTranslateY, -maxTy), maxTy);
        })
        .onEnd(() => {
            if (scale.value <= 1.05) {
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;

                scale.value = withSpring(1, springConfig);
                translateX.value = withSpring(0, springConfig);
                translateY.value = withSpring(0, springConfig);

                isScrollEnabledUI.value = true;
                return;
            }

            savedScale.value = scale.value;
            const { maxTx, maxTy } = getBounds(scale.value);

            const clampedX = Math.min(Math.max(translateX.value, -maxTx), maxTx);
            const clampedY = Math.min(Math.max(translateY.value, -maxTy), maxTy);

            savedTranslateX.value = clampedX;
            savedTranslateY.value = clampedY;

            translateX.value = withSpring(clampedX, springConfig);
            translateY.value = withSpring(clampedY, springConfig);

            isScrollEnabledUI.value = false;
        });

    // 3. PAN MOVE 
    const panMove = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .averageTouches(true)
        .manualActivation(true)
        .onTouchesDown((e, state) => {
            if (scale.value <= 1.05) state.fail();
        })
        .onTouchesMove((e, state) => {
            if (scale.value > 1.05) {
                state.activate();
            } else {
                state.fail();
            }
        })
        .onStart(() => {
            cancelAnimation(translateX);
            cancelAnimation(translateY);
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
            if (scale.value <= 1.05) return;

            const { maxTx, maxTy } = getBounds(scale.value);
            const nextX = savedTranslateX.value + e.translationX;
            const nextY = savedTranslateY.value + e.translationY;

            if (Math.abs(nextX) > maxTx) {
                const overshoot = Math.abs(nextX) - maxTx;
                translateX.value = nextX > 0 ? maxTx + overshoot * 0.3 : -maxTx - overshoot * 0.3;
            } else {
                translateX.value = nextX;
            }

            if (Math.abs(nextY) > maxTy) {
                const overshoot = Math.abs(nextY) - maxTy;
                translateY.value = nextY > 0 ? maxTy + overshoot * 0.3 : -maxTy - overshoot * 0.3;
            } else {
                translateY.value = nextY;
            }
        })
        .onEnd((e) => {
            if (scale.value <= 1.05) return;

            const { maxTx, maxTy } = getBounds(scale.value);

            // Implement balanced native momentum decay panning with custom velocity constraints
            translateX.value = withDecay({
                velocity: e.velocityX * 0.7,
                clamp: [-maxTx, maxTx],
            });
            translateY.value = withDecay({
                velocity: e.velocityY * 0.7,
                clamp: [-maxTy, maxTy],
            });
        });

    // 4. PAN CLOSE 
    const panClose = Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY([-15, 15])
        .failOffsetX([-25, 25])
        .onTouchesDown((e, state) => {
            if (scale.value > 1.05) state.fail();
        })
        .onUpdate((e) => {
            if (scale.value > 1.05) return;
            translateY.value = e.translationY;
        })
        .onEnd((e) => {
            if (scale.value > 1.05) return;

            if (
                Math.abs(e.translationY) > 150 ||
                Math.abs(e.velocityY) > 1000
            ) {
                const direction = e.translationY > 0 ? 1 : -1;

                translateY.value = withTiming(
                    SCREEN_HEIGHT * direction,
                    { duration: 200 },
                    () => {
                        if (onClose) {
                            runOnJS(onClose)();
                        }
                    }
                );
            } else {
                translateY.value = withSpring(0, springConfig);
            }
        });

    // 1. DOUBLE TAP
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(250)
        .onEnd((e) => {
            // Cancel any active pan decays before triggering resets to avoid animation conflict
            cancelAnimation(scale);
            cancelAnimation(translateX);
            cancelAnimation(translateY);

            if (scale.value > 1.05) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
                isScrollEnabledUI.value = true;
            } else {
                const targetScale = 2.5;

                // Zoom directly into the tap coordinate
                const targetX = -(e.x - SCREEN_WIDTH / 2) * (targetScale - 1);
                const targetY = -(e.y - SCREEN_HEIGHT / 2) * (targetScale - 1);

                const { maxTx, maxTy } = getBounds(targetScale);
                const clampedX = Math.min(Math.max(targetX, -maxTx), maxTx);
                const clampedY = Math.min(Math.max(targetY, -maxTy), maxTy);

                scale.value = withTiming(targetScale);
                translateX.value = withTiming(clampedX);
                translateY.value = withTiming(clampedY);

                savedScale.value = targetScale;
                savedTranslateX.value = clampedX;
                savedTranslateY.value = clampedY;
                isScrollEnabledUI.value = false;
            }
        });

    const composedGestures = Gesture.Exclusive(
        doubleTap,
        Gesture.Simultaneous(pinch, panMove, panClose)
    );

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value },
            ],
            opacity: scale.value > 1.05 ? 1 : interpolate(
                Math.abs(translateY.value),
                [0, 300],
                [1, 0.3],
                Extrapolation.CLAMP
            ),
        };
    });

    // Independent backdrop fade
    const backdropStyle = useAnimatedStyle(() => {
        return {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'black',
            opacity: interpolate(
                Math.abs(translateY.value),
                [0, 300],
                [1, 0],
                Extrapolation.CLAMP
            )
        };
    });

    return (
        <GestureDetector gesture={composedGestures}>
            <Animated.View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <Animated.View style={backdropStyle} />
                <AnimatedImage
                    style={[{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, animatedStyle]}
                    source={{ uri }}
                    contentFit="contain"
                    onLoadStart={() => setAssetLoading && setAssetLoading(true)}
                    onLoad={(e) => {
                        // Safe variable lookup across variable variations/nesting properties inside expo-image source definitions
                        const sourceObj = e.source || (Array.isArray(e) && e[0]?.source);
                        const imgWidth = sourceObj?.width || e?.width;
                        const imgHeight = sourceObj?.height || e?.height;

                        if (imgWidth && imgHeight) {
                            const aspect = imgWidth / imgHeight;
                            const screenAspect = SCREEN_WIDTH / SCREEN_HEIGHT;
                            if (aspect > screenAspect) {
                                imageRenderWidth.value = SCREEN_WIDTH;
                                imageRenderHeight.value = SCREEN_WIDTH / aspect;
                            } else {
                                imageRenderHeight.value = SCREEN_HEIGHT;
                                imageRenderWidth.value = SCREEN_HEIGHT * aspect;
                            }
                        }
                    }}
                    onLoadEnd={() => setAssetLoading && setAssetLoading(false)}
                />
            </Animated.View>
        </GestureDetector>
    );
});

export default ZoomableImage;