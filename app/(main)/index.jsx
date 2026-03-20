import { useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PagerView from 'react-native-pager-view';
import PostsViewer from "./../../components/PostViewer";
import { Text } from "./../../components/Text";
import CategoryPage from "./categories/[id]";

const CHANNELS = [
    { id: 'all', title: 'Global', type: 'feed' },
    { id: 'news', title: 'News', type: 'category' },
    { id: 'memes', title: 'Memes', type: 'category' },
    { id: 'fanart', title: 'Fan Art', type: 'category' },
    { id: 'polls', title: 'Polls', type: 'category' },
    { id: 'review', title: 'Review', type: 'category' },
    { id: 'gaming', title: 'Gaming', type: 'category' },
];

// ⚡️ STRICT MEMORY SCENE: Actively mounts AND destroys pages to save RAM
const Scene = memo(({ item, index, activeIndex }) => {
    
    // ⚡️ THE MEMORY RULES:
    // Rule 1: The Global Feed (Index 0) is ALWAYS mounted.
    // Rule 2: Mount the Active Page + 1 page to the left/right (so the finger swipe doesn't show a blank black screen).
    // Rule 3: If it doesn't match Rule 1 or 2, DESTROY the component to free RAM.
    const isGlobalFeed = index === 0;
    const isAdjacent = Math.abs(activeIndex - index) <= 1;
    const shouldMount = isGlobalFeed || isAdjacent;

    return (
        <View style={{ flex: 1 }}>
            <View className="flex-1 z-10 bg-transparent">
                {/* ⚡️ Only render the heavy lists if they pass the strict memory rules */}
                {shouldMount ? (
                    item.type === 'feed' ? <PostsViewer /> : <CategoryPage forcedId={item.id} />
                ) : null}
            </View>
            
            {/* Show loading indicator behind unmounted pages */}
            {!shouldMount && (
                <View 
                    pointerEvents="none" 
                    style={{ position: 'absolute', inset: 0, zIndex: -1 }}
                    className="items-center justify-center bg-[#050505]"
                >
                    <ActivityIndicator size="small" color="#2563eb" />
                </View>
            )}
        </View>
    );
}, (prevProps, nextProps) => {
    // ⚡️ AGGRESSIVE MEMOIZATION:
    // Do not let React re-render this Scene unless its 'shouldMount' status has changed.
    // This stops the app from lagging when you swipe.
    const prevShouldMount = prevProps.index === 0 || Math.abs(prevProps.activeIndex - prevProps.index) <= 1;
    const nextShouldMount = nextProps.index === 0 || Math.abs(nextProps.activeIndex - nextProps.index) <= 1;
    
    return prevShouldMount === nextShouldMount; 
});

export default function HomePage() {
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    
    const pagerRef = useRef(null);
    const { initialSector } = useLocalSearchParams(); 
    
    const [activeTitle, setActiveTitle] = useState(CHANNELS[0].title); 
    const [activeIndex, setActiveIndex] = useState(0); 

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("scrollToIndex", (index) => {
            pagerRef.current?.setPage(index); 
            setActiveIndex(index);
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (initialSector) {
            const index = parseInt(initialSector);
            const timer = setTimeout(() => {
                pagerRef.current?.setPage(index);
                setActiveTitle(CHANNELS[index].title);
                setActiveIndex(index);
                DeviceEventEmitter.emit("pageSwiped", index);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [initialSector]);

    const onPageSelected = useCallback((e) => {
        const newIndex = e.nativeEvent.position;
        setActiveTitle(CHANNELS[newIndex].title);
        setActiveIndex(newIndex); // ⚡️ This triggers the Scene unmounting logic
        DeviceEventEmitter.emit("pageSwiped", newIndex);
    }, []);

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>
            <PagerView
                ref={pagerRef}
                style={{ flex: 1 }}
                initialPage={0}
                onPageSelected={onPageSelected}
                overdrag={false} 
                offscreenPageLimit={1} 
            >
                {CHANNELS.map((item, index) => (
                    <View key={item.id} style={{ flex: 1 }} collapsable={false}>
                        <Scene item={item} index={index} activeIndex={activeIndex} />
                    </View>
                ))}
            </PagerView>

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