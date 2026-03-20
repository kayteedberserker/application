import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SendingLoader = () => {
  const spinValue = useSharedValue(0);

  useEffect(() => {
    spinValue.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false // false = don't reverse, just loop 0 -> 360 over and over
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinValue.value}deg` }],
    };
  });

  return (
    <View className="flex-row items-center justify-center p-2">
      <Animated.View style={animatedStyle}>
        <Ionicons name="refresh-outline" size={20} color="#3b82f6" />
      </Animated.View>
      <Text className="ml-2 text-blue-500 font-bold">Sending...</Text>
    </View>
  );
};

export default SendingLoader;

// export default function SendingLoader() {
//   return null;
// }

// Use this inside your CommentSection's Post button
// {isPosting ? <SendingLoader /> : <Text className="text-white">Post</Text>}