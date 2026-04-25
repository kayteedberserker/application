import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList, // Added FlatList
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
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from "react-native-reanimated";
import useSWR from "swr";
import { useAlert } from "../context/AlertContext";
import { useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import BadgeIcon from "./BadgeIcon";
import { Text } from "./Text";


// Import your new components
import { useMMKV } from "react-native-mmkv";
import { useCoins } from '../context/CoinContext'; // New Import
import CoinIcon from "./ClanIcon";
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

const SingleComment = ({ comment, isDark, onOpenDiscussion, stickerCache, storage }) => {
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

            {/* ⚡️ FIXED: Removed flex-wrap, added flex-shrink to the nameplate wrapper */}
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

                {/* {comment.author?.badges && comment.author.badges.length > 0 && (
                    <View className="flex-row items-center gap-1 overflow-hidden flex-shrink-0">
                        {comment.author.badges.slice(0, 3).map((badge, idx) => (
                            <BadgeIcon key={idx} badge={badge} size={14} isDark={true} />
                        ))}
                    </View>
                )} */}
            </View>

            {comment.type === "sticker" ? (
                <StickerPreview
                    sticker={stickerCache[comment.stickerId] || getStickerFromPersistence(storage, comment.stickerId)}
                    stickerId={comment.stickerId}
                    isDark={isDark}
                    size="large"
                />
            ) : (
                <Text className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-5 mt-1">
                    {comment.text}
                </Text>
            )}
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
                    {previewReply.type === "sticker" ? (
                        <StickerPreview
                            sticker={stickerCache[previewReply.stickerId] || getStickerFromPersistence(storage, previewReply.stickerId)}
                            stickerId={previewReply.stickerId}
                            isDark={isDark}
                            size="small"
                        />
                    ) : (
                        <Text className="text-[10px] text-gray-500 font-bold" numberOfLines={1}>
                            {previewReply.text}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
};

const DiscussionDrawer = ({ visible, isDark, comment, onClose, onReply, isPosting, slug, highlightId, stickerCache, storage }) => {
    const [replyText, setReplyText] = useState("");
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);
    const [stickerModalVisible, setStickerModalVisible] = useState(false); // NEW STATE

    const panY = useSharedValue(SCREEN_HEIGHT);

    const scrollViewRef = useRef(null);
    const scrollOffset = useRef(0);
    const contentHeight = useRef(0);
    const scrollViewHeight = useRef(0);

    const displayComments = useMemo(() => {
        if (!comment) return [];
        return flattenReplies(comment.replies); // Assuming flattenReplies is defined elsewhere
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

    // NEW: Function to handle sending a sticker
    const handleSendSticker = (stickerId) => {
        setStickerModalVisible(false);
        if (!isPosting) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            // We pass empty text, and the stickerId as the payload. 
            // Make sure your onReply function accepts a sticker parameter!
            onReply(comment._id, "", stickerId);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 500);
        }
    };

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

                                {/* ⚡️ FIXED: Same fix applied here */}
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
                                    {/* {comment.author?.badges && comment.author.badges.length > 0 && (
                                        <View className="flex-row items-center gap-1 overflow-hidden flex-shrink-0">
                                            {comment.author.badges.slice(0, 3).map((badge, idx) => (
                                                <BadgeIcon key={idx} badge={badge} size={20} isDark={true} />
                                            ))}
                                        </View>
                                    )} */}
                                </View>

                                <Text className="text-xs text-gray-600 dark:text-gray-400 font-bold leading-5" numberOfLines={3}>{comment.text}</Text>
                            </View>

                            <View className="p-5 flex-row gap-3 items-center">
                                {/* NEW: STICKER BUTTON */}
                                <Pressable
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setStickerModalVisible(true);
                                    }}
                                    className="bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 w-12 h-12 rounded-2xl items-center justify-center"
                                >
                                    <Ionicons name="happy" size={22} color={isDark ? "white" : "#374151"} />
                                </Pressable>

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
                                    {isPosting ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={20} color="white" />}
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
                                            <HighlightableComment
                                                isDark={isDark}
                                                key={reply._id || idx}
                                                reply={reply}
                                                isHighlighted={isHighlighted}
                                                stickerCache={stickerCache}
                                                storage={storage}
                                            />
                                        );
                                    })}
                                    <View className="h-20" />
                                </View>
                            </ScrollView>
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>

            {/* NEW: STICKER MODAL COMPONENT */}
            <StickerModal
                visible={stickerModalVisible}
                isDark={isDark}
                onClose={() => setStickerModalVisible(false)}
                onSelectSticker={handleSendSticker}
            />
        </Modal>
    );
};

