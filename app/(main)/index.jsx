import { useColorScheme } from "nativewind";
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { 
    ActivityIndicator, 
    Animated, 
    DeviceEventEmitter, 
    FlatList, 
    View, 
    useWindowDimensions, 
    InteractionManager, 
    Platform // 🚀 FIXED: Added missing import
} from 'react-native';
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

const Scene = memo(({ item, pageWidth, isActive }) => {
    const [shouldRender, setShouldRender] = useState(isActive);

    useEffect(() => {
        let isMounted = true;
        if (isActive && !shouldRender) {
            InteractionManager.runAfterInteractions(() => {
                if (isMounted) setShouldRender(true);
            });
        }
        return () => { isMounted = false; };
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
            if (index >= 0 && index < CHANNELS.length) {
                flatListRef.current?.scrollToIndex({ index, animated: true });
            }
        });
        return () => sub.remove();
    }, []);

    const renderItem = useCallback(({ item, index }) => (
        <Scene 
            item={item} 
            pageWidth={windowWidth} 
            isActive={Math.abs(activeIndex - index) <= 1} 
        />
    ), [windowWidth, activeIndex]);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 51,
        minimumViewTime: 50 // 🚀 Added to prevent index flickering during fast swipes
    }).current;

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems && viewableItems.length > 0) {
            const newIndex = viewableItems[0].index;
            if (newIndex !== null && newIndex !== undefined) {
                setActiveIndex(newIndex);
                DeviceEventEmitter.emit("pageSwiped", newIndex);
            }
        }
    }, []);

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            {/* 🚀 REPLACED blur-3xl with a safer gradient-like View to prevent GPU crashes */}
            <View 
                pointerEvents="none" 
                className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/5 rounded-full" 
                style={{ opacity: 0.5 }}
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
                
                // Performance settings
                windowSize={3}
                initialNumToRender={1}
                maxToRenderPerBatch={1}
                removeClippedSubviews={Platform.OS === 'android'} 
                
                getItemLayout={(_, index) => ({
                    length: windowWidth,
                    offset: windowWidth * index,
                    index,
                })}
                
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                // 🚀 Added to prevent empty list rendering during navigation
                listKey="main_channel_list"
            />

            <View 
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 5, opacity: 0.3 }}
                pointerEvents="none"
            >
                <View className="h-1 w-1 rounded-full bg-blue-600" />
                <Text className="text-[8px] font-[900] uppercase tracking-[0.5em] text-blue-600">
                    Neural_Link // {CHANNELS[activeIndex]?.title?.toUpperCase() || "ALL"}_SECTOR
                </Text>
            </View>
        </View>
    ); 
}
