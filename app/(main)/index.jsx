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

const Scene = memo(({ item }) => (
    <View style={{ flex: 1 }}>
        <View className="flex-1 z-10 bg-transparent">
            {item.type === 'feed' ? <PostsViewer /> : <CategoryPage forcedId={item.id} />}
        </View>
        <View 
            pointerEvents="none" 
            style={{ position: 'absolute', inset: 0, zIndex: -1 }}
            className="items-center justify-center bg-[#050505]"
        >
            <ActivityIndicator size="small" color="#2563eb" />
        </View>
    </View>
), (p, n) => p.item.id === n.item.id);

export default function HomePage() {
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    
    const pagerRef = useRef(null);
    const { initialSector } = useLocalSearchParams(); // ⚡️ Listen for incoming redirect
    const [activeTitle, setActiveTitle] = useState(CHANNELS[0].title); 

    // Handle internal swipes/taps
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("scrollToIndex", (index) => {
            pagerRef.current?.setPage(index); 
        });
        return () => sub.remove();
    }, []);

    // ⚡️ Handle cross-page navigation via params
    useEffect(() => {
        if (initialSector) {
            const index = parseInt(initialSector);
            // Slight delay ensures the PagerView is native-ready
            const timer = setTimeout(() => {
                pagerRef.current?.setPage(index);
                setActiveTitle(CHANNELS[index].title);
                DeviceEventEmitter.emit("pageSwiped", index);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [initialSector]);

    const onPageSelected = useCallback((e) => {
        const newIndex = e.nativeEvent.position;
        setActiveTitle(CHANNELS[newIndex].title);
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
                {CHANNELS.map((item) => (
                    <View key={item.id} style={{ flex: 1 }} collapsable={false}>
                        <Scene item={item} />
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