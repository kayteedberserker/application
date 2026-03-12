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

// ⚡️ LAZY LOADED SCENE: Only mounts if it is near the active screen
const Scene = memo(({ item, index, activeIndex }) => {
    const [hasLoaded, setHasLoaded] = useState(false);

    // If this scene is the active one, or immediately adjacent (left/right), load it.
    // Once it loads, it stays loaded so swiping back is instant.
    if (!hasLoaded && Math.abs(activeIndex - index) <= 1) {
        setHasLoaded(true);
    }

    return (
        <View style={{ flex: 1 }}>
            <View className="flex-1 z-10 bg-transparent">
                {/* ⚡️ Only mount the heavy list if it is inside our lazy window */}
                {hasLoaded ? (
                    item.type === 'feed' ? <PostsViewer /> : <CategoryPage forcedId={item.id} />
                ) : null}
            </View>
            
            {/* Show loading indicator ONLY if the heavy list hasn't mounted yet */}
            {!hasLoaded && (
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
    // If the scene has already been loaded, tell React to NEVER re-render it from here.
    // The LegendList inside will handle its own internal renders.
    const prevInWindow = Math.abs(prevProps.activeIndex - prevProps.index) <= 1;
    const nextInWindow = Math.abs(nextProps.activeIndex - nextProps.index) <= 1;
    
    if (prevInWindow) return true; // Block re-render if it was already loaded
    return prevInWindow === nextInWindow; // Only re-render when it enters the window
});

export default function HomePage() {
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    
    const pagerRef = useRef(null);
    const { initialSector } = useLocalSearchParams(); 
    
    const [activeTitle, setActiveTitle] = useState(CHANNELS[0].title); 
    // ⚡️ Track numeric index to drive the Lazy Window
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
        setActiveIndex(newIndex); // ⚡️ Update the window position
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
                        {/* ⚡️ Pass index and activeIndex to power the Lazy Engine */}
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
