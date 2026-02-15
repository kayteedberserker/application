import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useColorScheme as useNativeWind } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    FlatList,
    Image,
    Modal,
    Platform,
    Pressable,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import useSWRInfinite from "swr/infinite";
import AnimeLoading from "../../components/AnimeLoading";
import AppOnboarding from "../../components/AppOnboarding";
import { SyncLoading } from "../../components/SyncLoading";
import { Text } from "../../components/Text";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";

const { width } = Dimensions.get("window");
const API_BASE = "https://oreblogda.com/api";
const LIMIT = 5;

const fetcher = (url) => apiFetch(url).then((res) => res.json());

// 🔹 AURA UI UTILITY (Using the Multi-Color Legend Theme)
const AURA_PURPLE = "#a78bfa";

const getAuraVisuals = (rank) => {
  const AURA_PURPLE = '#a78bfa'; 
  const MONARCH_GOLD = '#fbbf24'; 
  const YONKO_BLUE = '#60a5fa';   

  let visualConfig = { 
    color: AURA_PURPLE, 
    label: 'AURA OPERATIVE', 
    icon: 'target', 
    description: 'Your standing in the global hierarchy. Increase your points by engaging and posting logs.' 
  };

  if (!rank || rank <= 0) return visualConfig;

  if (rank === 1) {
    visualConfig.color = '#fbbf24'; // MONARCH_GOLD
    visualConfig.label = 'MONARCH';
    visualConfig.icon = 'crown';
    visualConfig.description = 'The absolute peak of the hierarchy. You command the shadows of the network.';
  } else if (rank === 2) {
    visualConfig.color = '#ef4444'; // CRIMSON_RED (Yonko)
    visualConfig.label = 'YONKO';
    visualConfig.icon = 'flare';
    visualConfig.description = 'An Emperor of the New World. Your influence is felt across all sectors.';
  } else if (rank === 3) {
    visualConfig.color = '#a855f7'; // SHADOW_PURPLE
    visualConfig.label = 'KAGE';
    visualConfig.icon = 'moon';
    visualConfig.description = 'The Shadow Leader. Tactical mastery has earned you this seat.';
  } else if (rank === 4) {
    visualConfig.color = '#3b82f6'; // STEEL_BLUE
    visualConfig.label = 'SHOGUN';
    visualConfig.icon = 'shield-star';
    visualConfig.description = 'Supreme Commander. You lead the elite guard with iron resolve.';
  } else if (rank === 5) {
    visualConfig.color = '#e0f2fe'; // REIATSU_WHITE
    visualConfig.label = 'ESPADA 0';
    visualConfig.icon = 'skull';
    visualConfig.description = 'The Secret Elite. You have surpassed the limits of the numbered guard.';
  } else if (rank >= 6 && rank <= 10) {
    // Map rank to the metallic fading colors
    const espadaColors = {
      6: '#cbd5e1', // Espada 1 (Bone Grey)
      7: '#94a3b8', // Espada 2
      8: '#64748b', // Espada 3
      9: '#475569', // Espada 4
      10: '#334155' // Espada 5 (Hollow Slate)
    };
    visualConfig.color = espadaColors[rank];
    visualConfig.label = `ESPADA ${rank - 5}`;
    visualConfig.icon = 'sword-cross';
    visualConfig.description = 'One of the ten elite warriors. Continue your ascent to reach the Top 5.';
  } else {
    visualConfig.color = '#1e293b'; // OPERATIVE
    visualConfig.label = 'OPERATIVE';
    visualConfig.icon = 'user'; // Or your default icon
    visualConfig.description = 'A standard operative in the field. Increase your Aura to rise.';
  }

  return visualConfig;
};

