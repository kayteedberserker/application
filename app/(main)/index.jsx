import { useColorScheme } from "nativewind";
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, FlatList, View, useWindowDimensions, InteractionManager } from 'react-native';
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

// 🔹 Optimized Scene: Only renders content when active
const Scene = memo(({ item, pageWidth, isActive }) => {
    const [shouldRender, setShouldRender] = useState(isActive);

    useEffect(() => {
        if (isActive && !shouldRender) {
            // 🚀 Delay the heavy render until the swipe animation finishes
            InteractionManager.runAfterInteractions(() => {
                setShouldRender(true);
            });
        }
    }, [isActive]);

    return (
        <View style={{ width: pageWidth, flex: 1 }}>
            {shouldRender ? (
                <View className="flex-1">
                    {item.type === 'feed' ? (
                        <PostsViewer />
                    ) : (
                        <CategoryPage forcedId={item.id} />
                    )}
                </View>
            ) : (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text className="text-[10px] text-blue-600/30 font-bold uppercase mt-2 tracking-widest">
                        Readying {item.title}...
                    </Text>
                </View>
            )}
        </View>
    );
});

export default function HomePage() {
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const { width: windowWidth } = useWindowDimensions();
    
    const flatListRef = useRef(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const [activeIndex, setActiveIndex] = useState(0); 

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("scrollToIndex", (index) => {
            flatListRef.current?.scrollToIndex({ index, animated: true });
        });
        return () => sub.remove();
    }, []);

    const renderItem = useCallback(({ item, index }) => (
        <Scene 
            item={item} 
            pageWidth={windowWidth} 
            isActive={Math.abs(activeIndex - index) <= 1} // Render current + 1 neighbor
        />
    ), [windowWidth, activeIndex]);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 51,
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const newIndex = viewableItems[0].index;
            if (newIndex !== null && newIndex !== undefined) {
                setActiveIndex(newIndex);
                DeviceEventEmitter.emit("pageSwiped", newIndex);
            }
        }
    }).current;

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            <View pointerEvents="none" className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />

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
                
                // 🔹 CRITICAL: Reduce memory and JS workload
                windowSize={3}           // Only keep 3 pages in memory (prev, current, next)
                initialNumToRender={1}   // Only render the first page on load
                maxToRenderPerBatch={1}  // Render one at a time
                removeClippedSubviews={Platform.OS === 'android'} 
                
                getItemLayout={(_, index) => ({
                    length: windowWidth,
                    offset: windowWidth * index,
                    index,
                })}
                
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true } // 🚀 Use native driver for scroll events
                )}
                scrollEventThrottle={16}
            />

            <View 
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 5, opacity: 0.3 }}
                pointerEvents="none"
            >
                <View className="h-1 w-1 rounded-full bg-blue-600" />
                <Text className="text-[8px] font-[900] uppercase tracking-[0.5em] text-blue-600">
                    Neural_Link // {CHANNELS[activeIndex]?.title.toUpperCase()}_SECTOR
                </Text>
            </View>
        </View>
    ); 
}
