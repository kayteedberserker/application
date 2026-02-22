import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, DeviceEventEmitter, FlatList, TouchableOpacity, View } from "react-native";
import { Text } from "./Text";

// 🔹 Your original category list (No "All" tab)
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

    useEffect(() => {
        // 🔹 Listen for swipes from HomePage
        const sub = DeviceEventEmitter.addListener("pageSwiped", (index) => {
            if (activeIndexRef.current !== index) {
                activeIndexRef.current = index;
                setActiveIndex(index);
                
                if (navListRef.current) {
                    try {
                        // Using your logic: index 0 is handled specially, others scroll
                        if (index > 0) {
                            navListRef.current.scrollToIndex({ 
                                index: index - 1, 
                                animated: true, 
                                viewPosition: 0.5 
                            });
                        } else {
                            navListRef.current.scrollToOffset({ offset: 0, animated: true });
                        }
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
            setTimeout(() => {
                DeviceEventEmitter.emit("scrollToIndex", actualSwiperIndex);
            }, 50); 
        }
    }, [pathname]);

    return (
        <View 
            className="shadow-sm bg-transparent w-full" // 🔹 Added w-full to ensure the wrapper spans the screen
            style={{ 
                height: 50,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? "rgba(30, 58, 138, 0.3)" : "rgba(229, 231, 235, 1)",
            }}
        >
            <FlatList
                ref={navListRef}
                horizontal
                data={categories} 
                keyExtractor={(item) => item.name}
                showsHorizontalScrollIndicator={false}
                centerContent={true} 
                style={{ width: '100%' }} // 🔹 Forces the FlatList to take the full width
                onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                        navListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                    });
                }}
                contentContainerStyle={{ 
                    paddingHorizontal: 15, 
                    alignItems: 'center',
                    flexGrow: 1, // 🔹 Crucial: Allows the container to grow to the screen width
                    justifyContent: 'center', // 🔹 Crucial: Pushes the items to the center of that grown space
                }}
                renderItem={({ item, index }) => {
                    // 🔹 Your logic: index + 1 maps to the swiper index
                    const actualSwiperIndex = index + 1;
                    const isActive = activeIndex === actualSwiperIndex;
                    const displayName = item.name === "Review" ? "Reviews" : item.name;

                    return (
                        <TouchableOpacity
                            onPress={() => handleCategoryPress(actualSwiperIndex)}
                            activeOpacity={0.8}
                            style={{ 
                                marginRight: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 6,
                                paddingHorizontal: isActive ? 12 : 8,
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
                                size={isActive ? 16 : 18} 
                                color={isActive ? "white" : (isDark ? "#94a3b8" : "#64748b")} 
                            />

                            {isActive && (
                                <Text 
                                    className="ml-2 text-[10px] font-black uppercase tracking-tight text-white"
                                >
                                    {displayName}
                                </Text>
                            )}
                            
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
