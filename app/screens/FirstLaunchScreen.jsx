import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from 'expo-application';
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  Platform,
  Pressable,
  Text as RNText,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import AnimeLoading from "../../components/AnimeLoading";
import { Text } from "../../components/Text";
import THEME from "../../components/useAppTheme";
import { useAlert } from "../../context/AlertContext";
import { useStreak } from "../../context/StreakContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";
import { getFingerprint } from "../../utils/device";

const { width } = Dimensions.get('window');
const FORBIDDEN_NAMES = ["admin", "system", "the admin", "the system", "administrator", "moderator"];

// 🔹 Top 25 Curated Anime (Shonen, Seinen, Shojo, New & Old Gen)
const ANIME_LIST = [
  "Naruto", "One Piece", "Bleach", "Dragon Ball Z", "Hunter x Hunter", // The Titans
  "JJK", "Solo Leveling", "My Hero Academia", "Hell's Paradise", "Demon Slayer", "AOT", "Chainsaw Man",      // New Gen Hits
  "Death Note", "Fullmetal Alchemist", "Code Geass", "Steins;Gate",    // Masterpieces
  "Berserk", "Vinland Saga", "Monster", "Vagabond",                   // Peak Seinen
  "Baki", "Nana", "Horimiya", "Fruits Basket", "Ouran High",               // Iconic Shojo
  "Haikyuu", "Blue Lock", "One Punch Man"                             // Hype/Sports
];

const GENRE_LIST = ["Shonen", "Seinen", "Romance", "Isekai", "Psychological", "Ecchi", "Action", "Slice of Life", "Manga", "Fantasy", "Sci-Fi", "Comedy", "Manhwa"];

