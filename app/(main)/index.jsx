import React, { useRef, useState, useEffect } from 'react';
import { View, DeviceEventEmitter, Dimensions } from "react-native";
import PagerView from 'react-native-pager-view';
import PostsViewer from "./../../components/PostViewer";
import CategoryPage from "./categories/[id]"; // Adjust this path if your Category file is elsewhere

const { width } = Dimensions.get('window');

// 🔹 Define your swipe order
const CATEGORIES = ["Home", "News", "Memes", "Polls", "Reviews", "Gaming"];

export default function HomePage() {
  const pagerRef = useRef(null);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // 🔹 Listen for clicks from your Category Nav Bar
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("jumpToCategory", (categoryName) => {
      const index = CATEGORIES.findIndex(cat => cat.toLowerCase() === categoryName.toLowerCase());
      if (index !== -1 && pagerRef.current) {
        pagerRef.current.setPage(index);
      }
    });
    return () => sub.remove();
  }, []);

  const onPageSelected = (e) => {
    const index = e.nativeEvent.position;
    setActivePageIndex(index);
    // Optional: Emit event so Nav Bar knows which button to highlight
    DeviceEventEmitter.emit("categoryChanged", CATEGORIES[index]);
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <PagerView 
        ref={pagerRef}
        style={{ flex: 1 }} 
        initialPage={0}
        onPageSelected={onPageSelected}
        // Use 'overdrag' so users feel a resistance at the end of the list
        overdrag={true}
      >
        {/* PAGE 0: MAIN HOME FEED */}
        <View key="0">
          <PostsViewer />
        </View>

        {/* PAGE 1: NEWS */}
        <View key="1">
          <CategoryPage id="news" />
        </View>

        {/* PAGE 2: MEMES */}
        <View key="2">
          <CategoryPage id="memes" />
        </View>

        {/* PAGE 3: POLLS */}
        <View key="3">
          <CategoryPage id="polls" />
        </View>

        {/* PAGE 4: REVIEWS */}
        <View key="4">
          <CategoryPage id="reviews" />
        </View>

        {/* PAGE 5: GAMING */}
        <View key="5">
          <CategoryPage id="gaming" />
        </View>
      </PagerView>
    </View>
  );
}
