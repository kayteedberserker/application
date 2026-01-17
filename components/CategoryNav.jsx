import { usePathname, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { FlatList, TouchableOpacity, View, DeviceEventEmitter } from "react-native";
import { Text } from "./Text";

// 🔹 Order matches the FlatList in index.js
const categories = ["Home", "News", "Memes", "Polls", "Review", "Gaming"];

export default function CategoryNav({ isDark }) {
    const router = useRouter();
    const pathname = usePathname();
    const flatListRef = useRef(null);
    
    // 🔹 Local state to track which category is active via swipe
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        // 🔹 Listen for when the user swipes the FlatList in index.js
        const sub = DeviceEventEmitter.addListener("categoryChanged", (categoryName) => {
            const index = categories.indexOf(categoryName);
            if (index !== -1) {
                setActiveIndex(index);
                // 🔹 Automatically scroll the nav bar to the active item
                flatListRef.current?.scrollToIndex({ 
                    index, 
                    animated: true, 
                    viewPosition: 0.5 
                });
            }
        });
        return () => sub.remove();
    }, []);

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
                ref={flatListRef}
                horizontal
                data={categories}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                // Maintain touch stability
                contentContainerStyle={{ 
                    paddingHorizontal: 3, 
                    alignItems: 'center',
                    height: '100%' 
                }}
                scrollEnabled={true}
                nestedScrollEnabled={true}
                renderItem={({ item, index }) => {
                    const catSlug = item.toLowerCase().replace("/", "-");
                    
                    // 🔹 Highlight logic: Swipe Index takes priority, then fallback to URL
                    const isActive = activeIndex === index || (item !== "Home" && pathname.includes(catSlug));
                    const displayName = item === "Videos/Edits" ? "Videos" : item;

                    return (
                        <TouchableOpacity
                            onPress={() => {
                                setActiveIndex(index);
                                // 🔹 Tell the FlatList in index.js to jump to this page
                                DeviceEventEmitter.emit("jumpToCategory", item);
                            }}
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

                            {/* Tactical Corners UI */}
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
