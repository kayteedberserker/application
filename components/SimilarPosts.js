import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { BannerAdSize } from "react-native-google-mobile-ads";
import useSWR from "swr";
import AppBanner from "./AppBanner";
import PostCard from "./PostCard";
import { Text } from "./Text";

const API_URL = "https://oreblogda.com";
const fetcher = (url) => fetch(url).then((res) => res.json());

export default function SimilarPosts({ category, currentPostId }) {
  const [shuffledPosts, setShuffledPosts] = useState([]);

  const { data, error, isLoading } = useSWR(
    category ? `${API_URL}/api/posts?category=${category}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  useEffect(() => {
    if (data) {
      const list = (Array.isArray(data) ? data : data.posts || [])
        .filter((p) => p._id !== currentPostId);

      const shuffled = [...list].sort(() => Math.random() - 0.5);
      setShuffledPosts(shuffled.slice(0, 6));
    }
  }, [data, currentPostId]);

  if (isLoading || error || !shuffledPosts.length) return null;

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

              {/* Ad placement every 2 posts */}
              {(index + 1) % 3 === 0 && (
                <View 
                  className="mr-4 w-[300px] h-[400px] bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 items-center justify-center"
                >
                  <Text className="text-[10px] text-gray-400 mb-4 uppercase tracking-widest">
                    Sponsored
                  </Text>

                  <AppBanner size={BannerAdSize.MEDIUM_RECTANGLE} />
                  
                  <Text className="text-[10px] text-gray-400 mt-4 text-center px-4">
                    Relevant content for you
                  </Text>
                </View>
              )}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}
