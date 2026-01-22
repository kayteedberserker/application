import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  Animated as RNAnimated,
  ScrollView,
  TextInput,
  View,
  Modal,
  Platform,
  PanResponder,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import useSWR from "swr";
import { useUser } from "../context/UserContext";
import { Text } from "./Text";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const API_URL = "https://oreblogda.com";

/* ---------------- Skeleton ---------------- */
const CommentSkeleton = () => {
  const opacity = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View className="mb-6 pl-4 border-l-2 border-gray-100 dark:border-gray-800">
      <RNAnimated.View style={{ opacity }} className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded-md mb-2" />
      <RNAnimated.View style={{ opacity }} className="h-4 w-full bg-gray-100 dark:border-gray-800 rounded-md mb-1" />
    </View>
  );
};

/* ---------------- Single Comment ---------------- */
const SingleComment = ({ comment, onOpenDiscussion }) => {
  const hasReplies = comment.replies?.length > 0;
  const previewReplies = (comment.replies || []).slice(0, 1);

  return (
    <View className="mb-6 border-l-2 border-blue-600/20 pl-4">
      <Text className="text-[11px] font-black text-blue-600 uppercase">{comment.name}</Text>
      <Text className="text-xs text-gray-600 dark:text-gray-300 font-bold mt-1">{comment.text}</Text>

      <View className="flex-row items-center mt-3 gap-4">
        <Text className="text-gray-400 text-[8px] font-bold">
          {new Date(comment.date).toLocaleDateString()}
        </Text>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpenDiscussion(comment);
          }}
          className="flex-row items-center bg-blue-600/10 px-3 py-1.5 rounded-full border border-blue-600/20"
        >
          <Ionicons name="chatbubbles-outline" size={12} color="#2563eb" />
          <Text className="text-blue-600 text-[9px] font-black uppercase ml-1.5">
            {hasReplies ? `View Discussion (${comment.replies.length})` : "Start Discussion"}
          </Text>
        </Pressable>
      </View>

      {hasReplies && (
        <View className="mt-3 opacity-50 bg-gray-50 dark:bg-white/5 p-2 rounded-lg">
          <Text className="text-[9px] font-black text-gray-500 uppercase">
            {previewReplies[0].name}
          </Text>
          <Text className="text-[10px] text-gray-500 font-bold" numberOfLines={1}>
            {previewReplies[0].text}
          </Text>
        </View>
      )}
    </View>
  );
};

/* ---------------- Discussion Drawer ---------------- */
const DiscussionDrawer = ({ visible, comment, onClose, onReply, isPosting }) => {
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showNewMessageToast, setShowNewMessageToast] = useState(false);

  const panY = useRef(new RNAnimated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const messageRefs = useRef({});
  const scrollOffset = useRef(0);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
      setReplyingTo(null);
      setShowNewMessageToast(false);
      setShouldAutoScroll(true);
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && scrollOffset.current <= 0,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) panY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 150 || gs.vy > 0.6) {
          RNAnimated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          RNAnimated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!comment) return null;

  return (
    <Modal visible={visible} transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
          style={{ flex: 1 }}
        >
          <RNAnimated.View
            {...panResponder.panHandlers}
            style={{ transform: [{ translateY: panY }], height: "92%" }}
            className="bg-white dark:bg-[#0a0a0a] rounded-t-[40px] overflow-hidden"
          >
            <View className="items-center py-5">
              <View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full" />
            </View>

            <ScrollView
              ref={scrollViewRef}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              onScroll={(e) => (scrollOffset.current = e.nativeEvent.contentOffset.y)}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                if (shouldAutoScroll) {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                  setShouldAutoScroll(false);
                }
              }}
            >
              <View className="px-6 pb-20">
                <Text className="text-sm font-black">{comment.name}</Text>
                <Text className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  {comment.text}
                </Text>

                {comment.replies?.map((reply, idx) => (
                  <View key={reply._id || idx} className="mt-6">
                    <Text className="text-[10px] font-black text-blue-500 uppercase">
                      {reply.name}
                    </Text>
                    <Text className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      {reply.text}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View className="p-5 border-t border-gray-100 dark:border-gray-800">
              <View className="flex-row gap-3 items-end">
                <TextInput
                  placeholder="WRITE RESPONSE..."
                  placeholderTextColor="#6b7280"
                  multiline
                  value={replyText}
                  onChangeText={setReplyText}
                  className="flex-1 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl text-[12px] font-black"
                />
                <Pressable
                  onPress={() => {
                    if (!replyText.trim() || isPosting) return;
                    onReply(comment._id, replyText, replyingTo);
                    setReplyText("");
                    Keyboard.dismiss();
                  }}
                  className="bg-blue-600 w-14 h-14 rounded-2xl items-center justify-center"
                >
                  {isPosting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Ionicons name="send" size={20} color="white" />
                  )}
                </Pressable>
              </View>
            </View>
          </RNAnimated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

/* ---------------- Main Section ---------------- */
export default function CommentSection({ postId }) {
  const { user } = useUser();
  const [text, setText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [activeDiscussion, setActiveDiscussion] = useState(null);

  const loaderX = useSharedValue(-200);
  useEffect(() => {
    loaderX.value = isPosting
      ? withRepeat(withTiming(200, { duration: 1500, easing: Easing.linear }), -1)
      : -200;
  }, [isPosting]);

  const loaderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: loaderX.value }],
  }));

  const { data, mutate, isLoading } = useSWR(
    user?.deviceId ? `${API_URL}/api/posts/${postId}/comment` : null,
    (url) => fetch(url).then((r) => r.json()),
    { refreshInterval: 5000 }
  );

  const comments = data?.comments || [];

  const handlePostComment = async (parentId = null, replyTextOverride = null) => {
    const content = replyTextOverride || text;
    if (!content.trim()) return;

    setIsPosting(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.username || "Anonymous",
          text: content,
          parentCommentId: parentId,
          fingerprint: user.deviceId,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        mutate({ comments: parentId ? comments : [json.comment, ...comments] }, false);
        setText("");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <View className="bg-white/80 dark:bg-black/40 rounded-[32px] p-5 mt-4">
      <TextInput
        placeholder="ENTER ENCRYPTED MESSAGE..."
        placeholderTextColor="#6b7280"
        multiline
        value={text}
        onChangeText={setText}
        className="p-4 rounded-xl bg-gray-50 dark:bg-gray-950 font-black"
      />

      <Pressable
        onPress={() => handlePostComment()}
        disabled={isPosting}
        className="bg-blue-600 h-14 rounded-xl mt-4 items-center justify-center"
      >
        {isPosting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-black uppercase">Transmit Signal</Text>
        )}
        {isPosting && (
          <View className="absolute bottom-0 w-full h-1 bg-white/20">
            <Animated.View className="h-full w-1/2 bg-white/60" style={loaderStyle} />
          </View>
        )}
      </Pressable>

      <ScrollView className="mt-6" showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <>
            <CommentSkeleton />
            <CommentSkeleton />
          </>
        ) : (
          comments.map((c, i) => (
            <SingleComment key={c._id || i} comment={c} onOpenDiscussion={setActiveDiscussion} />
          ))
        )}
      </ScrollView>

      <DiscussionDrawer
        visible={!!activeDiscussion}
        comment={activeDiscussion}
        onClose={() => setActiveDiscussion(null)}
        onReply={handlePostComment}
        isPosting={isPosting}
      />
    </View>
  );
	}
