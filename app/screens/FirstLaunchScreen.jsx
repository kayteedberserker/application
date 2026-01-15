import { Ionicons, Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useUser } from "../../context/UserContext"; 
import { getFingerprint } from "../../utils/device";

const { width } = Dimensions.get('window');

export default function FirstLaunchScreen() {
  const [username, setUsername] = useState("");
  const [recoverId, setRecoverId] = useState(""); // 👈 Added for ID recovery
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); // 👈 Toggle state
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const isMounted = useRef(true);
  const { setUser } = useUser(); 

  const notify = (title, message) => {
    if (Platform.OS === "web") alert(`${title}\n${message}`);
    else Alert.alert(title, message);
  };

  useEffect(() => {
    isMounted.current = true;
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem("mobileUser");
        if (storedUser && isMounted.current) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed); 
          router.replace("/profile");
          return;
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

    // Validation
    if (!isRecoveryMode) {
        if (!username.trim() || username.trim().length < 3 || username.trim() === "Admin") {
            return notify("Invalid Username", "Username must be at least 3 characters.");
        }
    } else {
        if (!recoverId.trim()) {
            return notify("Missing ID", "Please enter your previous Device ID to synchronize.");
        }
    }

    setIsProcessing(true);
    try {
      const currentDeviceId = await getFingerprint();
      const pushToken = await registerForPushNotificationsAsync();

      // We use the same endpoint or a separate one, but for this logic:
      // If recovery: use input ID. If register: use current fingerprint.
      const targetId = isRecoveryMode ? recoverId.trim() : (currentDeviceId || "device-id");
      
      const endpoint = isRecoveryMode 
        ? "https://oreblogda.com/api/mobile/recover" // 👈 New endpoint for matching existing ID
        : "https://oreblogda.com/api/mobile/register";

      const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: targetId,
            username: isRecoveryMode ? undefined : username.trim(),
            pushToken,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Operation failed");

      // Data returned from server should include the username found in DB if recovering
      const userData = {
        deviceId: targetId,
        username: data.username || username.trim(),
        pushToken,
      };

      await AsyncStorage.setItem("mobileUser", JSON.stringify(userData));
      setUser(userData);

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
      <View style={{ position: 'absolute', top: 100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowBlue, opacity: 0.3 }} />
      <View style={{ position: 'absolute', bottom: 100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowIndigo, opacity: 0.3 }} />

      {/* Terminal Icon */}
      <View 
        style={{ borderColor: isRecoveryMode ? '#a855f7' : THEME.border }}
        className="w-20 h-20 bg-gray-900 rounded-[30px] items-center justify-center mb-8 border-2 shadow-2xl shadow-blue-500/20"
      >
        <Ionicons name={isRecoveryMode ? "key-outline" : "finger-print"} size={40} color={isRecoveryMode ? '#a855f7' : THEME.accent} />
      </View>

      <View className="items-center mb-10">
        <Text className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 mb-2 text-center">
            {isRecoveryMode ? "Data Restoration" : "Identity Initialization"}
        </Text>
        <Text className="text-4xl font-black italic uppercase text-white text-center">
            {isRecoveryMode ? "Link Account" : "Welcome"}
        </Text>
      </View>

      {/* Form Section */}
      <View className="w-full">
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-3 ml-1">
            {isRecoveryMode ? "Enter Previous Device ID" : "Callsign Assignment"}
        </Text>
        
        {isRecoveryMode ? (
            <TextInput
                style={{ backgroundColor: THEME.card, borderColor: '#a855f7' }}
                className="w-full border-2 rounded-2xl px-5 py-5 mb-4 text-white font-black italic uppercase"
                placeholder="PASTE DEVICE ID HERE"
                placeholderTextColor="#334155"
                autoCapitalize="none"
                value={recoverId}
                onChangeText={setRecoverId}
                editable={!isProcessing}
            />
        ) : (
            <TextInput
                style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
                className="w-full border-2 rounded-2xl px-5 py-5 mb-4 text-white font-black italic uppercase"
                placeholder="ENTER CALLSIGN (E.G. ANIMELOVER)"
                placeholderTextColor="#334155"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                editable={!isProcessing}
            />
        )}

        {/* Toggle Mode Button */}
        <Pressable 
            onPress={() => setIsRecoveryMode(!isRecoveryMode)} 
            className="mb-8 items-center"
        >
            <RNText className="text-blue-500 text-[10px] font-bold uppercase tracking-widest">
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
          className="w-full py-5 rounded-[24px] flex-row justify-center items-center shadow-2xl shadow-blue-500/40"
        >
          {isProcessing ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 12 }} />
              <RNText style={{ color: "white", fontSize: 16, fontWeight: "900", fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 2 }}>
                Synchronizing...
              </RNText>
            </>
          ) : (
            <>
              <Ionicons name={isRecoveryMode ? "git-network-outline" : "power"} size={18} color="white" style={{ marginRight: 10 }} />
              <RNText style={{ color: "white", fontSize: 16, fontWeight: "900", fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 2 }}>
                {isRecoveryMode ? "Sync Account" : "Establish Link"}
              </RNText>
            </>
          )}
        </Pressable>
      </View>

      <View className="absolute bottom-12 items-center">
        <Text className="text-gray-800 font-black text-[8px] uppercase tracking-[0.5em]">Secure Auth Sector 7</Text>
      </View>
    </View>
  );
}
