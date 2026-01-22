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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const API_URL = "https://oreblogda.com";

// --- Skeleton Component ---
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

// --- Single Comment Component ---
const SingleComment = ({ comment, onOpenDiscussion }) => {
	const hasReplies = comment.replies && comment.replies.length > 0;
	const previewReplies = (comment.replies || []).slice(0, 1);

	return (
		<View className="mb-6 border-l-2 border-blue-600/20 pl-4">
			<Text className="text-[11px] font-black text-blue-600 uppercase tracking-tighter">{comment.name}</Text>
			<Text className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-5 mt-1">{comment.text}</Text>
			<View className="flex-row items-center mt-3 gap-4">
				<Text className="text-gray-400 text-[8px] font-bold">{new Date(comment.date).toLocaleDateString()}</Text>
				<Pressable 
					onPress={() => {
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
						onOpenDiscussion(comment);
					}} 
					className="flex-row items-center bg-blue-600/10 px-3 py-1.5 rounded-full border border-blue-600/20"
				>
					<Ionicons name="chatbubbles-outline" size={12} color="#2563eb" />
					<Text className="text-blue-600 text-[9px] font-black uppercase ml-1.5 tracking-widest">
						{hasReplies ? `View Discussion (${comment.replies.length})` : "Start Discussion"}
					</Text>
				</Pressable>
			</View>
			{hasReplies && (
				<View className="mt-3 opacity-50 bg-gray-50 dark:bg-white/5 p-2 rounded-lg border-l border-gray-300 dark:border-gray-700">
					<Text className="text-[9px] font-black text-gray-500 uppercase">{previewReplies[0].name}</Text>
					<Text className="text-[10px] text-gray-500 font-bold" numberOfLines={1}>{previewReplies[0].text}</Text>
				</View>
			)}
		</View>
	);
};

