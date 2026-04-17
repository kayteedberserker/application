import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    Share,
    TextInput,
    useColorScheme,
    View
} from "react-native";
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    runOnJS,
    SlideInRight,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from "react-native-reanimated";
import { Text } from "./Text";

// Import your new components
import BadgeIcon from "./BadgeIcon";
import PlayerNameplate from "./PlayerNameplate";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const API_URL = "https://oreblogda.com";

const flattenReplies = (nodes) => {
    let flatList = [];
    const traverse = (items) => {
        if (!items) return;
        items.forEach(item => {
            flatList.push(item);
            if (item.replies && item.replies.length > 0) {
                traverse(item.replies);
            }
        });
    };
    traverse(nodes);
    return flatList.sort((a, b) => new Date(a.date) - new Date(b.date));
};

const CommentSkeleton = () => {
    const opacityVal = useSharedValue(0.3);

    useEffect(() => {
        opacityVal.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 800 }),
                withTiming(0.3, { duration: 800 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacityVal.value
    }));

    return (
        <View className="mb-6 pl-4 border-l-2 border-gray-100 dark:border-gray-800">
            <Animated.View style={animatedStyle} className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded-md mb-2" />
            <Animated.View style={animatedStyle} className="h-4 w-full bg-gray-100 dark:border-gray-800 rounded-md mb-1" />
        </View>
    );
};

const SingleComment = ({ comment, isDark, onOpenDiscussion }) => {
    const countReplies = (nodes) => {
        let count = 0;
        if (!nodes) return 0;
        nodes.forEach(n => {
            count++;
            if (n.replies) count += countReplies(n.replies);
        });
        return count;
    };

    const totalReplies = countReplies(comment.replies);
    const hasReplies = totalReplies > 0;
    const previewReply = comment.replies && comment.replies.length > 0 ? comment.replies[0] : null;

    return (
        <View className="mb-6 border-l-2 border-blue-600/20 pl-4">
            <View className="flex-row items-center gap-2 pr-2">
                <View className="flex-shrink">
                    <PlayerNameplate
                        author={comment.author || { name: comment.name }}
                        themeColor={comment.author?.equippedGlow?.visualConfig?.primaryColor || "#2563eb"}
                        equippedGlow={comment.author?.equippedGlow}
                        auraRank={comment.author?.auraRank}
                        isDark={isDark}
                        fontSize={14}
                    />
                </View>

                {comment.author?.badges && comment.author.badges.length > 0 && (
                    <View className="flex-row items-center gap-1 overflow-hidden flex-shrink-0">
                        {comment.author.badges.slice(0, 3).map((badge, idx) => (
                            <BadgeIcon key={idx} badge={badge} size={14} isDark={true} />
                        ))}
                    </View>
                )}
            </View>

            <Text className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-5 mt-1">{comment.text}</Text>
            <View className="flex-row items-center mt-1 gap-4">
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
                        {hasReplies ? `View Discussion (${totalReplies})` : "Start Discussion"}
                    </Text>
                </Pressable>
            </View>
            {hasReplies && previewReply && (
                <View className="mt-3 opacity-50 bg-gray-50 dark:bg-white/5 p-2 rounded-lg border-l border-gray-300 dark:border-gray-700">
                    <Text className="text-[9px] font-black text-gray-500 uppercase">{previewReply.name}</Text>
                    <Text className="text-[10px] text-gray-500 font-bold" numberOfLines={1}>{previewReply.text}</Text>
                </View>
            )}
        </View>
    );
};

