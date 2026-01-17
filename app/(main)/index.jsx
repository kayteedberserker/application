import React, { useRef, useState, useEffect } from 'react';
import { View, DeviceEventEmitter, Dimensions, FlatList } from "react-native";
import PostsViewer from "./../../components/PostViewer";
import CategoryPage from "./categories/[id]"; 

const { width } = Dimensions.get('window');

// 🔹 Swipe order: Matches your CategoryNav exactly
const CATEGORIES = ["Home", "News", "Memes", "Polls", "Review", "Gaming"];

export default function HomePage() {
  const flatListRef = useRef(null);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // 🔹 Listen for clicks from your Category Nav Bar (Jump to page)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("jumpToCategory", (categoryName) => {
      const index = CATEGORIES.findIndex(cat => cat.toLowerCase() === categoryName.toLowerCase());
      
      if (index !== -1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({ index, animated: true });
      }
    });
    return () => sub.remove();
  }, []);

  // 🔹 Triggered when the user finishes swiping manually
  const onMomentumScrollEnd = (e) => {
    const contentOffset = e.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / width);
    
    if (index !== activePageIndex) {
      setActivePageIndex(index);
      // 🔹 Notify CategoryNav to move the highlight
      DeviceEventEmitter.emit("categoryChanged", CATEGORIES[index]);
      // 🔹 Notify MainLayout for the Hardware Back Button logic
      DeviceEventEmitter.emit("categoryIndexChanged", index);
    }
  };

  const renderPage = ({ item }) => {
    return (
      <View style={{ width }}>
        {item === "Home" ? (
          <PostsViewer />
        ) : (
          <CategoryPage id={item.toLowerCase()} />
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        ref={flatListRef}
        data={CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={renderPage}
        horizontal
        pagingEnabled // 🔹 This makes it snap to pages like a swiper
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        bounces={true}
        // Optimization: Pre-calculates positions so the swipe is fast
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        // Memory management
        removeClippedSubviews={true}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={2}
        scrollEventThrottle={16}
      />
    </View>
  );
}
