import { usePathname, useRouter } from "expo-router"; // Added these
import { useEffect, useState } from "react";
import { BackHandler, DeviceEventEmitter, FlatList, TouchableOpacity, View } from "react-native";
import { Text } from "./Text";

// Categories match the IDs in HomePage CHANNELS (excluding 'all')
const categories = ["News", "Memes", "Polls", "Review", "Gaming"];

export default function CategoryNav({ isDark }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        // 🔹 1. Listen for swipes from HomePage
        const sub = DeviceEventEmitter.addListener("pageSwiped", (index) => {
            setActiveIndex(index);
        });

        // 🔹 2. Handle Hardware Back Button
        const backAction = () => {
            if (activeIndex !== 0) {
                setActiveIndex(0);
                DeviceEventEmitter.emit("scrollToIndex", 0);
                return true; 
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            backAction
        );

        return () => {
            sub.remove();
            backHandler.remove();
        };
    }, [activeIndex]);

    const handleCategoryPress = (actualSwiperIndex) => {
        setActiveIndex(actualSwiperIndex);

        // Check if we are actually on the home screen
        if (pathname === "/") {
            // We are already home, just scroll
            DeviceEventEmitter.emit("scrollToIndex", actualSwiperIndex);
        } else {
            // We are on Profile/Diary/etc. 
            // 1. Navigate home first
            router.replace("/");
            
            // 2. Wait for the HomePage to mount, then scroll
            setTimeout(() => {
                DeviceEventEmitter.emit("scrollToIndex", actualSwiperIndex);
            }, 100); 
        }
    };

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
                horizontal
                data={categories}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
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