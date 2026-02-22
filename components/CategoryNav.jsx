import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, DeviceEventEmitter, FlatList, TouchableOpacity, View } from "react-native";
import { Text } from "./Text";
// 🔹 Using Expo's built-in Ionicons
import { Ionicons } from '@expo/vector-icons'; 

const categories = [
    { name: "News", icon: "newspaper-outline", activeIcon: "newspaper" },
    { name: "Memes", icon: "flash-outline", activeIcon: "flash" },
    { name: "Fan Art", icon: "brush-outline", activeIcon: "brush" },
    { name: "Polls", icon: "stats-chart-outline", activeIcon: "stats-chart" },
    { name: "Review", icon: "star-outline", activeIcon: "star" },
    { name: "Gaming", icon: "game-controller-outline", activeIcon: "game-controller" },
];

export default function CategoryNav({ isDark }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeIndexRef = useRef(0); 
    
    const pathname = usePathname();
    const router = useRouter();
    const navListRef = useRef(null);

    // Combine "All" with categories for the data source
    const navData = [{ name: "All", icon: "grid-outline", activeIcon: "grid" }, ...categories];

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("pageSwiped", (index) => {
            if (activeIndexRef.current !== index) {
                activeIndexRef.current = index;
                setActiveIndex(index);
                
                if (index >= 0 && navListRef.current) {
                    // ⚡️ Added a safety check to prevent index out of bounds
                    try {
                        navListRef.current.scrollToIndex({ 
                            index: index, 
                            animated: true, 
                            viewPosition: 0.5 
                        });
                    } catch (err) {
                        console.warn("Scroll error:", err);
                    }
                }
            }
        });

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
            // Keep the timeout for router transitions, but wrap the emit
            setTimeout(() => {
                DeviceEventEmitter.emit("scrollToIndex", actualSwiperIndex);
            }, 100); 
        }
    }, [pathname]);

    return (
        <View 
            className={`shadow-sm ${isDark ? "bg-black/40" : "bg-white/40"}`} 
            style={{ 
                height: 60,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? "rgba(30, 58, 138, 0.3)" : "rgba(229, 231, 235, 1)",
            }}
        >
            <FlatList
                ref={navListRef}
                horizontal
                data={navData} 
                keyExtractor={(item) => item.name}
                showsHorizontalScrollIndicator={false}
                // 🔹 Safety: Handles cases where index is requested before layout
                onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                        navListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                    });
                }}
                contentContainerStyle={{ 
                    paddingHorizontal: 15, 
                    alignItems: 'center',
                }}
                renderItem={({ item, index }) => {
                    const isActive = activeIndex === index;
                    const displayName = item.name === "Review" ? "Reviews" : item.name;

                    return (
                        <TouchableOpacity
                            onPress={() => handleCategoryPress(index)}
                            activeOpacity={0.8}
                            style={{ 
                                marginRight: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: isActive ? 14 : 10,
                                // Adding a slight scaling effect for feel
                                transform: [{ scale: isActive ? 1.05 : 1 }]
                            }}
                            className={`rounded-full ${
                                isActive 
                                ? "bg-blue-600 shadow-lg shadow-blue-500/40" 
                                : "bg-gray-100 dark:bg-gray-800/80"
                            }`}
                        >
                            <Ionicons 
                                name={isActive ? item.activeIcon : item.icon} 
                                size={isActive ? 18 : 20} 
                                color={isActive ? "white" : (isDark ? "#94a3b8" : "#64748b")} 
                            />

                            {isActive && (
                                <Text 
                                    className="ml-2 text-[11px] font-black uppercase tracking-tight text-white"
                                >
                                    {displayName}
                                </Text>
                            )}
                            
                            {/* Little indicator dot for the active tab */}
                            {isActive && (
                                <View 
                                    className="absolute -bottom-[2px] self-center w-1 h-1 bg-white rounded-full" 
                                    style={{ left: '50%', marginLeft: -0.5 }}
                                />
                            )}
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}
