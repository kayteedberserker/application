import { useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Dimensions, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useSWR from 'swr';
import AnimeLoading from '../../../components/AnimeLoading';
import CommentSection from "../../../components/CommentSection";
import PostCard from "../../../components/PostCard";
import SimilarPosts from "../../../components/SimilarPosts";
import { Text } from '../../../components/Text';
import apiFetch from "../../../utils/apiFetch"

const fetcher = (url) => apiFetch(url).then((res) => res.json());
const { width } = Dimensions.get('window');
const API_URL = "https://oreblogda.com";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";
  
  const [similarPosts, setSimilarPosts] = useState([]);
  const scrollRef = useRef(null);

  // --- 1. ANIMATION HOOKS (Moved to top to prevent Hook Order Error) ---
  const streamX = useSharedValue(-width);
  
  const streamStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: streamX.value }],
  }));

  useEffect(() => {
    streamX.value = withRepeat(
      withTiming(width, {
        duration: 3000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  // --- 2. FUNCTIONAL HOOKS ---
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("doScrollToTop", () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => sub.remove();
  }, []);

  const { data: post, error, mutate, isLoading } = useSWR(
    id ? `${API_URL}/api/posts/${id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!post?._id) return;

    apiFetch(`${API_URL}/api/posts?category=${post.category}&limit=6`)
      .then(res => res.json())
      .then(data => {
        const filtered = (data.posts || []).filter((p) => p._id !== id);
        setSimilarPosts(filtered);
      })
      .catch(err => console.error("Similar posts fetch failed", err));

    handleViewIncrement(post._id);
  }, [post?._id]);

  const handleViewIncrement = async (postId) => {
    try {
      await apiFetch(`${API_URL}/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "view" }),
      });
      if (post) {
        mutate({ ...post, views: (post.views || 0) + 1 }, false);
      }
    } catch (e) {
      console.error("View count update failed", e);
    }
  };

  // --- 3. CONDITIONAL RENDERING (Must stay after all Hook calls) ---
  if (isLoading) {
    return <AnimeLoading message="Loading..." subMessage="Fetching Post" />
  }

  if (error || !post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#111827' : '#fff' }}>
        <Text className="dark:text-white">Post not found</Text>
      </View>
    );
  }

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
          <Text className="text-[10px] font-black text-blue-600 tracking-widest uppercase">
            Intel_Stream
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
          {/* Corner Decoration Overlay */}
          <View 
            className="absolute top-0 right-0 w-10 h-10 border-t border-r border-blue-600/20 rounded-tr-[32px] z-10" 
            pointerEvents="none" 
          />
          
          <PostCard
            post={post}
            isFeed={false}
            posts={[post]}
            setPosts={mutate}
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
          </View>
          
          <View className="bg-gray-50/50 dark:bg-gray-900/30 rounded-[32px] border border-gray-100 dark:border-blue-900/20 p-1">
            <CommentSection slug={post?.slug} postId={post?._id} mutatePost={mutate} />
          </View>
        </View>

        {/* --- SIMILAR INTEL SECTOR --- */}
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

      </ScrollView>
    </View>
  );
}