export default function FirstLaunchScreen() {
  const CustomAlert = useAlert();
  const router = useRouter();
  const isMounted = useRef(true);
  const { setUser } = useUser(); 
  const { refreshStreak } = useStreak();

  // Logic States
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1);

  // Data States
  const [username, setUsername] = useState("");
  const [recoverId, setRecoverId] = useState(""); 
  const [referrerCode, setReferrerCode] = useState(""); 
  const [isAutoReferrer, setIsAutoReferrer] = useState(false); 
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); 

  // Selection States
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
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem("mobileUser");
        if (storedUser && isMounted.current) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed); 
          router.replace("/profile");
          return;
        }

        if (Platform.OS === 'android') {
          try {
            const installReferrer = await Application.getInstallReferrerAsync();
            const isInvalid = !installReferrer || installReferrer.includes("google-play") || installReferrer.includes("(not%20set)");
            if (!isInvalid && isMounted.current) {
                setReferrerCode(installReferrer);
                setIsAutoReferrer(true); 
            }
          } catch (refErr) { console.log("Referrer not available:", refErr); }
        }
      } catch (e) { console.error("Storage error", e); }
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

  const toggleItem = (item, list, setList) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (list.includes(item)) setList(list.filter(i => i !== item));
    else setList([...list, item]);
  };

  const handleNextStep = () => {
    if (step === 1) {
        if (isRecoveryMode) {
            if (!recoverId.trim()) return notify("Required", "Please enter your Recovery ID.");
            // 🔹 Instead of calling handleAction, we now move to Step 2 to collect fresh preferences
            setStep(2);
            return;
        }
        if (username.trim().length < 3) return notify("Identity Weak", "Callsign must be 3+ characters.");
        if (FORBIDDEN_NAMES.includes(username.toLowerCase())) return notify("Access Denied", "This callsign is restricted.");
        setStep(2);
    } else if (step === 2) {
        if (selectedAnimes.length === 0 || selectedGenres.length === 0) {
            return notify("Input Required", "Select your interests to synchronize.");
        }
        setStep(3);
    }
  };

  const handleAction = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const currentDeviceId = await getFingerprint();
      const pushToken = await registerForPushNotificationsAsync();
      const targetId = isRecoveryMode ? recoverId.trim() : (currentDeviceId || "device-id");
      
      const endpoint = isRecoveryMode ? "/mobile/recover" : "/mobile/register";

      const res = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({
            deviceId: targetId,
            username: isRecoveryMode ? undefined : username.trim(),
            pushToken,
            referredBy: isRecoveryMode ? undefined : referrerCode.trim(), 
            preferences: {
                favAnimes: selectedAnimes,
                favGenres: selectedGenres,
                favCharacter: favCharacter.trim()
            }
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Operation failed");

      // 🔹 Construct the user object with the newly selected preferences
      const userData = {
        deviceId: targetId,
        username: data.user?.username || username.trim(), 
        pushToken,
        country: data.user?.country || "Unknown",
        referredBy: referrerCode.trim(),
        preferences: {
            favAnimes: selectedAnimes,
            favGenres: selectedGenres,
            favCharacter: favCharacter.trim()
        }
      };

      await AsyncStorage.setItem("mobileUser", JSON.stringify(userData));
      setUser(userData);
      if (refreshStreak) refreshStreak();
      setTimeout(() => router.replace("/profile"), 100);

    } catch (err) {
      notify("Authentication Error", err.message);
      setIsProcessing(false);
    }
  };

  // Filter the list based on search query
  const filteredAnimes = ANIME_LIST.filter(anime => 
    anime.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <AnimeLoading message="Checking Session" subMessage="Initializing Neural Link" />;

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }} className="px-8 pt-20">
      
      {/* Step Indicator */}
      <View className="flex-row justify-between mb-12 px-2">
        {[1, 2, 3].map((s) => (
           <View key={s} style={{ height: 4, width: (width - 100) / 3, borderRadius: 2, backgroundColor: step >= s ? THEME.accent : THEME.border }} />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Dynamic Header */}
        <View className="items-center mb-10">
          <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="w-16 h-16 rounded-2xl items-center justify-center mb-4 border-2 shadow-xl">
             <Ionicons 
                name={step === 1 ? (isRecoveryMode ? "key-outline" : "finger-print") : step === 2 ? "flame-outline" : "heart-outline"} 
                size={32} 
                color={THEME.accent} 
             />
          </View>
          <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.4em] mb-1">
             Phase 0{step}
          </Text>
          <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase text-center">
             {step === 1 ? (isRecoveryMode ? "Link Account" : "Identity") : step === 2 ? "Affinities" : "Soul Link"}
          </Text>
        </View>

        {/* --- STEP 1: IDENTITY --- */}
        {step === 1 && (
            <View>
                {isRecoveryMode ? (
                    <TextInput
                        style={{ backgroundColor: THEME.card, borderColor: '#a855f7', color: THEME.text}}
                        className="w-full border-2 rounded-2xl px-6 py-5 mb-4 font-black italic"
                        placeholder="ENTER RECOVERY ID..."
                        placeholderTextColor={THEME.textSecondary + '80'}
                        value={recoverId}
                        onChangeText={setRecoverId}
                    />
                ) : (
                    <>
                        <TextInput
                            style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                            className="w-full border-2 rounded-2xl px-6 py-5 mb-6 font-black italic"
                            placeholder="CHOOSE CALLSIGN..."
                            placeholderTextColor={THEME.textSecondary + '80'}
                            value={username}
                            onChangeText={setUsername}
                        />
                        <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[9px] mb-3 ml-2 tracking-widest">Referral Link (Optional)</Text>
                        <TextInput
                            style={{ 
                                backgroundColor: isAutoReferrer ? THEME.bg : THEME.card, 
                                borderColor: isAutoReferrer ? '#a855f760' : THEME.border, 
                                color: isAutoReferrer ? '#a855f7' : THEME.text 
                            }}
                            className="w-full border-2 rounded-2xl px-6 py-5 mb-4 font-black italic"
                            placeholder="UPLINK CODE..."
                            value={referrerCode}
                            onChangeText={setReferrerCode}
                            editable={!isAutoReferrer}
                        />
                    </>
                )}
                <TouchableOpacity onPress={() => setIsRecoveryMode(!isRecoveryMode)} className="mt-2 items-center">
                    <RNText style={{ color: THEME.accent }} className="text-[10px] font-bold uppercase tracking-widest">
                        {isRecoveryMode ? "Create New Instead" : "Switch to Recovery Mode"}
                    </RNText>
                </TouchableOpacity>
            </View>
        )}

        {/* --- STEP 2: AFFINITIES --- */}
        {step === 2 && (
            <View>
                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[10px] mb-4 tracking-widest">Local Database Filter</Text>
                
                {/* 🔹 Local Search Input */}
                <View className="mb-6 relative">
                  <TextInput
                    style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                    className="w-full border-2 rounded-2xl px-6 py-4 font-black italic pr-12"
                    placeholder="FILTER POPULAR..."
                    placeholderTextColor={THEME.textSecondary + '40'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <View className="absolute right-4 top-4">
                    <Ionicons name="filter" size={20} color={THEME.textSecondary} />
                  </View>
                </View>

                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[10px] mb-4 tracking-widest">Popular Series (Pick 2+)</Text>
                <View className="flex-row flex-wrap mb-8">
                    {filteredAnimes.map((anime) => {
                        const active = selectedAnimes.includes(anime);
                        return (
                            <TouchableOpacity 
                                key={anime} 
                                onPress={() => toggleItem(anime, selectedAnimes, setSelectedAnimes)}
                                style={{ backgroundColor: active ? THEME.accent : THEME.card, borderColor: active ? THEME.accent : THEME.border }}
                                className="px-5 py-2.5 rounded-full border-2 mr-2 mb-3"
                            >
                                <RNText style={{ color: active ? 'white' : THEME.textSecondary }} className="font-black text-[11px] uppercase">{anime}</RNText>
                            </TouchableOpacity>
                        );
                    })}
                    {filteredAnimes.length === 0 && (
                      <RNText style={{ color: THEME.textSecondary }} className="italic text-xs py-4 opacity-50">No matches found in standard database...</RNText>
                    )}
                </View>

                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[10px] mb-4 tracking-widest">Preferred Genres</Text>
                <View className="flex-row flex-wrap mb-8">
                    {GENRE_LIST.map((genre) => {
                        const active = selectedGenres.includes(genre);
                        return (
                            <TouchableOpacity 
                                key={genre} 
                                onPress={() => toggleItem(genre, selectedGenres, setSelectedGenres)}
                                style={{ backgroundColor: active ? '#a855f7' : THEME.card, borderColor: active ? '#a855f7' : THEME.border }}
                                className="px-5 py-2.5 rounded-full border-2 mr-2 mb-3"
                            >
                                <RNText style={{ color: active ? 'white' : THEME.textSecondary }} className="font-black text-[11px] uppercase">{genre}</RNText>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        )}

        {/* --- STEP 3: CHARACTER & FINAL --- */}
        {step === 3 && (
            <View className="items-center">
                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[10px] mb-6 tracking-widest text-center">
                    Who is your absolute GOAT character?
                </Text>
                <TextInput
                    style={{ backgroundColor: THEME.card, borderColor: THEME.accent, color: THEME.text }}
                    className="w-full border-2 rounded-[30px] px-6 py-8 mb-10 font-black italic text-2xl text-center"
                    placeholder="E.G. MADARA"
                    placeholderTextColor={THEME.textSecondary + '40'}
                    autoFocus
                    value={favCharacter}
                    onChangeText={setFavCharacter}
                />
                <View style={{ backgroundColor: THEME.accent + '10' }} className="p-6 rounded-3xl border border-dashed border-sky-500/30">
                    <Text style={{ color: THEME.textSecondary }} className="text-[11px] text-center leading-5 italic">
                        "Your path is set. Establishing this link will synchronize your preferences across the Great Library."
                    </Text>
                </View>
            </View>
        )}

        {/* --- ACTION BUTTON --- */}
        <View className="mt-12 mb-20">
            <Pressable
                onPress={step === 3 ? handleAction : handleNextStep}
                disabled={isProcessing}
                style={({ pressed }) => [
                    {
                        backgroundColor: isProcessing ? THEME.border : THEME.accent,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                        opacity: isProcessing ? 0.6 : 1
                    }
                ]}
                className="w-full py-6 rounded-[28px] flex-row justify-center items-center shadow-2xl"
            >
                {isProcessing ? (
                    <ActivityIndicator size="small" color="white" />
                ) : (
                    <>
                        <RNText style={{ color: 'white' }} className="font-black italic uppercase tracking-[0.2em] text-lg mr-2">
                            {step === 3 ? (isRecoveryMode ? "Recover Link" : "Establish Link") : "Next Phase"}
                        </RNText>
                        <Ionicons name="arrow-forward" size={20} color="white" />
                    </>
                )}
            </Pressable>
            
            {step > 1 && (
                <TouchableOpacity onPress={() => setStep(step - 1)} className="mt-6 self-center">
                    <RNText style={{ color: THEME.textSecondary }} className="text-[10px] font-black uppercase tracking-widest opacity-50">Go Back</RNText>
                </TouchableOpacity>
            )}
        </View>
      </ScrollView>

      {/* Footer Branding */}
      <View className="absolute bottom-10 self-center">
        <Text style={{ color: THEME.textSecondary }} className="font-black text-[8px] uppercase tracking-[0.5em] opacity-30">Secure Protocol v2.0</Text>
      </View>
    </View>
  );
}