// --- Discussion Drawer Component ---
const DiscussionDrawer = ({ visible, comment, onClose, onReply, isPosting }) => {
	const [replyText, setReplyText] = useState("");
	const [replyingTo, setReplyingTo] = useState(null);
	const [showNewMessageToast, setShowNewMessageToast] = useState(false);
	const panY = useRef(new RNAnimated.Value(0)).current;
	const scrollViewRef = useRef(null);
	const messageRefs = useRef({});
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
	const scrollOffset = useRef(0);
	const [keyboardHeight, setKeyboardHeight] = useState(0);

	// Manual Keyboard Tracking
	useEffect(() => {
		const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
			setKeyboardHeight(e.endCoordinates.height);
		});
		const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
			setKeyboardHeight(0);
		});
		return () => { showSub.remove(); hideSub.remove(); };
	}, []);

	useEffect(() => {
		if (visible) {
			panY.setValue(0);
			setReplyingTo(null);
			setShouldAutoScroll(true);
			setShowNewMessageToast(false);
		}
	}, [visible]);

	useEffect(() => {
		// Only show toast if new message arrived while the user was scrolled up
		if (visible && comment?.replies?.length > 0 && !shouldAutoScroll && scrollOffset.current > 100) {
			setShowNewMessageToast(true);
		}
	}, [comment?.replies?.length, visible]);

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => false,
			onMoveShouldSetPanResponder: (e, gs) => {
				// Only allow drag-down-to-close if at top of scroll
				return gs.dy > 10 && scrollOffset.current <= 0;
			},
			onPanResponderMove: (e, gs) => { if (gs.dy > 0) panY.setValue(gs.dy); },
			onPanResponderRelease: (e, gs) => {
				if (gs.dy > 150 || gs.vy > 0.5) {
					RNAnimated.timing(panY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }).start(onClose);
				} else {
					RNAnimated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
				}
			},
		})
	).current;

	const scrollToMessage = (id) => {
		if (id === 'anchor') {
			scrollViewRef.current?.scrollTo({ y: 0, animated: true });
			return;
		}
		const layout = messageRefs.current[id];
		if (layout) scrollViewRef.current?.scrollTo({ y: layout.y, animated: true });
	};

	const jumpToBottom = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		scrollViewRef.current?.scrollToEnd({ animated: true });
		setShowNewMessageToast(false);
	};

	if (!comment) return null;

	return (
		<Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
			<View className="flex-1 bg-black/60 justify-end">
				<RNAnimated.View 
					style={{ 
						transform: [{ translateY: panY }], 
						height: '92%', 
						paddingBottom: Platform.OS === 'ios' ? keyboardHeight : 0 
					}} 
					className="bg-white dark:bg-[#0a0a0a] rounded-t-[40px] border-t-2 border-blue-600/40 overflow-hidden"
				>
					{/* Header / Draggable Area */}
					<View {...panResponder.panHandlers} className="items-center py-5 bg-white dark:bg-[#0a0a0a]">
						<View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full" />
					</View>

					<View className="flex-1">
						{showNewMessageToast && (
							<Animated.View entering={FadeIn} exiting={FadeOut} className="absolute top-24 self-center z-50">
								<Pressable onPress={jumpToBottom} className="flex-row items-center bg-blue-600 px-4 py-2 rounded-full shadow-xl border border-white/20">
									<Ionicons name="arrow-down" size={14} color="white" />
									<Text className="text-white text-[10px] font-black uppercase ml-2">New Signals Detected</Text>
								</Pressable>
							</Animated.View>
						)}

						<ScrollView 
							ref={scrollViewRef} 
							className="flex-1" 
							onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
							scrollEventThrottle={16}
							showsVerticalScrollIndicator={false}
							stickyHeaderIndices={[0]}
							onContentSizeChange={() => {
								if (shouldAutoScroll) {
									scrollViewRef.current?.scrollToEnd({ animated: true });
									setShouldAutoScroll(false);
								}
							}}
						>
							<View className="bg-white dark:bg-[#0a0a0a] px-6 pb-4 border-b border-gray-100 dark:border-gray-800 shadow-sm">
								<Pressable onLongPress={() => {
									Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
									setReplyingTo({ name: comment.name, text: comment.text, id: 'anchor' });
								}}>
									<Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Anchor Signal</Text>
									<Text className="text-sm font-black dark:text-white">{comment.name}</Text>
									<Text className="text-xs text-gray-600 dark:text-gray-400 font-bold mt-1 leading-5">{comment.text}</Text>
								</Pressable>
							</View>

							<View className="px-6 pt-6">
								<Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-6">Response Feed</Text>
								{comment.replies && comment.replies.map((reply, idx) => (
									<View key={reply._id || idx} onLayout={(event) => { messageRefs.current[reply._id] = event.nativeEvent.layout; }} className="mb-8">
										<Pressable onLongPress={() => {
											Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
											setReplyingTo({ name: reply.name, text: reply.text, id: reply._id });
										}} className="border-l-2 border-gray-100 dark:border-gray-800 pl-4">
											{reply.replyTo && (
												<Pressable onPress={() => scrollToMessage(reply.replyTo.id)} className="bg-gray-100 dark:bg-white/5 p-2 rounded-lg border-l-4 border-blue-500 mb-2 opacity-80">
													<Text className="text-[8px] font-black text-blue-500 uppercase">{reply.replyTo.name}</Text>
													<Text className="text-[10px] text-gray-500 dark:text-gray-400 font-bold" numberOfLines={1}>{reply.replyTo.text}</Text>
												</Pressable>
											)}
											<Text className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">{reply.name}</Text>
											<Text className="text-xs text-gray-600 dark:text-gray-300 font-bold mt-1 leading-5">{reply.text}</Text>
											<View className="flex-row items-center justify-between mt-3">
												<Text className="text-[8px] font-bold text-gray-400 uppercase">{new Date(reply.date).toLocaleTimeString()}</Text>
												<Pressable onPress={() => {
													Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
													setReplyingTo({ name: reply.name, text: reply.text, id: reply._id });
												}}>
													<Text className="text-blue-500 text-[9px] font-black uppercase tracking-widest">Reply</Text>
												</Pressable>
											</View>
										</Pressable>
									</View>
								))}
								<View className="h-20" />
							</View>
						</ScrollView>

						<View className="p-5 pb-10 bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-gray-800">
							{replyingTo && (
								<View className="flex-row items-center bg-blue-50 dark:bg-blue-900/10 p-3 rounded-t-2xl border-l-4 border-blue-600 mb-[-5px] pb-4">
									<View className="flex-1">
										<Text className="text-[9px] font-black text-blue-600 uppercase">Replying to {replyingTo.name}</Text>
										<Text className="text-[11px] text-gray-500 dark:text-gray-400 font-bold" numberOfLines={1}>{replyingTo.text}</Text>
									</View>
									<Pressable onPress={() => setReplyingTo(null)} className="ml-2">
										<Ionicons name="close-circle" size={20} color="#2563eb" />
									</Pressable>
								</View>
							)}
							<View className="flex-row gap-3 items-end">
								<TextInput
									placeholder="WRITE RESPONSE..."
									placeholderTextColor="#6b7280"
									multiline
									className="flex-1 bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl text-[12px] font-black dark:text-white max-h-32 border border-gray-100 dark:border-gray-800"
									value={replyText}
									onChangeText={setReplyText}
								/>
								<Pressable
									onPress={() => {
										if (replyText.trim() && !isPosting) {
											Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
											onReply(comment._id, replyText, replyingTo);
											setReplyText("");
											setReplyingTo(null);
											setShouldAutoScroll(true);
											Keyboard.dismiss();
										}
									}}
									disabled={isPosting}
									className="bg-blue-600 w-14 h-14 rounded-2xl items-center justify-center shadow-lg"
								>
									{isPosting ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={20} color="white" />}
								</Pressable>
							</View>
						</View>
					</View>
				</RNAnimated.View>
			</View>
		</Modal>
	);
};