const DiscussionDrawer = ({ visible, isDark, comment, onClose, onReply, isPosting, slug, highlightId, showTyping }) => {
    const [replyText, setReplyText] = useState("");
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);

    const panY = useSharedValue(SCREEN_HEIGHT);

    const scrollViewRef = useRef(null);
    const scrollOffset = useRef(0);
    const contentHeight = useRef(0);
    const scrollViewHeight = useRef(0);

    const displayComments = useMemo(() => {
        if (!comment) return [];
        return flattenReplies(comment.replies);
    }, [comment]);

    useEffect(() => {
        if (visible) {
            panY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) });
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 400);
        } else {
            panY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
        }
    }, [visible]);


    const handleClose = () => {
        panY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, (isFinished) => {
            if (isFinished) {
                runOnJS(onClose)();
            }
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (e, gs) => gs.dy > 10 && scrollOffset.current <= 5 && !Keyboard.isVisible(),
            onPanResponderMove: (e, gs) => {
                if (gs.dy > 0) {
                    panY.value = gs.dy;
                }
            },
            onPanResponderRelease: (e, gs) => {
                if (gs.dy > 150 || gs.vy > 0.5) {
                    panY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, (isFinished) => {
                        if (isFinished) {
                            runOnJS(onClose)();
                        }
                    });
                } else {
                    panY.value = withSpring(0, { damping: 15, stiffness: 90 });
                }
            },
        })
    ).current;

    const handleShare = async () => {
        if (!comment) return;
        try {
            await Share.share({
                message: `Join the discussion on OreBlogda: ${API_URL}/post/${slug}?discussion=${comment._id}`,
            });
        } catch (error) {
            console.log(error.message);
        }
    };

    const handleScroll = (event) => {
        const offset = event.nativeEvent.contentOffset.y;
        scrollOffset.current = offset;
        const totalScrollable = contentHeight.current - scrollViewHeight.current;
        setShowJumpToBottom(totalScrollable - offset > 100);
    };

    const drawerStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: panY.value }]
        };
    });

    if (!comment) return null;

    return (
        <Modal visible={visible} animationType="none" transparent={true} onRequestClose={handleClose}>
            <View className="flex-1 bg-black/60">
                <Pressable className="flex-1" onPress={() => { Keyboard.dismiss(); handleClose(); }} />
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <Animated.View
                        style={[drawerStyle, { height: SCREEN_HEIGHT * 0.9 }]}
                        className="bg-white dark:bg-[#0a0a0a] rounded-t-[40px] border-t-2 border-blue-600/40 overflow-hidden"
                    >
                        <View className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-gray-800 z-50">
                            <View {...panResponder.panHandlers} className="items-center py-4">
                                <View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full" />
                            </View>
                            <View className="flex-row items-center justify-between px-6 pb-2">
                                <Pressable onPress={handleClose} className="bg-gray-100 dark:bg-white/10 px-4 py-2 rounded-full">
                                    <Text className="text-[10px] font-black text-blue-600 uppercase">Close</Text>
                                </Pressable>
                                <Pressable onPress={handleShare} className="flex-row items-center bg-blue-600 px-5 py-2 rounded-full shadow-md">
                                    <Ionicons name="share-social" size={14} color="white" />
                                    <Text className="text-white text-[10px] font-black uppercase ml-2">Share Discussion</Text>
                                </Pressable>
                            </View>

                            <View className="bg-blue-50/50 dark:bg-blue-900/10 px-6 py-4 border-y border-blue-100 dark:border-blue-900/30">
                                <Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Anchor Signal</Text>

                                <View className="flex-row items-center gap-2 mb-1 pr-2">
                                    <View className="flex-shrink">
                                        <PlayerNameplate
                                            author={comment.author || { name: comment.name }}
                                            themeColor={comment.author?.equippedGlow?.visualConfig?.primaryColor || "#2563eb"}
                                            equippedGlow={comment.author?.equippedGlow}
                                            auraRank={comment.author?.auraRank}
                                            isDark={isDark}
                                            fontSize={16}
                                        />
                                    </View>
                                    {comment.author?.badges && comment.author.badges.length > 0 && (
                                        <View className="flex-row items-center gap-1 overflow-hidden flex-shrink-0">
                                            {comment.author.badges.slice(0, 3).map((badge, idx) => (
                                                <BadgeIcon key={idx} badge={badge} size={20} isDark={true} />
                                            ))}
                                        </View>
                                    )}
                                </View>

                                <Text className="text-xs text-gray-600 dark:text-gray-400 font-bold leading-5" numberOfLines={3}>{comment.text}</Text>
                            </View>

                            <View className="p-5 flex-row gap-3 items-center">
                                <TextInput
                                    placeholder="WRITE RESPONSE..."
                                    placeholderTextColor="#6b7280"
                                    multiline
                                    className="flex-1 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl text-[13px] font-black dark:text-white max-h-24 border border-gray-100 dark:border-gray-800"
                                    value={replyText}
                                    onChangeText={setReplyText}
                                />
                                <Pressable
                                    onPress={() => {
                                        if (replyText.trim() && !isPosting) {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            onReply(comment._id, replyText);
                                            setReplyText("");
                                            Keyboard.dismiss();
                                            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 500);
                                        }
                                    }}
                                    disabled={isPosting}
                                    className="bg-blue-600 w-12 h-12 rounded-2xl items-center justify-center shadow-lg"
                                >
                                    <Ionicons name="send" size={20} color="white" />
                                </Pressable>
                            </View>
                        </View>

                        <View className="flex-1 relative">
                            {showJumpToBottom && (
                                <Animated.View entering={FadeIn} exiting={FadeOut} className="absolute bottom-10 self-center z-50">
                                    <Pressable
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            scrollViewRef.current?.scrollToEnd({ animated: true });
                                        }}
                                        className="flex-row items-center bg-blue-600 px-4 py-2 rounded-full shadow-2xl"
                                    >
                                        <Ionicons name="arrow-down" size={14} color="white" />
                                        <Text className="text-white text-[10px] font-black uppercase ml-2">Jump to Bottom</Text>
                                    </Pressable>
                                </Animated.View>
                            )}
                            <ScrollView
                                ref={scrollViewRef}
                                className="flex-1"
                                onScroll={handleScroll}
                                scrollEventThrottle={16}
                                onLayout={(e) => scrollViewHeight.current = e.nativeEvent.layout.height}
                                onContentSizeChange={(w, h) => {
                                    contentHeight.current = h;
                                    if (!showJumpToBottom) scrollViewRef.current?.scrollToEnd({ animated: true });
                                }}
                                showsVerticalScrollIndicator={false}
                            >
                                <View className="px-6 pt-6">
                                    <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-6">Live Feed</Text>
                                    {displayComments.map((reply, idx) => {
                                        const isHighlighted = highlightId === reply._id;
                                        return (
                                            <Animated.View key={reply._id || idx} entering={SlideInRight.duration(300)}>
                                                <HighlightableComment isDark={isDark} reply={reply} isHighlighted={isHighlighted} />
                                            </Animated.View>
                                        );
                                    })}
                                    {showTyping && (
                                        <View className="mb-6 pl-4 border-l-2 border-blue-600/20">
                                            <View className="flex-row items-center gap-2 pr-2">
                                                <View className="flex-shrink">
                                                    <PlayerNameplate
                                                        author={{ name: "Typing..." }}
                                                        themeColor="#2563eb"
                                                        isDark={isDark}
                                                        fontSize={14}
                                                    />
                                                </View>
                                            </View>
                                            <View className="flex-row mt-1">
                                                <View className="w-2 h-2 bg-blue-600 rounded-full mr-1 animate-pulse" />
                                                <View className="w-2 h-2 bg-blue-600 rounded-full mr-1 animate-pulse" style={{ animationDelay: '0.2s' }} />
                                                <View className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                                            </View>
                                        </View>
                                    )}
                                    <View className="h-20" />
                                </View>
                            </ScrollView>
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const HighlightableComment = ({ reply, isHighlighted, isDark }) => {
    const scale = useSharedValue(1);
    const bgColorOpacity = useSharedValue(0);

    useEffect(() => {
        if (isHighlighted) {
            scale.value = withSequence(
                withTiming(1.08, { duration: 400 }),
                withRepeat(withTiming(1, { duration: 400 }), 3, true)
            );
            bgColorOpacity.value = withTiming(0.15, { duration: 500 });
        } else {
            bgColorOpacity.value = withTiming(0, { duration: 500 });
        }
    }, [isHighlighted]);
    let replyGlow = reply.author?.equippedGlow?.visualConfig?.primaryColor
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        backgroundColor: `rgba(37, 99, 235, ${bgColorOpacity.value})`,
        borderRadius: 8,
        padding: isHighlighted ? 12 : 0,
        marginBottom: 24,
        borderLeftWidth: 2,
        borderLeftColor: replyGlow ? replyGlow : isHighlighted ? '#2563eb' : '#374151',
        paddingLeft: 16
    }));

    return (
        <Animated.View style={animatedStyle}>
            <View className="flex-row items-start w-full mb-[2px] pr-2">
                <View className="">
                    <PlayerNameplate
                        author={reply.author || { name: reply.name }}
                        themeColor={reply.author?.equippedGlow?.visualConfig?.primaryColor || "#60a5fa"}
                        equippedGlow={reply.author?.equippedGlow}
                        auraRank={reply.author?.auraRank}
                        isDark={isDark}
                        fontSize={14}
                    />
                </View>
                {reply.author?.badges && reply.author.badges.length > 0 && (
                    <View className="flex-row items-start gap-1 overflow-hidden flex-shrink-0">
                        {reply.author.badges.slice(0, 3).map((badge, idx) => (
                            <BadgeIcon key={idx} badge={badge} size={16} isDark={true} />
                        ))}
                    </View>
                )}
            </View>

            <Text className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-5">{reply.text}</Text>
            <Text className="text-[9px] font-bold text-gray-400 uppercase mt-2">{new Date(reply.date).toLocaleTimeString()}</Text>
        </Animated.View>
    );
};

