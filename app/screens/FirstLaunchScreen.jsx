import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from "expo-constants";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Dimensions,
	Image,
	LayoutAnimation,
	Modal,
	Platform,
	Pressable,
	Text as RNText,
	ScrollView,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
	useColorScheme
} from "react-native";
import { useMMKV } from "react-native-mmkv";

import Animated, {
	Easing, FadeInRight,
	SlideInRight,
	ZoomIn,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming
} from "react-native-reanimated";

import * as SecureStore from 'expo-secure-store';
import AnimeLoading from "../../components/AnimeLoading";
import NeuralPinModal from "../../components/NeuralPinModal";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useAlert } from "../../context/AlertContext";
import { useClan } from "../../context/ClanContext";
import { useStreak } from "../../context/StreakContext";
import { useUser } from "../../context/UserContext";
import apiFetch, { syncApiUser } from "../../utils/apiFetch";
import { getFingerprint } from "../../utils/device";
const { width, height } = Dimensions.get('window');
const FORBIDDEN_NAMES = ["admin", "system", "the admin", "the system", "administrator", "moderator"];

const ANIME_LIST = [
	"Naruto", "One Piece", "Bleach", "Dragon Ball Z", "Hunter x Hunter",
	"JJK", "Solo Leveling", "My Hero Academia", "Hell's Paradise", "Demon Slayer", "AOT", "Chainsaw Man",
	"Death Note", "Fullmetal Alchemist", "Code Geass", "Steins;Gate",
	"Berserk", "Vinland Saga", "Vagabond",
	"Baki", "Horimiya", "Fruits Basket",
	"Haikyuu", "Blue Lock", "One Punch Man"
];

const GAME_LIST = [
	"CODM", "Blood Strike", "Genshin Impact", "Valorant", "League of Legends",
	"Elden Ring", "Minecraft", "Roblox", "PUBG", "Free Fire", "Honkai: Star Rail", "Apex Legends"
];

const GENRE_LIST = ["Shonen", "Seinen", "Romance", "Isekai", "Psychological", "Ecchi", "Action", "Slice of Life", "Manga", "Fantasy", "Sci-Fi", "Comedy", "Manhwa"];

// ============================================================================
// 🌌 1. THE FLOATING ORBS ENGINE
// ============================================================================
const FloatingOrb = ({ size, color, delay, startX, startY, rangeX, rangeY, duration }) => {
	const transX = useSharedValue(startX);
	const transY = useSharedValue(startY);

	useEffect(() => {
		transX.value = withDelay(delay, withRepeat(
			withSequence(
				withTiming(startX + rangeX, { duration: duration, easing: Easing.inOut(Easing.sin) }),
				withTiming(startX - rangeX, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }),
				withTiming(startX, { duration: duration, easing: Easing.inOut(Easing.sin) })
			), -1, true
		));
		transY.value = withDelay(delay, withRepeat(
			withSequence(
				withTiming(startY + rangeY, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) }),
				withTiming(startY - rangeY, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) }),
				withTiming(startY, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) })
			), -1, true
		));
	}, []);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: transX.value }, { translateY: transY.value }]
	}));

	return (
		<Animated.View
			style={[
				{
					position: 'absolute',
					width: size, height: size,
					borderRadius: size / 2,
					backgroundColor: color,
					opacity: 0.15,
					shadowColor: color,
					shadowOffset: { width: 0, height: 0 },
					shadowOpacity: 0.5,
					shadowRadius: 50,
					elevation: 10,
				},
				animatedStyle
			]}
		/>
	);
};

const AnimatedBackground = ({ isDark }) => {
	return (
		<View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#020617' : '#f8fafc', overflow: 'hidden' }]}>
			<FloatingOrb size={300} color={THEME.accent} delay={0} startX={-50} startY={-50} rangeX={150} rangeY={200} duration={8000} />
			<FloatingOrb size={400} color="#a855f7" delay={1500} startX={width - 150} startY={height / 3} rangeX={-100} rangeY={250} duration={10000} />
			<FloatingOrb size={250} color="#10b981" delay={3000} startX={width / 2 - 100} startY={height - 100} rangeX={200} rangeY={-150} duration={9000} />
			<View style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.05 : 0.03 }]} className="bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]" />
		</View>
	);
};

// ============================================================================
// ✍️ 2. PREMIUM CINEMATIC WORD REVEAL
// ============================================================================
const AnimatedWord = ({ word, index, style }) => {
	const opacity = useSharedValue(0);
	const translateY = useSharedValue(10);

	useEffect(() => {
		const timer = setTimeout(() => { Haptics.selectionAsync(); }, index * 150);
		opacity.value = withDelay(index * 150, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));
		translateY.value = withDelay(index * 150, withTiming(0, { duration: 600, easing: Easing.out(Easing.back(1.5)) }));
		return () => clearTimeout(timer);
	}, [word]);

	const animStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ translateY: translateY.value }]
	}));

	return <Animated.Text style={[style, animStyle, { marginRight: 6 }]}>{word}</Animated.Text>;
};

