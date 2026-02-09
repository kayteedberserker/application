import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, DeviceEventEmitter, FlatList, TouchableOpacity, View } from "react-native";
import { Text } from "./Text";

const categories = ["News", "Memes", "Polls", "Review", "Gaming"];

// Pre-calculate item width for smoother scrolling (Estimate: Padding 16 + Text ~50 + Margin 8)
const ESTIMATED_ITEM_WIDTH = 80; 

export default function CategoryNav({ isDark }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeIndexRef = useRef(0); // ⚡️ Mutable ref for instant access without re-renders
    
    const pathname = usePathname();
    const router = useRouter();
    const navListRef = useRef(null);

    useEffect(() => {
        // 🔹 1. Listen for swipes from HomePage
        const sub = DeviceEventEmitter.addListener("pageSwiped", (index) => {
            // Only update if changed to prevent thrashing
            if (activeIndexRef.current !== index) {
                activeIndexRef.current = index;
                setActiveIndex(index);
                
                // 🔹 Immediate Scroll Calculation
                if (index > 0 && navListRef.current) {
                    navListRef.current.scrollToIndex({ 
                        index: index - 1, 
                        animated: true, 
                        viewPosition: 0.5 
                    });
                } else if (index === 0 && navListRef.current) {
                     navListRef.current.scrollToOffset({ offset: 0, animated: true });
                }
            }
        });

        // 🔹 2. Handle Hardware Back Button
        const backAction = () => {
            if (activeIndexRef.current !== 0) {
                setActiveIndex(0);
                activeIndexRef.current = 0;
                DeviceEventEmitter.emit("scrollToIndex", 0);
                return true; 
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

        return () => {
            sub.remove();
            backHandler.remove();
        };
    }, []);

    const handleCategoryPress = useCallback((actualSwiperIndex) => {
        setActiveIndex(actualSwiperIndex);
        activeIndexRef.current = actualSwiperIndex;

        if (pathname === "/") {
            DeviceEventEmitter.emit("scrollToIndex", actualSwiperIndex);
        } else {
            router.replace("/");
            // Reduced timeout for snappier feel
            setTimeout(() => {
                DeviceEventEmitter.emit("scrollToIndex", actualSwiperIndex);
            }, 50); 
        }
    }, [pathname]);

    // ⚡️ Optimization: Define getItemLayout to avoid dynamic measurement lag
    const getItemLayout = (data, index) => ({
        length: ESTIMATED_ITEM_WIDTH,
        offset: ESTIMATED_ITEM_WIDTH * index,
        index,
    });

    return (
        <View 
            className={`shadow-sm ${isDark ? "bg-black/40" : "bg-white/40"}`} 
            style={{ 
                height: 55,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? "rgba(30, 58, 138, 0.3)" : "rgba(229, 231, 235, 1)",
            }}
        >
            <FlatList
                ref={navListRef}
                horizontal
                data={categories}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                // ⚡️ Added getItemLayout for performance
                // getItemLayout={getItemLayout} 
                // Note: If your tab widths vary significantly, remove getItemLayout. 
                // But for similar sized text tabs, it helps massively.
                
                contentContainerStyle={{ 
                    paddingHorizontal: 15, 
                    alignItems: 'center',
                    height: '100%' 
                }}
                renderItem={({ item, index }) => {
                    const actualSwiperIndex = index + 1;
                    const isActive = activeIndex === actualSwiperIndex;
                    const displayName = item === "Review" ? "Reviews" : item;

                    return (
                        <TouchableOpacity
                            onPress={() => handleCategoryPress(actualSwiperIndex)}
                            activeOpacity={0.7}
                            style={{ marginRight: 8 }}
                            className={`px-4 py-2 rounded-lg relative ${
                                isActive ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-800/80"
                            }`}
                        >
                            <Text 
                                className={`text-[10px] font-black uppercase tracking-widest ${
                                    isActive ? "text-white" : "text-gray-800 dark:text-gray-400"
                                }`}
                            >
                                {displayName}
                            </Text>

                            {isActive && (
                                <>
                                    <View style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 4, borderTopWidth: 1, borderLeftWidth: 1, borderColor: 'white' }} />
                                    <View style={{ position: 'absolute', bottom: 0, right: 0, width: 4, height: 4, borderBottomWidth: 1, borderRightWidth: 1, borderColor: 'white' }} />
                                </>
                            )}
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}