// --- Main Comment Section ---
export default function CommentSection({ postId }) {
	const { user } = useUser();
	const [text, setText] = useState("");
	const [isPosting, setIsPosting] = useState(false);
	const [activeDiscussion, setActiveDiscussion] = useState(null);

	const loaderX = useSharedValue(-200);
	useEffect(() => {
		if (isPosting) loaderX.value = withRepeat(withTiming(200, { duration: 1500, easing: Easing.linear }), -1, false);
		else loaderX.value = -200;
	}, [isPosting]);

	const loaderStyle = useAnimatedStyle(() => ({ transform: [{ translateX: loaderX.value }] }));

	const { data, mutate, isLoading } = useSWR(
		user?.deviceId ? `${API_URL}/api/posts/${postId}/comment` : null,
		(url) => fetch(url).then(res => res.json()),
		{ refreshInterval: 5000 }
	);

	const comments = data?.comments || [];

	useEffect(() => {
		if (activeDiscussion) {
			const updated = comments.find(c => c._id === activeDiscussion._id);
			if (updated && JSON.stringify(updated.replies) !== JSON.stringify(activeDiscussion.replies)) {
				setActiveDiscussion(updated);
			}
		}
	}, [comments]);

	const handlePostComment = async (parentId = null, replyContent = null, replyToMeta = null) => {
		const content = replyContent || text;
		if (!content.trim() || !user?.deviceId) return;

		setIsPosting(true);
		try {
			const res = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: user?.username || "Anonymous",
					text: content,
					parentCommentId: parentId,
					replyTo: replyToMeta, 
					fingerprint: user.deviceId,
					userId: user._id || null
				}),
			});

			const responseData = await res.json();

			if (res.ok) {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
				
				// Use the actual comment returned by the server to update the local state
				const serverComment = responseData.comment;

				if (parentId) {
					mutate({
						comments: comments.map(c => {
							if (c._id === parentId) {
								const updatedReplies = [...(c.replies || []), serverComment];
								if (activeDiscussion?._id === parentId) {
									setActiveDiscussion(prev => ({ ...prev, replies: updatedReplies }));
								}
								return { ...c, replies: updatedReplies };
							}
							return c;
						})
					}, false);
				} else {
					mutate({
						comments: [serverComment, ...comments]
					}, false);
					setText("");
				}
			}
		} catch (err) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			Alert.alert("Link Failure", "Connection lost.");
		} finally {
			setIsPosting(false);
		}
	};

	return (
		<View className="bg-white/80 dark:bg-black/40 rounded-[32px] p-5 border border-gray-100 dark:border-blue-900/30 shadow-2xl mt-4">
			<View className="flex-row items-center justify-between mb-6">
				<View className="flex-row items-center gap-2">
					<View className="w-2 h-2 bg-blue-600 rounded-full" />
					<Text className="text-sm font-[900] uppercase tracking-[0.3em] text-gray-900 dark:text-white">Comms_Feed</Text>
				</View>
				<Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{comments.length} Signals</Text>
			</View>

			<View className="gap-3 mb-8">
				<TextInput
					placeholder="ENTER ENCRYPTED MESSAGE..."
					placeholderTextColor="#6b7280"
					multiline
					className="w-full p-4 rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-[13px] font-black tracking-widest text-gray-900 dark:text-white min-h-[100px]"
					style={{ textAlignVertical: "top" }}
					value={text}
					onChangeText={setText}
				/>
				<Pressable
					onPress={() => {
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
						handlePostComment();
					}}
					disabled={isPosting}
					className="relative bg-blue-600 h-14 rounded-xl overflow-hidden justify-center items-center shadow-lg"
				>
					<View className="flex-row items-center gap-2">
						{isPosting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-[13px] font-black text-white uppercase tracking-widest">Transmit Signal</Text>}
					</View>
					{isPosting && (
						<View className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
							<Animated.View className="h-full w-1/2 bg-white/60" style={loaderStyle} />
						</View>
					)}
				</Pressable>
			</View>

			<View style={{ maxHeight: 500 }}>
				<ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
					{isLoading ? (
						<View><CommentSkeleton /><CommentSkeleton /></View>
					) : comments.length > 0 ? (
						comments.map((c, i) => (
							<SingleComment key={c._id || i} comment={c} onOpenDiscussion={(comm) => setActiveDiscussion(comm)} />
						))
					) : (
						<View className="items-center justify-center py-10 opacity-40">
							<View className="w-8 h-8 border border-dashed border-gray-500 rounded-full items-center justify-center mb-3">
								<ActivityIndicator size="small" color="#6b7280" />
							</View>
							<Text className="text-[15px] font-bold text-gray-500 uppercase tracking-widest text-center">
								Awaiting First Signal...
							</Text>
						</View>
					)}
				</ScrollView>
			</View>

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