// Helper to determine rent price on frontend
const getRentPrice = (rarity) => {
    switch (rarity?.toLowerCase()) {
        case 'mythic': return 50;
        case 'legendary': return 30;
        case 'epic': return 15;
        case 'rare': return 10;
        case 'common':
        default: return 5;
    }
};

// Helper for card background based on rarity to complement the BadgeIcon
const getCardBackground = (rarity, isDark) => {
    switch (rarity?.toLowerCase()) {
        case 'mythic': return isDark ? 'bg-red-900/20 border-red-700/30' : 'bg-red-50 border-red-200';
        case 'legendary': return isDark ? 'bg-amber-900/20 border-amber-700/30' : 'bg-amber-50 border-amber-200';
        case 'epic': return isDark ? 'bg-purple-900/20 border-purple-700/30' : 'bg-purple-50 border-purple-200';
        case 'rare': return isDark ? 'bg-blue-900/20 border-blue-700/30' : 'bg-blue-50 border-blue-200';
        case 'common':
        default: return isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300';
    }
};

const getStickerCacheKey = (stickerId) => `sticker_${stickerId}`;

const getStickerFromPersistence = (storage, stickerId) => {
    if (!storage || !stickerId) return null;
    const cached = storage.getString(getStickerCacheKey(stickerId));
    if (!cached) return null;
    try {
        return JSON.parse(cached);
    } catch (error) {
        return null;
    }
};

const cacheStickerToPersistence = (storage, sticker) => {
    if (!storage || !sticker?.id) return;
    try {
        storage.set(getStickerCacheKey(sticker.id), JSON.stringify(sticker));
    } catch (error) {
        console.error('Sticker cache error', error);
    }
};

const findStickerIds = (comments = []) => {
    const ids = new Set();
    const traverse = (items) => {
        if (!items) return;
        items.forEach(item => {
            if (item?.type === 'sticker' && item?.stickerId) {
                ids.add(item.stickerId);
            }
            if (item?.replies?.length) {
                traverse(item.replies);
            }
        });
    };
    traverse(comments);
    return Array.from(ids);
};

const getStickerBackgroundStyle = (rarity, isDark) => {
    const baseClasses = "items-center justify-center rounded-2xl border";

    switch (rarity?.toLowerCase()) {
        case 'mythic':
            return `${baseClasses} ${isDark ? 'bg-red-900/20 border-red-500/60' : 'bg-red-50 border-red-200'}`;
        case 'legendary':
            return `${baseClasses} ${isDark ? 'bg-amber-900/20 border-amber-500/60' : 'bg-amber-50 border-amber-200'}`;
        case 'epic':
            return `${baseClasses} ${isDark ? 'bg-purple-900/20 border-purple-500/60' : 'bg-purple-50 border-purple-200'}`;
        case 'rare':
            return `${baseClasses} ${isDark ? 'bg-blue-900/20 border-blue-500/60' : 'bg-blue-50 border-blue-200'}`;
        case 'common':
        default:
            return `${baseClasses} ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'}`;
    }
};


