import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useColorScheme as useNativeWind } from "nativewind";
import { useEffect, useRef, useState } from "react";
import {
	Animated,
	DeviceEventEmitter,
	Image,
	Linking,
	StatusBar,
	TouchableOpacity,
	useColorScheme as useSystemScheme,
	View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AnimeLoading from "../../components/AnimeLoading";
import UpdateHandler from "../../components/UpdateModal";
import { useUser } from "../../context/UserContext";
import "../globals.css";
import CategoryNav from "./../../components/CategoryNav";
import TopBar from "./../../components/Topbar";

export default function MainLayout() {
	const { colorScheme, setColorScheme } = useNativeWind();
	const systemScheme = useSystemScheme(); // ✅ system theme

	const [lastOffset, setLastOffset] = useState(0);
	const [isNavVisible, setIsNavVisible] = useState(true);
	const [showTop, setShowTop] = useState(false);

	const navY = useRef(new Animated.Value(0)).current;
	const { user, contextLoading } = useUser();

	useEffect(() => {
		// We only ping if we have a deviceId (meaning the user has registered)
		if (user?.deviceId) {
			const updateActivity = async () => {
				try {
					// This happens in the background
					await fetch("https://oreblogda.com/api/mobile/app-open", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ deviceId: user.deviceId }),
					});
				} catch (err) {
					// We don't alert the user for analytics failures
					// console.error("Failed to update lastActive:", err);
				}
			};

			updateActivity();
		}
	}, [user?.deviceId]); // Runs once on mount, and again if user logs in

	// ✅ Only redirect if we ARE NOT loading context AND we have no user
	if (!contextLoading && !user) {
		return <Redirect href="/screens/FirstLaunchScreen" />;
	}

	// While context is fetching from AsyncStorage, show the loader with return
	if (contextLoading) {
		return <AnimeLoading message="Loading Page" subMessage="Syncing Account" />;
	}

	const insets = useSafeAreaInsets();

	// ✅ FIX: Sync system theme → NativeWind
	useEffect(() => {
		if (systemScheme) {
			setColorScheme(systemScheme);
		}
	}, [systemScheme]);

	// Scroll listener
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

	return (
		<>
			{/* STATUS BAR */}
			<StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
			
			{/* HEADER */}
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
			{/* TABS */}
            <Tabs
                backBehavior="history" // ✅ KEY FIX: Ensures back button goes to previous screen, not always Home
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: "#60a5fa",
                    tabBarInactiveTintColor: isDark ? "#94a3b8" : "#64748b",
                    tabBarShowLabel: true, 
                    tabBarLabelStyle: {
                        fontSize: 9,
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 8,
                    },
                    tabBarStyle: {
                        position: "absolute",
                        bottom: insets.bottom + 15,
                        height: 60, 
                        transform: [{ translateX: '15%' }], // 🛡️ PRESERVED AS REQUESTED
                        width: "70%",
                        alignSelf: "center",
                        borderRadius: 25,
                        backgroundColor: isDark ? "#111111" : "#ffffff",
                        borderTopWidth: 0,
                        borderWidth: isDark ? 1 : 0,
                        borderColor: "#1e293b",
                        paddingTop: 2,
                        elevation: 10,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 5,
                    },
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: "Home",
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons 
                                name={focused ? "home" : "home-outline"} 
                                size={22} 
                                color={color} 
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="authordiary"
                    options={{
                        title: "Ore Diary",
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons 
                                name={focused ? "add-circle" : "add-circle-outline"} 
                                size={24} 
                                color={color} 
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: "Profile",
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons 
                                name={focused ? "person" : "person-outline"} 
                                size={22} 
                                color={color} 
                            />
                        ),
                    }}
                />

                {/* Hidden Routes - Logic Changed: Removed 'display: none' so Tab Bar stays visible */}
                <Tabs.Screen name="post/[id]" options={{ href: null }} />
                <Tabs.Screen name="author/[id]" options={{ href: null }} />
                <Tabs.Screen name="categories/[id]" options={{ href: null }} />
            </Tabs>

			{/* FLOATING ACTION INTERFACE */}
			<View
				style={{
					position: "absolute",
					bottom: insets.bottom + 20,
					right: 20,
					gap: 12,
					alignItems: "center",
					zIndex: 1000,
				}}
			>
				{showTop && (
					<TouchableOpacity
						onPress={handleBackToTop}
						activeOpacity={0.7}
						style={{
							width: 48,
							height: 48,
							borderRadius: 16,
							justifyContent: "center",
							alignItems: "center",
							backgroundColor: "#111111",
							borderWidth: 1.5,
							borderColor: "#1e293b",
							elevation: 5,
							shadowColor: "#000",
							shadowOffset: { width: 0, height: 2 },
							shadowOpacity: 0.2,
						}}
					>
						<Ionicons name="chevron-up" size={24} color="#3b82f6" />
					</TouchableOpacity>
				)}

				<TouchableOpacity
					onPress={() =>
						Linking.openURL(
							"https://whatsapp.com/channel/0029VbBkiupCRs1wXFWtDG3N"
						)
					}
					activeOpacity={0.8}
					style={{
						elevation: 8,
						shadowColor: "#22c55e",
						shadowOffset: { width: 0, height: 4 },
						shadowOpacity: 0.3,
						shadowRadius: 8,
					}}
				>
					<Image
						source={require("../../assets/images/whatsapp.png")}
						style={{
							width: 52,
							height: 52,
							borderRadius: 18,
							borderWidth: 2,
							borderColor: "#111111"
						}}
					/>
				</TouchableOpacity>
			</View>
		</>
	);
						}
