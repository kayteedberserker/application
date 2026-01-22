import { Ionicons } from "@expo/vector-icons";
import { Redirect, Stack, useRouter, usePathname } from "expo-router";
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
	View,
	Text
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AnimeLoading from "../../components/AnimeLoading";
import UpdateHandler from "../../components/UpdateModal";
import { useUser } from "../../context/UserContext";
import "../globals.css";
import CategoryNav from "./../../components/CategoryNav";
import TopBar from "./../../components/Topbar";
import apiFetch from "../../utils/apiFetch"

export default function MainLayout() {
	const { colorScheme, setColorScheme } = useNativeWind();
	const systemScheme = useSystemScheme();
	const router = useRouter();
	const pathname = usePathname(); // To highlight the active "tab"

	const [lastOffset, setLastOffset] = useState(0);
	const [isNavVisible, setIsNavVisible] = useState(true);
	const [showTop, setShowTop] = useState(false);

	const navY = useRef(new Animated.Value(0)).current;
	const { user, contextLoading } = useUser();

	useEffect(() => {
		if (user?.deviceId) {
			const updateActivity = async () => {
				try {
					await apiFetch("https://oreblogda.com/api/mobile/app-open", {
						method: "POST",
						body: JSON.stringify({ deviceId: user.deviceId }),
					});
				} catch (err) {}
			};
			updateActivity();
		}
	}, [user?.deviceId]);

	if (!contextLoading && !user) {
		return <Redirect href="/screens/FirstLaunchScreen" />;
	}

	if (contextLoading) {
		return <AnimeLoading message="Loading Page" subMessage="Syncing Account" />;
	}

	const insets = useSafeAreaInsets();

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

	// Helper for the custom tab bar navigation
	const navigateTo = (route) => {
		router.push(route);
	};

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

			{/* ✅ REPLACED TABS WITH STACK FOR BULLETPROOF BACK-BUTTON LOGIC */}
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="index" />
				<Stack.Screen name="authordiary" />
				<Stack.Screen name="profile" />
				<Stack.Screen name="post/[id]" />
				<Stack.Screen name="author/[id]" />
				<Stack.Screen name="categories/[id]" />
			</Stack>

			{/* ✅ CUSTOM FLOATING TAB BAR (UI PRESERVED) */}
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
					borderWidth: isDark ? 1 : 0,
					borderColor: "#1e293b",
					transform: [{ translateX: 0 }], // Adjusted for the View container
					zIndex: 999,
				}}
			>
				{/* HOME TAB */}
				<TouchableOpacity onPress={() => navigateTo("/")} className="items-center justify-center">
					<Ionicons 
						name={pathname === "/" ? "home" : "home-outline"} 
						size={22} 
						color={pathname === "/" ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b")} 
					/>
					<Text style={{ fontSize: 9, fontWeight: '900', color: pathname === "/" ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b"), marginTop: 2 }}>HOME</Text>
				</TouchableOpacity>

				{/* DIARY TAB */}
				<TouchableOpacity onPress={() => navigateTo("/authordiary")} className="items-center justify-center">
					<Ionicons 
						name={pathname === "/authordiary" ? "add-circle" : "add-circle-outline"} 
						size={24} 
						color={pathname === "/authordiary" ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b")} 
					/>
					<Text style={{ fontSize: 9, fontWeight: '900', color: pathname === "/authordiary" ? "#60a5fa" : (isDark ? "#94a3b8" : "#64748b"), marginTop: 2 }}>ORE DIARY</Text>
				</TouchableOpacity>

				{/* PROFILE TAB */}
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
			<View
				style={{
					position: "absolute",
					bottom: insets.bottom + 20,
					right: 5,
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
						}}
					>
						<Ionicons name="chevron-up" size={24} color="#3b82f6" />
					</TouchableOpacity>
				)}

				<TouchableOpacity
					onPress={() => Linking.openURL("https://whatsapp.com/channel/0029VbBkiupCRs1wXFWtDG3N")}
					activeOpacity={0.8}
					style={{ elevation: 8 }}
				>
					<Image
						source={require("../../assets/images/whatsapp.png")}
						style={{
							width: 50,
							height: 50,
							borderRadius: 18,
							borderWidth: 2,
							borderColor: "#111111"
						}}
					/>
				</TouchableOpacity>
			</View>
		</View>
	);
}
