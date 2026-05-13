import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { useColorScheme as useNativeWind } from "nativewind";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    DeviceEventEmitter,
    Dimensions // ⚡️ Added for Skia Layout
    ,































    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme as useSystemScheme,
    View
} from "react-native";
import { useMMKV } from "react-native-mmkv";
import Purchases from 'react-native-purchases'; // ⚡️ RevenueCat
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// ⚡️ IMPORT REANIMATED & MOTI & SKIA
import { BlurMask, Canvas, Rect, LinearGradient as SkiaGradient, vec } from '@shopify/react-native-skia'; // ⚡️ Added for Aura
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti'; // ⚡️ Added for high-end modal
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from "react-native-reanimated";

import AnimeLoading from "../../components/AnimeLoading";
import DailyModal from '../../components/DailyModal';
import GlobalMarquee from '../../components/GlobalMarquee';
import NeuralPinModal from "../../components/NeuralPinModal";
import TitleTag from "../../components/TitleTag";
import UpdateHandler from "../../components/UpdateModal";
import { useAlert } from "../../context/AlertContext";
import { useClan } from "../../context/ClanContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";
import "../globals.css";
import CategoryNav from "./../../components/CategoryNav";
import TopBar from "./../../components/Topbar";

const { width } = Dimensions.get('window'); // ⚡️ Get width for Skia

