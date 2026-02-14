import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { DeviceEventEmitter, Dimensions, Linking, Modal, Pressable, TouchableOpacity, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { Text } from './Text';

const { height } = Dimensions.get('window');
const STORAGE_KEYS = {
    HAS_REVIEWED: 'user_has_clicked_review_v1',
    POST_COUNT: 'user_post_count_v1'
};

const MILESTONES = [2, 5, 10, 15, 20, 30, 40, 50];

export default function ReviewGate() {
    const [visible, setVisible] = useState(false);
    const pulse = useSharedValue(1);
    const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.kaytee.oreblogda";

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("POST_CREATED_SUCCESS", () => {
            checkEligibility();
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (visible) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 800 }),
                    withTiming(1, { duration: 800 })
                ),
                -1,
                true
            );
        }
    }, [visible]);

    const checkEligibility = async () => {
        const alreadyReviewed = await AsyncStorage.getItem(STORAGE_KEYS.HAS_REVIEWED);
        if (alreadyReviewed === 'true') return;

        const currentCountStr = await AsyncStorage.getItem(STORAGE_KEYS.POST_COUNT) || "0";
        const newCount = parseInt(currentCountStr) + 1;
        await AsyncStorage.setItem(STORAGE_KEYS.POST_COUNT, newCount.toString());

        if (MILESTONES.includes(newCount)) {
            setTimeout(() => setVisible(true), 1200);
        }
    };

    const handleRateNow = async () => {
        await AsyncStorage.setItem(STORAGE_KEYS.HAS_REVIEWED, 'true');
        setVisible(false);
        Linking.openURL(PLAY_STORE_URL);
    };

    const handleDismiss = () => {
        setVisible(false);
    };

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
            <View className="flex-1 justify-end">
                {/* Backdrop with Fade */}
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)}
                    className="absolute inset-0 bg-black/60"
                >
                    <Pressable className="flex-1" onPress={handleDismiss} />
                </Animated.View>

                {/* Animated Drawer */}
                <Animated.View 
                    entering={SlideInDown.springify().damping(15)}
                    exiting={SlideOutDown.duration(300)}
                    style={{ height: height * 0.4 }}
                    className="w-full bg-[#0a0a0a] border-t-4 border-blue-600 rounded-t-[40px] px-8 pt-8 pb-10 shadow-2xl"
                >
                    {/* Top Accent Line */}
                    <View className="absolute top-2 left-1/2 -ml-8 w-16 h-1 bg-gray-800 rounded-full" />

                    {/* Header: Anime Status Style */}
                    <View className="flex-row items-center justify-between mb-8">
                        <View className="flex-row items-center gap-2">
                            <View className="bg-blue-600 px-2 py-0.5 rounded-sm">
                                <Text className="text-white font-[900] text-[8px] uppercase tracking-tighter">
                                    SYNC_ACTIVE
                                </Text>
                            </View>
                            <Text className="text-gray-500 font-bold text-[9px] tracking-[0.2em] uppercase">
                                // COMMUNITY_RANK_UP
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleDismiss}>
                            <MaterialCommunityIcons name="close" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Content Section */}
                    <View className="flex-row gap-5 items-center mb-10">
                        <View className="relative">
                             <View className="absolute -inset-1 bg-blue-600/20 blur-xl rounded-full" />
                             <View className="bg-blue-600/10 p-4 rounded-3xl border border-blue-600/40">
                                <MaterialCommunityIcons name="star-shooting-outline" size={38} color="#2563eb" />
                            </View>
                        </View>
                        
                        <View className="flex-1">
                            <Text className="text-2xl font-[900] text-white uppercase italic tracking-tighter mb-1">
                                Level <Text className="text-blue-600">Elite</Text>
                            </Text>
                            <Text className="text-gray-400 text-[13px] leading-4 font-medium italic">
                                "Your contributions are shaping the feed. Support the broadcast unit with 5 stars?"
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row gap-4">
                        <TouchableOpacity 
                            onPress={handleDismiss}
                            className="flex-1 bg-transparent border border-gray-800 py-4 rounded-2xl items-center"
                        >
                            <Text className="text-gray-600 font-black uppercase text-[10px] tracking-widest">Ignore</Text>
                        </TouchableOpacity>

                        <Animated.View style={[animatedButtonStyle, { flex: 2 }]}>
                            <TouchableOpacity 
                                onPress={handleRateNow}
                                className="w-full bg-blue-600 py-4 rounded-2xl items-center shadow-xl shadow-blue-500/40"
                            >
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-white font-[900] uppercase tracking-widest">Deploy Review</Text>
                                    <MaterialCommunityIcons name="send-check" size={18} color="white" />
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>

                    {/* Cyber Decorative Strip */}
                    <View className="mt-6 flex-row justify-center gap-1 opacity-20">
                        {[...Array(8)].map((_, i) => (
                            <View key={i} className="h-1 w-4 bg-blue-600 skew-x-[-20deg]" />
                        ))}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}