const PremiumTextReveal = ({ text, style }) => {
	const lines = text.split('\n');
	let globalWordIndex = 0;

	return (
		<View style={{ alignItems: 'center', width: '100%' }}>
			{lines.map((line, lineIndex) => (
				<View key={`line-${lineIndex}`} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: line === '' ? 12 : 0 }}>
					{line.split(' ').map((word, wIndex) => {
						if (word === '') return null;
						const currentIndex = globalWordIndex++;
						return <AnimatedWord key={`word-${currentIndex}`} word={word} index={currentIndex} style={style} />;
					})}
				</View>
			))}
		</View>
	);
}

// ============================================================================
// 🧠 3. THE LORE ENGINE
// ============================================================================
// ⚡️ UPDATED: Now it only takes one unified media array
const getOperativeTitle = (media) => {
	if (media.includes("Solo Leveling")) return "Monarch";
	if (media.includes("Naruto")) return "Shinobi";
	if (media.includes("One Piece")) return "Pirate";
	if (media.includes("Bleach")) return "Soul Reaper";
	if (media.includes("AOT")) return "Scout";
	if (media.includes("Demon Slayer")) return "Slayer";
	if (media.includes("JJK")) return "Sorcerer";
	if (media.includes("Dragon Ball Z")) return "Saiyan";
	if (media.includes("Hunter x Hunter")) return "Hunter";
	if (media.includes("Berserk")) return "Struggler";
	if (media.includes("Blue Lock")) return "Egoist";
	if (media.includes("Elden Ring")) return "Tarnished";
	if (media.includes("Valorant") || media.includes("CODM")) return "Agent";
	return "Operative";
};

const getGenreReaction = (genres) => {
	const topGenre = genres[0];
	switch (topGenre) {
		case "Shonen": return "A fiery Shonen spirit burns within you. The will to never give up.";
		case "Seinen": return "Seinen... you walk a darker, more mature path. A true survivor.";
		case "Romance": return "Romance. Even in the digital void, the heart beats loudest.";
		case "Isekai": return "Isekai. Ready to leave your past behind and conquer a new world?";
		case "Psychological": return "Psychological. You seek the truth hidden beneath the human mind.";
		case "Ecchi": return "Ah, Ecchi. An individual of absolute culture. Your secrets are safe.";
		case "Action": return "Action. Blood pumping, adrenaline rushing. Always ready for battle.";
		case "Slice of Life": return "Slice of Life. Finding beauty in the quiet, peaceful moments.";
		case "Manga": return "Manga. You prefer the raw, original ink. A true purist.";
		case "Fantasy": return "Fantasy. Magic, dragons, and boundless imagination.";
		case "Sci-Fi": return "Sci-Fi. Looking towards the future, stars, and steel.";
		case "Comedy": return "Comedy. A bright soul bringing laughter to the darkest timelines.";
		case "Manhwa": return "Manhwa. Infinite scrolling, leveling up, and absolute dominance.";
		default: return "Fascinating affinities. Your neural pattern is unique.";
	}
};

