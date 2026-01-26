import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Dimensions, ScrollView, View, TouchableOpacity } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimeLoading from '../../../components/AnimeLoading';
import CommentSection from "../../../components/CommentSection";
import PostCard from "../../../components/PostCard";
import SimilarPosts from "../../../components/SimilarPosts";
import { Text } from '../../../components/Text';
import apiFetch from "../../../utils/apiFetch";

const { width } = Dimensions.get('window');
const API_URL = "https://oreblogda.com";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = colorScheme === "dark";
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [similarPosts, setSimilarPosts] = useState([]);
  const scrollRef = useRef(null);
  
  const CACHE_KEY = `post_detail_${id}`;

  // --- 1. ANIMATION HOOKS ---
  const streamX = useSharedValue(-width);
  const streamStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: streamX.value }],
  }));

  useEffect(() => {
    streamX.value = withRepeat(
      withTiming(width, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  // --- 2. DATA FETCHING LOGIC (Cache + Network) ---
  const fetchPostData = async () => {
    try {
      // Step A: Load from Cache immediately
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setPost(JSON.parse(cached));
        setLoading(false); // Show cached content while fetching
      }

      // Step B: Fetch from Network
      const res = await apiFetch(`${API_URL}/api/posts/${id}`);
      if (!res.ok) throw new Error("Network response was not ok");
      
      const data = await res.json();
      
      // Step C: Update State & Cache
      setPost(data);
      setIsOffline(false);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      
      // Handle Side Effects (Views & Similar Posts)
      handleSimilarPosts(data);
      handleViewIncrement(data._id);

    } catch (error) {
      console.log("Fetch error:", error);
      // If we have no cache and network fails -> Offline Mode
      const hasCache = await AsyncStorage.getItem(CACHE_KEY);
      if (!hasCache) {
          setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPostData();
  }, [id]);

  const handleSimilarPosts = async (postData) => {
    try {
        const res = await apiFetch(`${API_URL}/api/posts?category=${postData.category}&limit=6`);
        const data = await res.json();
        const filtered = (data.posts || []).filter((p) => p._id !== id);
        setSimilarPosts(filtered);
    } catch (e) { console.log("Similar posts error", e); }
  };

  const handleViewIncrement = async (postId) => {
    try {
      await apiFetch(`${API_URL}/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "view" }),
      });
    } catch (e) { console.log("View count error", e); }
  };

  const handleRefresh = () => {
      setLoading(true);
      setIsOffline(false);
      fetchPostData();
  };

  // --- 3. EVENT LISTENERS ---
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => sub.remove();
  }, []);

  // --- UI: LOADING STATE ---
  if (loading && !post) {
    return <AnimeLoading message="Decrypting Intel..." subMessage="Accessing Mainframe" />;
  }

  // --- UI: OFFLINE / NOT FOUND STATE ---
  if (isOffline || (!post && !loading)) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#050505' : '#f9fafb', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {/* Glitch Effect Box */}
        <View className="relative items-center mb-8">
            <View className="absolute w-32 h-32 bg-red-500/20 rounded-full blur-xl animate-pulse" />
            <MaterialCommunityIcons name="wifi-off" size={64} color={isDark ? "#ef4444" : "#dc2626"} />
            <View className="absolute -bottom-2 w-full h-1 bg-red-500/50 shadow-[0_0_10px_#ef4444]" />
        </View>

        <Text className="text-3xl font-[900] italic uppercase text-red-600 tracking-tighter mb-2">
            Signal Lost
        </Text>
        <Text className="text-center text-gray-500 dark:text-gray-400 font-medium mb-8 leading-6">
            {isOffline 
                ? "Unable to establish neural link with the server.\nCheck your internet connection." 
                : "This intel has been redacted or deleted from the archive."}
        </Text>

        {/* Retry Button */}
        <TouchableOpacity 
            onPress={handleRefresh}
            className="flex-row items-center gap-2 bg-red-600 px-8 py-3 rounded-full shadow-lg shadow-red-500/30 active:scale-95"
        >
            <MaterialCommunityIcons name="refresh" size={20} color="white" />
            <Text className="text-white font-[900] uppercase tracking-widest text-xs">
                Reconnect
            </Text>
        </TouchableOpacity>

        <TouchableOpacity 
            onPress={() => router.back()}
            className="mt-6"
        >
             <Text className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                Return to Base
            </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- UI: MAIN CONTENT ---
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#050505" : "#ffffff" }}>
      
      {/* --- TOP DATA STREAM LOADER --- */}
      <View 
        className="absolute top-0 left-0 w-full h-[1px] z-50 overflow-hidden"
        style={{ backgroundColor: isDark ? 'rgba(30, 58, 138, 0.2)' : 'rgba(37, 99, 235, 0.1)' }}
      >
        <Animated.View 
          className="h-full w-1/2 bg-blue-500"
          style={[streamStyle, { shadowColor: '#3b82f6', shadowRadius: 4, shadowOpacity: 0.5 }]}
        />
      </View>

      <ScrollView 
        ref={scrollRef} 
        onScroll={(e) => {
          DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingTop: insets.top + 20, 
          paddingBottom: insets.bottom + 100, 
          paddingHorizontal: 16 
        }} 
      >
        {/* --- BREADCRUMB HUD --- */}
        <View className="flex-row items-center gap-2 mb-6 px-1">
          <View className={`h-1.5 w-1.5 rounded-full ${isOffline ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
          <Text className={`text-[10px] font-black tracking-widest uppercase ${isOffline ? 'text-orange-500' : 'text-blue-600'}`}>
            {isOffline ? "OFFLINE_CACHE" : "INTEL_STREAM"}
          </Text>
          <View className="h-[1px] w-8 bg-gray-200 dark:bg-gray-800" />
          <Text 
            numberOfLines={1}
            className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex-1"
          >
            {post?.category || "Unclassified"}
          </Text>
        </View>

        {/* --- MAIN CONTENT SECTOR --- */}
        <View className="mb-8 relative">
          <PostCard
            post={post}
            isFeed={false}
            // Passing empty array or similar isn't strictly necessary unless PostCard uses it for navigation
            posts={[post]} 
            // In offline mode, mutations might not save, but we keep the function for UI optimistics
            setPosts={() => {}} 
            hideComments={true}
            isDark={isDark}
          />
        </View>

        {/* --- COMMS CHANNEL (Comment Section) --- */}
        <View className="mb-10">
          <View className="flex-row items-center gap-2 mb-4 px-2">
            <View className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
            <Text className="text-[11px] font-[900] uppercase tracking-[0.2em] text-gray-900 dark:text-white">
              Comms_Channel
            </Text>
            {isOffline && (
                 <Text className="text-[9px] font-bold text-orange-500 uppercase tracking-wide ml-auto">
                    (Read Only)
                 </Text>
            )}
          </View>
          
          <View className="bg-gray-50/50 dark:bg-gray-900/30 rounded-[32px] border border-gray-100 dark:border-blue-900/20 p-1">
             {/* If offline, we can still show comments if we cached them, but for now let's just let the component handle its own fetch failure gracefully or hide write access */}
            <CommentSection 
                slug={post?.slug} 
                postId={post?._id} 
                mutatePost={() => {}} 
                isOffline={isOffline} // Pass this if you want to disable the input field in CommentSection
            />
          </View>
        </View>

        {/* --- SIMILAR INTEL SECTOR --- */}
        {similarPosts.length > 0 && (
            <View className="mb-10">
            <View className="flex-row items-center gap-4 mb-6">
                <Text className="text-2xl font-[900] italic uppercase tracking-tighter text-gray-900 dark:text-white">
                Related <Text className="text-blue-600">Intel</Text>
                </Text>
                <View className="h-[1px] flex-1 bg-gray-100 dark:bg-gray-800" />
            </View>
            
            <SimilarPosts
                posts={similarPosts}
                category={post?.category}
                currentPostId={post?._id}
            />
            </View>
        )}
      </ScrollView>
    </View>
  );
}
