import { useColorScheme } from "nativewind";
import { useEffect, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncLoading } from "../../components/SyncLoading";
import PostsViewer from "./../../components/PostViewer";
import { Text } from "./../../components/Text";

export default function HomePage() {
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    // ⚡️ State to hold off rendering the heavy list
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // ⚡️ Wait for all navigation animations and layout to finish
        const task = InteractionManager.runAfterInteractions(() => {
            setIsReady(true);
        });

        return () => task.cancel();
    }, []);

    return (
        <View className={`flex-1 ${isDark ? "bg-[#050505]" : "bg-white"}`}>

            {/* ⚡️ Only mount the heavy PostsViewer when the screen is fully ready */}
            {isReady ? (
                <PostsViewer />
            ) : (
                // Lightweight loading view during the split-second transition
                <View className="flex-1 items-center justify-center">
                    <SyncLoading message="Fetching Otaku Archives..." />
                </View>
            )}

            {/* ⚡️ Your Cyberpunk UI Overlay */}
            <View
                className="absolute left-6 flex-row items-center gap-2"
                style={{ bottom: insets.bottom + 5, opacity: 0.3 }}
                pointerEvents="none"
            >
                <View className="h-1 w-1 rounded-full bg-blue-600" />
                <Text className="text-[8px] font-[900] uppercase tracking-[0.5em] text-blue-600">
                    Neural_Link // GLOBAL_SECTOR
                </Text>
            </View>

        </View>
    );
}