export default function MainLayout() {
    const { colorScheme, setColorScheme } = useNativeWind();
    const systemScheme = useSystemScheme();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const [isActive, setIsActive] = useState(false);

    const storage = useMMKV();

    useEffect(() => {
        if (pathname === "/Search" || pathname === "/" || pathname === "/authordiary" || pathname === "/profile") {
            setIsActive(true);
        } else {
            setIsActive(false);
        }
    }, [pathname]);

    const { warActionsCount, canManageClan, fullData, hasUnreadChat } = useClan();

    const [lastOffset, setLastOffset] = useState(0);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [showTop, setShowTop] = useState(false);
    const [showClanMenu, setShowClanMenu] = useState(false);

    // ⚡️ COFFEE SYSTEM STATE
    const [showCoffeeModal, setShowCoffeeModal] = useState(false);
    const [isCoffeeLoading, setIsCoffeeLoading] = useState(false);

    const { user, setUser, contextLoading, pinModalVisible, setPinModalVisible } = useUser();
    const CustomAlert = useAlert()
    if (__DEV__) console.log(pinModalVisible);

    // ⚡️ CLAN HINT STATE
    const [showClanHint, setShowClanHint] = useState(false);

    // ⚡️ REANIMATED SHARED VALUES
    const navY = useSharedValue(0);
    const clanMenuAnim = useSharedValue(0);
    const eventPulse = useSharedValue(1);
    const eventSpin = useSharedValue(0);
    const tooltipAnim = useSharedValue(0);
    const clanHintBounce = useSharedValue(0); // ⚡️ For the Gold clan hint

    const [isUserAuthenticated, setIsUserAuthenticated] = useState(() => {
        return storage.getString("mobileUser") !== "null" && storage.getString("mobileUser") ? true : null;
    });

    const [userInClan, setUserInClan] = useState(false);
    const [isFirstPostFlow, setIsFirstPostFlow] = useState(false);
    // =================================================================
    // 1. INTERCEPT: CHECK FOR FIRST POST FLAG
    // =================================================================
    useEffect(() => {
        const checkFirstPost = storage.getNumber("trigger_first_post");
        if (checkFirstPost !== 0 && checkFirstPost !== undefined) {
            setIsFirstPostFlow(true);
        }
    }, []);

    const tabs = [
        { id: 'home', label: 'HOME', icon: 'home', route: '/', color: '#3b82f6', match: (p) => p === "/" },
        { id: 'search', label: 'SEARCH', icon: 'search', route: '/Search', color: '#a855f7', match: (p) => p === "/Search" },
        { id: 'diary', label: 'DIARY', icon: 'add-circle', route: '/authordiary', color: '#10b981', match: (p) => p === "/authordiary" },
        { id: 'profile', label: 'PROFILE', icon: 'person', route: '/profile', color: '#f59e0b', match: (p) => p === "/profile" },
    ];

    // ⚡️ CLAN HINT LOGIC (2s Delay, 10x Max)
    useEffect(() => {
        const hintCount = storage.getNumber('clan_hint_count') || 0;
        if (hintCount < 5) {
            // 1. Wait 2 seconds before showing the hint
            const showTimer = setTimeout(() => {
                setShowClanHint(true);
                storage.set('clan_hint_count', hintCount + 1);

                // 2. Start Vertical Bouncing Animation (Up and Down)
                clanHintBounce.value = withRepeat(
                    withSequence(
                        withTiming(-8, { duration: 400 }), // Move up
                        withTiming(0, { duration: 400 })   // Move down
                    ), -1, true
                );
            }, 2000);

            // 3. Auto hide after 10 seconds total (2s wait + 8s display)
            const hideTimer = setTimeout(() => setShowClanHint(false), 10000);

            return () => {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
            };
        }
    }, []);

    // ⚡️ REANIMATED EFFECTS
    useEffect(() => {
        setIsNavVisible(true);
        navY.value = withTiming(0, { duration: 300 });
    }, [pathname]);

    useEffect(() => {
        clanMenuAnim.value = withSpring(showClanMenu ? 1 : 0, {
            damping: 15,
            stiffness: 150,
        });
    }, [showClanMenu]);

    useEffect(() => {
        // Continuous Pulse
        eventPulse.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1200 }),
                withTiming(1, { duration: 1200 })
            ),
            -1,
            false
        );

        eventSpin.value = 0;
        eventSpin.value = withRepeat(
            withTiming(1, { duration: 3500, easing: Easing.linear }),
            -1,
            false
        );

        // Attractor Tooltip Animation
        tooltipAnim.value = withSequence(
            withSpring(1, { damping: 12, stiffness: 100 }),
            withDelay(4000, withTiming(0, { duration: 500 }))
        );
    }, []);

    const checkAuthAndMigrate = async () => {
        if (isUserAuthenticated !== null) return;
        try {
            const legacyUserStr = await AsyncStorage.getItem("mobileUser");

            if (legacyUserStr) {
                if (__DEV__) console.log("Gatekeeper: Migrating veteran operative to MMKV...");
                storage.set("mobileUser", legacyUserStr);
                const parsed = JSON.parse(legacyUserStr);
                setUser(parsed);
                setIsUserAuthenticated(true);
                return;
            }
            setIsUserAuthenticated(false);
        } catch (e) {
            console.error("Gatekeeper migration error:", e);
            setIsUserAuthenticated(false);
        }
    };

    useEffect(() => {
        checkAuthAndMigrate();
    }, [isUserAuthenticated, setUser, storage]);

    useEffect(() => {
        if (user?.deviceId) {
            const updateActivity = async () => {
                try {
                    await apiFetch("/mobile/app-open", {
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
    }, [systemScheme, setColorScheme]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener("onScroll", (offsetY) => {
            setShowTop(offsetY > 400);
            if (offsetY < lastOffset || offsetY < 50) {
                if (!isNavVisible) {
                    setIsNavVisible(true);
                    navY.value = withTiming(0, { duration: 200 });
                }
            } else if (offsetY > lastOffset && offsetY > 100) {
                if (isNavVisible) {
                    setIsNavVisible(false);
                    navY.value = withTiming(-80, { duration: 200 });
                }
            }
            setLastOffset(offsetY);
        });
        return () => subscription.remove();
    }, [lastOffset, isNavVisible]);

    const handleClanPress = () => {
        setShowClanHint(false); // ⚡️ Instantly hide the hint if they click it!
        try {
            const userClanData = storage.getString('userClan');
            if (userClanData) {
                setUserInClan(true);
            }
            setShowClanMenu(!showClanMenu);
        } catch (e) {
            DeviceEventEmitter.emit("navigateSafely", "/screens/discover");
        }
    };

    // ⚡️ REVENUECAT CONFIGURATION CHECK
    useEffect(() => {
        const setupPurchases = async () => {
            if (Platform.OS === 'android') {
                // Double-check configuration even if handled in root _layout
                await Purchases.configure({ apiKey: "goog_cypWcXGzLgDujHkFvHTcUoqUNQi" });
            }
        };
        setupPurchases();
    }, []);

    // ⚡️ COFFEE PURCHASE LOGIC
    const handleBuyCoffee = async () => {
        setIsCoffeeLoading(true)
        // Call your special route to handle database saving
        try {
            const offerings = await Purchases.getOfferings();
            if (!offerings.current || offerings.current.availablePackages.length === 0) {
                CustomAlert("Error", "No offerings found. Check your Package Name and Store configuration.");
                return;
            }
            // Assumes your package identifier in RevenueCat is 'coffee_tip'
            const coffeePackage = offerings.current.availablePackages.find(p => p.product.identifier === 'buy_us_a_coffee');
            if (!offerings.current || offerings.current.availablePackages.length === 0) {
                CustomAlert("Error", "coffeePackage not found.");
                return;
            }
            if (coffeePackage) {
                const { customerInfo } = await Purchases.purchasePackage(coffeePackage);

                // Call your special route to handle database saving
                await apiFetch("/mobile/coins/coffee", {
                    method: "POST",
                    body: JSON.stringify({
                        uid: user?.uid,
                        transactionId: customerInfo.originalAppUserId
                    }),
                })

                CustomAlert("Success", "Coffee Sent Successful! ☕️ THE SYSTEM thanks you.");
                setShowCoffeeModal(false);
            }
        } catch (e) {
            if (!e.userCancelled) {
                console.error("Coffee Error", e);
                CustomAlert("Error", "Coffee Purchase Failed")
            }
        } finally {
            setIsCoffeeLoading(false);
        }
    };

    const NotificationBadge = ({ count, hasUnRead, size = 12 }) => {
        if (!hasUnRead && (!count || count <= 0)) return null;
        if (!hasUnRead && !canManageClan) return null;
        return (
            <View
                className="absolute -top-1 -right-1 bg-red-500 rounded-full items-center justify-center border-2 border-white dark:border-slate-900"
                style={{ minWidth: size, height: size, paddingHorizontal: 2 }}
            >
                {count > 9 && <View className="w-1 h-1 bg-white rounded-full" />}
            </View>
        )
    };

    // ⚡️ REANIMATED STYLES
    const navStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: navY.value }],
        opacity: interpolate(navY.value, [-70, -20, 0], [0, 0.5, 1], Extrapolation.CLAMP),
    }));

    const eventBtnStyle = useAnimatedStyle(() => ({
        transform: [{ scale: eventPulse.value }],
    }));

    const rouletteSpinStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${eventSpin.value * 360}deg` }],
        };
    });

    const tooltipStyle = useAnimatedStyle(() => ({
        opacity: tooltipAnim.value,
        transform: [
            { translateX: interpolate(tooltipAnim.value, [0, 1], [20, 0]) },
            { scale: interpolate(tooltipAnim.value, [0, 1], [0.8, 1]) }
        ],
    }));

    const mainFabIconStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(clanMenuAnim.value, [0, 1], [0, 90])}deg` }],
    }));

    const getSubFabStyle = (targetY) => useAnimatedStyle(() => ({
        opacity: interpolate(clanMenuAnim.value, [0, 0.5, 1], [0, 0, 1]),
        transform: [
            { translateY: interpolate(clanMenuAnim.value, [0, 1], [targetY, 0]) },
            { scale: clanMenuAnim.value }
        ]
    }));

    // ⚡️ Clan Hint Vertical Animation Style
    const clanHintAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: clanHintBounce.value }]
    }));

    const fab1Style = getSubFabStyle(20);
    const fab2Style = getSubFabStyle(40);
    const fab3Style = getSubFabStyle(60);

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

    if (contextLoading) {
        return <AnimeLoading tipType={"general"} message="LOADING_PAGE" subMessage="Syncing Account" />;
    }

    if (isUserAuthenticated === false) {
        return <Redirect href="/screens/FirstLaunchScreen" />;
    }

    const goldNeon = "#fcd34d";
    const deepVoid = "#050A18";

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? "#000" : "#fff" }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <SafeAreaView
                edges={['top', 'left', 'right']}
                style={{
                    zIndex: 100,
                    backgroundColor: isDark ? "#000" : "#fff",
                }}>
                <TopBar isDark={isDark} />
            </SafeAreaView>

            <Animated.View
                pointerEvents={isNavVisible ? "auto" : "none"}
                style={[
                    {
                        position: 'absolute',
                        top: insets.top + 55,
                        left: 0,
                        right: 0,
                        height: 40,
                        zIndex: 90,
                        backgroundColor: "transparent",
                    },
                    navStyle
                ]}
            >
                <CategoryNav isDark={isDark} />
            </Animated.View>
            {!isFirstPostFlow && <GlobalMarquee isDark={isDark} />}
            {!isFirstPostFlow && <UpdateHandler />}
            {!isFirstPostFlow && <NeuralPinModal visible={pinModalVisible}
                onSuccess={() => setPinModalVisible(false)} onClose={() => setPinModalVisible(false)} />}

            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="authordiary" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="post/[id]" />
                <Stack.Screen name="author/[id]" />
                <Stack.Screen name="categories/[id]" />
            </Stack>

            {/* ⚡️ THE GOLD ROULETTE EVENT BUTTON + COFFEE BUTTON */}
            <View style={styles.eventButtonContainer} pointerEvents="box-none">
                <View style={{ alignItems: 'center' }}>
                    {/* ⚡️ BUY ME A COFFEE BUTTON (Above Event Button) */}
                    <Animated.View style={eventBtnStyle}>
                        <TouchableOpacity
                            onPress={() => setShowCoffeeModal(true)}
                            activeOpacity={0.8}
                            style={[
                                styles.coffeeButton,
                                {
                                    backgroundColor: isDark ? "#111" : "#fff",
                                    borderColor: "#fcd34d",
                                    marginBottom: 20
                                }
                            ]}
                        >
                            <Feather name="coffee" size={20} color="#fcd34d" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* EVENT BUTTON */}
                    <Animated.View style={eventBtnStyle}>
                        <TouchableOpacity
                            onPress={() => navigateTo("/screens/referralevent")}
                            activeOpacity={0.8}
                            style={[
                                styles.eventButton,
                                {
                                    backgroundColor: isDark ? "#111111" : "#ffffff",
                                    borderColor: "#f59e0b",
                                    shadowColor: "#f59e0b",
                                }
                            ]}
                        >
                            <Animated.View style={rouletteSpinStyle}>
                                <Ionicons name="aperture" size={26} color="#f59e0b" />
                            </Animated.View>

                            <View style={[
                                styles.eventBadge,
                                { backgroundColor: "#f59e0b", borderColor: isDark ? "#111111" : "#ffffff" }
                            ]}>
                                <Text style={styles.eventBadgeText}>EVENT</Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </View>

            {/* ⚡️ CLEAN COFFEE SUPPORT MODAL */}
            <Modal visible={showCoffeeModal} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.coffeeOverlay}>
                    <MotiView
                        from={{ opacity: 0, scale: 0.9, translateY: 20 }}
                        animate={{
                            opacity: showCoffeeModal ? 1 : 0,
                            scale: showCoffeeModal ? 1 : 0.9,
                            translateY: showCoffeeModal ? 0 : 20
                        }}
                        transition={{ type: 'timing', duration: 400 }}
                        style={[styles.coffeeModalHighEnd, { backgroundColor: deepVoid, borderColor: goldNeon }]}
                        className="p-6 rounded-[40px] border-2 overflow-hidden shadow-2xl"
                    >
                        {/* SKIA AURA BACKGROUND */}
                        <View className="absolute inset-0">
                            <Canvas style={{ flex: 1 }}>
                                <Rect x={0} y={0} width={width * 0.9} height={600}>
                                    <SkiaGradient
                                        start={vec(0, 0)}
                                        end={vec(width * 0.9, 400)}
                                        colors={["rgba(252,211,77,0.15)", "transparent", "rgba(252,211,77,0.05)"]}
                                    />
                                </Rect>
                                <BlurMask blur={30} style="normal" />
                            </Canvas>
                        </View>

                        {/* ACTION LINES */}
                        <View className="absolute inset-0 opacity-10">
                            <LinearGradient colors={['transparent', goldNeon, 'transparent']} style={{ width: 1, height: '100%', position: 'absolute', left: '15%', transform: [{ rotate: '35deg' }] }} />
                            <LinearGradient colors={['transparent', goldNeon, 'transparent']} style={{ width: 1, height: '100%', position: 'absolute', right: '15%', transform: [{ rotate: '-35deg' }] }} />
                        </View>

                        <View className="flex-row justify-between items-start z-10 mb-4">
                            <MotiView from={{ rotate: '0deg' }} animate={{ rotate: '360deg' }} transition={{ loop: true, duration: 10000, type: 'timing' }}>
                                <MaterialCommunityIcons name="atom" size={24} color={goldNeon} />
                            </MotiView>
                            <TouchableOpacity onPress={() => setShowCoffeeModal(false)} className="bg-white/10 p-2 rounded-full border border-white/10">
                                <Ionicons name="close" size={20} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View className="items-center z-10">
                            <MotiView from={{ scale: 1 }} animate={{ scale: [1, 1.1, 1] }} transition={{ loop: true, duration: 2000 }} className="mb-4">
                                <Feather name="coffee" size={64} color={goldNeon} />
                            </MotiView>

                            <Text style={{ color: 'white' }} className="text-3xl font-black italic uppercase tracking-tighter text-center">BUY US A COFFEE</Text>

                            <View className="flex-row items-center mb-6">
                                <View style={{ backgroundColor: goldNeon }} className="h-[2px] w-8 mr-2" />
                                <Text style={{ color: goldNeon }} className="text-[10px] font-black uppercase tracking-[0.3em]">Support THE SYSTEM</Text>
                                <View style={{ backgroundColor: goldNeon }} className="h-[2px] w-8 ml-2" />
                            </View>

                            {/* ⚡️ THE UPDATED NORMAL WRITEUP */}
                            <Text className="text-white/60 text-center text-[13px] leading-5 mb-8 px-4">
                                Buying a coffee for <Text className="text-white font-bold">THE SYSTEM</Text> helps keep the servers running and the experience fast. Your support directly contributes to maintaining and evolving the system for everyone.
                            </Text>

                            <MotiView className="bg-yellow-500/10 p-4 rounded-2xl border border-yellow-500/20 mb-4 w-full flex-row items-center justify-center">
                                <MaterialCommunityIcons name="shield-star" size={18} color={goldNeon} className="mr-2" />
                                <Text style={{ color: goldNeon }} className="text-[11px] font-black uppercase tracking-widest text-center">UNLOCKS 'SYSTEM PATRON' TITLE</Text>
                            </MotiView>

                            <View className="w-full flex-row items-center justify-center mb-4">
                                <TitleTag isDark={isDark} title={"System Patron"} tier={"Rare"} />
                            </View>

                            <TouchableOpacity onPress={handleBuyCoffee} disabled={isCoffeeLoading} activeOpacity={0.9} className="w-full">
                                <LinearGradient colors={[goldNeon, '#B45309']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="py-5 rounded-2xl flex-row justify-center items-center shadow-xl border border-white/20">
                                    {isCoffeeLoading ? <ActivityIndicator color={deepVoid} /> : (
                                        <>
                                            <Feather name="coffee" size={20} color={deepVoid} />
                                            <Text style={{ color: deepVoid }} className="font-black uppercase ml-2 tracking-[0.1em] text-[16px] italic">SEND A COFFEE ($0.99)</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <Text className="text-white/30 text-[9px] mt-4 uppercase font-bold tracking-widest">Secure Transaction via Google Play</Text>
                        </View>
                    </MotiView>
                </View>
            </Modal>

            <View
                style={{
                    position: "absolute",
                    bottom: insets.bottom + 15,
                    height: 60,
                    left: isActive ? 25 : 50,
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
                    const active = tab.match(pathname);
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
                                paddingHorizontal: active ? 16 : 12,
                                backgroundColor: active ? tab.color : 'transparent',
                                marginHorizontal: 2,
                            }}
                        >
                            <Ionicons
                                name={active ? tab.icon : `${tab.icon}-outline`}
                                size={active ? 20 : 22}
                                color={active ? "#fff" : (isDark ? "#64748b" : "#94a3b8")}
                            />
                            {active && (
                                <Text
                                    style={{ fontSize: 11, fontWeight: '900', color: "#fff", marginLeft: 8 }}
                                >
                                    {tab.label}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {!isFirstPostFlow && <DailyModal />}

            {showClanMenu && (
                <TouchableOpacity
                    style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }]}
                    activeOpacity={1}
                    onPress={() => setShowClanMenu(false)}
                />
            )}

            <View
                style={[styles.container, { bottom: insets.bottom + 22 }]}
                pointerEvents="box-none"
            >
                <Animated.View pointerEvents={showClanMenu ? "auto" : "none"} style={[fab3Style, { marginBottom: 10 }]}>
                    <TouchableOpacity
                        onPress={() => { setShowClanMenu(false); navigateTo("/screens/war"); }}
                        activeOpacity={0.8}
                        style={[styles.subFab, { backgroundColor: "#ef4444" }]}
                    >
                        <MaterialCommunityIcons name="sword-cross" size={20} color="#fff" />
                        <NotificationBadge count={warActionsCount} />
                    </TouchableOpacity>
                </Animated.View>

                {userInClan && (
                    <Animated.View pointerEvents={showClanMenu ? "auto" : "none"} style={[fab2Style, { marginBottom: 10 }]}>
                        <TouchableOpacity
                            onPress={() => { setShowClanMenu(false); navigateTo("/clanprofile"); }}
                            activeOpacity={0.8}
                            style={[styles.subFab, { backgroundColor: "#3b82f6" }]}
                        >
                            <Ionicons name="shield" size={20} color="#fff" />
                            <NotificationBadge hasUnRead={hasUnreadChat} count={fullData} />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                <Animated.View pointerEvents={showClanMenu ? "auto" : "none"} style={[fab1Style, { marginBottom: 12 }]}>
                    <TouchableOpacity
                        onPress={() => { setShowClanMenu(false); navigateTo("/screens/discover"); }}
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
                        style={[styles.mainFab, { marginBottom: 12, backgroundColor: isDark ? "#111111" : "#f8fafc", borderColor: isDark ? "#1e293b" : "#e2e8f0" }]}
                    >
                        <Ionicons name="chevron-up" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                )}

                {/* ⚡️ WRAPPER FOR MAIN FAB + VERTICAL FLOATING HINT */}
                <View className="relative items-center justify-center z-50">

                    {/* ⚡️ VERTICAL BOUNCING GOLD HINT */}
                    {!isFirstPostFlow && showClanHint && !showClanMenu && (
                        <Animated.View
                            style={[clanHintAnimatedStyle, { position: 'absolute', bottom: 40, right: 10, alignItems: 'center' }]}
                            className="z-[100]"
                            pointerEvents="none"
                        >
                            <View
                                style={{ backgroundColor: '#f59e0b', shadowColor: '#f59e0b' }}
                                className="px-4 py-3 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.6)] min-w-[100] border border-yellow-300 items-center justify-center"
                            >
                                <View className="flex-row items-center mb-1">
                                    <Ionicons name="shield-half" size={24} color="white" className="mr-1" />
                                    <Text className="text-white font-black uppercase text-[12px] tracking-widest leading-tight text-center">
                                        Clan Details
                                    </Text>
                                </View>
                                <Text className="text-white/80 font-bold uppercase text-[10px] tracking-widest text-center">
                                    Tap To Access
                                </Text>
                            </View>

                            <Ionicons
                                name="caret-down"
                                size={28}
                                color="#f59e0b"
                                style={{
                                    marginTop: -8,
                                    position: "absolute",
                                    right: 0,
                                    bottom: 0,
                                    textShadowColor: 'rgba(245, 158, 11, 0.5)',
                                    textShadowOffset: { width: 0, height: 2 },
                                    textShadowRadius: 6
                                }}
                            />
                        </Animated.View>
                    )}

                    <TouchableOpacity
                        onPress={handleClanPress}
                        activeOpacity={0.8}
                        style={[
                            styles.mainFab,
                            {
                                borderColor: showClanMenu ? (isDark ? "#fff" : "#3b82f6") : (isDark ? "#1e293b" : "#e2e8f0"),
                                borderWidth: 2,
                                backgroundColor: showClanMenu ? (isDark ? "#1e293b" : "#3b82f6") : (isDark ? "#111111" : "#f8fafc")
                            }
                        ]}
                    >
                        <Animated.View style={mainFabIconStyle}>
                            <Ionicons
                                name={showClanMenu ? "close" : "shield-half"}
                                size={24}
                                color={showClanMenu ? "#fff" : "#3b82f6"}
                            />
                        </Animated.View>

                        {(!showClanMenu && canManageClan && (warActionsCount > 0 || fullData > 0)) || hasUnreadChat && (
                            <View
                                style={{
                                    position: 'absolute', top: -2, right: -2, width: 14, height: 14,
                                    borderRadius: 7, backgroundColor: '#ef4444', borderWidth: 2,
                                    borderColor: isDark ? '#111111' : '#f8fafc'
                                }}
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: "absolute", right: 15, alignItems: "center", zIndex: 1000 },
    overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
    mainFab: { width: 48, height: 48, borderRadius: 18, justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65 },
    subFab: { width: 45, height: 45, borderRadius: 15, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    eventButtonContainer: { position: 'absolute', right: 12, top: '42%', zIndex: 998, flexDirection: 'row', alignItems: 'center' },
    eventButton: { width: 40, height: 40, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5, borderWidth: 2 },
    eventBadge: { position: 'absolute', top: -6, left: -8, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.5 },
    eventBadgeText: { fontSize: 6, color: '#ffffff', fontWeight: '900' },
    coffeeButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, elevation: 4 },

    // ⚡️ Coffee Modal High End
    coffeeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    coffeeModalHighEnd: { width: '100%', maxWidth: 400, position: 'relative' },

    // ⚡️ Tooltip Styles for Event Button
    tooltipContainer: { backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 10, elevation: 5, shadowColor: '#f59e0b', shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    tooltipText: { color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    tooltipArrow: { position: 'absolute', right: -4, top: '50%', marginTop: -4, width: 0, height: 0, borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 5, borderStyle: 'solid', backgroundColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#f59e0b' }
});