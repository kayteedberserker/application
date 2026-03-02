import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { useColorScheme as useNativeWind } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
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
import CoinIcon from "../../components/ClanIcon";
import UpdateHandler from "../../components/UpdateModal";
import { useCoins } from "../../context/CoinContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";
import "../globals.css";
import CategoryNav from "./../../components/CategoryNav";
import TopBar from "./../../components/Topbar";

export default function MainLayout() {
    // 1. ALL HOOKS MUST BE AT THE TOP
    const { colorScheme, setColorScheme } = useNativeWind();
    const systemScheme = useSystemScheme();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets(); 

    const [lastOffset, setLastOffset] = useState(0);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [showTop, setShowTop] = useState(false);
    const [showClanMenu, setShowClanMenu] = useState(false);
    
    const navY = useRef(new Animated.Value(0)).current;
    
    const { user, contextLoading } = useUser();
    const { processTransaction } = useCoins(); 

    const animValue = useRef(new Animated.Value(0)).current;
    const eventPulse = useRef(new Animated.Value(1)).current;

    const [isUserAuthenticated, setIsUserAuthenticated] = useState(null);
    const [userInClan, setUserInClan] = useState(false);

    // 2. ALL USEEFFECTS & MEMOIZED VALUES
    useEffect(() => {
        setIsNavVisible(true);
        Animated.timing(navY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true, // 🔹 Back to true for smooth performance
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

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(eventPulse, {
                    toValue: 1.05,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(eventPulse, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, [eventPulse]);

    useEffect(() => {
        const checkUser = async () => {
            const storedUser = await AsyncStorage.getItem("mobileUser") || null;
            setIsUserAuthenticated(!!storedUser);
        };
        checkUser();
    }, []);

    // --- DAILY REWARDS LOGIC ---
    useEffect(() => {
        const checkDailyReward = async () => {
            if (!isUserAuthenticated) return;
            
            try {
                const storedStreak = await AsyncStorage.getItem("dailyStreak");
                const lastClaimed = await AsyncStorage.getItem("lastClaimedDate");
                
                let currentStreak = storedStreak ? parseInt(storedStreak) : 0;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (lastClaimed) {
                    const lastDate = new Date(lastClaimed);
                    lastDate.setHours(0, 0, 0, 0);
                    
                    const diffTime = today.getTime() - lastDate.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 0) {
                        setCanClaimToday(false);
                        setDailyStreak(currentStreak);
                    } else if (diffDays === 1) {
                        setCanClaimToday(true);
                        setDailyStreak(currentStreak >= 7 ? 0 : currentStreak);
                        setShowDailyModal(true); 
                    } else {
                        setCanClaimToday(true);
                        setDailyStreak(0);
                        setShowDailyModal(true);
                    }
                } else {
                    setCanClaimToday(true);
                    setDailyStreak(0);
                    setShowDailyModal(true);
                }
            } catch (error) {
                console.error("Error checking daily reward", error);
            }
        };
        
        checkDailyReward();
    }, [isUserAuthenticated]);

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
                        toValue: -80, // 🔹 Slide out slightly further to clear shadow
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                }
            }
            setLastOffset(offsetY);
        });
        return () => subscription.remove();
    }, [lastOffset, isNavVisible]);

    // 3. LOGIC & HANDLERS
    const handleClanPress = async () => {
        try {
            const userClanData = await AsyncStorage.getItem('userClan');
            if (userClanData) {
                setUserInClan(true);
            }
            setShowClanMenu(!showClanMenu);
        } catch (e) {
            DeviceEventEmitter.emit("navigateSafely", "/screens/discover");
        }
    };

    const handleClaimDaily = async () => {
        setIsClaiming(true);
        try {
            const newStreak = dailyStreak + 1;
            const transactionType = newStreak === 7 ? 'daily_login_7' : 'daily_login';
            
            const result = await processTransaction('claim', transactionType);
            
            if (result.success) {
                const today = new Date().toISOString();
                await AsyncStorage.setItem("dailyStreak", newStreak.toString());
                await AsyncStorage.setItem("lastClaimedDate", today);
                
                setDailyStreak(newStreak);
                setCanClaimToday(false);
                
                setTimeout(() => {
                    setIsClaiming(false);
                    setShowDailyModal(false);
                }, 800);
            } else {
                throw new Error("Transaction failed");
            }
        } catch (error) {
            console.error("Failed to claim daily reward", error);
            setIsClaiming(false);
        }
    };

    const translateY_1 = animValue.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
    const translateY_2 = animValue.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const translateY_3 = animValue.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
    const scale = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const opacityClan = animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
    const rotation = animValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

    const navOpacity = navY.interpolate({
        inputRange: [-70, -20, 0],
        outputRange: [0, 0.5, 1]
    });

    const isDark = colorScheme === "dark";
    const handleBackToTop = () => DeviceEventEmitter.emit("doScrollToTop");

    const navigateTo = (route) => {
        setShowClanMenu(false);
        if (route === "/" && (pathname === "/" || pathname.startsWith("/categories"))) {
            DeviceEventEmitter.emit("doScrollToTop");
            DeviceEventEmitter.emit("scrollToIndex", 0);
            return;
        }
        DeviceEventEmitter.emit("navigateSafely", route);
    };

    // 4. NOW IT IS SAFE TO DO EARLY RETURNS
    if (isUserAuthenticated === null) {
        return <AnimeLoading message="LOADING_PAGE" subMessage="Fetching Otaku Archives" />;
    };
    
    if (contextLoading) {
        return <AnimeLoading message="LOADING_PAGE" subMessage="Syncing Account" />;
    }

    if (!isUserAuthenticated) {
        return <Redirect href="/screens/FirstLaunchScreen" />;
    }

    const streakDays = [1, 2, 3, 4, 5, 6, 7];
    const targetDay = canClaimToday ? dailyStreak + 1 : dailyStreak;

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

            {/* DAILY REWARD MODAL */}
            <Modal
                visible={showDailyModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDailyModal(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? "#1e293b" : "#ffffff" }]}>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowDailyModal(false)}>
                            <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                        </TouchableOpacity>

                        <Text style={[styles.modalTitle, { color: isDark ? "#ffffff" : "#0f172a" }]}>Daily Check-In</Text>
                        <Text style={[styles.modalSubtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                            Claim coins every day! Complete the 7-day streak for a huge bonus.
                        </Text>

                        <View style={styles.daysGrid}>
                            {streakDays.map((day) => {
                                const isClaimed = day < targetDay || (!canClaimToday && day === targetDay);
                                const isCurrent = canClaimToday && day === targetDay;
                                const isDay7 = day === 7;
                                
                                return (
                                    <View 
                                        key={day} 
                                        style={[
                                            styles.dayItem, 
                                            { 
                                                backgroundColor: isClaimed ? "#10b981" : (isCurrent ? "#3b82f6" : (isDark ? "#334155" : "#f1f5f9")),
                                                borderColor: isCurrent ? "#60a5fa" : "transparent",
                                                borderWidth: isCurrent ? 2 : 0,
                                                width: isDay7 ? '100%' : '30%', 
                                            }
                                        ]}
                                    >
                                        <Text className="mb-2" style={[styles.dayText, { color: isClaimed || isCurrent ? "#ffffff" : (isDark ? "#94a3b8" : "#64748b") }]}>
                                            Day {day}
                                        </Text>
                                        
                                        {isClaimed ? (
                                            <Ionicons name="checkmark-circle" size={28} color="#ffffff" style={{ marginVertical: 4 }} />
                                        ) : (
                                            <CoinIcon size={24} type="OC" />
                                        )}
                                        
                                        <Text style={[styles.coinText, { color: isClaimed || isCurrent ? "#ffffff" : (isDark ? "#94a3b8" : "#64748b") }]}>
                                            +{isDay7 ? 50 : 10} OC
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            onPress={handleClaimDaily}
                            disabled={!canClaimToday || isClaiming}
                            style={[
                                styles.claimButton,
                                { backgroundColor: canClaimToday ? "#3b82f6" : (isDark ? "#334155" : "#cbd5e1") }
                            ]}
                        >
                            {isClaiming ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={[styles.claimButtonText, { color: canClaimToday ? "#ffffff" : (isDark ? "#94a3b8" : "#64748b") }]}>
                                    {canClaimToday ? `Claim Day ${targetDay} Reward` : "Come back tomorrow!"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="authordiary" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="post/[id]" />
                <Stack.Screen name="author/[id]" />
                <Stack.Screen name="categories/[id]" />
            </Stack>

            <TouchableOpacity 
                onPress={() => setShowDailyModal(true)}
                style={[styles.manualDailyButton, { backgroundColor: isDark ? "#1e293b" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}
            >
                <MaterialCommunityIcons name="calendar-check" size={20} color="#3b82f6" />
                {canClaimToday && <View style={styles.notificationDot} />}
            </TouchableOpacity>

            <Animated.View style={[styles.eventButtonContainer, { transform: [{ scale: eventPulse }] }]}>
                <TouchableOpacity
                    onPress={() => navigateTo("/screens/referralevent")}
                    activeOpacity={0.8}
                    style={[
                        styles.eventButton, 
                        { 
                            backgroundColor: isDark ? "#111111" : "#ffffff",
                            borderColor: isDark ? "#3b82f6" : "#60a5fa",
                            shadowColor: isDark ? "#60a5fa" : "#3b82f6",
                        }
                    ]}
                >
                    <Ionicons name="trophy" size={24} color={isDark ? "#60a5fa" : "#3b82f6"} />
                    <View style={{ position: 'absolute' }}> {/* Keep logic from prev version but wrapped correctly */}
                        <View style={[
                            styles.eventBadge, 
                            { 
                                backgroundColor: "#3b82f6", 
                                borderColor: isDark ? "#111111" : "#ffffff" 
                            }
                        ]}>
                            <Text style={styles.eventBadgeText}>WIN!</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>

            {/* CUSTOM FLOATING TAB BAR */}
            <View
                style={{
                    position: "absolute",
                    bottom: insets.bottom + 15,
                    height: 60,
                    left: 35, 
                    borderRadius: 30,
                    backgroundColor: isDark ? "rgba(17, 17, 17, 0.95)" : "rgba(255, 255, 255, 0.95)",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 8,
                    elevation: 10,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 5 },
                    shadowOpacity: 0.2,
                    shadowRadius: 5,
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
                    zIndex: 999,
                }}
            >
                {tabs.map((tab) => {
                    const isActive = tab.match(pathname);
                    return (
                        <TouchableOpacity 
                            key={tab.id}
                            onPress={() => navigateTo(tab.route)} 
                            activeOpacity={0.9}
                            style={{
                                height: 44,
                                borderRadius: 22,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingHorizontal: isActive ? 16 : 12,
                                backgroundColor: isActive ? tab.color : 'transparent',
                                marginHorizontal: 2,
                            }}
                        >
                            <Ionicons
                                name={isActive ? tab.icon : `${tab.icon}-outline`}
                                size={isActive ? 20 : 22}
                                color={isActive ? "#fff" : (isDark ? "#64748b" : "#94a3b8")}
                            />
                            {isActive && (
                                <Text 
                                    style={{ 
                                        fontSize: 11, 
                                        fontWeight: '900', 
                                        color: "#fff", 
                                        marginLeft: 8 
                                    }}
                                >
                                    {tab.label}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {showClanMenu && (
                <TouchableOpacity
                    style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }]}
                    activeOpacity={1}
                    onPress={() => setShowClanMenu(false)}
                />
            )}

            <View style={[styles.container, { bottom: insets.bottom + 22 }]}>
                <Animated.View style={{ opacity: opacityClan, transform: [{ translateY: translateY_3 }, { scale }], marginBottom: 10 }}>
                    <TouchableOpacity onPress={() => { setShowClanMenu(false); navigateTo("/screens/war"); }} activeOpacity={0.8} style={[styles.subFab, { backgroundColor: "#ef4444" }]}>
                        <MaterialCommunityIcons name="sword-cross" size={20} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>

                {userInClan && (
                    <Animated.View style={{ opacity: opacityClan, transform: [{ translateY: translateY_2 }, { scale }], marginBottom: 10 }}>
                        <TouchableOpacity onPress={() => { setShowClanMenu(false); navigateTo("/clanprofile"); }} activeOpacity={0.8} style={[styles.subFab, { backgroundColor: "#3b82f6" }]}>
                            <Ionicons name="shield" size={20} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                <Animated.View style={{ opacity: opacityClan, transform: [{ translateY: translateY_1 }, { scale }], marginBottom: 12 }}>
                    <TouchableOpacity onPress={() => { setShowClanMenu(false); navigateTo("/screens/discover"); }} activeOpacity={0.8} style={[styles.subFab, { backgroundColor: isDark ? "#1e293b" : "#475569" }]}>
                        <Ionicons name="search" size={20} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>

                {showTop && (
                    <TouchableOpacity onPress={handleBackToTop} activeOpacity={0.7} style={[styles.mainFab, { marginBottom: 12, backgroundColor: isDark ? "#111111" : "#f8fafc", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}>
                        <Ionicons name="chevron-up" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={handleClanPress} activeOpacity={0.8} style={[styles.mainFab, { borderColor: showClanMenu ? (isDark ? "#fff" : "#3b82f6") : (isDark ? "#1e293b" : "#e2e8f0"), borderWidth: 2, backgroundColor: showClanMenu ? (isDark ? "#1e293b" : "#3b82f6") : (isDark ? "#111111" : "#f8fafc") }]}>
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <Ionicons name={showClanMenu ? "close" : "shield-half"} size={24} color={showClanMenu ? "#fff" : "#3b82f6"} />
                    </Animated.View>
                </TouchableOpacity>
            </View>
        </View>
    );
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
    },
    eventButtonContainer: {
        position: 'absolute',
        right: 12,
        top: '45%',
        zIndex: 998,
    },
    eventButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        borderWidth: 2,
    },
    eventBadge: {
        position: 'absolute',
        top: -6,
        left: -8,
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderWidth: 1.5,
    },
    eventBadgeText: {
        fontSize: 8,
        color: '#ffffff',
        fontWeight: '900',
    }
});
