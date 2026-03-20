import { Canvas, Circle, Group, Rect } from "@shopify/react-native-skia";
import { useState } from 'react';
import {
    Dimensions,
    Modal,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import THEME from './useAppTheme'; 

const { width } = Dimensions.get('window');

const PullSpinModal = ({ isVisible, onClose, onComplete, pullMetadata, rewardName }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentNum, setCurrentNum] = useState('?');
  const [hasFinished, setHasFinished] = useState(false);
  
  const scaleValue = useSharedValue(1);

  const startSpin = () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    setHasFinished(false);

    let iterations = 0;
    const maxIterations = 30;
    const interval = setInterval(() => {
      setCurrentNum(Math.floor(Math.random() * 11));
      iterations++;
      
      if (iterations >= maxIterations) {
        clearInterval(interval);
        finalizeSpin();
      }
    }, 80);
  };

  const finalizeSpin = () => {
    const result = Math.floor(Math.random() * (pullMetadata.max + 1));
    setCurrentNum(result);
    setIsSpinning(false);
    setHasFinished(true);

    scaleValue.value = withSequence(
      withTiming(1.5, { duration: 200 }),
      withSpring(1, { damping: 10, stiffness: 100 })
    );
  };

  const handleConfirm = () => {
    onComplete(currentNum);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }]
    };
  });

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View className="flex-1 bg-black/95 justify-center items-center p-6">
        <Canvas style={{ position: 'absolute', width: '100%', height: '100%' }}>
          <Rect x={0} y={0} width={width} height={1000} color="rgba(0,0,0,0.9)" />
          <Group opacity={0.1}>
            <Circle cx={width/2} cy={400} r={200} color={THEME.accent} />
          </Group>
        </Canvas>

        <View className="items-center w-full">
          <Text style={{ color: THEME.accent }} className="font-black uppercase tracking-[5px] text-xs mb-2">Sequence Initiated</Text>
          <Text style={{ color: 'white' }} className="text-2xl font-black italic uppercase mb-10 text-center">{rewardName}</Text>

          <Animated.View 
            style={[
              animatedStyle,
              { 
                borderColor: hasFinished ? THEME.success : THEME.accent,
                backgroundColor: THEME.card 
              }
            ]} 
            className="w-40 h-40 rounded-3xl border-4 items-center justify-center shadow-2xl"
          >
            <Text style={{ color: hasFinished ? THEME.success : THEME.text }} className="text-7xl font-black italic">
              {currentNum}
            </Text>
          </Animated.View>

          <Text style={{ color: THEME.textSecondary }} className="mt-8 font-bold uppercase text-[10px] tracking-widest text-center px-10">
            {hasFinished ? "Identity Bound to Fragment" : "Awaiting synchronization with the Hollow Void"}
          </Text>

          <View className="mt-12 w-full gap-4">
            {!hasFinished ? (
              <TouchableOpacity 
                onPress={startSpin}
                disabled={isSpinning}
                style={{ backgroundColor: isSpinning ? THEME.border : THEME.accent }}
                className="h-16 rounded-2xl items-center justify-center shadow-xl"
              >
                <Text className="text-white font-black uppercase tracking-widest">
                  {isSpinning ? "Synchronizing..." : "Initiate Pull"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={handleConfirm}
                style={{ backgroundColor: THEME.success }}
                className="h-16 rounded-2xl items-center justify-center shadow-xl"
              >
                <Text className="text-white font-black uppercase tracking-widest">Claim Designation</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default PullSpinModal;