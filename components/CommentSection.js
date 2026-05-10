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
import { Text } from "./Text";


// Import your new components
import { Image } from "expo-image";
import { useMMKV } from "react-native-mmkv";
import { useCoins } from '../context/CoinContext'; // New Import
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
                    size="medium"
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

import { LegendList } from "@legendapp/list";

const DiscussionDrawer = ({ visible, isDark, comment, onClose, onReply, isPosting, slug, highlightId, stickerCache, storage }) => {
    const [replyText, setReplyText] = useState("")
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
            if (__DEV__) console.log(error.message);
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
                                {comment.type === "sticker" ? (
                                    <StickerPreview
                                        sticker={stickerCache[comment.stickerId] || getStickerFromPersistence(storage, comment.stickerId)}
                                        stickerId={comment.stickerId}
                                        isDark={isDark}
                                        size="small"
                                    />
                                ) : (
                                    <Text className="text-xs text-gray-600 dark:text-gray-400 font-bold leading-5" numberOfLines={3}>
                                        {comment.text}
                                    </Text>
                                )}
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

                            {/* REPLACED ScrollView with FlatList */}
                            <LegendList
                                ref={scrollViewRef}
                                className="flex-1"
                                data={displayComments}
                                keyExtractor={(item, index) => item._id?.toString() || index.toString()}
                                onScroll={handleScroll}
                                scrollEventThrottle={16}
                                drawDistance={1000}
                                recycleItems={true}
                                onLayout={(e) => scrollViewHeight.current = e.nativeEvent.layout.height}
                                onContentSizeChange={(w, h) => {
                                    contentHeight.current = h;
                                    if (!showJumpToBottom) scrollViewRef.current?.scrollToEnd({ animated: true });
                                }}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 80 }}
                                ListHeaderComponent={
                                    <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-6">Live Feed</Text>
                                }
                                renderItem={({ item: reply }) => {
                                    const isHighlighted = highlightId === reply._id;
                                    return (
                                        <HighlightableComment
                                            isDark={isDark}
                                            reply={reply}
                                            isHighlighted={isHighlighted}
                                            stickerCache={stickerCache}
                                            storage={storage}
                                        />
                                    );
                                }}
                            />
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


import { Blur, Canvas, Circle, Group } from "@shopify/react-native-skia";
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
const { width, height } = Dimensions.get('window');

const getStickerCacheKey = (stickerId) => `sticker_${stickerId}`;

// Updated for new DB structure (using stickerId and url)
const cacheStickerToPersistence = (storage, sticker) => {
    if (!storage || !sticker?.stickerId) return;
    try {
        storage.set(getStickerCacheKey(sticker.stickerId), JSON.stringify(sticker));
    } catch (error) {
        console.error('Sticker cache error', error);
    }
};

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
    const baseClasses = "items-center justify-center rounded-xl border";
    const r = rarity?.toLowerCase();

    switch (r) {
        case 'mythic':
            return {
                classes: `${baseClasses} ${isDark ? 'bg-red-500/10 border-red-500/40' : 'bg-red-50 border-red-200'}`,
                glow: '#ef4444',
                text: '#f87171'
            };
        case 'legendary':
            return {
                classes: `${baseClasses} ${isDark ? 'bg-amber-500/10 border-amber-500/40' : 'bg-amber-50 border-amber-200'}`,
                glow: '#f59e0b',
                text: '#fbbf24'
            };
        case 'epic':
            return {
                classes: `${baseClasses} ${isDark ? 'bg-purple-500/10 border-purple-500/40' : 'bg-purple-50 border-purple-200'}`,
                glow: '#a855f7',
                text: '#c084fc'
            };
        case 'rare':
            return {
                classes: `${baseClasses} ${isDark ? 'bg-blue-500/10 border-blue-500/40' : 'bg-blue-50 border-blue-200'}`,
                glow: '#3b82f6',
                text: '#60a5fa'
            };
        default:
            return {
                classes: `${baseClasses} ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-100 border-gray-300'}`,
                glow: isDark ? '#4b5563' : '#9ca3af',
                text: isDark ? '#9ca3af' : '#4b5563'
            };
    }
};

