import { useColorScheme } from "nativewind";
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, FlatList, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostsViewer from "./../../components/PostViewer";
import { Text } from "./../../components/Text";
import CategoryPage from "./categories/[id]";

const CHANNELS = [
    { id: 'all', title: 'Global', type: 'feed' },
    { id: 'news', title: 'News', type: 'category' },
    { id: 'memes', title: 'Memes', type: 'category' },
    { id: 'polls', title: 'Polls', type: 'category' },
    { id: 'review', title: 'Review', type: 'category' },
    { id: 'gaming', title: 'Gaming', type: 'category' },
];

// 🔹 Optimized Scene with Loading Animation
const Scene = memo(({ item, pageWidth }) => {
    return (
        <View style={{ width: pageWidth, flex: 1 }}>
            {/* Using a key based on item.id ensures the component mounts correctly */}
            <View className="flex-1">
                {item.type === 'feed' ? (
                    <PostsViewer />
                ) : (
                    <CategoryPage forcedId={item.id} />
                )}
            </View>
            
            {/* Fallback Loading Overlay: If the JS thread is busy, 
                this simple View is more likely to show than the heavy child */}
            <View 
                pointerEvents="none" 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
                className="items-center justify-center"
            >
                <ActivityIndicator size="small" color="#2563eb" />
                <Text className="text-[10px] text-blue-600/30 font-bold uppercase mt-2 tracking-widest">
                    Loading Sector...
                </Text>
            </View>
        </View>
    );
});

export default function HomePage() {
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    
    // ⚡️ ROTATION FIX: useWindowDimensions updates automatically on rotate
    const { width: windowWidth } = useWindowDimensions();
    
    const flatListRef = useRef(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const [activeTitle, setActiveTitle] = useState(CHANNELS[0].title); 

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("scrollToIndex", (index) => {
            flatListRef.current?.scrollToIndex({ index, animated: true });
        });
        return () => sub.remove();
    }, []);

    // ⚡️ PERFORMANCE: Passing windowWidth to Scene ensures it resizes on rotation
    const renderItem = useCallback(({ item }) => (
        <Scene item={item} pageWidth={windowWidth} />
    ), [windowWidth]);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 51,
        minimumViewTime: 0 
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const newItem = viewableItems[0];
            const newIndex = newItem.index;
            if (newIndex !== null && newIndex !== undefined) {
                setActiveTitle(CHANNELS[newIndex].title);
                DeviceEventEmitter.emit("pageSwiped", newIndex);
            }
        }
    }).current;

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            {/* Background Glow */}
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
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}

                // ⚡️ ROTATION FIX: Recalculate layout based on dynamic width
                getItemLayout={(_, index) => ({
                    length: windowWidth,
                    offset: windowWidth * index,
                    index,
                })}

                // 🔹 Optimized Rendering Window
                // windowSize={5} is a bit heavier on memory but helps stop the blank pages 
                // because it keeps 2 pages ahead and 2 pages behind in memory.
                windowSize={5} 
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                removeClippedSubviews={true} 
                scrollEventThrottle={16}
                decelerationRate="fast"
                
                // Helps with "stickiness" on swipe
                snapToInterval={windowWidth}
                snapToAlignment="start"
            />

            {/* Neural Link Footer */}
            <View 
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 5, opacity: 0.3 }}
                pointerEvents="none"
            >
                <View className="h-1 w-1 rounded-full bg-blue-600" />
                <Text className="text-[8px] font-[900] uppercase tracking-[0.5em] text-blue-600">
                    Neural_Link // {activeTitle.toUpperCase()}_SECTOR
                </Text>
            </View>
        </View>
    ); 
}