const StickerPreview = ({ sticker, stickerId, isDark, size = 'medium' }) => {
    // 1. Memoize or simplify constants to reduce re-render logic
    const stickerSize = size === 'large' ? 80 : size === 'small' ? 50 : 60;
    const containerPadding = size === 'large' ? 'px-6 py-6' : size === 'small' ? 'px-4 py-4' : 'px-5 py-5';

    // 2. Get the background style separately
    const backgroundStyle = sticker ? getStickerBackgroundStyle(sticker.rarity, isDark) : '';

    if (sticker) {
        return (
            /* 3. Use an array for classes or separate the self-start. 
               Sometimes 'self-start' combined with dynamic background classes 
               triggers the interop loop. */
            <View
                className={`self-start ${containerPadding} ${backgroundStyle}`}
                style={{ minHeight: stickerSize, minWidth: stickerSize }} // Physical guard
            >
                <BadgeIcon badge={sticker} size={stickerSize} isDark={isDark} />
            </View>
        );
    }

    return (
        <View className="self-start rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 px-4 py-4">
            <Text className="text-[10px] text-gray-500 dark:text-gray-400">
                Sticker: {stickerId}
            </Text>
        </View>
    );
};

const StickerModal = ({ visible, onClose, onSelectSticker, isDark }) => {
    const { user } = useUser();
    const { coins, setCoins } = useCoins(); // We'll use setCoins to update global UI state
    const storage = useMMKV();
    const CustomAlert = useAlert();

    const [activeTab, setActiveTab] = useState('owned');
    const [ownedStickers, setOwnedStickers] = useState([]);
    const [storeStickers, setStoreStickers] = useState([]);

    // Loading states
    const [isInitialLoading, setIsInitialLoading] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        if (visible) {
            loadStickerData();
        }
    }, [visible]);

    const loadStickerData = async () => {
        // 1. Check if we have cached data
        const cached = storage.getString('user_stickers');
        const cachedStore = storage.getString('store_stickers');

        if (cached) {
            setOwnedStickers(JSON.parse(cached));
        }
        if (cachedStore) {
            setStoreStickers(JSON.parse(cachedStore));
        }

        // 2. Only show loading animation if cache is totally empty
        if (!cached) {
            setIsInitialLoading(true);
        }

        try {
            // 3. Background sync with Server
            const response = await apiFetch('/store/sticker', {
                method: 'GET',
                headers: { 'deviceid': user?.deviceId }
            });
            const data = await response.json();

            if (data.owned) {
                setOwnedStickers(data.owned);
                storage.set('user_stickers', JSON.stringify(data.owned));
            }
            if (data.store) {
                setStoreStickers(data.store);
                storage.set('store_stickers', JSON.stringify(data.store));
            }

        } catch (error) {
            console.error("Error syncing stickers", error);
        } finally {
            setIsInitialLoading(false);
        }
    };

    const handleTransaction = async (action, sticker) => {
        if (processingId) return;

        setProcessingId(sticker.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Call the actual sticker route to update DB and User Inventory
            const response = await apiFetch('/store/sticker', {
                method: 'POST',
                headers: { 'deviceid': user?.deviceId },
                body: JSON.stringify({
                    action: action,
                    stickerId: sticker.id
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                CustomAlert(result.error || "Transaction failed", "error");
                return;
            }

            // SUCCESS HANDLING
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Sync the global coin balance across the app
            if (result.balance !== undefined) {
                setCoins(result.balance);
            }

            if (action === 'buy') {
                CustomAlert(`Purchased ${sticker.name}!`, "success");

                // Update local list instantly
                const updatedOwned = [...ownedStickers, result.newSticker || sticker];
                setOwnedStickers(updatedOwned);
                storage.set('user_stickers', JSON.stringify(updatedOwned));
                setActiveTab('owned');
            } else if (action === 'rent') {
                CustomAlert(`Rented ${sticker.name}!`, "success");
                onSelectSticker(sticker.id);
                onClose(); // Close modal after renting for immediate use
            }

        } catch (error) {
            console.error("Transaction Error:", error);
            CustomAlert("Network error. Try again.", "error");
        } finally {
            setProcessingId(null);
        }
    };

    // UI Renders for Tabs
    const renderTabButton = (tabId, label, icon) => {
        const isActive = activeTab === tabId;
        return (
            <Pressable
                onPress={() => {
                    Haptics.selectionAsync();
                    setActiveTab(tabId);
                }}
                className={`flex-1 py-3 items-center flex-row justify-center gap-2 border-b-2 ${isActive
                    ? 'border-blue-500'
                    : 'border-transparent'
                    }`}
            >
                <Ionicons
                    name={icon}
                    size={16}
                    color={isActive ? "#3b82f6" : (isDark ? "#6b7280" : "#9ca3af")}
                />
                <Text className={`text-xs font-black uppercase ${isActive
                    ? 'text-blue-500'
                    : 'text-gray-400 dark:text-gray-500'
                    }`}>
                    {label}
                </Text>
            </Pressable>
        );
    };

    const renderOwnedTab = () => {
        if (isInitialLoading && ownedStickers.length === 0) {
            return <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#3b82f6" /></View>;
        }

        if (ownedStickers.length === 0) {
            return (
                <View className="flex-1 items-center justify-center p-8">
                    <Ionicons name="sad-outline" size={48} color={isDark ? "#374151" : "#d1d5db"} className="mb-4" />
                    <Text className="text-gray-500 dark:text-gray-400 font-bold text-center mb-6">
                        You don't own any stamps yet.
                    </Text>
                    <Pressable
                        onPress={() => setActiveTab('explore')}
                        className="bg-blue-600 px-6 py-3 rounded-full flex-row items-center gap-2"
                    >
                        <Ionicons name="compass" size={18} color="white" />
                        <Text className="text-white font-black uppercase text-xs">Explore Store</Text>
                    </Pressable>
                </View>
            );
        }

        return (
            <FlatList
                data={ownedStickers}
                numColumns={3}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, gap: 16 }}
                columnWrapperStyle={{ gap: 16 }}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() => onSelectSticker(item.id)}
                        className={`flex-1 aspect-square rounded-2xl border items-center justify-center ${getCardBackground(item.rarity, isDark)}`}
                    >
                        <BadgeIcon badge={item} size={60} isDark={isDark} />
                    </Pressable>
                )}
            />
        );
    };

    const renderExploreTab = () => {
        if (isInitialLoading && storeStickers.length === 0) {
            return <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#3b82f6" /></View>;
        }

        const availableStickers = storeStickers.filter(
            storeSticker => !ownedStickers.some(owned => owned.id === storeSticker.id)
        );

        if (availableStickers.length === 0 && !isInitialLoading) {
            return (
                <View className="flex-1 items-center justify-center">
                    <Ionicons name="checkmark-circle" size={48} color="#10b981" className="mb-4" />
                    <Text className="text-gray-500 font-bold uppercase text-xs">You own the entire catalog!</Text>
                </View>
            );
        }

        return (
            <FlatList
                data={availableStickers}
                numColumns={3}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, gap: 16 }}
                columnWrapperStyle={{ gap: 16 }}
                renderItem={({ item }) => (
                    <View className={`flex-1 rounded-2xl p-4 border items-center justify-center ${getCardBackground(item.rarity, isDark)}`}>
                        <View className="mb-4">
                            <BadgeIcon badge={item} size={50} isDark={isDark} />
                        </View>

                        <Pressable
                            onPress={() => handleTransaction('buy', item)}
                            disabled={processingId !== null}
                            className={`w-full py-2 rounded-full gap-1 flex-row items-center justify-center ${processingId === item.id ? 'bg-blue-400' : 'bg-blue-600'}`}
                        >
                            {processingId === item.id ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <>
                                    <CoinIcon type="OC" size={14} />
                                    <Text className="text-white font-black text-[10px] uppercase">{item.price} OC</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                )}
            />
        );
    };

    const renderRentTab = () => {
        if (isInitialLoading && storeStickers.length === 0) {
            return <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#3b82f6" /></View>;
        }

        const rentableStickers = storeStickers.filter(s => s.rentable);

        if (rentableStickers.length === 0 && !isInitialLoading) {
            return (
                <View className="flex-1 items-center justify-center p-8">
                    <Ionicons name="timer-outline" size={48} color={isDark ? "#374151" : "#d1d5db"} className="mb-4" />
                    <Text className="text-gray-500 dark:text-gray-400 font-bold text-center">
                        No stamps available for rent right now.
                    </Text>
                </View>
            );
        }

        return (
            <View className="flex-1">
                <View className="bg-blue-500/10 p-3 mx-4 mt-4 rounded-xl items-center">
                    <Text className="text-blue-500 text-xs font-bold text-center">Use your OC to rent premium stickers for a single comment.</Text>
                </View>

                <FlatList
                    data={rentableStickers}
                    numColumns={3}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 16, gap: 16 }}
                    columnWrapperStyle={{ gap: 16 }}
                    renderItem={({ item }) => {
                        const rentPrice = getRentPrice(item.rarity);
                        return (
                            <View className={`flex-1 rounded-2xl border p-3 items-center justify-center ${getCardBackground(item.rarity, isDark)}`}>
                                <View className="mb-4 mt-2">
                                    <BadgeIcon badge={item} size={50} isDark={isDark} />
                                </View>

                                <Pressable
                                    onPress={() => handleTransaction('rent', item)}
                                    disabled={processingId !== null}
                                    className={`w-full py-2 rounded-full gap-1 flex-row items-center justify-center ${processingId === item.id ? 'bg-orange-400' : 'bg-orange-500'}`}
                                >
                                    {processingId === item.id ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <>
                                            <CoinIcon type="OC" size={14} />
                                            <Text className="text-white font-black text-[10px] uppercase">Rent {rentPrice}</Text>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        );
                    }}
                />
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View className="flex-1 justify-end">
                <Pressable className="absolute inset-0" onPress={onClose} />

                <View className="h-2/3 bg-white dark:bg-[#0f0f0f] rounded-t-3xl border-t border-gray-200 dark:border-gray-800 shadow-2xl">
                    <View className="px-4 pt-4 border-b border-gray-100 dark:border-gray-800">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black dark:text-white uppercase">Stamps</Text>
                            <View className="flex-row items-center gap-3">
                                <View className="bg-yellow-500/20 px-3 py-1 rounded-full">
                                    <Text className="text-yellow-600 font-black text-xs">{coins || 0} OC</Text>
                                </View>
                                <Pressable onPress={onClose} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full">
                                    <Ionicons name="close" size={20} color={isDark ? "white" : "black"} />
                                </Pressable>
                            </View>
                        </View>

                        <View className="flex-row">
                            {renderTabButton('owned', 'Owned', 'briefcase')}
                            {renderTabButton('rent', 'Rent', 'timer')}
                            {renderTabButton('explore', 'Explore', 'compass')}
                        </View>
                    </View>

                    <View className="flex-1 bg-gray-50 dark:bg-[#0a0a0a]">
                        {activeTab === 'owned' && renderOwnedTab()}
                        {activeTab === 'rent' && renderRentTab()}
                        {activeTab === 'explore' && renderExploreTab()}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const HighlightableComment = ({ reply, isHighlighted, isDark, stickerCache, storage }) => {
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
            {/* ⚡️ FIXED: Cleaned up the 50% view widths and used proper flex-row constraints */}
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
                {/* {reply.author?.badges && reply.author.badges.length > 0 && (
                    <View className="flex-row items-start gap-1 overflow-hidden flex-shrink-0">
                        {reply.author.badges.slice(0, 3).map((badge, idx) => (
                            <BadgeIcon key={idx} badge={badge} size={16} isDark={true} />
                        ))}
                    </View>
                )} */}
            </View>

            {reply.type === "sticker" ? (
                <StickerPreview
                    sticker={stickerCache[reply.stickerId] || getStickerFromPersistence(storage, reply.stickerId)}
                    stickerId={reply.stickerId}
                    isDark={isDark}
                    size="large"
                />
            ) : (
                <Text className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-5">
                    {reply.text}
                </Text>
            )}
            <Text className="text-[9px] font-bold text-gray-400 uppercase mt-2">{new Date(reply.date).toLocaleTimeString()}</Text>
        </Animated.View>
    );
};