export default function PromoCommentSection({
    mockComments = [],
    onAddComment,
    onOpenDiscussion,
    onReply,
    showTyping = false,
    isPosting = false,
    activeDiscussion = null,
    onCloseDiscussion,
    highlightId = null,
    slug = "promo-post",
    controlledText = "",
    onTextChange
}) {
    const isDark = useColorScheme() === "dark";

    const [text, setText] = useState("");

    const handleTextChange = (newText) => {
        if (onTextChange) {
            onTextChange(newText);
        } else {
            setText(newText);
        }
    };

    const currentText = controlledText !== undefined ? controlledText : text;

    const handlePostComment = () => {
        if (currentText.trim() && onAddComment) {
            onAddComment(currentText);
            if (!onTextChange) setText("");
            Keyboard.dismiss();
        }
    };

    return (
        <View className="bg-white/80 dark:bg-black/40 rounded-[32px] p-5 border border-gray-100 dark:border-blue-900/30 shadow-2xl mt-4">
            <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center gap-2">
                    <View className="w-2 h-2 bg-blue-600 rounded-full" />
                    <Text className="text-sm font-[900] uppercase tracking-[0.3em] text-gray-900 dark:text-white">Comms_Feed</Text>
                </View>
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{mockComments.length} Signals</Text>
            </View>

            <View className="gap-3 mb-8">
                <TextInput
                    placeholder="ENTER ENCRYPTED MESSAGE..."
                    placeholderTextColor="#6b7280"
                    multiline
                    className="w-full p-4 rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-[13px] font-black tracking-widest text-gray-900 dark:text-white min-h-[100px]"
                    style={{ textAlignVertical: "top" }}
                    value={currentText}
                    onChangeText={handleTextChange}
                />
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handlePostComment();
                    }}
                    disabled={isPosting}
                    className="relative bg-blue-600 h-14 rounded-xl overflow-hidden justify-center items-center shadow-lg"
                >
                    {isPosting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-[13px] font-black text-white uppercase tracking-widest">Transmit Signal</Text>}
                </Pressable>
            </View>

            <View style={{ maxHeight: 600 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {mockComments.length > 0 ? (
                        <View>
                            {mockComments.map((c, i) => (
                                <SingleComment key={c._id || i} isDark={isDark} comment={c} onOpenDiscussion={onOpenDiscussion} />
                            ))}
                        </View>
                    ) : (
                        <View className="items-center justify-center py-10 opacity-40">
                            <ActivityIndicator size="small" color="#6b7280" />
                            <Text className="text-[15px] font-bold text-gray-500 uppercase tracking-widest text-center mt-3">Awaiting First Signal...</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            <DiscussionDrawer
                visible={!!activeDiscussion}
                comment={activeDiscussion}
                onClose={onCloseDiscussion}
                isDark={isDark}
                onReply={onReply}
                isPosting={isPosting}
                slug={slug}
                highlightId={highlightId}
                showTyping={showTyping}
            />
        </View>
    );
}