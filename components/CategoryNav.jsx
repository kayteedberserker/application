import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, DeviceEventEmitter, FlatList, TouchableOpacity, View } from "react-native";
import { Text } from "./Text";

const categories = [
    { name: "News", icon: "newspaper-outline", activeIcon: "newspaper" },
    { name: "Memes", icon: "flash-outline", activeIcon: "flash" },
    { name: "Fan Art", icon: "brush-outline", activeIcon: "brush" },
    { name: "Polls", icon: "stats-chart-outline", activeIcon: "stats-chart" },
    { name: "Review", icon: "star-outline", activeIcon: "star" },
    { name: "Gaming", icon: "game-controller-outline", activeIcon: "game-controller" },
];

const NavPill = memo(({ item, index, isActive, isDark, onPress }) => {
    const displayName = item.name === "Review" ? "Reviews" : item.name;
    const actualSwiperIndex = index + 1; 

    return (
        <TouchableOpacity
            onPress={() => onPress(actualSwiperIndex)}
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
                isActive ? "bg-blue-600 shadow-lg shadow-blue-500/40" : "bg-gray-100 dark:bg-gray-800/80"
            }`}
        >
            <Ionicons 
                name={isActive ? item.activeIcon : item.icon} 
                size={16} 
                color={isActive ? "white" : (isDark ? "#94a3b8" : "#64748b")} 
            />
            {isActive && (
                <Text className="ml-2 text-[10px] font-black uppercase tracking-tight text-white">
                    {displayName}
                </Text>
            )}
        </TouchableOpacity>
    );
});

export default function CategoryNav({ isDark }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeIndexRef = useRef(0); 
    
    const pathname = usePathname();
    const router = useRouter();
    const navListRef = useRef(null);

    // Sync active index when swiping
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("pageSwiped", (index) => {
            if (activeIndexRef.current !== index) {
                activeIndexRef.current = index;
                setActiveIndex(index);
                
                if (navListRef.current) {
                    try {
                        if (index > 0) {
                            navListRef.current.scrollToIndex({ index: index - 1, animated: true, viewPosition: 0.5 });
                        } else {
                            navListRef.current.scrollToOffset({ offset: 0, animated: true });
                        }
                    } catch (err) { /* index not in view yet */ }
                }
            }
        });

        const backAction = () => {
            if (activeIndexRef.current !== 0 && (pathname === "/" || pathname === "/index")) {
                handleCategoryPress(0);
                return true; 
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

        return () => {
            sub.remove();
            backHandler.remove();
        };
    }, [pathname]);

    const handleCategoryPress = useCallback((actualSwiperIndex) => {
        setActiveIndex(actualSwiperIndex);
        activeIndexRef.current = actualSwiperIndex;

        // ⚡️ Fix: Expo Router root path detection
        const isHome = pathname === "/" || pathname === "/index";

        if (isHome) {
            DeviceEventEmitter.emit("scrollToIndex", actualSwiperIndex);
        } else {
            // ⚡️ Fix: Use Params to navigate back to Home and set the index
            router.replace({
                pathname: "/",
                params: { initialSector: actualSwiperIndex }
            });
        }
    }, [pathname, router]);

    const renderItem = useCallback(({ item, index }) => (
        <NavPill 
            item={item} 
            index={index} 
            isActive={activeIndex === (index + 1)} 
            isDark={isDark} 
            onPress={handleCategoryPress} 
        />
    ), [activeIndex, isDark, handleCategoryPress]);

    if (pathname === "/Search") return null;

    return (
        <View 
            className="bg-transparent w-full"
            style={{ height: 50, borderBottomWidth: 1, borderBottomColor: isDark ? "rgba(30, 58, 138, 0.3)" : "rgba(229, 231, 235, 1)" }}
        >
            <FlatList
                ref={navListRef}
                horizontal
                data={categories} 
                keyExtractor={(item) => item.name}
                extraData={activeIndex} 
                showsHorizontalScrollIndicator={false}
                style={{ width: '100%' }}
                contentContainerStyle={{ paddingHorizontal: 15, alignItems: 'center' }}
                renderItem={renderItem}
            />
        </View>
    );
}