export default function CommentSection({ postId, slug, discussionIdfromPage }) {
    const CustomAlert = useAlert()
    const { user } = useUser();
    const { discussion, commentId, discussionId } = useLocalSearchParams();
    const targetId = discussion || commentId || discussionId || discussionIdfromPage
    const isDark = useColorScheme() === "dark";

    const [text, setText] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [activeDiscussion, setActiveDiscussion] = useState(null);
    const [activeHighlightId, setActiveHighlightId] = useState(null);
    const [pagedComments, setPagedComments] = useState([]);
    const [page, setPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [stickerCache, setStickerCache] = useState({});

    const storage = useMMKV();
    const fetchedStickerIds = useRef(new Set());

    const hasAutoOpened = useRef(false);

    const loaderX = useSharedValue(-200);

    useEffect(() => {
        if (isPosting || isLoadingMore || (pagedComments.length === 0 && !data)) {
            loaderX.value = withRepeat(withTiming(200, { duration: 1500, easing: Easing.linear }), -1, false);
        } else {
            loaderX.value = -200
        }
    }, [isPosting, isLoadingMore, pagedComments, data]);

    const loaderStyle = useAnimatedStyle(() => ({ transform: [{ translateX: loaderX.value }] }));

    const { data, mutate, isLoading } = useSWR(
        user?.deviceId ? `/posts/${postId}/comment?page=1&limit=40` : null,
        (url) => apiFetch(url).then(res => res.json()),
        { refreshInterval: 30000 }
    );

    useEffect(() => {
        if (data?.comments) {
            if (page === 1) setPagedComments(data.comments);
        }
    }, [data, page])

    const handleLoadMore = async () => {
        if (isLoadingMore || !data?.hasMore) return;
        setIsLoadingMore(true);
        try {
            const nextPage = page + 1;
            const res = await apiFetch(`/posts/${postId}/comment?page=${nextPage}&limit=40`);
            const result = await res.json();
            setPagedComments(prev => [...prev, ...result.comments]);
            setPage(nextPage);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const findAndOpenComment = (tId) => {
        if (!tId || pagedComments.length === 0) return;

        const target = pagedComments.find(c => {
            if (c._id === tId) return true;
            const search = (nodes) => nodes?.some(n => n._id === tId || search(n.replies));
            return search(c.replies);
        });

        if (target) {
            setActiveDiscussion(target);
            setActiveHighlightId(tId);
            hasAutoOpened.current = true;
        }
    };

    useEffect(() => {
        if (pagedComments.length > 0 && targetId && !hasAutoOpened.current) {
            findAndOpenComment(targetId);
        } else if (discussionIdfromPage) {
            findAndOpenComment(targetId);
        }
    }, [targetId, pagedComments, discussionIdfromPage]);

    useEffect(() => {
        if (activeDiscussion) {
            const updated = pagedComments.find(c => c._id === activeDiscussion._id);
            if (updated) setActiveDiscussion(updated);
        }
    }, [pagedComments]);

    useEffect(() => {
        const stickerIds = findStickerIds(pagedComments);
        if (!stickerIds.length) return;

        const cachedStickers = {};
        const missingIds = [];

        stickerIds.forEach(id => {
            const persisted = getStickerFromPersistence(storage, id);
            if (persisted) {
                cachedStickers[id] = persisted;
            } else if (!fetchedStickerIds.current.has(id)) {
                missingIds.push(id);
            }
        });

        if (Object.keys(cachedStickers).length) {
            setStickerCache(prev => ({ ...prev, ...cachedStickers }));
        }

        if (!missingIds.length) return;

        const fetchMissing = async () => {
            try {
                const res = await apiFetch('/store/sticker');
                if (!res.ok) return;
                const payload = await res.json();
                const allStickers = [...(payload.store || []), ...(payload.owned || [])];
                const found = {};

                missingIds.forEach(id => {
                    const sticker = allStickers.find(item => item.id === id);
                    if (sticker) {
                        found[id] = sticker;
                        cacheStickerToPersistence(storage, sticker);
                        fetchedStickerIds.current.add(id);
                    }
                });

                if (Object.keys(found).length) {
                    setStickerCache(prev => ({ ...prev, ...found }));
                }
            } catch (error) {
                console.error('Failed to load sticker metadata', error);
            }
        };

        fetchMissing();
    }, [pagedComments, storage]);

    const handlePostComment = async (parentId = null, replyContent = null, stickerId = null) => {
        const content = replyContent ?? text;
        if ((!content || !content.trim()) && !stickerId) return;

        const trimmedText = content?.trim() || "";
        const isStickerComment = !!stickerId;
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimisticComment = {
            _id: tempId,
            type: isStickerComment ? 'sticker' : 'text',
            stickerId,
            text: trimmedText,
            name: user?.username || 'Anonymous',
            author: {
                username: user?.username || user?.name || 'Anonymous',
                name: user?.username || user?.name || 'Anonymous',
                auraRank: user?.auraRank,
                equippedGlow: user?.equippedGlow
            },
            date: new Date().toISOString(),
            replies: []
        };

        setIsPosting(true);
        setText("");
        Keyboard.dismiss();

        if (parentId) {
            setPagedComments(prev => prev.map(comment => {
                if (comment._id !== parentId) return comment;
                return {
                    ...comment,
                    replies: [optimisticComment, ...(comment.replies || [])]
                };
            }));
        } else {
            setPagedComments(prev => [optimisticComment, ...prev]);
        }

        try {
            const res = await apiFetch(`/posts/${postId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: user?.username || 'Anonymous',
                    text: trimmedText,
                    stickerId,
                    parentCommentId: parentId,
                    fingerprint: user.deviceId,
                    userId: user._id || null
                })
            });

            if (!res.ok) {
                throw new Error('Failed to post comment');
            }

            const responseData = await res.json();
            const serverComment = responseData.comment;

            if (parentId) {
                setPagedComments(prev => prev.map(comment => {
                    if (comment._id !== parentId) return comment;
                    return {
                        ...comment,
                        replies: (comment.replies || []).map(reply => reply._id === tempId ? serverComment : reply)
                    };
                }));
            } else {
                setPagedComments(prev => prev.map(comment => comment._id === tempId ? serverComment : comment));
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            if (parentId) {
                setPagedComments(prev => prev.map(comment => {
                    if (comment._id !== parentId) return comment;
                    return {
                        ...comment,
                        replies: (comment.replies || []).filter(reply => reply._id !== tempId)
                    };
                }));
            } else {
                setPagedComments(prev => prev.filter(comment => comment._id !== tempId));
            }
            CustomAlert('Link Failure', 'Connection lost. Your comment was not posted.');
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
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{data?.total || pagedComments.length} Signals</Text>
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
                    {isPosting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-[13px] font-black text-white uppercase tracking-widest">Transmit Signal</Text>}
                    {(isPosting || isLoadingMore || (isLoading && page === 1)) && (
                        <View className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
                            <Animated.View className="h-full w-1/2 bg-white/60" style={loaderStyle} />
                        </View>
                    )}
                </Pressable>
            </View>

            <View style={{ maxHeight: 600 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {isLoading && page === 1 ? (
                        <View>
                            <CommentSkeleton />
                            <CommentSkeleton />
                            <CommentSkeleton />
                        </View>
                    ) : pagedComments.length > 0 ? (
                        <View>
                            {pagedComments.map((c, i) => (
                                <SingleComment
                                    key={c._id || i}
                                    isDark={isDark}
                                    comment={c}
                                    stickerCache={stickerCache}
                                    storage={storage}
                                    onOpenDiscussion={(comm) => {
                                        setActiveHighlightId(null);
                                        setActiveDiscussion(comm);
                                    }}
                                />
                            ))}
                            {data?.hasMore && (
                                <Pressable onPress={handleLoadMore} disabled={isLoadingMore} className="py-6 items-center border-t border-gray-100 dark:border-gray-800">
                                    {isLoadingMore ? <ActivityIndicator size="small" color="#2563eb" /> : <Text className="text-blue-600 font-black text-[10px] uppercase tracking-widest">Load More Signals</Text>}
                                </Pressable>
                            )}
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
                onClose={() => {
                    setActiveDiscussion(null);
                    setActiveHighlightId(null);
                }}
                isDark={isDark}
                onReply={handlePostComment}
                isPosting={isPosting}
                slug={slug}
                highlightId={activeHighlightId}
                stickerCache={stickerCache}
                storage={storage}
            />
        </View>
    );
}