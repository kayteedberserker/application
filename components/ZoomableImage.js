import { Image } from 'expo-image';
import { memo } from 'react';
import { Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
// Ensure your LightboxVideoPlayer, SyncLoading, and THEME are imported here as well

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedImage = Animated.createAnimatedComponent(Image);
const springConfig = { damping: 25, stiffness: 220, mass: 0.6 };

const ZoomableImage = memo(({ uri, onClose, setAssetLoading, isScrollEnabledUI }) => {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const pinchFocalX = useSharedValue(0);
    const pinchFocalY = useSharedValue(0);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const getBounds = (currentScale) => {
        'worklet';
        const maxTx = Math.max(0, (SCREEN_WIDTH * currentScale - SCREEN_WIDTH) / 2);
        const maxTy = Math.max(0, (SCREEN_HEIGHT * currentScale - SCREEN_HEIGHT) / 2);
        return { maxTx, maxTy };
    };

    // 1. DOUBLE TAP
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(250)
        .onEnd(() => {
            if (scale.value > 1) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
                isScrollEnabledUI.value = true; // UI Thread unlock
            } else {
                scale.value = withTiming(2.5);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 2.5;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
                isScrollEnabledUI.value = false;
            }
        });

    // 2. PINCH TO ZOOM
    const pinch = Gesture.Pinch()
        .onStart((e) => {
            // Safely capture the exact current state in case we are interrupting a spring animation
            savedScale.value = scale.value;
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;

            pinchFocalX.value = e.focalX - SCREEN_WIDTH / 2;
            pinchFocalY.value = e.focalY - SCREEN_HEIGHT / 2;

            isScrollEnabledUI.value = false;
        })
        .onUpdate((e) => {
            let nextScale = savedScale.value * e.scale;
            nextScale = Math.max(0.8, Math.min(nextScale, 5));
            const scaleDelta = nextScale / savedScale.value;

            scale.value = nextScale;

            // FIX: Multiply saved translation by scaleDelta so the focal point scales outward natively
            translateX.value =
                savedTranslateX.value * scaleDelta -
                pinchFocalX.value * (scaleDelta - 1);

            translateY.value =
                savedTranslateY.value * scaleDelta -
                pinchFocalY.value * (scaleDelta - 1);
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

            if (scale.value > 4) {
                savedScale.value = 4;
                scale.value = withSpring(4, springConfig);
            } else {
                savedScale.value = scale.value;
            }

            const { maxTx, maxTy } = getBounds(savedScale.value);

            const clampedX = Math.min(
                Math.max(translateX.value, -maxTx),
                maxTx
            );

            const clampedY = Math.min(
                Math.max(translateY.value, -maxTy),
                maxTy
            );

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
        .manualActivation(true) // FIX: Manually control activation
        .onTouchesMove((e, state) => {
            // FIX: If unzoomed, fail the gesture completely so FlatList can claim the horizontal swipe
            if (scale.value > 1) {
                state.activate();
            } else {
                state.fail();
            }
        })
        .onStart(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
            if (scale.value <= 1) return;

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
        .onEnd(() => {
            if (scale.value <= 1) return;

            const { maxTx, maxTy } = getBounds(scale.value);

            const clampedX = Math.min(Math.max(translateX.value, -maxTx), maxTx);
            const clampedY = Math.min(Math.max(translateY.value, -maxTy), maxTy);

            // Assign the raw clamped number to saved state BEFORE kicking off the spring animation
            savedTranslateX.value = clampedX;
            savedTranslateY.value = clampedY;

            translateX.value = withSpring(clampedX, springConfig);
            translateY.value = withSpring(clampedY, springConfig);
        });

    // 4. PAN CLOSE 
    const panClose = Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY([-15, 15])
        .failOffsetX([-25, 25])
        .onUpdate((e) => {
            if (scale.value > 1) return;

            translateY.value = e.translationY;
        })
        .onEnd((e) => {
            if (scale.value > 1) return;

            if (
                Math.abs(e.translationY) > 150 ||
                Math.abs(e.velocityY) > 1000
            ) {
                const direction =
                    e.translationY > 0 ? 1 : -1;

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
                translateY.value = withSpring(
                    0,
                    springConfig
                );
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
            opacity: scale.value > 1 ? 1 : interpolate(
                Math.abs(translateY.value),
                [0, 300],
                [1, 0.3],
                Extrapolation.CLAMP
            ),
        };
    });

    return (
        <GestureDetector gesture={composedGestures}>
            <AnimatedImage
                style={[{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, animatedStyle]}
                source={{ uri }}
                contentFit="contain"
                onLoadStart={() => setAssetLoading && setAssetLoading(true)}
                onLoadEnd={() => setAssetLoading && setAssetLoading(false)}
            />
        </GestureDetector>
    );
});




export default ZoomableImage;