const StickerPreview = ({ sticker, stickerId, isDark, size = 'medium', onPress }) => { // 🚀 ADDED onPress PROP
    const [showDetails, setShowDetails] = useState(false);
    const stickerSize = size === 'large' ? 70 : size === 'small' ? 50 : 60;
    const containerPadding = size === 'large' ? 'p-1' : size === 'small' ? 'p-0' : 'p-0.5';

    const theme = getStickerBackgroundStyle(sticker?.tier || sticker?.rarity, isDark);

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setShowDetails(true);
    };

    if (!sticker?.url) {
        return (
            <View className={`self-start rounded-lg border px-2 py-1 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                <Text className="text-[8px] text-gray-500 font-mono">#{stickerId}</Text>
            </View>
        );
    }

    return (
        <>
            <Pressable
                onPress={onPress} // 🚀 PASS IT HERE
                onLongPress={handleLongPress}
                delayLongPress={500}
                className="self-start"
            >
                <MotiView
                    className={`${containerPadding} ${theme.classes}`}
                    style={{
                        minHeight: stickerSize + 8,
                        minWidth: stickerSize + 8,
                        shadowColor: theme.glow,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isDark ? 0.4 : 0.1,
                        shadowRadius: 4
                    }}
                >
                    <Image
                        source={{ uri: sticker.url }}
                        style={{ width: stickerSize, height: stickerSize }}
                        resizeMode="contain"
                    />
                </MotiView>
            </Pressable>

            {/* --- DETAILS MODAL --- */}
            <Modal visible={showDetails} transparent animationType="fade" onRequestClose={() => setShowDetails(false)}>
                <Pressable
                    className="flex-1 bg-black/90 items-center justify-center p-6"
                    onPress={() => setShowDetails(false)}
                >
                    <MotiView
                        from={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-sm rounded-[32px] overflow-hidden border-2"
                        style={{ borderColor: theme.glow }} // Modal border matches Tier color
                    >
                        <LinearGradient
                            // Correct use of isDark for the modal card itself
                            colors={isDark ? ['#121212', '#000000'] : ['#ffffff', '#f2f2f2']}
                            className="p-8"
                        >
                            {/* Header */}
                            <View className="flex-row justify-between items-start mb-6">
                                <View>
                                    <Text className="text-[9px] font-black text-blue-500 uppercase tracking-widest">STICKER_PROFILE</Text>
                                    <Text className={`text-md font-bold italic uppercase ${isDark ? 'text-white' : 'text-black'}`}>
                                        {sticker.stickerId}
                                    </Text>
                                </View>
                                <View className="px-2 py-1 rounded-md border" style={{ borderColor: theme.glow + '50' }}>
                                    <Text className="text-[8px] font-black" style={{ color: theme.glow }}>{sticker.tier || 'COMMON'}</Text>
                                </View>
                            </View>

                            {/* Large Image Preview */}
                            <View className={`items-center justify-center py-8 rounded-3xl mb-6 border border-white/5 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                                <Image source={{ uri: sticker.url }} style={{ width: 120, height: 120 }} resizeMode="contain" />
                            </View>

                            {/* Data Rows with isDark applied */}
                            <View className="gap-y-3">
                                <DataRow label="CREATOR" value={sticker.author || "ROOT_USER"} icon="person" isDark={isDark} />
                                {sticker.type === "free" && <DataRow label="SOURCE" value={sticker.source || "FLATICON"} icon="share-social" isDark={isDark} />}
                                <DataRow label="PACK" value={sticker.packId || "CORE"} icon="cube" isDark={isDark} />
                                <DataRow label="TYPE" value={sticker.type || "FREE"} icon="flash" isDark={isDark} />
                            </View>

                            <Pressable
                                onPress={() => setShowDetails(false)}
                                className="mt-8 py-3 rounded-xl items-center border"
                                style={{ borderColor: theme.glow + '40', backgroundColor: theme.glow + '10' }}
                            >
                                <Text className="font-black text-[10px] tracking-widest" style={{ color: theme.glow }}>CLOSE_STATION</Text>
                            </Pressable>
                        </LinearGradient>
                    </MotiView>
                </Pressable>
            </Modal>
        </>
    );
};

const DataRow = ({ label, value, icon, isDark }) => (
    <View className="flex-row items-center justify-between border-b border-white/5 pb-1">
        <View className="flex-row items-center gap-2">
            <Ionicons name={icon} size={10} color="#3b82f6" />
            <Text className="text-[8px] font-bold text-gray-500 uppercase">{label}</Text>
        </View>
        <Text className={`text-[10px] font-black uppercase ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
            {value}
        </Text>
    </View>
);

// Helper for Tier Colors & Glows
const getTierTheme = (tier, isDark) => {
    const t = tier?.toLowerCase();
    switch (t) {
        case 'mythic': return { color: '#ff4d4d', glow: '#ff0000', label: 'MYTH' };
        case 'legendary': return { color: '#ffac33', glow: '#ff8800', label: 'LEGD' };
        case 'epic': return { color: '#bc13fe', glow: '#a000ff', label: 'EPIC' };
        case 'rare': return { color: '#00d2ff', glow: '#00a2ff', label: 'RARE' };
        default: return { color: '#9ca3af', glow: '#4b5563', label: 'BASE' };
    }
};

// UI Component: The Circular Price Badge (Skia Glow)
const PriceOrb = ({ price, color, isRent }) => (
    <View className="absolute -top-2 -right-2 w-8 h-8 items-center justify-center z-20">
        <Canvas style={{ position: 'absolute', width: 32, height: 32 }}>
            <Group>
                <Circle cx={16} cy={16} r={12} color={color}>
                    <Blur blur={3} />
                </Circle>
                <Circle cx={16} cy={16} r={10} color={color} opacity={0.9} />
            </Group>
        </Canvas>
        <Text className="text-[6px] font-black text-white text-center">
            {price > 0 ? price : '0'}{isRent ? 'OC' : ''}
        </Text>
    </View>
);

const StickerModal = ({ visible, onClose, onSelectSticker, isDark }) => {
    const { user } = useUser();
    const { coins, setCoins } = useCoins();
    const storage = useMMKV();
    const CustomAlert = useAlert();

    const [activeTab, setActiveTab] = useState('free');
    const [activePackId, setActivePackId] = useState(null); // 🚀 Track current pack
    const [ownedStickers, setOwnedStickers] = useState([]);
    const [storePacks, setStorePacks] = useState([]); // 🚀 Store packs instead of flat list
    const [isInitialLoading, setIsInitialLoading] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        if (visible) loadStickerData();
    }, [visible]);

    const loadStickerData = async () => {
        const cachedOwned = storage.getString('user_stickers');
        const cachedPacks = storage.getString('store_packs');

        if (cachedOwned) setOwnedStickers(JSON.parse(cachedOwned));
        if (cachedPacks) {
            const parsedPacks = JSON.parse(cachedPacks);
            setStorePacks(parsedPacks);
            if (parsedPacks.length > 0 && !activePackId) setActivePackId(parsedPacks[0].packId);
        }

        if (!cachedPacks) setIsInitialLoading(true);

        try {
            const response = await apiFetch(`/store/sticker`, {
                method: 'GET',
                headers: { 'deviceid': user?.deviceId }
            });
            const data = await response.json();

            if (data.owned) {
                setOwnedStickers(data.owned);
                storage.set('user_stickers', JSON.stringify(data.owned));
            }
            if (data.storePacks) {
                setStorePacks(data.storePacks);
                storage.set('store_packs', JSON.stringify(data.storePacks));
                // Default to first pack if none selected
                if (!activePackId && data.storePacks.length > 0) {
                    setActivePackId(data.storePacks[0].packId);
                }
            }
        } catch (error) {
            console.error("Error syncing stickers", error);
        } finally {
            setIsInitialLoading(false);
        }
    };

    const handleTransaction = async (action, sticker) => {
        if (processingId) return;
        setProcessingId(sticker.stickerId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const response = await apiFetch(`store/sticker`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'deviceid': user?.deviceId },
                body: JSON.stringify({ action, stickerId: sticker.stickerId })
            });
            const result = await response.json();

            if (!response.ok) {
                CustomAlert(result.error || "Denied", "error");
                return;
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (result.balance !== undefined) setCoins(result.balance);

            if (action === 'buy') {
                const updatedOwned = [...ownedStickers, result.newSticker || sticker];
                setOwnedStickers(updatedOwned);
                storage.set('user_stickers', JSON.stringify(updatedOwned));
                setActiveTab('owned');
            } else if (action === 'rent') {
                onSelectSticker(sticker?.stickerId);
                onClose();
            }
        } catch (error) {
            CustomAlert("Network error", "error");
        } finally {
            setProcessingId(null);
        }
    };

    const confirmTransaction = (action, item) => {
        Haptics.selectionAsync();
        CustomAlert(
            "Authorize Protocol",
            `Deduct ${item.price} OC to ${action === 'rent' ? 'rent for this comment' : 'permanently buy'} this stamp?`,
            [
                { text: "Abort", style: "cancel" },
                {
                    text: "Execute",
                    style: "default",
                    onPress: () => handleTransaction(action, item)
                }
            ],
            { cancelable: true }
        );
    };

    // 🚀 Data routing: Get current pack's items based on Active Tab
    const currentData = useMemo(() => {
        if (!activePackId) return [];

        // 1. Get all items in the currently selected Pack
        const activePackItems = storePacks.find(p => p.packId === activePackId)?.items || [];

        // 2. Filter them based on the selected Tab
        if (activeTab === 'free') return activePackItems.filter(s => s.price === 0);
        if (activeTab === 'rent') return activePackItems.filter(s => s.price > 0 || s.type === 'rent');

        // If Owned tab, only show owned items THAT BELONG TO THE CURRENT PACK
        return ownedStickers.filter(s =>
            (s.packId === activePackId) ||
            (!s.packId && activePackId === 'SYSTEM_DEFAULT')
        );
    }, [activeTab, activePackId, storePacks, ownedStickers]);

    const renderTabButton = (tabId, label, icon) => {
        const isActive = activeTab === tabId;
        return (
            <Pressable
                onPress={() => { Haptics.selectionAsync(); setActiveTab(tabId); }}
                className="flex-1 items-center justify-center py-4 relative"
            >
                <MotiView animate={{ opacity: isActive ? 1 : 0.4, scale: isActive ? 1.1 : 0.9 }}>
                    <Ionicons name={icon} size={18} color={isActive ? "#3b82f6" : (isDark ? "#fff" : "#000")} />
                </MotiView>
                <Text className={`text-[9px] font-black uppercase mt-1 ${isActive ? 'text-blue-500' : 'text-gray-500'}`}>
                    {label}
                </Text>
                {isActive && (
                    <MotiView
                        className="absolute bottom-0 h-[2px] bg-blue-500 w-1/2"
                        from={{ width: 0 }} animate={{ width: '50%' }}
                    />
                )}
            </Pressable>
        );
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/60">
                <Pressable className="absolute inset-0" onPress={onClose} />

                <MotiView
                    from={{ translateY: height * 0.5 }}
                    animate={{ translateY: 0 }}
                    className="h-[75%] w-full"
                >
                    <LinearGradient
                        colors={isDark ? ['#121212', '#050505'] : ['#ffffff', '#f0f0f0']}
                        className="flex-1 rounded-t-[40px] border-t border-white/10 overflow-hidden"
                    >
                        {/* HEADER */}
                        <View className="px-6 pt-8 pb-4">
                            <View className="flex-row justify-between items-center mb-6">
                                <View>
                                    <Text className="text-2xl font-black italic tracking-tighter dark:text-white uppercase">SYSTEM_STAMPS</Text>
                                    <View className="flex-row items-center gap-1 mt-1">
                                        <View className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <Text className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                                            {activePackId || "Network Secure"}
                                        </Text>
                                    </View>
                                </View>

                                <View className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex-row items-center gap-2 shadow-lg">
                                    <Text className="text-blue-500 font-black text-xs">{coins || 0} <Text className="text-[10px]">OC</Text></Text>
                                </View>
                            </View>

                            <View className="flex-row bg-black/20 dark:bg-white/5 rounded-2xl p-1 border border-white/5">
                                {renderTabButton('owned', 'Owned', 'briefcase-outline')}
                                {renderTabButton('free', 'Free', 'gift-outline')}
                                {renderTabButton('rent', 'Premium', 'flash-outline')}
                            </View>
                        </View>

                        {/* STICKER GRID LIST */}
                        <FlatList
                            key={`${activeTab}-${activePackId}-grid`}
                            data={currentData}
                            numColumns={4} // Tight 4 column layout
                            keyExtractor={(item) => item.stickerId}
                            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} // padding bottom to account for the Pack Selector
                            // Reduced gaps dramatically for a dense tech UI
                            columnWrapperStyle={{ gap: 4, marginBottom: 4, justifyContent: 'flex-start' }}
                            renderItem={({ item }) => {
                                const theme = getTierTheme(item.tier, isDark);

                                return (
                                    <MotiView
                                        from={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="items-center"
                                        style={{ width: `${(100 / 4) - 1}%` }}
                                    >
                                        {/* 🚀 Changed to a View! No more nested Pressables */}
                                        <View className="w-full aspect-square rounded-xl items-center justify-center overflow-hidden">
                                            <View className="relative w-full h-full items-center justify-center">

                                                <StickerPreview
                                                    sticker={item}
                                                    stickerId={item.stickerId}
                                                    isDark={isDark}
                                                    size="medium"
                                                    // 🚀 The logic lives here now!
                                                    onPress={() => {
                                                        if (activeTab === 'owned' || activeTab === 'free') {
                                                            onSelectSticker(item?.stickerId);
                                                            onClose();
                                                        } else {
                                                            confirmTransaction(activeTab === 'rent' ? 'rent' : 'buy', item);
                                                        }
                                                    }}
                                                />

                                                {/* Price Orb - Added pointerEvents="none" so it doesn't block touches */}
                                                {activeTab === 'rent' && (
                                                    <View className="absolute bottom-1 right-1" pointerEvents="none">
                                                        <PriceOrb
                                                            price={item.price}
                                                            color={theme.glow}
                                                            isRent={true}
                                                        />
                                                    </View>
                                                )}

                                                {/* Loading State - Added pointerEvents="none" */}
                                                {processingId === item.stickerId && (
                                                    <View className="absolute inset-0 z-30 bg-black/70 items-center justify-center" pointerEvents="none">
                                                        <ActivityIndicator color={theme.glow || "#3b82f6"} size="small" />
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </MotiView>
                                );
                            }}
                            ListEmptyComponent={
                                <View className="flex-1 items-center justify-center mt-10">
                                    <Ionicons name="folder-open-outline" size={32} color={isDark ? "#333" : "#ccc"} />
                                    <Text className="text-gray-500 font-black uppercase tracking-widest text-[10px] mt-2">Sector Empty</Text>
                                </View>
                            }
                        />

                        {/* 🚀 HORIZONTAL PACK SELECTOR AT BOTTOM */}
                        <View className="absolute bottom-0 left-0 right-0 pt-2 pb-4 bg-black/40 border-t border-white/10" style={{ backdropFilter: 'blur(20px)' }}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 10, gap: 10 }}
                            >
                                {storePacks.map((pack) => {
                                    const isActive = activePackId === pack.packId;

                                    return (
                                        <Pressable
                                            key={pack.packId}
                                            onPress={() => {
                                                Haptics.selectionAsync();
                                                setActivePackId(pack.packId);
                                            }}
                                            className="items-center"
                                        >
                                            <MotiView
                                                animate={{
                                                    scale: isActive ? 1 : 0.9,
                                                    opacity: isActive ? 1 : 0.5
                                                }}
                                                className={`w-12 h-12 rounded-2xl border-2 items-center justify-center overflow-hidden bg-black/50 ${isActive ? 'border-blue-500' : 'border-white/10'}`}
                                            >
                                                {pack.coverArt ? (
                                                    <Image
                                                        source={{ uri: pack.coverArt }}
                                                        style={{ width: 40, height: 40, opacity: 1 }}
                                                        contentFit="contain"
                                                        transition={200}
                                                    />
                                                ) : (
                                                    <Ionicons name="cube-outline" size={24} color={isActive ? "#3b82f6" : "#888"} />
                                                )}
                                            </MotiView>
                                            <Text className={`text-[8px] font-black uppercase mt-2 tracking-widest ${isActive ? 'text-blue-500' : 'text-gray-500'}`}>
                                                {pack.packId.length > 8 ? `${pack.packId.substring(0, 6)}..` : pack.packId}
                                            </Text>
                                        </Pressable>
                                    )
                                })}
                            </ScrollView>
                        </View>

                    </LinearGradient>
                </MotiView>
            </View>
        </Modal>
    );
};

const Transition = { type: 'spring', damping: 20 };

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
    const [stickerModalVisible, setStickerModalVisible] = useState(false); // NEW STATE
    const isFetching = useRef(false); // Add this at the top of your component

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
        { refreshInterval: 15000, revalidateOnFocus: true }
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
            // 🚀 BATCHING GUARD: Prevents multiple simultaneous API calls
            if (isFetching.current) return;
            isFetching.current = true;

            try {
                const res = await apiFetch('/store/sticker');
                if (!res.ok) throw new Error("Stream denied");

                const payload = await res.json();
                const storeStickers = (payload.storePacks || []).flatMap(p => p.items || []);
                const allStickers = [...storeStickers, ...(payload.owned || [])];

                const found = {};
                missingIds.forEach(id => {
                    const sticker = allStickers.find(item => item.stickerId === id);
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
                console.error('Vault Sync Error', error);
            } finally {
                isFetching.current = false; // 🚀 Unlock for future missing stickers
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

    // NEW: Function to handle sending a sticker
    const handleSendSticker = (stickerId) => {

        setStickerModalVisible(false);
        if (!isPosting) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            // We pass empty text, and the stickerId as the payload. 
            // Make sure your onReply function accepts a sticker parameter!
            handlePostComment("", "", stickerId);
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
                <View className="flex-row gap-2 w-full items-center">
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
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            handlePostComment();
                        }}
                        disabled={isPosting}
                        className="relative bg-blue-600 w-[80%] h-14 rounded-xl overflow-hidden justify-center items-center shadow-lg"
                    >
                        {isPosting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-[13px] font-black text-white uppercase tracking-widest">Transmit Signal</Text>}
                        {(isPosting || isLoadingMore || (isLoading && page === 1)) && (
                            <View className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
                                <Animated.View className="h-full w-1/2 bg-white/60" style={loaderStyle} />
                            </View>
                        )}
                    </Pressable>
                </View>
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
            {/* NEW: STICKER MODAL COMPONENT */}
            <StickerModal
                visible={stickerModalVisible}
                isDark={isDark}
                onClose={() => setStickerModalVisible(false)}
                onSelectSticker={handleSendSticker}
            />
        </View>
    );
}