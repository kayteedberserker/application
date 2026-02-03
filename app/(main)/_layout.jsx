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
	Text,
	Modal,
	ActivityIndicator,
	Pressable
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

	// New states for the Clan Modal
	const [clanModalVisible, setClanModalVisible] = useState(false);
	const [isCooking, setIsCooking] = useState(false);

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

	// Logic for the Clan Modal
	const handleClanPress = () => {
		setIsCooking(true);
		setClanModalVisible(true);
		// Simulate cooking delay
		setTimeout(() => {
			setIsCooking(false);
		}, 2000);
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
					transform: [{ translateX: 0 }], 
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
					right: 15,
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

				{/* UPDATED: CLAN BUTTON */}
				<TouchableOpacity
					onPress={handleClanPress}
					activeOpacity={0.8}
					className="w-[52px] h-[52px] items-center justify-center rounded-[18px] border-2 border-[#111111] bg-[#111111]"
					style={{ elevation: 8, shadowColor: '#60a5fa', shadowOpacity: 0.5, shadowRadius: 10 }}
				>
					<Ionicons name="shield-half" size={28} color="#60a5fa" />
				</TouchableOpacity>
			</View>

			{/* COOKING MODAL */}
			<Modal
				animationType="fade"
				transparent={true}
				visible={clanModalVisible}
				onRequestClose={() => setClanModalVisible(false)}
			>
				<Pressable 
					className="flex-1 justify-center items-center bg-black/80 px-10"
					onPress={() => !isCooking && setClanModalVisible(false)}
				>
					<View className="w-full bg-[#111] border border-slate-800 rounded-[30px] p-8 items-center shadow-2xl">
						{isCooking ? (
							<View className="items-center py-4">
								<ActivityIndicator size="large" color="#60a5fa" />
								<Text className="text-blue-400 mt-4 font-bold tracking-widest italic">THE SYSTEM IS COOKING...</Text>
							</View>
						) : (
							<View className="items-center">
								<View className="bg-blue-500/10 p-4 rounded-full mb-4">
									<Ionicons name="flash" size={40} color="#60a5fa" />
								</View>
								<Text className="text-white text-xl font-black text-center mb-2">CLAN SYSTEM 2.0</Text>
								<Text className="text-slate-400 text-center leading-5 font-medium mb-6">
									The system is cooking something nice. I'm adding new features to the app to make your experience legendary. Anticipate!
								</Text>
								<TouchableOpacity 
									onPress={() => setClanModalVisible(false)}
									className="bg-blue-500 py-3 px-8 rounded-xl"
								>
									<Text className="text-black font-black text-sm">NOTED</Text>
								</TouchableOpacity>
							</View>
						)}
					</View>
				</Pressable>
			</Modal>
		</View>
	);
						}
