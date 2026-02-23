import { useColorScheme } from "nativewind";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native"; // Added ActivityIndicator
import useSWR from "swr";
import apiFetch from "../utils/apiFetch";
import PostCard from "./PostCard";

const API_URL = "https://oreblogda.com";
const fetcher = (url) => apiFetch(url).then((res) => res.json());

export default function SimilarPosts({ category, currentPostId }) {
  const [shuffledPosts, setShuffledPosts] = useState([]);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // FIX 1: Removed refreshInterval. 
  // Added revalidateIfStale: false and revalidateOnFocus: false to ensure it only loads once.
  const { data, error, isLoading } = useSWR(
    category ? `${API_URL}/api/posts?category=${category}` : null,
    fetcher,
    { 
      refreshInterval: 0, 
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false 
    }
  );

  useEffect(() => {
    // FIX 2: Only shuffle if we have data AND we haven't already set shuffledPosts.
    // This prevents the posts from changing/jumping when the component re-renders.
    if (data && shuffledPosts.length === 0) {
      const list = (Array.isArray(data) ? data : data.posts || [])
        .filter((p) => p._id !== currentPostId);

      const shuffled = [...list].sort(() => Math.random() - 0.5);
      setShuffledPosts(shuffled.slice(0, 6));
    }
  }, [data, currentPostId, shuffledPosts.length]);

  // Handle Loading State with animation as requested
  if (isLoading) {
      return (
          <View className="mt-6 py-10 items-center justify-center">
              <ActivityIndicator size="small" color="#60a5fa" />
          </View>
      );
  }

  if (error || !shuffledPosts.length) return null;

  return (
    <View className="mt-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8, paddingRight: 16 }}
        className="flex-row"
      >
        {shuffledPosts.map((post, index) => {
          return (
            <React.Fragment key={post._id}>
              {/* Post Item */}
              <View className="mr-4 w-[320px]">
                <PostCard
                  post={post}
                  similarPosts={true}
                  posts={shuffledPosts}
                  setPosts={() => {}}
                  isFeed={true}
                  className="h-[400px] flex flex-col justify-between"
                  hideMedia={post.category === "Polls"}
                />
              </View>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}