// ============================================================================
// 🎮 4. THE MAIN LAUNCH SCREEN
// ============================================================================
export default function FirstLaunchScreen() {
	const storage = useMMKV();
	const CustomAlert = useAlert();
	const router = useRouter();
	const isMounted = useRef(true);
	const { setUser } = useUser();
	const { refreshStreak } = useStreak();
	const { refreshClanStatus } = useClan();
	const isDark = useColorScheme() === "dark";

	const [accessGate, setAccessGate] = useState(true);
	const [showAwakeningModal, setShowAwakeningModal] = useState(false);
	const [recoveredUid, setRecoveredUid] = useState("");
	const [showPinModal, setShowPinModal] = useState(false);
	const [pendingRecoveryData, setPendingRecoveryData] = useState(null);
	const [isQuickLogin, setIsQuickLogin] = useState(false);
	const recentSessions = JSON.parse(storage.getString("session_history") || "[]")

	const [loading, setLoading] = useState(true);
	const [isProcessing, setIsProcessing] = useState(false);
	const [step, setStep] = useState(0);

	const [username, setUsername] = useState("");
	const [recoverId, setRecoverId] = useState("");
	const [referrerCode, setReferrerCode] = useState("");
	const [isAutoReferrer, setIsAutoReferrer] = useState(false);
	const [isRecoveryMode, setIsRecoveryMode] = useState(false);

	// ⚡️ UPDATED: Only selectedAnimes remains. Games will be pushed into this array too.
	const [selectedAnimes, setSelectedAnimes] = useState([]);
	const [selectedGenres, setSelectedGenres] = useState([]);
	const [favCharacter, setFavCharacter] = useState("");
	const [searchQuery, setSearchQuery] = useState("");

	const notify = (title, message) => {
		if (Platform.OS === "web") alert(`${title}\n${message}`);
		else CustomAlert(title, message);
	};

	useEffect(() => {
		isMounted.current = true;
		const checkAndMigrateStorage = async () => {
			try {
				const storedUser = storage.getString("mobileUser");
				if (storedUser && storedUser !== "null" && isMounted.current) {
					const parsed = JSON.parse(storedUser);
					setUser(parsed);
					router.replace("/profile");
					return;
				}

				const legacyUserStr = await AsyncStorage.getItem("mobileUser");
				if (legacyUserStr && legacyUserStr !== "null" && isMounted.current) {
					storage.set("mobileUser", legacyUserStr);
					const parsed = JSON.parse(legacyUserStr);
					setUser(parsed);
					router.replace("/profile");
					return;
				}
			} catch (e) { }

			if (Platform.OS === 'android') {
				try {
					const installReferrer = await Application.getInstallReferrerAsync();
					const isInvalid = !installReferrer || installReferrer.includes("google-play") || installReferrer.includes("(not%20set)");
					if (!isInvalid && isMounted.current) {
						setReferrerCode(installReferrer);
						setIsAutoReferrer(true);
					}
				} catch (refErr) { }
			}

			if (isMounted.current) setLoading(false);
		};

		checkAndMigrateStorage();
		return () => { isMounted.current = false; };
	}, [router, storage]);

	async function registerForPushNotificationsAsync() {
		if (Platform.OS === "web") return null;
		try {
			const { status: existingStatus } = await Notifications.getPermissionsAsync();
			let finalStatus = existingStatus;
			if (existingStatus !== "granted") {
				const { status } = await Notifications.requestPermissionsAsync();
				finalStatus = status;
			}
			if (finalStatus !== "granted") return null;
			const projectId = Constants?.expoConfig?.extra?.eas?.projectId || "yMNrI6jWuN";
			return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
		} catch { return null; }
	}

	const toggleItem = (item, list, setList) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		if (list.includes(item)) setList(list.filter(i => i !== item));
		else setList([...list, item]);
	};

	const handleNextStep = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

		if (step === 0) setStep(1);
		else if (step === 1) {
			if (isRecoveryMode) {
				if (!recoverId.trim()) return notify("Required", "Please enter your Recovery ID.");
				handleAction();
				return;
			}
			if (username.trim().length < 3) return notify("Identity Weak", "Callsign must be 3+ characters.");
			if (username.trim().length > 30) return notify("Identity Too Long", "Callsign must be less than 30 characters.");
			if (FORBIDDEN_NAMES.includes(username.toLowerCase())) return notify("Access Denied", "This callsign is restricted.");
			setStep(2);
		} else if (step === 2) setStep(3);
		else if (step === 3) {
			// ⚡️ UPDATED: Only check selectedAnimes
			if (selectedAnimes.length === 0) {
				return notify("Input Required", "Select at least one Anime or Game.");
			}
			setStep(4);
		} else if (step === 4) setStep(5);
		else if (step === 5) {
			if (selectedGenres.length === 0) return notify("Input Required", "Select your genre affinities.");
			setStep(6);
		} else if (step === 6) setStep(7);
	};

	const handleQuickLogin = async ({ session, pin }) => {
		if (isProcessing) return;
		setIsQuickLogin(true);
		setIsProcessing(true);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

		try {
			const fingerprint = await getFingerprint();
			const pushToken = await registerForPushNotificationsAsync();
			let realPin = ""
			if (typeof pin == "string") {
				realPin = pin
			}
			console.log(session.deviceId, "is the session deviceID");

			// 2. 🔗 CALL BACKEND TO RESTORE SESSION
			// This now returns sessionData with followedClans, onboarding flags
			const res = await apiFetch("/mobile/recover", {
				method: "POST",
				body: JSON.stringify({
					deviceId: session.deviceId,
					hardwareId: fingerprint.hardwareId,
					recoverId: session.uid,
					pushToken,
					pin: realPin
				})
			});

			const data = await res.json();

			// 3. 🛡️ PIN CHALLENGE (Encryption Layer)
			if (res.status === 401 && data.message?.includes("ENCRYPTION_REQUIRED")) {
				setIsProcessing(false);
				CustomAlert(data.message, data.detail, [
					{ text: "Cancel", style: "cancel", onPress: () => setAccessGate(true) },
					{
						text: "Decrypt",
						style: "default",
						onPress: () => {
							setAccessGate(true)
							setPendingRecoveryData({ session, fingerprint, pushToken });
							setShowPinModal(true);
						}
					}
				]);
				return;
			}

			if (!res.ok) throw new Error(data.message || "Session recovery failed");

			// 4. 🔑 SECURE NEW TOKENS
			// Essential: Save the new session tokens to SecureStore!
			if (data.accessToken && data.refreshToken) {
				await SecureStore.setItemAsync('userToken', data.accessToken);
				await SecureStore.setItemAsync('refreshToken', data.refreshToken);
			}

			// 5. 🧬 SYNC USER IDENTITY
			const userData = {
				deviceId: data.user?.deviceId,
				uid: data.user?.uid,
				username: data.user?.username,
				pushToken: pushToken || data.user?.pushToken,
				country: data.user?.country || "Unknown",
				referredBy: data.user?.referredBy,
				preferences: data.user?.preferences || {}
			};

			// Save user data to MMKV
			storage.set("mobileUser", JSON.stringify(userData));
			setUser(userData);
			syncApiUser(userData);

			// 6. 💾 SAVE SESSION DATA FROM BACKEND TO MMKV
			// Store each field individually for quickLogin to use later

			if (data.sessionData) {
				const { followedClans, ...onboardingFlags } = data.sessionData;

				// Save followed clans (as JSON string array)
				storage.set("followed_clans", JSON.stringify(followedClans || []));
				storage.set("ONBOARDING_KEY", onboardingFlags.ONBOARDING_KEY || "true");

				// Save onboarding flags individually
				storage.set("HAS_SEEN_CLAN_UPDATE", onboardingFlags.HAS_SEEN_CLAN_UPDATE || "true");
				storage.set("has_seen_profile_onboarding", onboardingFlags.has_seen_profile_onboarding ? "true" : "false");
				storage.set("HAS_SEEN_COINS_V3", onboardingFlags.HAS_SEEN_COINS_V3 || "true");
				storage.set("HAS_SEEN_PEAK_V5", onboardingFlags.HAS_SEEN_PEAK_V5 || "true");
				storage.set("HAS_SEEN_STORE_V4", onboardingFlags.HAS_SEEN_STORE_V4 || "true");
				storage.set("HAS_SEEN_WELCOME", onboardingFlags.HAS_SEEN_WELCOME || "true");
			}

			// 7. 🔄 REFRESH APP STATE
			if (refreshStreak) refreshStreak();
			if (refreshClanStatus) refreshClanStatus();

			setRecoveredUid(data.user?.uid);
			setShowAwakeningModal(true);
			setTimeout(() => {
				router.replace("/profile");
			}, 600);

		} catch (err) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			// ⚠️ FAILSAFE: Preserve session history so login buttons remain
			const rawHistory = storage.getString("session_history");
			storage.clearAll();
			if (rawHistory) {
				storage.set("session_history", rawHistory);
			}
			console.log(err);

			notify("Access Denied", err.message);
			setIsProcessing(false)
			setIsQuickLogin(false);
		}
	};

	const handleAction = async (pin = "") => {
		if (isProcessing) return;
		setIsProcessing(true);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

		try {
			const fingerprint = await getFingerprint();
			const pushToken = await registerForPushNotificationsAsync();
			const endpoint = isRecoveryMode ? "/mobile/recover" : "/mobile/register";

			const payload = {
				deviceId: fingerprint.softwareId,
				hardwareId: fingerprint.hardwareId,
				pushToken,
				pin: ""
			};

			if (isRecoveryMode) {
				payload.recoverId = recoverId.trim();
			} else {
				payload.username = username.trim();
				payload.referredBy = referrerCode.trim();
				payload.preferences = {
					favAnimes: selectedAnimes,
					favGenres: selectedGenres,
					favCharacter: favCharacter.trim()
				};
			}

			if (typeof pin == "string") {
				payload.pin = pin;
			}

			const res = await apiFetch(endpoint, {
				method: "POST",
				body: JSON.stringify(payload),
			});

			// if (!res) throw new Error("No response from server.");
			const data = await res.json();
			console.log("data is", data);

			if (res.status === 401 && data.message?.includes("ENCRYPTION_REQUIRED")) {
				setIsProcessing(false);
				CustomAlert(data.message, data.detail, [
					{ text: "Cancel", style: "cancel", onPress: () => setAccessGate(true) },
					{
						text: "Decrypt",
						style: "default",
						onPress: () => {
							setAccessGate(true)
							setPendingRecoveryData({ fingerprint, pushToken });
							setShowPinModal(true);
						}
					}
				]);
				return;
			}

			if (!res.ok) throw new Error(data.message || "Operation failed");

			// 🛡️ SECURITY UPGRADE: SAVE TO SECURE STORE
			// We save the tokens separately from the profile for security
			if (data.accessToken && data.refreshToken) {
				await SecureStore.setItemAsync('userToken', data.accessToken);
				await SecureStore.setItemAsync('refreshToken', data.refreshToken);
			}

			const userData = {
				deviceId: data.user?.deviceId,
				uid: data.user?.uid,
				username: data.user?.username || username.trim(),
				pushToken: pushToken || data.user?.pushToken,
				country: data.user?.country || "Unknown",
				referredBy: data.user?.referredBy || referrerCode.trim(),
				preferences: isRecoveryMode ? (data.user?.preferences || {}) : {
					favAnimes: selectedAnimes,
					favGenres: selectedGenres,
					favCharacter: favCharacter.trim()
				}
			};

			// Standard storage for UI data
			storage.set("mobileUser", JSON.stringify(userData));

			setUser(userData);
			syncApiUser(userData);

			if (data.sessionData) {
				const { followedClans, ...onboardingFlags } = data.sessionData;
				// Save followed clans (as JSON string array)
				storage.set("followed_clans", JSON.stringify(followedClans || []));
				storage.set("ONBOARDING_KEY", onboardingFlags.ONBOARDING_KEY || "true");
				// Save onboarding flags individually
				storage.set("HAS_SEEN_CLAN_UPDATE", onboardingFlags.HAS_SEEN_CLAN_UPDATE || "true");
				storage.set("has_seen_profile_onboarding", onboardingFlags.has_seen_profile_onboarding ? "true" : "false");
				storage.set("HAS_SEEN_COINS_V3", onboardingFlags.HAS_SEEN_COINS_V3 || "true");
				storage.set("HAS_SEEN_PEAK_V5", onboardingFlags.HAS_SEEN_PEAK_V5 || "true");
				storage.set("HAS_SEEN_STORE_V4", onboardingFlags.HAS_SEEN_STORE_V4 || "true");
				storage.set("HAS_SEEN_WELCOME", onboardingFlags.HAS_SEEN_WELCOME || "true");
			}
			if (refreshStreak) refreshStreak();

			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			if (isRecoveryMode) {
				setRecoveredUid(data.user?.uid);
				setShowAwakeningModal(true);
				setTimeout(() => {
					router.replace("/profile");
				}, 600);
			} else {
				storage.set("trigger_first_post", 1);
				setTimeout(() => router.replace("/authordiary"), 1000);
			}

		} catch (err) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			notify("System Alert", err.message);
			setIsProcessing(false);
		}
	};

	// ⚡️ NEW: Handler for PIN modal success
	const handlePinSuccess = async (verifiedPin) => {
		setShowPinModal(false);

		if (verifiedPin) {
			// Retry recovery with the verified PIN
			if (isQuickLogin) {
				await handleQuickLogin({ session: pendingRecoveryData.session, pin: verifiedPin });
			} else {
				await handleAction(verifiedPin);
			}
		}
	};

	const filteredAnimes = ANIME_LIST.filter(anime => anime.toLowerCase().includes(searchQuery.toLowerCase()));
	const filteredGames = GAME_LIST.filter(game => game.toLowerCase().includes(searchQuery.toLowerCase()));

	// ⚡️ UPDATED: Passing the unified array
	const dynamicTitle = getOperativeTitle(selectedAnimes);

	const getSystemFeedback = () => {
		if (step === 0) return "SYSTEM INITIALIZATION COMPLETE...\n\nWelcome to Oreblogda. I am THE SYSTEM. I oversee the library of Anime and Gaming legends.\n\nAre you ready to awaken your profile?";
		if (step === 2) return `Identity confirmed: ${username}.\nA formidable callsign.\n\nNow, tell me the worlds you inhabit. Select your favorite Anime and Games.`;
		if (step === 4) {
			// ⚡️ UPDATED: Uses selectedAnimes
			const topPick = selectedAnimes[0] || "these worlds";
			return `Ah, I see you favor ${topPick}... A true ${dynamicTitle} of culture.\n\nWhat type of energy resonates with your soul? Select your Genres.`;
		}
		if (step === 6) {
			return `${getGenreReaction(selectedGenres)}\n\nFinally, out of all the multiverses, who stands at the absolute peak? Who is your GOAT?`;
		}
		return "";
	};

	const floatAnim = useSharedValue(0);
	useEffect(() => {
		floatAnim.value = withRepeat(
			withSequence(
				withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
				withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
			), -1, true
		);
	}, []);
	const floatingStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatAnim.value }] }));

	if (loading) return <AnimeLoading tipType={"general"} message="Checking Session" subMessage="Initializing Neural Link" />;
	if (isProcessing && !showAwakeningModal) return <AnimeLoading tipType={"general"} message="Synchronizing Soul" subMessage={`Welcome to the Guild, ${username || dynamicTitle || 'Operative'}`} />;

	const isDialogueStep = step % 2 === 0 && !isRecoveryMode;
	const currentPhase = Math.ceil(step / 2) || 1;

	const stepColors = [THEME.accent, THEME.accent, "#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#a855f7", "#facc15"];
	const activeColor = stepColors[step] || THEME.accent;
	const primaryTextColor = isDark ? '#ffffff' : '#0f172a';

	// ============================================================================
	// ⚡️ ACCESS GATE VIEW
	// ============================================================================
	if (accessGate) {
		return (
			<View style={{ flex: 1 }}>
				<AnimatedBackground isDark={isDark} />
				<View className="flex-1 px-8 justify-center">

					<Animated.View entering={FadeInRight.duration(800)} className="items-center mb-16">
						<Text style={{ color: THEME.accent }} className="font-black tracking-[0.5em] text-[10px] uppercase mb-2">The System</Text>
						<Text style={{ color: primaryTextColor }} className="text-4xl font-black italic uppercase tracking-tighter">Access Gate</Text>
					</Animated.View>

					{recentSessions.length > 0 && (
						<Animated.View entering={FadeInRight.delay(200).duration(800)} className="mb-12">
							<Text style={{ color: THEME.textSecondary }} className="font-black text-[9px] uppercase tracking-widest mb-6 text-center">Recent Neural Links</Text>
							<View className="flex-row justify-center gap-6">
								{recentSessions.map((session, idx) => (
									<TouchableOpacity
										key={`${session.uid}-${idx}`}
										onPress={() => handleQuickLogin({ session: session })}
										className="items-center"
									>
										<View style={{ borderColor: THEME.accent }} className="p-1 rounded-[24px] border-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
											<Image source={{ uri: session.pfp || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} className="w-16 h-16 rounded-[20px] bg-zinc-800" />
										</View>
										<Text style={{ color: primaryTextColor }} className="font-bold text-[10px] mt-3 uppercase tracking-wider">{session.username}</Text>
									</TouchableOpacity>
								))}
							</View>
						</Animated.View>
					)}

					<Animated.View entering={FadeInRight.delay(400).duration(800)} className="gap-y-4">
						<TouchableOpacity
							onPress={() => {
								LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
								setIsRecoveryMode(false);
								setStep(0);
								setAccessGate(false);
							}}
							style={{ backgroundColor: THEME.accent }}
							className="p-6 rounded-[24px] items-center shadow-lg shadow-blue-600/20"
						>
							<RNText className="text-white font-black uppercase tracking-widest text-[12px]">Initialize New Link</RNText>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={() => {
								LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
								setIsRecoveryMode(true);
								setStep(1);
								setAccessGate(false);
							}}
							style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
							className="border-2 p-6 rounded-[24px] items-center bg-black/5 dark:bg-white/5"
						>
							<RNText style={{ color: THEME.textSecondary }} className="font-black uppercase tracking-widest text-[12px]">Restore Identity</RNText>
						</TouchableOpacity>
					</Animated.View>
				</View>

				{/* ⚡️ NEW: Neural PIN Modal for Recovery */}
				<NeuralPinModal
					visible={showPinModal}
					onSuccess={handlePinSuccess}
					onClose={() => setShowPinModal(false)}
					returnPinOnly={true}
				/>
			</View>
		);
	}

	// ============================================================================
	// ⚡️ MAIN ONBOARDING & RECOVERY VIEW
	// ============================================================================
	return (
		<View style={{ flex: 1 }}>
			<AnimatedBackground isDark={isDark} />

			<Modal visible={showAwakeningModal} transparent animationType="fade">
				<View className="flex-1 bg-black/90 items-center justify-center p-8">
					<Animated.View entering={ZoomIn.duration(400).springify()} className="bg-zinc-900 border-2 border-blue-500 p-8 rounded-[40px] w-full items-center shadow-[0_0_50px_rgba(59,130,246,0.3)]">
						<MaterialCommunityIcons name="auto-fix" size={50} color="#3b82f6" />
						<Text className="text-blue-500 font-black uppercase tracking-widest text-[10px] mt-4">Authentication Successful</Text>
						<Text className="text-2xl font-black italic text-white uppercase text-center mt-2">Link Restored</Text>

						<View className="bg-black/50 p-6 rounded-2xl border border-blue-500/20 my-6 w-full">
							<Text className="text-gray-500 text-[9px] font-black uppercase text-center mb-2 tracking-widest">Operative UID</Text>
							<Text className="text-blue-400 font-mono text-lg text-center font-bold tracking-tighter" selectable>
								{recoveredUid}
							</Text>
						</View>

						<Text className="text-gray-400 text-[11px] text-center leading-5 mb-8 font-medium px-2">
							Your neural link has been re-established. Keep your Operative UID secure for future access.
						</Text>

						<TouchableOpacity
							onPress={() => {
								setShowAwakeningModal(false);
							}}
							className="bg-blue-600 py-4 px-10 rounded-[20px] w-full items-center shadow-lg shadow-blue-500/30"
						>
							<Text className="text-white font-black uppercase text-xs tracking-widest">Enter System</Text>
						</TouchableOpacity>
					</Animated.View>
				</View>
			</Modal>

			<View className="flex-1 px-8 pt-20">
				<TouchableOpacity
					onPress={() => setAccessGate(true)}
					className="absolute top-16 left-6 z-30 p-2"
				>
					<Ionicons name="chevron-back" size={24} color={THEME.textSecondary} />
				</TouchableOpacity>

				{!isDialogueStep && !isRecoveryMode && (
					<View className="flex-row justify-between mb-8 px-2 z-10 mt-6">
						{[1, 2, 3, 4].map((s) => (
							<View key={s} style={{ height: 5, width: (width - 110) / 4, borderRadius: 3, backgroundColor: currentPhase >= s ? activeColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }} />
						))}
					</View>
				)}

				<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={isDialogueStep ? { flexGrow: 1, justifyContent: 'center' } : {}}>

					{isDialogueStep ? (
						<Animated.View entering={FadeInRight.duration(600).springify()} className="items-center px-2 mb-10">
							<Animated.View style={[floatingStyle, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', borderColor: activeColor, shadowColor: activeColor }]} className="w-28 h-28 rounded-[36px] items-center justify-center mb-10 border-[3px] shadow-[0_0_40px_rgba(0,0,0,0.3)]">
								<Ionicons
									name={step === 0 ? "power" : step === 2 ? "finger-print" : step === 4 ? "game-controller-outline" : "flame"}
									size={54}
									color={activeColor}
								/>
							</Animated.View>

							<Text style={{ color: activeColor }} className="font-black text-[13px] uppercase tracking-[0.4em] mb-8 text-center opacity-90">
								{">"} THE_SYSTEM_PROMPT
							</Text>

							<View style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} className="w-full p-8 rounded-[30px] border shadow-2xl">
								<PremiumTextReveal
									text={getSystemFeedback()}
									style={{
										color: primaryTextColor,
										fontSize: 20,
										lineHeight: 25,
										fontWeight: '900',
										fontStyle: 'italic',
										textTransform: 'uppercase'
									}}
								/>
							</View>
						</Animated.View>
					) : (

						<Animated.View entering={SlideInRight.duration(500).springify()}>

							<View className={`items-center ${isRecoveryMode ? 'mb-8 mt-12' : 'mb-10 mt-4'}`}>
								<View style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', borderColor: activeColor, shadowColor: activeColor }} className="w-20 h-20 rounded-[28px] items-center justify-center mb-4 border-2 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
									<Ionicons
										name={step === 1 ? (isRecoveryMode ? "key-outline" : "person") : step === 3 ? "search" : step === 5 ? "color-filter" : "star"}
										size={38}
										color={activeColor}
									/>
								</View>
							</View>

							{step === 1 && (
								<View>
									{isRecoveryMode ? (
										<View>
											<TextInput
												style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', borderColor: activeColor, color: primaryTextColor }}
												className="w-full border-2 rounded-3xl px-6 py-6 mb-2 font-black italic text-xl text-center shadow-lg"
												placeholder="ENTER OPERATIVE UID..."
												placeholderTextColor={THEME.textSecondary + '80'}
												value={recoverId}
												onChangeText={setRecoverId}
												autoCapitalize="characters"
											/>
											<TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("screens/Contact"); }} className="self-end mb-4 px-2 mt-4">
												<RNText style={{ color: THEME.textSecondary }} className="text-[11px] font-bold uppercase tracking-widest border-b border-gray-500/30 pb-1">
													Lost your ID? Contact Support
												</RNText>
											</TouchableOpacity>
										</View>
									) : (
										<>
											<TextInput
												style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', borderColor: activeColor, color: primaryTextColor }}
												className="w-full border-2 rounded-[28px] px-6 py-7 mb-8 font-black italic text-center text-2xl shadow-xl"
												placeholder="ENTER USERNAME..."
												placeholderTextColor={THEME.textSecondary + '60'}
												value={username}
												onChangeText={setUsername}
												autoFocus
											/>
											<Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[10px] mb-3 ml-4 tracking-[0.2em] opacity-80">Uplink Code (Optional)</Text>
											<TextInput
												style={{
													backgroundColor: isAutoReferrer ? (isDark ? 'rgba(30,27,75,0.6)' : '#f3e8ff') : (isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)'),
													borderColor: isAutoReferrer ? activeColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
													color: isAutoReferrer ? activeColor : primaryTextColor
												}}
												className="w-full border-2 rounded-3xl px-6 py-5 mb-4 font-black italic text-center text-lg"
												placeholder="REFERRAL CODE..."
												value={referrerCode}
												onChangeText={setReferrerCode}
												editable={!isAutoReferrer}
											/>
										</>
									)}
								</View>
							)}

							{step === 3 && !isRecoveryMode && (
								<View>
									<View className="mb-10 relative">
										<TextInput
											style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: primaryTextColor }}
											className="w-full border-2 rounded-[28px] px-6 py-5 font-black italic pr-12 text-xl"
											placeholder="SEARCH DATABASE..."
											placeholderTextColor={THEME.textSecondary + '50'}
											value={searchQuery}
											onChangeText={setSearchQuery}
										/>
										<View className="absolute right-6 top-6">
											<Ionicons name="search" size={24} color={THEME.textSecondary} />
										</View>
									</View>

									<Text style={{ color: activeColor }} className="font-black uppercase text-[12px] mb-6 tracking-[0.2em]">Anime Archives</Text>
									<View className="flex-row flex-wrap mb-10">
										{filteredAnimes.map((anime) => {
											const active = selectedAnimes.includes(anime);
											return (
												<TouchableOpacity
													key={anime}
													onPress={() => toggleItem(anime, selectedAnimes, setSelectedAnimes)}
													style={{ backgroundColor: active ? activeColor : (isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'), borderColor: active ? activeColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }}
													className="px-5 py-3.5 rounded-full border-2 mr-3 mb-4 shadow-sm"
												>
													<RNText style={{ color: active ? 'white' : THEME.textSecondary }} className="font-black text-[12px] uppercase tracking-widest">{anime}</RNText>
												</TouchableOpacity>
											);
										})}
									</View>

									<Text style={{ color: '#f59e0b' }} className="font-black uppercase text-[12px] mb-6 tracking-[0.2em]">Gaming Realms (Optional)</Text>
									<View className="flex-row flex-wrap mb-8">
										{filteredGames.map((game) => {
											// ⚡️ UPDATED: Check selectedAnimes since games are pushed there
											const active = selectedAnimes.includes(game);
											return (
												<TouchableOpacity
													key={game}
													// ⚡️ UPDATED: Map to selectedAnimes state
													onPress={() => toggleItem(game, selectedAnimes, setSelectedAnimes)}
													style={{ backgroundColor: active ? '#f59e0b' : (isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'), borderColor: active ? '#f59e0b' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }}
													className="px-5 py-3.5 rounded-full border-2 mr-3 mb-4 shadow-sm"
												>
													<RNText style={{ color: active ? 'white' : THEME.textSecondary }} className="font-black text-[12px] uppercase tracking-widest">{game}</RNText>
												</TouchableOpacity>
											);
										})}
									</View>
								</View>
							)}

							{step === 5 && !isRecoveryMode && (
								<View>
									<Text style={{ color: activeColor }} className="font-black uppercase text-[13px] mb-8 tracking-[0.3em] text-center">Preferred Genres</Text>
									<View className="flex-row flex-wrap mb-8 justify-center">
										{GENRE_LIST.map((genre) => {
											const active = selectedGenres.includes(genre);
											return (
												<TouchableOpacity
													key={genre}
													onPress={() => toggleItem(genre, selectedGenres, setSelectedGenres)}
													style={{ backgroundColor: active ? activeColor : (isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'), borderColor: active ? activeColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }}
													className="px-6 py-4 rounded-full border-2 mx-2 mb-4 shadow-md"
												>
													<RNText style={{ color: active ? 'white' : THEME.textSecondary }} className="font-black text-[13px] uppercase tracking-[0.2em]">{genre}</RNText>
												</TouchableOpacity>
											);
										})}
									</View>
								</View>
							)}

							{step === 7 && !isRecoveryMode && (
								<View className="items-center">
									<Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[12px] mb-10 tracking-[0.3em] text-center opacity-80">
										Who is your absolute GOAT character?
									</Text>
									<TextInput
										style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', borderColor: activeColor, color: primaryTextColor }}
										className="w-full border-2 rounded-[36px] px-6 py-10 mb-12 font-black italic text-4xl text-center shadow-[0_0_40px_rgba(250,204,21,0.2)]"
										placeholder="E.G. MADARA"
										placeholderTextColor={THEME.textSecondary + '40'}
										autoFocus
										value={favCharacter}
										onChangeText={setFavCharacter}
									/>
									<View style={{ backgroundColor: isDark ? 'rgba(250,204,21,0.05)' : 'rgba(250,204,21,0.1)' }} className="p-8 rounded-[30px] border border-dashed border-yellow-500/40 w-full backdrop-blur-lg">
										<Text style={{ color: THEME.textSecondary }} className="text-[13px] text-center leading-7 font-black uppercase tracking-[0.2em]">
											Your path is set. Submitting this will bind your profile to the network. Let's go, {dynamicTitle} {username}.
										</Text>
									</View>
								</View>
							)}
						</Animated.View>
					)}

					<View className="mt-12 mb-20 w-full z-20">
						<Pressable
							onPress={step === 7 || isRecoveryMode ? handleAction : handleNextStep}
							disabled={isProcessing}
							style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.96 : 1 }] }]}
						>
							<LinearGradient
								colors={isDialogueStep ? ['transparent', 'transparent'] : [activeColor, activeColor + 'dd']}
								start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
								style={{
									paddingVertical: 26,
									borderRadius: 36,
									flexDirection: "row",
									justifyContent: "center",
									alignItems: "center",
									borderWidth: isDialogueStep ? 2.5 : 0,
									borderColor: activeColor,
									shadowColor: activeColor,
									shadowOffset: { width: 0, height: 10 },
									shadowOpacity: isDialogueStep ? 0 : 0.5,
									shadowRadius: 15,
									elevation: isDialogueStep ? 0 : 15
								}}
							>
								{isProcessing ? (
									<ActivityIndicator size="small" color={isDialogueStep ? activeColor : "white"} />
								) : (
									<>
										<RNText style={{ color: isDialogueStep ? activeColor : (activeColor === '#facc15' ? '#000' : 'white') }} className="font-black italic uppercase tracking-[0.3em] text-xl mr-3">
											{isRecoveryMode ? "Recover Link" :
												step === 0 ? "Begin Initiation" :
													step === 7 ? `Awaken ${dynamicTitle}` :
														isDialogueStep ? "Acknowledge" : "Continue"}
										</RNText>
										<Ionicons name={step === 7 || isRecoveryMode ? "flash" : "arrow-forward"} size={26} color={isDialogueStep ? activeColor : (activeColor === '#facc15' ? '#000' : "white")} />
									</>
								)}
							</LinearGradient>
						</Pressable>

						{step > 0 && !isRecoveryMode && (
							<TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(step - 1); }} className="mt-10 self-center">
								<RNText style={{ color: THEME.textSecondary }} className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60 border-b border-gray-600/30 pb-2">Retreat</RNText>
							</TouchableOpacity>
						)}
					</View>

				</ScrollView>
			</View>
		</View>
	);
}