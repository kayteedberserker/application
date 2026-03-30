import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { Text } from "./Text";

// ⚡️ ADDED: 'id' field to match your /categories/[id] route
const categories = [
    { id: "news", name: "News", icon: "newspaper-outline", activeIcon: "newspaper" },
    { id: "memes", name: "Memes", icon: "flash-outline", activeIcon: "flash" },
    { id: "fanart", name: "Fan Art", icon: "brush-outline", activeIcon: "brush" },
    { id: "polls", name: "Polls", icon: "stats-chart-outline", activeIcon: "stats-chart" },
    { id: "review", name: "Review", icon: "star-outline", activeIcon: "star" },
    { id: "gaming", name: "Gaming", icon: "game-controller-outline", activeIcon: "game-controller" },
];

const NavPill = memo(({ item, isActive, isDark, onPress }) => {
    const displayName = item.name === "Review" ? "Reviews" : item.name;

    return (
        <TouchableOpacity
            onPress={() => onPress(item.id)}
            activeOpacity={0.8}
            style={{
                marginRight: 10,
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                paddingHorizontal: isActive ? 12 : 8,
                transform: [{ scale: isActive ? 1.05 : 1 }]
            }}
            className={`rounded-full ${isActive ? "bg-blue-600 shadow-lg shadow-blue-500/40" : "bg-gray-100 dark:bg-gray-800/80"
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
}, (prevProps, nextProps) => prevProps.isActive === nextProps.isActive && prevProps.isDark === nextProps.isDark);

export default function CategoryNav({ isDark }) {
    const pathname = usePathname();
    const router = useRouter();
    // ⚡️ NEW: Get the current category ID from the route params to determine active state
    const { id } = useGlobalSearchParams();

    const navListRef = useRef(null);

    // ⚡️ Auto-scroll the nav list to the active pill when the route changes
    useEffect(() => {
        if (id && navListRef.current) {
            const activeIndex = categories.findIndex(c => c.id === id);
            if (activeIndex !== -1) {
                // Short delay to ensure FlatList layout is ready
                setTimeout(() => {
                    navListRef.current?.scrollToIndex({ index: activeIndex, animated: true, viewPosition: 0.5 });
                }, 100);
            }
        }
    }, [id]);

    const handleCategoryPress = useCallback((categoryId) => {
        // If they click the category they are already viewing, do nothing
        if (id === categoryId) return;

        // ⚡️ Direct navigation to the actual category page
        router.push(`/categories/${categoryId}`);
    }, [id, router]);

    const renderItem = useCallback(({ item }) => {
        // ⚡️ Pill is active if the route ID matches the item ID
        const isActive = id === item.id;

        return (
            <NavPill
                item={item}
                isActive={isActive}
                isDark={isDark}
                onPress={handleCategoryPress}
            />
        );
    }, [id, isDark, handleCategoryPress]);

    if (pathname === "/Search") return null;

    return (
        <View
            className="bg-transparent w-full"
            style={{ height: 40, borderBottomWidth: 1, borderBottomColor: isDark ? "rgba(30, 58, 138, 0.3)" : "rgba(229, 231, 235, 1)" }}
        >
            <FlatList
                ref={navListRef}
                horizontal
                data={categories}
                keyExtractor={(item) => item.id}
                extraData={id} // ⚡️ Re-render list when route ID changes
                showsHorizontalScrollIndicator={false}
                style={{ width: '100%' }}
                contentContainerStyle={{
                    paddingHorizontal: 15,
                    alignItems: 'center',
                    flexGrow: 1,
                    justifyContent: 'center'
                }}
                renderItem={renderItem}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        navListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                    }, 100);
                }}
            />
        </View>
    );
}