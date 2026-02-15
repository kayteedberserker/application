import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from 'expo-application';
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  Text as RNText,
  TextInput,
  View,
} from "react-native";
import AnimeLoading from "../../components/AnimeLoading";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useStreak } from "../../context/StreakContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";
import { getFingerprint } from "../../utils/device";

const { width } = Dimensions.get('window');

// 🔹 Blacklisted names that cannot be used
const FORBIDDEN_NAMES = ["admin", "system", "the admin", "the system", "administrator", "moderator"];

export default function FirstLaunchScreen() {
  const [username, setUsername] = useState("");
  const [recoverId, setRecoverId] = useState(""); 
  const [referrerCode, setReferrerCode] = useState(""); // 🔹 Initialized as empty string
  const [isAutoReferrer, setIsAutoReferrer] = useState(false); // 🔹 To lock the field
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); 
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const isMounted = useRef(true);
  const { setUser } = useUser(); 
  const { refreshStreak } = useStreak();

  const notify = (title, message) => {
    if (Platform.OS === "web") alert(`${title}\n${message}`);
    else Alert.alert(title, message);
  };

  useEffect(() => {
    isMounted.current = true;
    (async () => {
      try {
        // 1. Check for existing session
        const storedUser = await AsyncStorage.getItem("mobileUser");
        if (storedUser && isMounted.current) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed); 
          router.replace("/profile");
          return;
        }

        // 2. 🔹 Check for Install Referrer (Only on Android)
        if (Platform.OS === 'android') {
          try {
            const installReferrer = await Application.getInstallReferrerAsync();
            
            // Google Play returns a specific string for organic installs, we ignore that
            if (installReferrer && !installReferrer.includes("utm_source=google-play")) {
                console.log("Referral Code Detected:", installReferrer);
                setReferrerCode(installReferrer);
                setIsAutoReferrer(true); // 🔹 Mark as auto-detected to lock UI
            }
          } catch (refErr) {
            console.log("Referrer not available:", refErr);
          }
        }

      } catch (e) {
        console.error("Storage error", e);
      }
      setLoading(false);
    })();
    return () => { isMounted.current = false; };
  }, []);

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
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      return token;
    } catch { return null; }
  }

  const handleAction = async () => {
    if (isProcessing) return;

    const cleanUsername = username.trim();
    const cleanRecoverId = recoverId.trim();
    const cleanReferrer = referrerCode.trim();

    // Validation
    if (!isRecoveryMode) {
        if (!cleanUsername || cleanUsername.length < 3) {
            return notify("Invalid Username", "Username must be at least 3 characters.");
        }
        
        if (FORBIDDEN_NAMES.includes(cleanUsername.toLowerCase())) {
            return notify("Restricted Alias", "This callsign is reserved for system authority.");
        }
    } else {
        if (!cleanRecoverId) {
            return notify("Missing ID", "Please enter your previous Device ID to synchronize.");
        }
    }

    setIsProcessing(true);
    try {
      const currentDeviceId = await getFingerprint();
      const pushToken = await registerForPushNotificationsAsync();

      const targetId = isRecoveryMode ? cleanRecoverId : (currentDeviceId || "device-id");
      
      const endpoint = isRecoveryMode 
        ? "https://oreblogda.com/api/mobile/recover" 
        : "https://oreblogda.com/api/mobile/register";

      const res = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({
            deviceId: targetId,
            username: isRecoveryMode ? undefined : cleanUsername,
            pushToken,
            referredBy: isRecoveryMode ? undefined : cleanReferrer, // 🔹 Pass the code (manual or auto)
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Operation failed");

      const detectedCountry = data.user?.country || "Unknown";

      const userData = {
        deviceId: targetId,
        username: data.user?.username || cleanUsername, 
        pushToken,
        country: detectedCountry,
        referredBy: cleanReferrer,
      };

      await AsyncStorage.setItem("mobileUser", JSON.stringify(userData));
      setUser(userData);
      
      if (refreshStreak) refreshStreak();

      setTimeout(() => {
        router.replace("/profile");
      }, 100);

    } catch (err) {
      console.error("Action Catch:", err);
      notify("Authentication Error", err.message);
      if (isMounted.current) setIsProcessing(false);
    }
  };

  if (loading) {
    return <AnimeLoading message="Checking Session" subMessage="Initializing Neural Link" />
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }} className="justify-center items-center px-8">
      
      {/* Ambient Background Glows */}
      <View style={{ position: 'absolute', top: 100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowBlue, opacity: THEME.isDark ? 0.3 : 0.1 }} />
      <View style={{ position: 'absolute', bottom: 100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowIndigo, opacity: THEME.isDark ? 0.3 : 0.1 }} />

      {/* Terminal Icon */}
      <View 
        style={{ 
          backgroundColor: THEME.card, 
          borderColor: isRecoveryMode ? '#a855f7' : THEME.border 
        }}
        className="w-20 h-20 rounded-[30px] items-center justify-center mb-8 border-2 shadow-2xl"
      >
        <Ionicons name={isRecoveryMode ? "key-outline" : "finger-print"} size={40} color={isRecoveryMode ? '#a855f7' : THEME.accent} />
      </View>

      <View className="items-center mb-10">
        <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 text-center">
            {isRecoveryMode ? "Data Restoration" : "Identity Initialization"}
        </Text>
        <Text style={{ color: THEME.text }} className="text-4xl font-black italic uppercase text-center">
            {isRecoveryMode ? "Link Account" : "Welcome"}
        </Text>
      </View>

      {/* Form Section */}
      <View className="w-full">
        <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-3 ml-1">
            {isRecoveryMode ? "Enter Previous Device ID" : "Callsign Assignment - Enter Username"}
        </Text>
        
        {isRecoveryMode ? (
            <TextInput
                style={{ backgroundColor: THEME.card, borderColor: '#a855f7', color: THEME.text}}
                className="w-full border-2 rounded-2xl px-5 py-5 mb-4 font-black italic"
                placeholder="PASTE DEVICE ID HERE"
                placeholderTextColor={THEME.textSecondary + '80'}
                autoCapitalize="none"
                autoCorrect={false}
                value={recoverId}
                onChangeText={setRecoverId}
                editable={!isProcessing}
            />
        ) : (
            <>
                <TextInput
                    style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                    className="w-full border-2 rounded-2xl px-5 py-5 mb-4 font-black italic"
                    placeholder="ENTER USERNAME..."
                    placeholderTextColor={THEME.textSecondary + '80'}
                    autoCapitalize="none" 
                    autoCorrect={false}
                    spellCheck={false}
                    value={username}
                    onChangeText={setUsername}
                    editable={!isProcessing}
                />

                {/* 🔹 REFERRAL CODE FIELD */}
                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-3 mt-2 ml-1">
                    Uplink Referral Code {isAutoReferrer ? "(SECURED)" : "(OPTIONAL)"}
                </Text>
                <View className="relative">
                    <TextInput
                        style={{ 
                            backgroundColor: isAutoReferrer ? THEME.bg : THEME.card, 
                            borderColor: isAutoReferrer ? '#a855f760' : THEME.border, 
                            color: isAutoReferrer ? '#a855f7' : THEME.text,
                            opacity: isAutoReferrer ? 0.8 : 1
                        }}
                        className="w-full border-2 rounded-2xl px-5 py-5 mb-4 font-black italic"
                        placeholder="ENTER CODE..."
                        placeholderTextColor={THEME.textSecondary + '80'}
                        autoCapitalize="characters" 
                        autoCorrect={false}
                        value={referrerCode}
                        onChangeText={setReferrerCode}
                        editable={!isProcessing && !isAutoReferrer} // 🔹 Locked if auto-detected
                    />
                    {isAutoReferrer && (
                        <View className="absolute right-4 top-5">
                            <Ionicons name="lock-closed" size={18} color="#a855f7" />
                        </View>
                    )}
                </View>
            </>
        )}

        {/* Toggle Mode Button */}
        <Pressable 
            onPress={() => setIsRecoveryMode(!isRecoveryMode)} 
            className="mb-8 items-center"
        >
            <RNText style={{ color: THEME.accent }} className="text-[10px] font-bold uppercase tracking-widest">
                {isRecoveryMode ? "Create New Identity instead" : "Have a previous Device ID? Link here"}
            </RNText>
        </Pressable>

        <Pressable
          onPress={handleAction}
          disabled={isProcessing}
          style={({ pressed }) => [
            {
              backgroundColor: isProcessing ? "#1e3a8a" : (isRecoveryMode ? '#a855f7' : THEME.accent),
              transform: [{ scale: pressed ? 0.98 : 1 }],
              opacity: isProcessing ? 0.7 : 1
            }
          ]}
          className="w-full py-5 rounded-[24px] flex-row justify-center items-center shadow-2xl"
        >
          {isProcessing ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 12 }} />
              <RNText style={{ color: THEME.text, fontSize: 16, fontWeight: "900", fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 2 }}>
                Synchronizing...
              </RNText>
            </>
          ) : (
            <>
              <Ionicons name={isRecoveryMode ? "git-network-outline" : "power"} size={18} color="white" style={{ marginRight: 10 }} />
              <RNText style={{ color: THEME.text, fontSize: 16, fontWeight: "900", fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 2 }}>
                {isRecoveryMode ? "Sync Account" : "Establish Link"}
              </RNText>
            </>
          )}
        </Pressable>
      </View>

      <View className="absolute bottom-12 items-center">
        <Text style={{ color: THEME.textSecondary }} className="font-black text-[8px] uppercase tracking-[0.5em]">Secure Auth Sector 7</Text>
      </View>
    </View>
  );
}