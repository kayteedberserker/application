import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { useColorScheme as useNativeWind } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    DeviceEventEmitter,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme as useSystemScheme,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AnimeLoading from "../../components/AnimeLoading";
import UpdateHandler from "../../components/UpdateModal";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";
import "../globals.css";
import CategoryNav from "./../../components/CategoryNav";
import TopBar from "./../../components/Topbar";

export default function MainLayout() {
    const { colorScheme, setColorScheme } = useNativeWind();
    const systemScheme = useSystemScheme();
    const router = useRouter();
    const pathname = usePathname();

    const [lastOffset, setLastOffset] = useState(0);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [showTop, setShowTop] = useState(false);
    const [showClanMenu, setShowClanMenu] = useState(false);
    const navY = useRef(new Animated.Value(0)).current;
    const { user, contextLoading } = useUser();
    const animValue = useRef(new Animated.Value(0)).current;

    // 1. Reset Nav Visibility whenever the route changes
    useEffect(() => {
        setIsNavVisible(true);
        Animated.timing(navY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [pathname]);

    useEffect(() => {
        Animated.spring(animValue, {
            toValue: showClanMenu ? 1 : 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    }, [showClanMenu]);
    const [userInClan, setUserInClan] = useState(false);
    const handleClanPress = async () => {
        try {
            const userClanData = await AsyncStorage.getItem('userClan');
            // If user is in a clan, toggle the menu showing Profile, Discover, and Wa  
            if (userClanData) {
                setUserInClan(true)
            }
            setShowClanMenu(!showClanMenu);
        } catch (e) {
            DeviceEventEmitter.emit("navigateSafely", "/screens/discover");
        }
    };

    const translateY_1 = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
    });

    const translateY_2 = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [40, 0],
    });

    const translateY_3 = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [60, 0],
    });

    const scale = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    const opacity = animValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, 1],
    });

    const rotation = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '90deg'],
    });

    useEffect(() => {
        if (user?.deviceId) {
            const updateActivity = async () => {
                try {
                    await apiFetch("https://oreblogda.com/api/mobile/app-open", {
                        method: "POST",
                        body: JSON.stringify({ deviceId: user.deviceId }),
                    });
                } catch (err) { }
            };
            updateActivity();
        }
    }, [user?.deviceId]);

    useEffect(() => {
        if (systemScheme) {
            setColorScheme(systemScheme);
        }
    }, [systemScheme]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener("onScroll", (offsetY) => {
            setShowTop(offsetY > 400);

            if (offsetY < lastOffset || offsetY < 50) {
                if (!isNavVisible) {
                    setIsNavVisible(true);
                    Animated.timing(navY, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                }
            } else if (offsetY > lastOffset && offsetY > 100) {
                if (isNavVisible) {
                    setIsNavVisible(false);
                    Animated.timing(navY, {
                        toValue: -70,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                }
            }
            setLastOffset(offsetY);
        });

        return () => subscription.remove();
    }, [lastOffset, isNavVisible]);

    const isDark = colorScheme === "dark";
    const handleBackToTop = () => DeviceEventEmitter.emit("doScrollToTop");

    // 2. Smart Navigation Logic
    const navigateTo = (route) => {
        // Close menus
        setShowClanMenu(false);

        // If user clicks HOME while already on a feed page
        if (route === "/" && (pathname === "/" || pathname.startsWith("/categories"))) {
            // First, scroll the feed to top
            DeviceEventEmitter.emit("doScrollToTop");
            // Then, reset the Swiper in HomePage to index 0 (Global)
            DeviceEventEmitter.emit("scrollToIndex", 0);
            return;
        }

        DeviceEventEmitter.emit("navigateSafely", route);
    };

    if (contextLoading) {
        return <AnimeLoading message="Loading Page" subMessage="Syncing Account" />;
    }
    const userAvailable = async () => {
        const userAvailable = await AsyncStorage.getItem("mobileUser");
        return userAvailable !== null;
    }
    if (!contextLoading && !userAvailable()) {
        return <Redirect href="/screens/FirstLaunchScreen" />;
    }

    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#000" : "#fff" }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <SafeAreaView
                style={{
                    zIndex: 100,
                    maxHeight: 130,
                }}>
                <TopBar isDark={isDark} />
                <Animated.View
                    style={{
                        transform: [{ translateY: navY }],
                        zIndex: 10,
                    }}
                >
                    <CategoryNav isDark={isDark} />
                </Animated.View>
            </SafeAreaView>

            <UpdateHandler />

            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="authordiary" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="post/[id]" />
                <Stack.Screen name="author/[id]" />
                <Stack.Screen name="categories/[id]" />
            </Stack>

            {/* CUSTOM FLOATING TAB BAR */}
            <View
                style={{
                    position: "absolute",
                    bottom: insets.bottom + 15,
                    height: 60,
                    width: "70%",
                    alignSelf: "center",
                    borderRadius: 25,
                    backgroundColor: isDark ? "#111111" : "#ffffff",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-around",
                    elevation: 10,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 5,
                    borderWidth: isDark ? 1 : 0.5,
                    borderColor: isDark ? "#1e293b" : "#e2e8f0",
                    zIndex: 999,
                }}
            >
                <TouchableOpacity onPress={() => navigateTo("/")} className="items-center justify-center">
                    <Ionicons
                        name={pathname === "/" || pathname.startsWith("/categories") ? "home" : "home-outline"}
                        size={22}
                        color={pathname === "/" || pathname.startsWith("/categories") ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b")}
                    />
                    <Text style={{ fontSize: 9, fontWeight: '900', color: pathname === "/" || pathname.startsWith("/categories") ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b"), marginTop: 2 }}>HOME</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigateTo("/authordiary")} className="items-center justify-center">
                    <Ionicons
                        name={pathname === "/authordiary" ? "add-circle" : "add-circle-outline"}
                        size={24}
                        color={pathname === "/authordiary" ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b")}
                    />
                    <Text style={{ fontSize: 9, fontWeight: '900', color: pathname === "/authordiary" ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b"), marginTop: 2 }}>ORE DIARY</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigateTo("/profile")} className="items-center justify-center">
                    <Ionicons
                        name={pathname === "/profile" ? "person" : "person-outline"}
                        size={22}
                        color={pathname === "/profile" ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b")}
                    />
                    <Text style={{ fontSize: 9, fontWeight: '900', color: pathname === "/profile" ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b"), marginTop: 2 }}>PROFILE</Text>
                </TouchableOpacity>
            </View>

            {/* FLOATING ACTION BUTTONS */}
            {showClanMenu && (
                <TouchableOpacity
                    style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }]}
                    activeOpacity={1}
                    onPress={() => setShowClanMenu(false)}
                />
            )}

            <View style={[styles.container, { bottom: insets.bottom + 22 }]}>
                {/* NEW: CLAN WAR BUTTON */}
                <Animated.View style={{
                    opacity,
                    transform: [{ translateY: translateY_3 || -180 }, { scale }], // Adjusting for 3rd position
                    marginBottom: 10
                }}>
                    <TouchableOpacity
                        onPress={() => {
                            setShowClanMenu(false);
                            navigateTo("/clans/war");
                        }}
                        activeOpacity={0.8}
                        style={[styles.subFab, { backgroundColor: "#ef4444" }]} // Red for War
                    >
                        <MaterialCommunityIcons name="sword-cross" size={20} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>

                {userInClan && <Animated.View style={{
                    opacity,
                    transform: [{ translateY: translateY_2 }, { scale }],
                    marginBottom: 10
                }}>
                    <TouchableOpacity
                        onPress={() => {
                            setShowClanMenu(false);
                            navigateTo("/clanprofile");
                        }}
                        activeOpacity={0.8}
                        style={[styles.subFab, { backgroundColor: "#3b82f6" }]}
                    >
                        <Ionicons name="shield" size={20} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
                }

                <Animated.View style={{
                    opacity,
                    transform: [{ translateY: translateY_1 }, { scale }],
                    marginBottom: 12
                }}>
                    <TouchableOpacity
                        onPress={() => {
                            setShowClanMenu(false);
                            navigateTo("/screens/discover");
                        }}
                        activeOpacity={0.8}
                        style={[styles.subFab, { backgroundColor: isDark ? "#1e293b" : "#475569" }]}
                    >
                        <Ionicons name="search" size={20} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>

                {showTop && (
                    <TouchableOpacity
                        onPress={handleBackToTop}
                        activeOpacity={0.7}
                        style={[
                            styles.mainFab,
                            {
                                marginBottom: 12,
                                backgroundColor: isDark ? "#111111" : "#f8fafc",
                                borderColor: isDark ? "#1e293b" : "#e2e8f0",
                            }
                        ]}
                    >
                        <Ionicons name="chevron-up" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={handleClanPress}
                    activeOpacity={0.8}
                    style={[
                        styles.mainFab,
                        {
                            borderColor: showClanMenu ? (isDark ? "#fff" : "#3b82f6") : (isDark ? "#1e293b" : "#e2e8f0"),
                            borderWidth: 2,
                            backgroundColor: showClanMenu
                                ? (isDark ? "#1e293b" : "#3b82f6")
                                : (isDark ? "#111111" : "#f8fafc")
                        }
                    ]}
                >
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <Ionicons
                            name={showClanMenu ? "close" : "shield-half"}
                            size={24}
                            color={showClanMenu ? "#fff" : "#3b82f6"}
                        />
                    </Animated.View>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        right: 4,
        alignItems: "center",
        zIndex: 1000,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 999,
    },
    mainFab: {
        width: 48,
        height: 48,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    subFab: {
        width: 45,
        height: 45,
        borderRadius: 15,
        justifyContent: "center",
        alignItems: "center",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    }
});
