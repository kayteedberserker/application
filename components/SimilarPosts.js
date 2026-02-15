import { useColorScheme } from "nativewind";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import useSWR from "swr";
import apiFetch from "../utils/apiFetch";
import PostCard from "./PostCard";

const API_URL = "https://oreblogda.com";
const fetcher = (url) => apiFetch(url).then((res) => res.json());

export default function SimilarPosts({ category, currentPostId }) {
  const [shuffledPosts, setShuffledPosts] = useState([]);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

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
              {/* {(index + 1) % 3 === 0 && (
                <View className={'min-w-[270px]'}>
                  <AppBanner size="MEDIUM_RECTANGLE" />
                </View>
              )} */}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}