export default function MobileProfilePage() {
  const { user, setUser, contextLoading } = useUser();
  const { colorScheme } = useNativeWind(); 
  const isDark = colorScheme === "dark"; 
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState("");
  const [username, setUsername] = useState("");
  const [totalPosts, setTotalPosts] = useState(0); 
  const [isRestoringCache, setIsRestoringCache] = useState(true);
  const [showId, setShowId] = useState(false);
  const [preview, setPreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [rankModalVisible, setRankModalVisible] = useState(false);
  const [auraModalVisible, setAuraModalVisible] = useState(false);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const loadingAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current; 
  const [copied, setCopied] = useState(false);
  const [refCopied, setRefCopied] = useState(false); // 🔹 Added for Referral Copy

  const CACHE_KEY_USER_EXTRAS = `user_profile_cache_${user?.deviceId}`;

  // 🔹 AURA LOGIC (Dynamic Color Selection)
  const currentAuraPoints = user?.weeklyAura || 0; 
  const aura = useMemo(() => getAuraVisuals(user?.previousRank), [user?.previousRank]);
  const dynamicAuraColor = aura.color; // Use this for UI elements

  const filledBoxes = Math.min(Math.floor(currentAuraPoints / 10), 10);

  const copyToClipboard = async () => {
    if (user?.deviceId) {
      await Clipboard.setStringAsync(user.deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); 
    }
  };

  // 🔹 NEW REFERRAL COPY FUNCTION
  const copyReferralToClipboard = async () => {
    if (user?.referralCode) {
      const playStoreLink = `https://play.google.com/store/apps/details?id=com.kaytee.oreblogda&referrer=${user.referralCode}`;
      await Clipboard.setStringAsync(playStoreLink);
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 2000); 
    } else {
      Toast.show({
        type: 'info',
        text1: 'Syncing Code...',
        text2: 'Your referral ID is currently being generated.'
      });
    }
  };

  useEffect(() => {
    Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (isUpdating) {
      Animated.loop(
        Animated.timing(loadingAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      loadingAnim.stopAnimation();
      loadingAnim.setValue(0);
    }
  }, [isUpdating]);

  const spin = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const translateX = loadingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  useEffect(() => {
    const loadProfileCache = async () => {
      if (!user?.deviceId) return;
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY_USER_EXTRAS);
        if (cached) {
          const data = JSON.parse(cached);
          if (data.username) setUsername(data.username);
          if (data.description) setDescription(data.description);
          if (data.totalPosts) setTotalPosts(data.totalPosts);
        }
      } catch (e) {
        console.error("Cache load error", e);
      } finally {
        setIsRestoringCache(false);
      }
    };
    loadProfileCache();
  }, [user?.deviceId]);

  useEffect(() => {
    const syncUserWithDB = async () => {
      if (!user?.deviceId) return;
      try {
        const res = await apiFetch(`${API_BASE}/users/me?fingerprint=${user.deviceId}`);
        const dbUser = await res.json();
        if (res.ok) {
          setUser(dbUser);
          setDescription(dbUser.description || "");
          setUsername(dbUser.username || "");

          const postRes = await apiFetch(`/posts?author=${dbUser._id}&limit=1`);
          const postData = await postRes.json();
          const newTotal = postData.total || 0;
          if (postRes.ok) {
            setTotalPosts(newTotal);
          }

          await AsyncStorage.setItem(CACHE_KEY_USER_EXTRAS, JSON.stringify({
            username: dbUser.username,
            description: dbUser.description,
            totalPosts: newTotal
          }));
        }
      } catch (err) {
        console.error("Sync User Error:", err);
      }
    };
    syncUserWithDB();
  }, [user?.deviceId]);

  const getKey = (pageIndex, previousPageData) => {
    if (!user?._id) return null;
    if (previousPageData && previousPageData.posts.length < LIMIT) return null;
    return `${API_BASE}/posts?author=${user._id}&page=${pageIndex + 1}&limit=${LIMIT}`;
  };

  const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

  const posts = useMemo(() => {
    return data ? data.flatMap((page) => page.posts || []) : [];
  }, [data]);

  const isLoadingInitialData = isLoading && !data;
  const isReachingEnd = data && data[data.length - 1]?.posts.length < LIMIT;
  const isFetchingNextPage = isValidating && data && typeof data[size - 1] === "undefined";

  const count = totalPosts;
  const rankTitle = count > 200 ? "Master_Writer" : count > 150 ? "Elite_Writer" : count > 100 ? "Senior_Writer" : count > 50 ? "Novice_Writer" : count > 25 ? "Senior_Researcher" : "Novice_Researcher";
  const rankIcon = count > 200 ? "👑" : count > 150 ? "💎" : count > 100 ? "🔥" : count > 50 ? "⚔️" : count > 25 ? "📜" : "🛡️";
  const nextMilestone = count > 200 ? 500 : count > 150 ? 200 : count > 100 ? 150 : count > 50 ? 100 : count > 25 ? 50 : 25;
  const progress = Math.min((count / nextMilestone) * 100, 100);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const selected = result.assets[0];
      setPreview(selected.uri);
      setImageFile({
        uri: selected.uri,
        name: "profile.jpg",
        type: "image/jpeg",
      });
    }
  };

  const handleUpdate = async () => {
    if (!username.trim()) {
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }

    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append("userId", user?._id || "");
      formData.append("fingerprint", user?.deviceId || "");
      formData.append("description", description);
      formData.append("username", username);

      if (imageFile) {
        if (Platform.OS === "web") {
          const blob = await (await fetch(imageFile.uri)).blob();
          formData.append("file", blob, "profile.jpg");
        } else {
          formData.append("file", imageFile);
        }
      }

      const res = await apiFetch(`${API_BASE}/users/upload`, {
        method: "PUT",
        body: formData,
      });

      const result = await res.json();
      if (res.ok) {
        setUser(result.user);
        setPreview(null);
        setImageFile(null);

        await AsyncStorage.setItem(CACHE_KEY_USER_EXTRAS, JSON.stringify({
          username: result.user.username,
          description: result.user.description,
          totalPosts: totalPosts
        }));

        Alert.alert("Success", "Character Data Updated.");
      } else {
        Alert.alert("Error", result.message || "Failed to update.");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to sync changes.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = (postId) => {
    Alert.alert("Confirm Deletion", "Erase this transmission log?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          Toast.show({
            type: 'info',
            text1: 'Processing...',
            text2: 'Attempting to delete post',
            autoHide: false
          });

          try {
            const response = await apiFetch(`${API_BASE}/posts/delete`, {
              method: "DELETE",
              body: JSON.stringify({ postId, fingerprint: user?.deviceId }),
            });

            const data = await response.json();

            if (response.ok) {
              mutate();
              setTotalPosts(prev => prev - 1);
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: data.message || 'Post removed successfully'
              });
            } else {
              Toast.show({
                type: 'error',
                text1: 'Deletion Blocked',
                text2: data.message || 'This post cannot be deleted.'
              });
            }
          } catch (err) {
            console.error("Delete Error:", err);
            Toast.show({
              type: 'error',
              text1: 'Connection Error',
              text2: 'Failed to reach the server.'
            });
          }
        },
      },
    ]);
  };

  const listHeader = useMemo(() => (
    <View className="px-6">
      <View className="flex-row items-center gap-4 mb-10 border-b border-gray-100 dark:border-gray-800 pb-6">
        <View className="w-2 h-8" style={{ backgroundColor: dynamicAuraColor }} />
        <Text className="text-3xl font-black italic tracking-tighter uppercase dark:text-white">Player Profile</Text>
      </View>

      <View className="items-center mb-10">
        <View className="relative">
          {/* 🔹 Dynamic Aura Pulse Glow */}
          <Animated.View 
            style={{ 
              position: 'absolute', 
              inset: -12, 
              borderRadius: 100, 
              backgroundColor: dynamicAuraColor, 
              opacity: 0.15,
              transform: [{ scale: pulseAnim }]
            }} 
          />
          <Animated.View
            style={{ 
              transform: [{ rotate: spin }],
              borderColor: `${dynamicAuraColor}40` 
            }}
            className="absolute -inset-4 border border-dashed rounded-full"
          />
          <View 
            style={{ borderColor: dynamicAuraColor }}
            className="absolute -inset-1 border-2 rounded-full opacity-50" 
          />

          <TouchableOpacity onPress={pickImage} className="w-40 h-40 rounded-full overflow-hidden border-4 border-white dark:border-[#0a0a0a] bg-gray-900 shadow-2xl">
            <Image
              source={{ uri: preview || user?.profilePic?.url || "https://via.placeholder.com/150" }}
              className="w-full h-full object-cover"
            />
            <View className="absolute inset-0 bg-black/40 items-center justify-center">
              <Text className="text-[10px] font-black uppercase tracking-widest text-white">Change DNA</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View className="mt-6 items-center">
          <Pressable 
            onPress={() => setAuraModalVisible(true)}
            className="flex-row items-center gap-2"
          >
            <Text 
              style={{ color: isDark ? "#fff" : "#000" }}
              className="text-2xl font-black uppercase tracking-tighter"
            >
              {username || user?.username || "GUEST"}
            </Text>
            <View className="px-2 py-0.5 rounded-full border" style={{ borderColor: dynamicAuraColor, backgroundColor: `${dynamicAuraColor}10` }}>
              <Text style={{ color: dynamicAuraColor, fontSize: 8, fontWeight: '900' }}>{aura.label} {currentAuraPoints}</Text>
            </View>
          </Pressable>

          {/* 🔹 DYNAMIC POWER INDICATOR */}
          <View className="mt-3 items-center">
            <View className="flex-row gap-1 mb-1">
              {[...Array(10)].map((_, i) => (
                <View 
                  key={i} 
                  className="h-1.5 w-4 rounded-sm" 
                  style={{ 
                    backgroundColor: i < filledBoxes ? dynamicAuraColor : (isDark ? '#1f2937' : '#e5e7eb'),
                    opacity: i < filledBoxes ? 1 : 0.3 
                  }}
                />
              ))}
            </View>
            <Text style={{ color: dynamicAuraColor }} className="text-[8px] font-black uppercase tracking-[0.2em]">
              Aura Power: {filledBoxes}/10
            </Text>
          </View>

          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1">Class: {rankTitle}</Text>
        </View>

        <View className="mt-8 w-full px-4">
          <Pressable 
            onPress={() => setRankModalVisible(true)}
            className="flex-row justify-between items-end mb-2"
          >
            <View className="flex-row items-center gap-2">
              <Text className="text-xl">{rankIcon}</Text>
              <Text className="text-[10px] font-black uppercase tracking-widest dark:text-white">{rankTitle}</Text>
            </View>
            <Text className="text-[10px] font-mono font-bold text-gray-500">
              EXP: {count} / {count > 200 ? "MAX" : nextMilestone}
            </Text>
          </Pressable>
          <View className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-200 dark:border-white/10">
            <View
              style={{ width: `${progress}%`, backgroundColor: dynamicAuraColor }}
              className="h-full shadow-lg"
            />
          </View>
        </View>
      </View>

      <View className="space-y-6">
        <View className="space-y-1">
          <Text className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Display Name / Alias</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Enter alias..."
            placeholderTextColor="#4b5563"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl text-sm font-bold dark:text-white"
          />
        </View>

        <View className="space-y-1 mt-4">
          <Text className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">
            Neural Uplink - <Text className="text-[9px] font-black tracking-widest text-gray-500">Used for account recovery (Keep Secret)</Text>
          </Text>

          <View className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex-row justify-between items-center">
            <View className="flex-1 mr-4">
              <Text 
                numberOfLines={1} 
                ellipsizeMode="middle" 
                className={`text-xs font-bold font-mono ${showId ? 'text-gray-500 dark:text-gray-400' : 'text-blue-500/40'}`}
              >
                {showId 
                  ? (user?.deviceId || "SEARCHING...") 
                  : "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"} 
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable 
                onPress={() => setShowId(!showId)} 
                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800"
              >
                <Feather 
                  name={showId ? "eye-off" : "eye"} 
                  size={16} 
                  color={isDark ? "#94a3b8" : "#64748b"} 
                />
              </Pressable>

              <Pressable 
                onPress={copyToClipboard} 
                className={`p-2 rounded-xl ${copied ? 'bg-green-500/10' : 'bg-blue-500/10'}`}
              >
                <Feather 
                  name={copied ? "check" : "copy"} 
                  size={16} 
                  color={copied ? "#22c55e" : "#3b82f6"} 
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* 🔹 NEW REFERRAL DIRECTIVE UI */}
        <View className="space-y-1 mt-4">
          <Text className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">
            Recruitment Directive - <Text className="text-[9px] font-black tracking-widest text-gray-500">Share to build your ranks</Text>
          </Text>

          <View className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex-row justify-between items-center">
            <View className="flex-1 mr-4">
              <Text 
                numberOfLines={1} 
                ellipsizeMode="tail" 
                className="text-xs font-bold font-mono text-purple-500/80 dark:text-purple-400"
              >
                {user?.referralCode ? `play.google.com/...referrer=${user.referralCode}` : "SYNCHRONIZING_ID..."} 
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <View className="bg-purple-500/10 px-2 py-1.5 rounded-lg mr-1 border border-purple-500/20">
                <Text className="text-[9px] font-black text-purple-500 uppercase tracking-widest">
                  {user?.referralCount || 0} Recruits
                </Text>
              </View>
              <Pressable 
                onPress={copyReferralToClipboard} 
                className={`p-2 rounded-xl ${refCopied ? 'bg-green-500/10' : 'bg-purple-500/10'}`}
              >
                <Feather 
                  name={refCopied ? "check" : "share-2"} 
                  size={16} 
                  color={refCopied ? "#22c55e" : "#a855f7"} 
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View className="space-y-1 mt-4">
          <Text className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Biography / Lore</Text>
          <TextInput
            multiline
            value={description}
            onChangeText={setDescription}
            placeholder="Write your player bio here..."
            placeholderTextColor="#4b5563"
            className="w-full bg-white dark:bg-black/40 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-sm font-medium dark:text-white min-h-[120px]"
            style={{ textAlignVertical: 'top' }}
          />
        </View>

        <TouchableOpacity
          onPress={handleUpdate}
          disabled={isUpdating}
          style={{ backgroundColor: dynamicAuraColor }}
          className="relative w-full h-14 rounded-2xl overflow-hidden items-center justify-center mt-6"
        >
          <Text className="relative z-10 text-white font-black uppercase italic tracking-widest text-xs">
            {isUpdating ? "Syncing Changes..." : "Update Character Data"}
          </Text>
          {isUpdating && (
            <Animated.View
              className="absolute bottom-0 h-1 bg-white/40 w-full"
              style={{ transform: [{ translateX }] }}
            />
          )}
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center gap-4 mt-16 mb-8">
        <Text className="text-xl font-black uppercase tracking-tighter italic dark:text-white">Transmission Logs</Text>
        <View className="h-[1px] flex-1 bg-gray-100 dark:bg-gray-800" />
      </View>
    </View>
  ), [user, preview, description, username, isUpdating, spin, translateX, totalPosts, copied, refCopied, rankTitle, rankIcon, progress, nextMilestone, count, showId, isDark, aura, pulseAnim, filledBoxes, currentAuraPoints, dynamicAuraColor]); 

  if (contextLoading || isRestoringCache) {
    return <AnimeLoading message="Syncing Profile" subMessage="Checking local cache..." />;
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#0a0a0a]" style={{ paddingTop: insets.top }}>
      <AppOnboarding />
      <View className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full" pointerEvents="none" />
      <View className="absolute bottom-0 left-0 w-60 h-60 bg-purple-600/5 rounded-full" pointerEvents="none" />

      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={listHeader}
        onEndReached={() => {
          if (!isReachingEnd && !isValidating) {
            setSize(size + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <View className="px-6 mb-4">
            <View className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl flex-row justify-between items-center">
              <Pressable onPress={() => router.push(`/post/${item.slug || item._id}`)} className="flex-1 pr-4">
                <Text className="font-black text-sm uppercase tracking-tight text-gray-800 dark:text-gray-200" numberOfLines={1}>
                  {item.title || item.message}
                </Text>
                <Text className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                <View className="flex-row items-center gap-4 mt-2">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="heart-outline" size={12} color="#9ca3af" />
                    <Text className="text-gray-500 text-[10px] font-bold">{item.likes?.length || 0}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="chatbubble-outline" size={12} color="#9ca3af" />
                    <Text className="text-gray-500 text-[10px] font-bold">{item.comments?.length || 0}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="eye-outline" size={12} color="#9ca3af" />
                    <Text className="text-gray-500 text-[10px] font-bold">{item.views || 0}</Text>
                  </View>
                </View>
              </Pressable>
              <TouchableOpacity onPress={() => handleDelete(item._id)} className="p-3 bg-red-500/10 rounded-xl">
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={() => {
          if (isLoadingInitialData) return <SyncLoading />;
          return (
            <View className="mx-6 p-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800 items-center">
              <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400">Empty Logs - Go Post Something!</Text>
            </View>
          );
        }}
        ListFooterComponent={() => (
          <View style={{ paddingBottom: insets.bottom + 100 }}>
            {isFetchingNextPage && <ActivityIndicator className="py-4" color="#2563eb" />}
          </View>
        )}
      />

      <Modal visible={rankModalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/80 items-center justify-center p-6">
          <View className="bg-white dark:bg-[#0d1117] w-full p-8 rounded-[40px] border border-gray-200 dark:border-gray-800">
            <View className="w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-full items-center justify-center mb-6 self-center">
              <Text style={{ fontSize: 40 }}>{rankIcon}</Text>
            </View>
            <Text className="text-2xl font-black text-center uppercase tracking-tighter dark:text-white mb-2">{rankTitle.replace('_', ' ')}</Text>
            <Text className="text-gray-500 text-center font-bold text-xs uppercase tracking-widest mb-6">Current Standing</Text>
            <Text className="text-gray-600 dark:text-gray-400 text-center leading-6 mb-8">
              You have transmitted <Text className="font-black text-blue-600">{count}</Text> logs. 
              {count < 200 ? ` Reach ${nextMilestone} posts to evolve into the next class.` : " You have reached the pinnacle of researchers."}
            </Text>
            <TouchableOpacity onPress={() => setRankModalVisible(false)} className="bg-blue-600 p-4 rounded-2xl items-center"><Text className="text-white font-black uppercase tracking-widest text-xs">Close Intel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🔹 DYNAMIC AURA INFO MODAL */}
      <Modal visible={auraModalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/80 items-center justify-center p-6">
          <View className="bg-white dark:bg-[#0d1117] w-full p-8 rounded-[40px] border-2" style={{ borderColor: dynamicAuraColor }}>
            <MaterialCommunityIcons name={aura.icon} size={60} color={dynamicAuraColor} style={{ alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ color: dynamicAuraColor }} className="text-3xl font-black text-center uppercase tracking-widest mb-2">{aura.label} POWER</Text>
            <Text className="text-gray-500 text-center font-bold text-[10px] uppercase tracking-[0.3em] mb-2">Total Points: {currentAuraPoints}</Text>

            <View className="flex-row justify-center gap-1 mb-6">
              {[...Array(10)].map((_, i) => (
                <View key={i} className="h-2 w-4 rounded-sm" style={{ backgroundColor: i < filledBoxes ? dynamicAuraColor : '#374151' }} />
              ))}
            </View>

            <Text className="text-gray-600 dark:text-gray-400 text-center leading-7 mb-8 font-medium">{aura.description}</Text>
            <TouchableOpacity onPress={() => setAuraModalVisible(false)} style={{ backgroundColor: dynamicAuraColor }} className="p-4 rounded-2xl items-center shadow-lg"><Text className="text-white font-black uppercase tracking-widest text-xs">Acknowledge</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}