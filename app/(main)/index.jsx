import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Dimensions, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostsViewer from "./../../components/PostViewer";
import { Text } from "./../../components/Text";
import CategoryPage from "./categories/[id]";

const { width } = Dimensions.get('window');

const CHANNELS = [
    { id: 'all', title: 'Global', type: 'feed' },
    { id: 'news', title: 'News', type: 'category' },
    { id: 'memes', title: 'Memes', type: 'category' },
    { id: 'polls', title: 'Polls', type: 'category' },
    { id: 'review', title: 'Review', type: 'category' },
    { id: 'gaming', title: 'Gaming', type: 'category' },
];

export default function HomePage() {
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    
    const flatListRef = useRef(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const [activeIndex, setActiveIndex] = useState(0);

    // 🔹 Listen for Nav Taps from the Layout
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("scrollToIndex", (index) => {
            flatListRef.current?.scrollToIndex({ index, animated: true });
        });
        return () => sub.remove();
    }, []);

    const renderItem = ({ item }) => (
        <View style={{ width }}>
            {item.type === 'feed' ? (
                <PostsViewer />
            ) : (
                <CategoryPage forcedId={item.id} />
            )}
        </View>
    );

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            {/* Background Decor */}
            <View 
                pointerEvents="none"
                className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" 
            />

            <FlatList
                ref={flatListRef}
                data={CHANNELS}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setActiveIndex(index);
                    // 🔹 Sync the Layout's Nav with this swipe
                    DeviceEventEmitter.emit("pageSwiped", index);
                }}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
                removeClippedSubviews={true}
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                windowSize={3}
                scrollEventThrottle={16}
                decelerationRate="fast"
            />

            {/* Tactical Footer Overlay */}
            <View 
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 5, opacity: 0.3 }}
                pointerEvents="none"
            >
                <View className="h-1 w-1 rounded-full bg-blue-600" />
                <Text className="text-[8px] font-[900] uppercase tracking-[0.5em] text-blue-600">
                    Neural_Link // {CHANNELS[activeIndex].title.toUpperCase()}_SECTOR
                </Text>
            </View>
        </View>
    );
}