import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { requestPermissionsAsync } from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';
import { useMMKV } from "react-native-mmkv";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import { Text } from "../../components/Text";

import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import Toast from "react-native-toast-message";
import AnimeLoading from "../../components/AnimeLoading";
import { ClanBadge } from "../../components/ClanBadge";
import ClanBorder from "../../components/ClanBorder";
import ClanCard from "../../components/ClanCard";
import ClanCrest from "../../components/ClanCrest";
import CoinIcon from "../../components/ClanIcon";
import AnimatedItemIcon from "../../components/ConsumableSkiaIcon";
import { SyncLoading } from "../../components/SyncLoading";
import { useAlert } from "../../context/AlertContext";
import { useClan } from '../../context/ClanContext';
import { useCoins } from "../../context/CoinContext";
import { useUser } from '../../context/UserContext';
import apiFetch from "../../utils/apiFetch";
const { width, height } = Dimensions.get("window");

// ============================================================================
// ✍️ PREMIUM CINEMATIC WORD REVEAL (REFINED FOR ALIGNMENT)
// ============================================================================
const AnimatedWord = memo(({ word, index, style, isLast }) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(8);

    useEffect(() => {
        const delay = index * 50;
        const hapticTimer = setTimeout(() => {
            Haptics.selectionAsync();
        }, delay);

        opacity.value = withDelay(
            delay,
            withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) })
        );
        translateY.value = withDelay(
            delay,
            withTiming(0, { duration: 400, easing: Easing.out(Easing.back(1.2)) })
        );

        return () => clearTimeout(hapticTimer);
    }, [word]);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }]
    }));

    return (
        <Animated.Text style={[style, animStyle]}>
            {word}{isLast ? "" : " "}
        </Animated.Text>
    );
});

const PremiumTextReveal = memo(({ text, style }) => {
    const words = useMemo(() => text.split(/\s+/), [text]);

    return (
        <View style={styles.revealContainer}>
            <Text style={[style, { textAlign: 'left' }]}>
                {words.map((word, index) => (
                    <AnimatedWord
                        key={`${word}-${index}`}
                        word={word}
                        index={index}
                        style={style}
                        isLast={index === words.length - 1}
                    />
                ))}
            </Text>
        </View>
    );
});

// ============================================================================
// ⚡️ FULL-SCREEN CINEMATIC ONBOARDING MODAL
// ============================================================================
export const CinematicClanOnboarding = memo(({ visible, onClose, isLeader, appBlue }) => {
    const [step, setStep] = useState(0);

    const ONBOARDING_STEPS = useMemo(() => {
        const baseSteps = [
            {
                title: "THE_CLAN_DOJO",
                intel: "SYS: COMMAND_CENTER",
                desc: "Welcome to your Clan hub. Track Clan Rank, Clan Funds, and view your members from the Shinobi tab.",
                icon: "shield",
                color: appBlue
            },
            {
                title: "INTEL_&_COMMS",
                intel: "SYS: NETWORK_SYNC",
                desc: "Read Clan Transmissions in the Scrolls tab and coordinate with members in the Great Hall chat.",
                icon: "chatbubbles",
                color: "#a855f7"
            },
            {
                title: "WARS_&_BLACK_MARKET",
                intel: "SYS: COMBAT_&_ASSETS",
                desc: "Review Clan Wars history, manage your Inventory, and spend Clan Coins (CC) on cosmetics and upgrades.",
                icon: "flame",
                color: "#f59e0b"
            }
        ];

        if (isLeader) {
            baseSteps.push({
                title: "THE_KAGE_DESK",
                intel: "SYS: ADMIN_AUTHORITY",
                desc: "Manage Clan recruitment, approve members, and moderate your Clan from the Kage Desk.",
                icon: "key",
                color: "#ef4444"
            });
        }

        return baseSteps;
    }, [isLeader, appBlue]);


    if (!visible) return null;

    const currentStep = ONBOARDING_STEPS[step];
    const isLastStep = step === ONBOARDING_STEPS.length - 1

    const handleNext = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (isLastStep) {
            onClose();
        } else {
            setStep(s => s + 1);
        }
    };

    const handlePrev = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (step > 0) setStep(step - 1);
    };

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={styles.modalContainer}>

                {/* --- TOP NAVIGATION BAR --- */}
                <View style={styles.topNav}>
                    <View style={{ width: 80 }}>
                        {step > 0 && (
                            <TouchableOpacity onPress={handlePrev} style={styles.navButton}>
                                <Ionicons name="chevron-back" size={14} color={appBlue} />
                                <Text style={[styles.navText, { color: appBlue }]}>PREV</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.progressText, { color: currentStep.color }]}>
                            [ SYNC_PROGRESS: {step + 1}/{ONBOARDING_STEPS.length} ]
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onClose();
                    }} style={{ width: 80, alignItems: 'flex-end' }}>
                        <Text style={styles.skipText}>SKIP_X</Text>
                    </TouchableOpacity>
                </View>

                {/* --- MAIN CONTENT AREA --- */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Animated.View key={`icon-${step}`} entering={FadeIn.duration(600)} style={styles.iconWrapper}>
                        <View style={[styles.iconContainer, { borderColor: currentStep.color, shadowColor: currentStep.color }]}>
                            <Ionicons name={currentStep.icon} size={40} color={currentStep.color} />
                        </View>
                    </Animated.View>

                    <Animated.View key={`text-${step}`} entering={FadeInDown.springify().damping(15)}>
                        <Text style={[styles.intelLabel, { color: currentStep.color }]}>
                            {currentStep.intel}
                        </Text>
                        <Text style={styles.stepTitle}>
                            {currentStep.title.replace(/_/g, ' ')}
                        </Text>

                        <PremiumTextReveal
                            key={`reveal-${step}`}
                            text={currentStep.desc}
                            style={styles.descriptionText}
                        />
                    </Animated.View>
                </View>

                {/* --- FOOTER CONTROLS --- */}
                <View>
                    <View style={styles.dotContainer}>
                        {ONBOARDING_STEPS.map((_, i) => (
                            <View key={i} style={[
                                styles.dot,
                                {
                                    width: i === step ? 32 : 8,
                                    backgroundColor: i === step ? currentStep.color : '#1e293b'
                                }
                            ]} />
                        ))}
                    </View>

                    <TouchableOpacity
                        onPress={handleNext}
                        activeOpacity={0.8}
                        style={[styles.mainButton, { backgroundColor: currentStep.color, shadowColor: currentStep.color }]}
                    >
                        <Animated.View entering={FadeIn} style={styles.buttonContent}>
                            <Text style={styles.buttonText}>
                                {isLastStep ? "INITIALIZE_SYSTEM" : "NEXT_SYNC_LEVEL"}
                            </Text>
                            <Ionicons
                                name={isLastStep ? "flash" : "chevron-forward"}
                                size={20}
                                color="#000"
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#050505',
        paddingHorizontal: 30,
        paddingTop: 60,
        paddingBottom: 40,
        justifyContent: 'space-between'
    },
    topNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
        paddingBottom: 20
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    navText: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1
    },
    progressText: {
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 2
    },
    skipText: {
        fontSize: 10,
        color: '#475569',
        fontWeight: 'bold',
        letterSpacing: 1
    },
    iconWrapper: {
        marginBottom: 40
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: '#000',
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10
    },
    intelLabel: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 3,
        marginBottom: 16
    },
    stepTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 24,
        lineHeight: 38,
        fontStyle: 'italic'
    },
    revealContainer: {
        width: '100%',
        minHeight: 100
    },
    descriptionText: {
        fontSize: 16,
        color: '#94a3b8',
        lineHeight: 26,
        fontWeight: '500'
    },
    dotContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 40,
        justifyContent: 'center'
    },
    dot: {
        height: 4,
        borderRadius: 10
    },
    mainButton: {
        paddingVertical: 20,
        borderRadius: 20,
        alignItems: 'center',
        shadowOpacity: 0.3,
        shadowRadius: 10
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    buttonText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 2
    }
});

// =================================================================
// ⚡️ EXTRACTED MEMOIZED SECTIONS FOR PERFORMANCE ⚡️
// =================================================================

const ClanTopHeaderSection = memo(({
    fullData,
    activeGlowColor,
    APP_BLUE,
    isVerified,
    userRole,
    canManageClan,
    isEditing,
    editData,
    setEditData,
    setIsEditing,
    triggerAction,
    setCardPreviewVisible,
    setInventoryModalVisible,
    setStoreModalVisible,
    pulseStyle,
    spinStyle
}) => {

    // ⚡️ PERFORMANCE & FEATURE WIN: Stable callback with Emoji Filter
    const handleNameChange = useCallback((text) => {
        // Strip emojis from the clan name in real-time
        const noEmojiText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{1FB00}-\u{1FBFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}]/gu, '');
        // Use functional state update so this callback never needs to be recreated
        setEditData(prev => ({ ...prev, name: noEmojiText }));
    }, [setEditData]);

    // ⚡️ PERFORMANCE WIN: Stable callback for description to prevent typing lag
    const handleDescChange = useCallback((text) => {
        setEditData(prev => ({ ...prev, description: text }));
    }, [setEditData]);

    return (
        <View className="p-8 px-2 mt-10 items-center border-b border-gray-100 dark:border-zinc-900">
            <View className="w-full flex-row justify-center items-center relative">
                <View className="relative">
                    <Animated.View
                        style={[
                            pulseStyle
                        ]}
                    />
                    <Animated.View
                        style={[
                            { borderColor: `${activeGlowColor || APP_BLUE}40` },
                            spinStyle
                        ]}
                        className="absolute -inset-5 border border-dashed rounded-full"
                    />
                    <ClanCrest glowColor={activeGlowColor} rank={fullData?.rank || 1} size={120} />
                </View>

                <View className="absolute right-0 flex flex-col justify-between items-center gap-2">
                    <TouchableOpacity
                        onPress={() => setCardPreviewVisible(true)}
                        className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-full z-10 border border-gray-200 dark:border-zinc-700"
                    >
                        <MaterialCommunityIcons name="card-account-details-outline" size={24} color={APP_BLUE} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setInventoryModalVisible(true)}
                        className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-full z-10 border border-gray-200 dark:border-zinc-700"
                    >
                        <MaterialCommunityIcons name="archive-outline" size={24} color={APP_BLUE} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setStoreModalVisible(true)}
                        className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-full z-10 border border-gray-200 dark:border-zinc-700"
                    >
                        <MaterialCommunityIcons name="cart-outline" size={24} color={APP_BLUE} />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="mt-12 items-center w-full px-4">
                {isEditing ? (
                    <View className="w-full gap-y-2">
                        <TextInput
                            value={editData.name}
                            onChangeText={handleNameChange} // ⚡️ Using optimized handler
                            maxLength={18} // ⚡️ Enforces 15 character limit
                            className="text-1xl font-black text-blue-500 text-center italic border-b border-blue-500 w-full"
                            placeholder="Clan Name"
                        />
                        <TextInput
                            value={editData.description}
                            onChangeText={handleDescChange} // ⚡️ Using optimized handler
                            multiline
                            className="text-gray-600 dark:text-gray-300 text-xs italic text-center p-2 border border-blue-200 rounded-lg"
                            placeholder="Village Motto..."
                        />
                    </View>
                ) : (
                    <>
                        <View className="flex flex-row gap-2 items-center">
                            <Text className="text-2xl font-black text-black dark:text-white uppercase italic tracking-tighter text-center">
                                {fullData?.name}
                            </Text>
                            {isVerified && <RemoteSvgIcon size={30} xml={fullData?.activeCustomizations?.verifiedBadgeXml} />}
                        </View>
                        <Text className="text-gray-500 dark:text-gray-400 text-xs italic mt-2 text-center px-6 leading-4">
                            "{fullData?.description || "No village motto defined."}"
                        </Text>
                    </>
                )}

                <View className="flex-row items-center gap-2 mt-1">
                    <Text style={{ color: APP_BLUE }} className="font-black tracking-[0.3em] text-xs">#{fullData?.tag}</Text>
                    <View className="h-1 w-1 rounded-full bg-gray-400" />
                    <Text className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase">
                        {userRole === 'leader' ? 'Village Head' : userRole === 'viceLeader' ? 'Anbu Captain' : 'Shinobi'}
                    </Text>
                </View>

                {canManageClan && (
                    <TouchableOpacity
                        onPress={() => isEditing ? triggerAction("EDIT_CLAN", editData) : setIsEditing(true)}
                        className="absolute right-0 top-0 p-3 bg-gray-100 dark:bg-zinc-800 rounded-full"
                    >
                        <Feather name={isEditing ? "check" : "edit-3"} size={18} color={APP_BLUE} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
});

const ClanAchievementsSection = memo(({ fullData }) => {
    return (
        <View className="w-full mt-3 px-2">
            <Text className="text-[14px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center">Clan Achievements</Text>
            {/* Earned Medals Container */}
            <View className="w-full">
                {fullData && fullData.badges?.length > 0 ? (
                    <View className="flex-row flex-wrap justify-center gap-2 w-full px-4">
                        {fullData && fullData.badges.map((badge, idx) => (
                            <ClanBadge key={`${badge}-${idx}`} isClanPage={true} badgeName={badge} size={50} />
                        ))}
                    </View>
                ) : (
                    <View className="items-center opacity-40 py-2">
                        <View className="bg-gray-500/10 p-4 rounded-full mb-2">
                            <MaterialCommunityIcons name="shield-off-outline" size={24} color="#9ca3af" />
                        </View>
                        <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            No Achievements Yet
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
});

const ClanProgressSection = memo(({ fullData, decayAmount, safeProgress, decayProgress, activeGlowColor, APP_BLUE }) => {
    return (
        <View className="px-6 py-6">
            <View className="flex-row justify-between items-end mb-2">
                <View>
                    <Text className="text-gray-400 font-black text-[9px] uppercase tracking-widest">Clan Points</Text>
                    {decayAmount > 0 && (
                        <Text className="text-red-500 font-black text-[8px] uppercase tracking-widest mt-1">
                            -{decayAmount.toLocaleString()} Weekly Decay
                        </Text>
                    )}
                </View>
                <Text className="text-black dark:text-white font-mono font-bold text-[10px]">
                    {fullData?.totalPoints?.toLocaleString()} / {fullData?.nextThreshold?.toLocaleString()}
                </Text>
            </View>

            <View className="w-full h-[6px] flex-row bg-gray-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                {/* 1. Safe Points (Normal Color) */}
                <View
                    className="h-full"
                    style={{
                        width: `${safeProgress}%`,
                        backgroundColor: activeGlowColor || APP_BLUE
                    }}
                />

                {/* 2. Decay Points (Red indicator at the end) */}
                {decayProgress > 0 && (
                    <View
                        className="h-full bg-red-500"
                        style={{ width: `${decayProgress * 1.5}%` }}
                    />
                )}
            </View>
        </View>
    );
});

const ClanTabsHeader = memo(({ activeTab, setActiveTab, hasUnreadChat, fullData, canManageClan, APP_BLUE }) => {
    return (
        <View className="flex-row px-4 border-b border-gray-100 dark:border-zinc-900 mb-6">
            {['Dojo', 'Shinobi', 'Wars', 'Scrolls', "Hall", canManageClan && 'Kage Desk'].filter(Boolean).map(tab => {
                const isHallUnread = tab === 'Hall' && hasUnreadChat && activeTab !== 'Hall';
                const hasJoinReqs = tab === 'Kage Desk' && fullData?.joinRequests?.length > 0;

                return (
                    <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} className="flex-1 items-center py-4 relative">
                        <View className="relative">
                            <Text style={{ color: activeTab === tab ? APP_BLUE : '#9ca3af' }} className={`font-black text-[8px] uppercase tracking-widest`}>
                                {tab}
                            </Text>
                            {isHallUnread && (
                                <View className="absolute -top-1 -right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                            )}
                            {hasJoinReqs && (
                                <View className="absolute -top-1.5 -right-3 bg-red-500 rounded-full px-1 min-w-[12px] items-center justify-center">
                                    <Text className="text-[6px] text-white font-black">{fullData.joinRequests.length}</Text>
                                </View>
                            )}
                        </View>
                        {activeTab === tab && <View style={{ backgroundColor: APP_BLUE }} className="h-0.5 w-4 mt-1" />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
});

const TabDojo = memo(({ fullData, activeGlowColor, APP_BLUE, handleShareClan, copyLinkToClipboard, handleLeaveClan }) => {
    const lastIndex = fullData?.weeklyPointHistory.length - 1
    const rank = fullData?.weeklyPointHistory[lastIndex].rankAtTime

    return (
        <View className="px-6 pb-10">
            <View className="flex-row flex-wrap justify-between">
                <StatCard glowColor={activeGlowColor} label="Followers" value={fullData?.followerCount} icon="account-group" />
                <StatCard glowColor={activeGlowColor} label="Clan Funds" value={fullData?.spendablePoints} isCoin={true} icon="cash-multiple" />
                <StatCard glowColor={activeGlowColor} label="World Rank" value={`#${rank}`} icon="seal" />
                <StatCard glowColor={activeGlowColor} label="Shinobi Count" value={`${fullData?.members?.length}/${fullData?.maxSlots}`} icon="account-multiple" />
            </View>

            <Text className="text-black dark:text-white font-black text-xs mt-6 mb-4 uppercase tracking-widest">Village Expansion</Text>
            <View className="flex-row gap-x-2 mb-6">
                <TouchableOpacity
                    onPress={handleShareClan}
                    style={{ backgroundColor: APP_BLUE }}
                    className="flex-1 p-4 rounded-3xl flex-row items-center justify-center gap-x-2 shadow-lg shadow-blue-500/40"
                >
                    <Feather name="share-2" size={16} color="white" />
                    <Text className="text-white font-black text-[10px] uppercase italic">Summon Allies</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={copyLinkToClipboard}
                    className="bg-gray-100 dark:bg-zinc-900 p-4 rounded-3xl border border-gray-200 dark:border-zinc-800"
                >
                    <Feather name="copy" size={16} color={APP_BLUE} />
                </TouchableOpacity>
            </View>

            <View className="gap-y-3 mb-6">
                <ExpansionRow glowColor={APP_BLUE} icon="heart-plus-outline" label="Follow our Village" subLabel="Stay updated on our progress" />
                <ExpansionRow glowColor={APP_BLUE} icon="feather" label="Join as an Author" subLabel="Write scrolls for the clan" />
            </View>

            <Text className="text-black dark:text-white font-black text-xs mt-2 mb-4 uppercase tracking-widest">Village Influence</Text>
            <View className="bg-gray-50 dark:bg-zinc-950 p-2 rounded-3xl border border-gray-100 dark:border-zinc-900">
                <StatRow label="Sightings (Views)" value={fullData?.stats?.views} />
                <StatRow label="Respect (Likes)" value={fullData?.stats?.likes} />
                <StatRow label="Whispers (Comments)" value={fullData?.stats?.comments} />
                <StatRow label="Scroll Depth" value={`${fullData?.stats?.totalPosts} Posts`} highlight color={APP_BLUE} />
            </View>

            <TouchableOpacity onPress={handleLeaveClan} className="mt-8 bg-red-500/10 p-4 rounded-3xl items-center border border-red-500/20">
                <Text className="text-red-500 font-black text-[10px] uppercase tracking-widest">Desert Village</Text>
            </TouchableOpacity>
        </View>
    );
});

const TabShinobi = memo(({ fullData, canManageClan, userRole, triggerAction, isProcessingAction, APP_BLUE, isDark }) => {
    return (
        <View className="px-6 pb-10">
            {fullData?.members?.map(m => (
                <MemberItem
                    key={m._id}
                    member={m}
                    roleLabel={m._id === fullData.leader?._id ? "Kage" : (m._id === fullData.viceLeader?._id ? "Jonin" : "Genin")}
                    canManage={canManageClan && m._id !== fullData.leader?._id}
                    isLeader={userRole === 'leader'}
                    onKick={() => triggerAction("KICK_MEMBER", { userId: m._id })}
                    onAppoint={() => triggerAction("APPOINT_VICE", { userId: m._id })}
                    isProcessingAction={isProcessingAction}
                    accent={APP_BLUE}
                    isDark={isDark}
                />
            ))}
        </View>
    );
});

const TabWars = memo(({ warHistory, loadingWars, userClanTag }) => {
    return (
        <View className="px-6">
            <Text className="text-black dark:text-white font-black text-xs mb-4 uppercase tracking-widest italic">Great Ninja War Archives</Text>
            {loadingWars && <SyncLoading message="Loading Wars..." />}
            {warHistory.length === 0 && !loadingWars && (
                <View className="p-10 bg-gray-50 dark:bg-zinc-900 rounded-[30px] items-center border border-dashed border-gray-200 dark:border-zinc-800">
                    <MaterialCommunityIcons name="sword-cross" size={32} color="#9ca3af" />
                    <Text className="text-[10px] font-black text-gray-400 uppercase mt-2">No past conflicts recorded</Text>
                </View>
            )}
        </View>
    );
});

const TabKageDesk = memo(({ fullData, canManageClan, triggerAction, isProcessingAction, APP_BLUE, isDark }) => {
    if (!canManageClan) return null;
    return (
        <View className="px-6">
            <AdminToggle
                label="Open Village Gates"
                status={fullData.isRecruiting ? "OPEN" : "CLOSED"}
                onPress={() => triggerAction("TOGGLE_RECRUIT")}
                appBlue={APP_BLUE}
                isDark={isDark}
            />
            <View className="mt-8">
                <Text className="text-black dark:text-white font-black text-xs mb-4 uppercase tracking-widest italic">Seekers of the Leaf</Text>
                {fullData.joinRequests?.length > 0 ? (
                    fullData.joinRequests.map(req => (
                        <RequestItem
                            key={req.userId?._id || Math.random()}
                            isProcessingAction={isProcessingAction}
                            user={req.userId}
                            onApprove={() => triggerAction("APPROVE_MEMBER", { userId: req.userId?._id })}
                            onDecline={() => triggerAction("DECLINE_MEMBER", { userId: req.userId?._id })}
                            appBlue={APP_BLUE}
                            isDark={isDark}
                        />
                    ))
                ) : (
                    <View className="p-12 items-center bg-gray-50 dark:bg-zinc-900/50 rounded-[40px] border border-dashed border-gray-100 dark:border-zinc-800">
                        <Feather name="user-plus" size={24} color="#4b5563" />
                        <Text className="text-gray-400 font-bold uppercase text-[9px] mt-4 tracking-widest">No seekers found</Text>
                    </View>
                )}
            </View>
        </View>
    );
});

// ==========================================
// ⚡️ OPTIMIZATION 1: MEMOIZED POST ITEM (UPSCALED ED.)
// ==========================================
const ScrollPostItem = memo(({ item, isDark, onNavigate, onAction, onDelete }) => {
    return (
        <View className="px-6 mb-5">
            <View className="bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 p-6 rounded-3xl shadow-md">
                <View className="flex-row justify-between items-start mb-4">
                    <Pressable onPress={() => onNavigate(`/post/${item.slug || item._id}`)} className="flex-1 pr-4">
                        <Text className="font-black text-lg uppercase tracking-tight text-gray-900 dark:text-white leading-6" numberOfLines={2}>
                            {item.title || item.message}
                        </Text>

                        {/* 🛡️ Status Badges & Metadata Tags Area */}
                        <View className="flex-row items-center mt-3 flex-wrap gap-2">
                            <View className="bg-blue-500/10 px-2.5 py-1 rounded-md">
                                <Text className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </Text>
                            </View>

                            {item.category && <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-1">• {item.category}</Text>}

                            {/* State Indicator Tags */}
                            {item.isBoosted && (
                                <View className="bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/30 flex-row items-center">
                                    <Ionicons name="rocket" size={10} color="#3b82f6" />
                                    <Text className="text-[9px] font-black text-blue-500 uppercase ml-1 tracking-widest">Boosted</Text>
                                </View>
                            )}
                            {item.isResurrected && (
                                <View className="bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30 flex-row items-center">
                                    <MaterialCommunityIcons name="auto-fix" size={10} color="#a855f7" />
                                    <Text className="text-[9px] font-black text-purple-500 uppercase ml-1 tracking-widest">Revived</Text>
                                </View>
                            )}
                            {item.isTrending && (
                                <View className="bg-orange-500/20 px-2 py-0.5 rounded-md border border-orange-500/30 flex-row items-center">
                                    <Ionicons name="flame" size={10} color="#f97316" />
                                    <Text className="text-[9px] font-black text-orange-500 uppercase ml-1 tracking-widest">Hot</Text>
                                </View>
                            )}
                        </View>
                    </Pressable>

                    {/* 🎮 Adequate Tactile Action Buttons Box */}
                    <View className="flex-row items-center gap-2">
                        <TouchableOpacity onPress={() => onAction(item._id, 'boost')} className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-xl items-center justify-center active:scale-90 shadow-sm">
                            <Ionicons name="rocket-outline" size={20} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onAction(item._id, 'resurrect')} className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 rounded-xl items-center justify-center active:scale-90 shadow-sm">
                            <MaterialCommunityIcons name="auto-fix" size={20} color="#a855f7" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onDelete(item._id)} className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-xl items-center justify-center active:scale-90 shadow-sm">
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 📊 Upscaled Engagement Metric Footing */}
                <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/60">
                    <View className="flex-row items-center gap-4">
                        <View className="items-center flex-row gap-1.5"><Ionicons name="heart" size={16} color="#ef4444" /><Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.likesCount || 0}</Text></View>
                        <View className="items-center flex-row gap-1.5"><Ionicons name="chatbubble" size={16} color="#3b82f6" /><Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.commentsCount || 0}</Text></View>
                        <View className="items-center flex-row gap-1.5"><Ionicons name="chatbox-ellipses" size={16} color="#f59e0b" /><Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.discussionCount || 0}</Text></View>
                        <View className="items-center flex-row gap-1.5"><Ionicons name="flash" size={16} color="#00ff00" /><Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.hypePointsCount || 0}</Text></View>
                    </View>
                    <View className="flex-row items-center gap-4">
                        <View className="items-center flex-row gap-1.5"><Ionicons name="eye" size={16} color={isDark ? "#6b7280" : "#9ca3af"} /><Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.formattedViews || "0"}</Text></View>
                        <View className="items-center flex-row gap-1.5"><Ionicons name="share-social" size={16} color={isDark ? "#6b7280" : "#9ca3af"} /><Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.sharesCount || 0}</Text></View>
                    </View>
                </View>
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    return prevProps.item === nextProps.item && prevProps.isDark === nextProps.isDark;
});


// =================================================================
// MAIN COMPONENT
// =================================================================

const ClanProfile = () => {
    const storage = useMMKV();
    const { tab: urlTab } = useLocalSearchParams();
    const CustomAlert = useAlert();
    const { user } = useUser();
    const { userClan, isLoading: clanLoading, canManageClan, userRole, hasUnreadChat, markChatAsRead } = useClan();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [selectedMessage, setSelectedMessage] = useState()
    const [fullData, setFullData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Dojo');
    const [postFilter, setPostFilter] = useState('ALL'); // ⚡️ NEW: Filter state for scrolls
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', logo: '' });

    // 💬 Chat State
    const [localMessages, setLocalMessages] = useState([]);
    const flatListRef = useRef(null);
    const [showTopButton, setShowTopButton] = useState(false);

    // Modals
    const [storeModalVisible, setStoreModalVisible] = useState(false);
    const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ⚡️ ONBOARDING STATE
    const [showOnboarding, setShowOnboarding] = useState(false);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    // Pagination & Posts State
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
    const [isReachingEnd, setIsReachingEnd] = useState(false);
    const [cardPreviewVisible, setCardPreviewVisible] = useState(false);
    const clanCardRef = useRef(null);

    // ⚡️ URL Deep Link Listener
    useEffect(() => {
        if (urlTab) {
            const requestedTab = String(urlTab).toLowerCase();

            const tabMap = {
                'dojo': 'Dojo',
                'shinobi': 'Shinobi',
                'wars': 'Wars',
                'scrolls': 'Scrolls',
                'hall': 'Hall',
                'kagedesk': 'Kage Desk',
            };
            if (tabMap[requestedTab]) {
                setActiveTab(tabMap[requestedTab]);
            }
        }
    }, [urlTab]);

    const captureAndShare = useCallback(async () => {
        try {
            if (clanCardRef.current) {
                const uri = await clanCardRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                }
            }
        } catch (error) {
            console.error("Capture Error:", error);
        }
    }, []);

    const captureAndSave = useCallback(async () => {
        try {
            if (clanCardRef.current) {
                setIsSaving(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                const uri = await clanCardRef.current.capture();

                const { status } = await requestPermissionsAsync();
                if (status === 'granted') {
                    await createAssetAsync(uri);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    CustomAlert("Archived", "The Clan Scroll has been saved to your device.");
                } else {
                    CustomAlert("Permission Denied", "Access to gallery is required to save scrolls.");
                }
            }
        } catch (error) {
            console.error("Save Error:", error);
            CustomAlert("Error", "Failed to save the clan scroll.");
        } finally {
            setIsSaving(false);
        }
    }, [CustomAlert]);

    // War History State
    const [warHistory, setWarHistory] = useState([]);
    const [loadingWars, setLoadingWars] = useState(false);

    const { clanCoins, processTransaction } = useCoins();

    const CACHE_KEY = `@clan_data_${userClan?.tag}`;
    const ONBOARDING_KEY = `@has_seen_clan_onboarding`;

    useEffect(() => {
        if (fullData?.messages) {
            setLocalMessages(fullData.messages);
        }

        if (fullData && !loading) {
            const hasSeenOnboarding = storage.getBoolean(ONBOARDING_KEY);
            if (!hasSeenOnboarding) {
                setShowOnboarding(true);
            }
        }
    }, [fullData, loading]);

    const finishOnboarding = () => {
        storage.set(ONBOARDING_KEY, true);
        setShowOnboarding(false);
    };

    useEffect(() => {
        if (activeTab === 'Hall') {
            markChatAsRead();
        }
    }, [activeTab, localMessages, markChatAsRead]);

    useEffect(() => {
        if (userClan?.tag) {
            initializeClanData();
            fetchPosts(1);
            fetchWarHistory();
        } else if (!clanLoading) {
            setLoading(false);
        }
    }, [userClan?.tag]);

    useEffect(() => {
        scanAnim.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.linear }), -1, false);
        pulseAnim.value = withRepeat(
            withSequence(withTiming(1.05, { duration: 2500 }), withTiming(1, { duration: 2500 })),
            -1, false
        );
    }, []);

    const scanAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(1);

    const rankThresholds = [0, 5000, 20000, 50000, 100000, 300000];
    const decayAmounts = [200, 500, 1000, 2000, 5000, 30000];

    const { safeProgress, decayProgress, decayAmount } = useMemo(() => {
        if (!fullData || !fullData.nextThreshold) return { safeProgress: 0, decayProgress: 0, decayAmount: 0 };

        const points = fullData.totalPoints || 0;
        const nextThreshold = fullData.nextThreshold;

        let currentTierIndex = 0;
        for (let i = rankThresholds.length - 1; i >= 0; i--) {
            if (points >= rankThresholds[i]) {
                currentTierIndex = i;
                break;
            }
        }

        const decay = decayAmounts[currentTierIndex];
        const cappedPoints = Math.min(points, nextThreshold);

        const safePoints = Math.max(0, cappedPoints - decay);
        const actualDecay = cappedPoints - safePoints;

        return {
            safeProgress: (safePoints / nextThreshold) * 100,
            decayProgress: (actualDecay / nextThreshold) * 100,
            decayAmount: decay
        };
    }, [fullData]);

    const isVerified = fullData?.verifiedUntil && new Date(fullData?.verifiedUntil) > new Date();
    const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${scanAnim.value * 360}deg` }] }));
    const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));

    const initializeClanData = async () => {
        try {
            const cachedData = storage.getString(CACHE_KEY);
            if (cachedData && cachedData !== "") {
                const parsed = JSON.parse(cachedData);
                setFullData(parsed);
                setLocalMessages(parsed.messages || []);
                setEditData({ name: parsed.name, description: parsed.description, logo: parsed.logo });
                if (HAS_SHOWN_SESSION_LOADER) {
                    setLoading(false);
                }
            }
            await fetchFullDetails();
        } catch (err) {
            fetchFullDetails();
        }
    };

    let equippedGlow;
    let verifiedTier;
    if (fullData) {
        equippedGlow = fullData.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped) || {};
        verifiedTier = fullData.activeCustomizations?.verifiedTier;
    }
    const verifiedColor = verifiedTier === "premium" ? "#facc15" : verifiedTier === "standard" ? "#ef4444" : verifiedTier === "basic" ? "#3b82f6" : "";
    const highlightColor = isVerified ? verifiedColor : null;
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;
    const APP_BLUE = activeGlowColor || highlightColor || "#3b82f6";

    const fetchFullDetails = async () => {
        if (!user) {
            return null
        }
        const shouldShowHeavyLoader = !fullData && !HAS_SHOWN_SESSION_LOADER;
        if (shouldShowHeavyLoader) setLoading(true);
        try {
            const res = await apiFetch(`/clans/${userClan.tag}?deviceId=${user.deviceId}`);
            const data = await res.json();
            setFullData(data);
            setEditData({ name: data.name, description: data.description, logo: data.logo });
            storage.set(CACHE_KEY, JSON.stringify(data));
            HAS_SHOWN_SESSION_LOADER = true;
        } catch (err) {
            console.error("Fetch Details Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchWarHistory = async () => {
        setLoadingWars(true);
        try {
            const res = await apiFetch(`/clans/wars?clanTag=${userClan.tag}&status=COMPLETED`);
            const data = await res.json();
            const history = Array.isArray(data) ? data : (data.wars || []);
            setWarHistory(history);
        } catch (err) {
            console.error("Fetch Wars Error:", err);
        } finally {
            setLoadingWars(false);
        }
    };

    const fetchPosts = async (pageNum = 1) => {
        if (isFetchingNextPage || (pageNum > 1 && isReachingEnd)) return;
        if (pageNum > 1) setIsFetchingNextPage(true);
        try {
            const res = await apiFetch(`/posts?clanId=${userClan.tag}&page=${pageNum}&limit=10`);
            const text = await res.text();
            if (!text) {
                if (pageNum === 1) setPosts([]);
                return;
            }
            const data = JSON.parse(text);
            const postsArray = Array.isArray(data) ? data : (data.posts || []);
            if (postsArray.length < 10) setIsReachingEnd(true);
            setPosts(prev => pageNum === 1 ? postsArray : [...prev, ...postsArray]);
            setPage(pageNum);
        } catch (err) {
            console.error("Fetch Posts Error:", err);
        } finally {
            setIsFetchingNextPage(false);
        }
    };

    // ⚡️ POSTS FILTERING LOGIC
    const displayedPosts = useMemo(() => {
        if (postFilter === 'HIGHLIGHTS') {
            return posts.filter(p => p.isBoosted || p.isResurrected || p.isTrending);
        }
        return posts;
    }, [posts, postFilter]);

    // =================================================================
    // ⚡️ ACTION ENGINE
    // =================================================================
    const triggerAction = useCallback(async (action, payload = {}) => {
        setIsProcessingAction(true);

        const executeClanUpdate = async (actionType, actionPayload) => {
            try {
                const res = await apiFetch(`/clans/${userClan.tag}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ deviceId: user.deviceId, action: actionType, payload: actionPayload })
                });
                const data = await res.json();

                if (!res.ok) {
                    CustomAlert("Update Failed", data.message || "The village archives rejected the update.");
                } else {
                    CustomAlert("Transaction Done", "Clan Info Updated.");
                    if (typeof fetchFullDetails === 'function') fetchFullDetails();
                    setIsEditing(false); // Close edit view cleanly
                }
            } catch (error) {
                CustomAlert("Network Error", "Could not reach the village archives.");
            } finally {
                setIsProcessingAction(false);
            }
        };

        if (action === "EDIT_CLAN") {
            const currentName = fullData?.name || userClan.name;
            const isNameChanging = payload.newName && payload.newName.trim() !== currentName.trim();
            const isVerifiedActive = fullData?.verifiedUntil && new Date(fullData.verifiedUntil) > new Date();
            const hasFreeChange = isVerifiedActive && (fullData?.allowances?.freeNameChanges > 0);

            const nameCard = fullData?.specialInventory?.find(i => i.itemId === 'clan_name_change');
            const hasNameChangeCard = nameCard && (nameCard.itemCount > 0 || nameCard.itemCount === undefined);

            if (isNameChanging) {
                if (hasFreeChange) {
                    CustomAlert("Confirm Re-brand", "You have 1 Free Name Change remaining from your Verified Tier. Use it to update the Faction Name?", [
                        { text: "Cancel", style: "cancel", onPress: () => setIsProcessingAction(false) },
                        {
                            text: "Confirm",
                            style: "default",
                            onPress: async () => {
                                await executeClanUpdate(action, { ...payload, usingFreeChange: true });
                            }
                        }
                    ]);
                    return;
                }
                else if (hasNameChangeCard) {
                    CustomAlert("Confirm Re-brand", "Consume 1x Clan Re-brand Protocol chip from your inventory to alter your faction identity?", [
                        { text: "Cancel", style: "cancel", onPress: () => setIsProcessingAction(false) },
                        {
                            text: "Authorize",
                            style: "destructive",
                            onPress: async () => {
                                await executeClanUpdate(action, { ...payload, usingNameChangeCard: true });
                            }
                        }
                    ]);
                    return;
                }
                else {
                    CustomAlert(
                        "Asset Required",
                        "Re-branding Denied. You must acquire a 'Clan Re-brand Protocol' chip from the Faction Vault to alter your Clan's name."
                    );
                    setIsProcessingAction(false);
                    return;
                }
            } else {
                await executeClanUpdate(action, payload);
                return;
            }
        }

        try {
            const res = await apiFetch(`/clans/${userClan.tag}`, {
                method: 'PATCH',
                body: JSON.stringify({ deviceId: user.deviceId, action, payload })
            });
            const data = await res.json();
            if (res.ok) {
                if (action === "BUY_STORE_ITEM") CustomAlert("Success", `'${payload.itemName || 'Item'}' applied to the village.`);

                if (action === "LEAVE_CLAN") {
                    if (typeof storage !== 'undefined') {
                        storage.set(CACHE_KEY, "");
                        storage.set(ONBOARDING_KEY, false);
                    }
                    CustomAlert("Deserted", "You have left the village.");
                    if (router?.replace) router.replace('/screens/discover');
                }

                if (typeof fetchFullDetails === 'function') fetchFullDetails();

                if (action === "DELETE_POST" && typeof setPosts === 'function') {
                    setPosts(prev => prev.filter(p => p._id !== payload.postId));
                }
            } else {
                CustomAlert("Action Failed", data.message || "Jutsu failed to activate");
                if (action === "BUY_STORE_ITEM" && payload.itemId) {
                    if (typeof processTransaction === 'function') await processTransaction('refund', payload.itemId, "CC");
                }
            }
        } catch (err) {
            CustomAlert("Scroll Error", "Connection to the village lost.");
            if (action === "BUY_STORE_ITEM" && payload.itemId) {
                if (typeof processTransaction === 'function') await processTransaction('refund', payload.itemId, "CC");
            }
        } finally {
            setIsProcessingAction(false);
        }
    }, [userClan, fullData, processTransaction, CustomAlert, router, storage, CACHE_KEY, ONBOARDING_KEY]);

    // ⚡️ OPTIMIZATION: USECALLBACK FOR ACTIONS
    const handleDeletePost = useCallback((postId) => {
        CustomAlert("Banish Post", "Destroy this scroll from the village archives?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Destroy",
                style: "destructive",
                onPress: () => triggerAction("DELETE_POST", { postId })
            }
        ]);
    }, [CustomAlert, triggerAction]);

    const handlePostAction = useCallback((postId, actionType) => {
        const isBoost = actionType === 'boost';
        const title = isBoost ? 'Boost Transmission' : 'Resurrect Transmission';
        const msg = isBoost
            ? 'Spend CC or a Boost Scroll to amplify this post for 24 hours?'
            : 'Spend CC or a Resurrection Scroll to bring this post back to the top of the feed?';

        CustomAlert(title, msg, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Confirm",
                onPress: async () => {
                    Toast.show({ type: 'info', text1: 'Executing...', text2: `Initiating ${actionType} protocol`, autoHide: false });
                    try {
                        const response = await apiFetch(`/posts/action`, {
                            method: "POST",
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                deviceId: user?.deviceId,
                                postId,
                                context: 'clan', // ⚡️ CLAN CONTEXT APPLIED
                                actionType
                            })
                        });
                        const data = await response.json();

                        if (response.ok && data.success) {
                            // Optimistically update the UI to instantly reflect the new badge
                            setPosts(prev => prev.map(p => p._id === postId ? { ...p, isBoosted: isBoost ? true : p.isBoosted, isResurrected: !isBoost ? true : p.isResurrected } : p));
                            Toast.show({ type: 'success', text1: 'Protocol Complete', text2: data.message });
                            fetchFullDetails(); // Sync Clan Vault / Allowances quietly
                        } else {
                            Toast.show({ type: 'error', text1: 'Action Failed', text2: data.message || 'Failed to apply effect.' });
                        }
                    } catch (err) {
                        Toast.show({ type: 'error', text1: 'Connection Error', text2: 'Server unreachable.' });
                    }
                }
            }
        ]);
    }, [user?.deviceId, CustomAlert, fetchFullDetails]);

    const handleNavigate = useCallback((path) => {
        router.push(path);
    }, [router]);

    // ⚡️ OPTIMIZATION: MEMOIZE RENDER ITEM
    const renderScrollPostItem = useCallback(({ item }) => (
        <ScrollPostItem
            item={item}
            isDark={isDark}
            onNavigate={handleNavigate}
            onAction={handlePostAction}
            onDelete={handleDeletePost}
        />
    ), [isDark, handleNavigate, handlePostAction, handleDeletePost]);


    const handleShareClan = useCallback(async () => {
        const shareUrl = `https://oreblogda.com/clans/${fullData?.tag}`;
        try {
            await Share.share({
                message: `Join my clan ${fullData?.name} on the app! Local Tag: #${fullData?.tag}\nLink: ${shareUrl}`,
            });
        } catch (error) {
            CustomAlert("Error", "Could not manifest the share scroll.");
        }
    }, [fullData, CustomAlert]);

    const copyLinkToClipboard = useCallback(async () => {
        const shareUrl = `clans/${fullData?.tag}`;
        await Clipboard.setStringAsync(shareUrl);
        CustomAlert("Link Sealed", "Clan link copied to clipboard!");
    }, [fullData, CustomAlert]);

    const handleLeaveClan = useCallback(() => {
        CustomAlert("Leave Village", "Are you sure you want to abandon your clan? This action cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Leave",
                style: "destructive",
                onPress: () => triggerAction("LEAVE_CLAN")
            }
        ]);
    }, [CustomAlert, triggerAction]);

    const handleSendMessage = useCallback(async (text) => {
        const tempId = Date.now().toString();
        const newMessage = {
            _id: tempId,
            authorId: user.deviceId,
            authorName: user.username,
            text,
            date: new Date().toISOString()
        };

        setLocalMessages(prev => [...prev, newMessage]);

        try {
            await apiFetch(`/clans/${userClan.tag}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    deviceId: user.deviceId,
                    action: 'SEND_MESSAGE',
                    payload: { text }
                })
            });
        } catch (err) {
            console.error("Failed to send message", err);
        }
    }, [user.deviceId, user.username, userClan]);

    const scrollToTop = () => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    const handleScroll = (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        if (offsetY > 500) {
            if (!showTopButton) setShowTopButton(true);
        } else {
            if (showTopButton) setShowTopButton(false);
        }
    };

    // ⚡️ PERFORMANCE WIN: Completely Memoized List Header Component
    const listHeader = useMemo(() => {
        return (
            <View>
                <ClanTopHeaderSection
                    fullData={fullData}
                    activeGlowColor={activeGlowColor}
                    APP_BLUE={APP_BLUE}
                    isVerified={isVerified}
                    userRole={userRole}
                    canManageClan={canManageClan}
                    isEditing={isEditing}
                    editData={editData}
                    setEditData={setEditData}
                    setIsEditing={setIsEditing}
                    triggerAction={triggerAction}
                    setCardPreviewVisible={setCardPreviewVisible}
                    setInventoryModalVisible={setInventoryModalVisible}
                    setStoreModalVisible={setStoreModalVisible}
                    pulseStyle={pulseStyle}
                    spinStyle={spinStyle}
                />

                <ClanAchievementsSection fullData={fullData} />

                <ClanProgressSection
                    fullData={fullData}
                    decayAmount={decayAmount}
                    safeProgress={safeProgress}
                    decayProgress={decayProgress}
                    activeGlowColor={activeGlowColor}
                    APP_BLUE={APP_BLUE}
                />

                <ClanTabsHeader
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    hasUnreadChat={hasUnreadChat}
                    fullData={fullData}
                    canManageClan={canManageClan}
                    APP_BLUE={APP_BLUE}
                />

                {/* ⚡️ NEW: Highlight Tabs Toggle (Only visible in Scrolls tab) */}
                {activeTab === 'Scrolls' && (
                    <View className="px-6 mt-6 mb-2 flex-row gap-4 items-center">
                        <TouchableOpacity
                            onPress={() => setPostFilter('ALL')}
                            className={`py-2 px-4 rounded-full border ${postFilter === 'ALL' ? 'bg-blue-600 border-blue-500' : isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-100 border-gray-200'}`}
                        >
                            <Text className={`font-black uppercase text-[11px] tracking-widest ${postFilter === 'ALL' ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>All Transmissions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setPostFilter('HIGHLIGHTS')}
                            className={`py-2 px-4 flex-row items-center rounded-full border ${postFilter === 'HIGHLIGHTS' ? 'bg-orange-600 border-orange-500' : isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-100 border-gray-200'}`}
                        >
                            <MaterialCommunityIcons name="star-shooting" size={14} color={postFilter === 'HIGHLIGHTS' ? 'white' : isDark ? '#9ca3af' : '#6b7280'} className="mr-1" />
                            <Text className={`font-black uppercase text-[11px] ml-1 tracking-widest ${postFilter === 'HIGHLIGHTS' ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>Highlights</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {activeTab === 'Dojo' && (
                    <TabDojo
                        fullData={fullData}
                        activeGlowColor={activeGlowColor}
                        APP_BLUE={APP_BLUE}
                        handleShareClan={handleShareClan}
                        copyLinkToClipboard={copyLinkToClipboard}
                        handleLeaveClan={handleLeaveClan}
                    />
                )}

                {activeTab === 'Shinobi' && (
                    <TabShinobi
                        fullData={fullData}
                        canManageClan={canManageClan}
                        userRole={userRole}
                        triggerAction={triggerAction}
                        isProcessingAction={isProcessingAction}
                        APP_BLUE={APP_BLUE}
                        isDark={isDark}
                    />
                )}

                {activeTab === 'Wars' && (
                    <TabWars warHistory={warHistory} loadingWars={loadingWars} userClanTag={userClan.tag} />
                )}

                {activeTab === 'Kage Desk' && (
                    <TabKageDesk
                        fullData={fullData}
                        canManageClan={canManageClan}
                        triggerAction={triggerAction}
                        isProcessingAction={isProcessingAction}
                        APP_BLUE={APP_BLUE}
                        isDark={isDark}
                    />
                )}

                {activeTab === 'Hall' && (
                    <View className="px-4 pb-4">
                        <ClanChatInput onSend={handleSendMessage} copyText={selectedMessage} isDark={isDark} appBlue={APP_BLUE} />
                    </View>
                )}
            </View>
        );
    }, [
        fullData, activeGlowColor, APP_BLUE, isVerified, userRole, canManageClan,
        isEditing, editData, activeTab, postFilter, decayAmount, safeProgress, decayProgress,
        hasUnreadChat, isProcessingAction, warHistory, loadingWars, selectedMessage, isDark, handleSendMessage
    ]);

    if (loading || clanLoading) {
        return <AnimeLoading tipType={"clan"} message="Syncing Bloodline" subMessage="Consulting the Elder Scrolls..." />;
    }

    if (!userClan) {
        return (
            <View className="flex-1 justify-center items-center bg-white dark:bg-[#0a0a0a] p-6">
                <MaterialCommunityIcons name="sword-cross" size={64} color={APP_BLUE} />
                <Text className="text-gray-500 dark:text-gray-400 text-center text-lg font-black uppercase mt-4">
                    Rogue Ninja Detected
                </Text>
                <Text className="text-gray-400 text-center text-xs font-bold mt-2">
                    You belong to no village. Join a clan to build your legacy.
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <LegendList
                ref={flatListRef}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                drawDistance={300}
                style={{ flex: 1, backgroundColor: isDark ? "#0a0a0a" : "#fff" }}
                data={
                    activeTab === 'Scrolls' ? displayedPosts :
                        activeTab === 'Wars' ? warHistory :
                            activeTab === 'Hall' ? [...localMessages].reverse() : []
                }
                keyExtractor={(item) => item._id}
                estimatedItemSize={120}
                recycleItems={true}
                removeClippedSubviews={true}
                contentContainerStyle={{
                    paddingBottom: insets.bottom + 100
                }}
                ListHeaderComponent={listHeader}
                renderItem={({ item }) => {
                    if (activeTab === 'Scrolls') return renderScrollPostItem({ item });
                    if (activeTab === 'Wars') return <WarHistoryItem war={item} clanTag={userClan.tag} />;
                    if (activeTab === 'Hall') {
                        return <ClanMessageItem onSelectMessage={(msg) => {
                            if (__DEV__) console.log("Captured message data:", msg);
                            setSelectedMessage(msg);
                        }} message={item} isDark={isDark} isMe={item.authorId === user.deviceId} appBlue={APP_BLUE} />;
                    }
                    return null
                }}
                onEndReached={() => {
                    if (activeTab === 'Scrolls' && !isReachingEnd && !isFetchingNextPage) {
                        fetchPosts(page + 1);
                    }
                }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={() => {
                    if (activeTab === 'Hall' && localMessages.length === 0) {
                        return (
                            <View className="items-center justify-center py-20 opacity-50">
                                <Ionicons name="chatbubbles-outline" size={60} color={isDark ? "#52525b" : "#d1d5db"} />
                                <Text className="text-zinc-500 font-black uppercase text-xs tracking-widest mt-4">The Hall is Silent</Text>
                            </View>
                        )
                    }
                    if (activeTab === 'Scrolls' && displayedPosts.length === 0 && !isFetchingNextPage) {
                        return (
                            <View className="mx-6 p-10 bg-gray-50 dark:bg-[#121212] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 items-center my-4">
                                <Ionicons name={postFilter === 'HIGHLIGHTS' ? "star-outline" : "document-text-outline"} size={32} color={isDark ? "#4b5563" : "#9ca3af"} />
                                <Text className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-4">
                                    {postFilter === 'HIGHLIGHTS' ? 'No Highlights' : 'Empty Logs'}
                                </Text>
                                <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium text-center leading-5">
                                    {postFilter === 'HIGHLIGHTS' ? "This faction has no boosted, trending, or resurrected transmissions yet." : "This clan's intel diary is empty.\nStart writing to build the archive."}
                                </Text>
                            </View>
                        );
                    }
                    return null;
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => (
                    <View style={{ paddingBottom: insets.bottom + 100 }}>
                        {isFetchingNextPage && <SyncLoading message="Loading more scrolls" />}
                    </View>
                )}
            />

            {activeTab === 'Hall' && showTopButton && (
                <TouchableOpacity
                    onPress={scrollToTop}
                    activeOpacity={0.8}
                    style={{
                        position: 'absolute',
                        bottom: insets.bottom + 80,
                        left: 20,
                        backgroundColor: APP_BLUE,
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        justifyContent: 'center',
                        alignItems: 'center',
                        elevation: 5,
                        shadowColor: APP_BLUE,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10
                    }}
                >
                    <Ionicons name="arrow-up" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* ⚡️ PERFORMANCE WIN: Modals only mount if they are requested */}
            {storeModalVisible && (
                <ClanStoreModal fetchFullDetails={fetchFullDetails} isDark={isDark} onClose={() => setStoreModalVisible(false)} visible={true} clan={fullData} />
            )}

            {inventoryModalVisible && (
                <ClanInventoryModal visible={true} onClose={() => setInventoryModalVisible(false)} clan={fullData} isDark={isDark} user={user} fetchFullDetails={fetchFullDetails} />
            )}

            {showOnboarding && (
                <CinematicClanOnboarding visible={true} onClose={finishOnboarding} isLeader={canManageClan} appBlue={APP_BLUE} />
            )}

            {cardPreviewVisible && (
                <Modal visible={true} transparent animationType="slide">
                    <View className="flex-1 bg-black/95">
                        <Pressable style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0
                        }} onPress={() => setCardPreviewVisible(false)} />
                        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                            <View className="w-full items-center">
                                <View className="w-full flex-row justify-between items-center pt-10">
                                    <View>
                                        <Text className="text-white font-black text-xl italic uppercase tracking-widest">Clan Scroll</Text>
                                        <Text className="text-gray-500 font-bold text-[9px] uppercase tracking-[0.4em] mt-1">Official Manifest</Text>
                                    </View>
                                    <Pressable onPress={() => setCardPreviewVisible(false)} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center">
                                        <Ionicons name="close" size={28} color="white" />
                                    </Pressable>
                                </View>

                                {/* ⚡️ WIN 3: Wrapped ViewShot directly around the visible UI */}
                                <View style={{ transform: [{ scale: Math.min(1, (width - 40) / 380) }], width: 380, alignItems: 'center', marginVertical: 20 }}>
                                    <ViewShot ref={clanCardRef} options={{ format: "png", quality: 1 }}>
                                        <ClanCard clan={fullData} isDark={isDark} forSnapshot={true} />
                                    </ViewShot>
                                </View>

                                <View className="w-full mt-6">
                                    <View className="flex-row gap-3 w-full">
                                        <TouchableOpacity
                                            onPress={captureAndSave}
                                            disabled={isSaving}
                                            className="flex-1 h-16 bg-gray-800 rounded-[30px] items-center justify-center border border-gray-700 active:scale-95"
                                        >
                                            {isSaving ? <ActivityIndicator size="small" color="white" /> : (
                                                <View className="flex-row items-center gap-2">
                                                    <Feather name="download" size={20} color="white" />
                                                    <Text className="text-white font-black uppercase text-[10px] tracking-widest italic">Save</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={captureAndShare}
                                            style={{ backgroundColor: APP_BLUE }}
                                            className="flex-[2] h-16 rounded-[30px] flex-row items-center justify-center gap-3 shadow-lg active:scale-95"
                                        >
                                            <MaterialCommunityIcons name="share-variant" size={24} color="white" />
                                            <Text className="text-white font-black uppercase tracking-[0.2em] text-sm italic">Dispatch Scroll</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </Modal>
            )}
        </View>
    );
};
let HAS_SHOWN_SESSION_LOADER = false;

const ClanChatInput = memo(({ onSend, isDark, appBlue, copyText }) => {
    const [text, setText] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (copyText && copyText.trim().length > 0) {
            setText(prev => {
                const separator = prev.length > 0 ? " " : "";
                return `${copyText}${separator}${prev}`;
            });
        }
    }, [copyText]);

    // ⚡️ PERFORMANCE WIN: Locked send handler
    const handleSend = useCallback(() => {
        if (text.trim()) {
            onSend(text.trim());
            setText('');
            Keyboard.dismiss();
        }
    }, [text, onSend]);

    // ⚡️ PERFORMANCE WIN: Locked focus handlers prevent micro-stutters while typing
    const handleFocus = useCallback(() => setIsFocused(true), []);
    const handleBlur = useCallback(() => setIsFocused(false), []);

    return (
        <View className="px-4 pb-4 pt-2">
            <View
                style={{
                    backgroundColor: isDark
                        ? 'rgba(39, 39, 42, 0.8)'
                        : 'rgba(255, 255, 255, 0.9)',
                    borderColor: isFocused
                        ? appBlue
                        : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
                    borderWidth: 1.5,
                    borderRadius: 32,
                    shadowColor: isFocused ? appBlue : "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isFocused ? 0.3 : 0.1,
                    shadowRadius: 8,
                    elevation: 5,
                }}
                className="flex-row items-center p-1.5"
            >
                <TextInput
                    className={`flex-1 min-h-[48px] max-h-32 px-5 py-3 font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}
                    placeholder="Speak to the village..."
                    placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    multiline
                    value={text}
                    onChangeText={setText} // setText from useState is naturally stable
                    onFocus={handleFocus}  // ⚡️ Using optimized handler
                    onBlur={handleBlur}    // ⚡️ Using optimized handler
                    keyboardAppearance={isDark ? "dark" : "light"}
                    autoCapitalize="sentences"
                    textAlignVertical="center"
                />

                <TouchableOpacity
                    onPress={handleSend}
                    activeOpacity={0.7}
                    style={{
                        backgroundColor: text.trim() ? appBlue : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                        shadowColor: text.trim() ? appBlue : 'transparent',
                        shadowOpacity: 0.6,
                        shadowRadius: 10,
                        elevation: text.trim() ? 8 : 0,
                        width: 44,
                        height: 44
                    }}
                    className="rounded-full items-center justify-center ml-1"
                >
                    <Ionicons
                        name="send"
                        size={18}
                        color={text.trim() ? 'white' : (isDark ? '#3f3f46' : '#d1d5db')}
                        style={{ marginLeft: 3 }}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
});

const ClanMessageItem = memo(({ message, isMe, isDark, appBlue, onSelectMessage }) => {


    const handleLongPress = async () => {
        await Clipboard.setStringAsync(message.text);
        if (onSelectMessage) {
            onSelectMessage(`${message.text} // `);
        }
    };

    return (
        <View className={`px-6 py-1.5 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
            <Pressable
                onLongPress={handleLongPress}
                delayLongPress={300}
                style={{
                    backgroundColor: isMe
                        ? appBlue
                        : (isDark ? 'rgba(45, 45, 50, 0.8)' : 'rgba(255, 255, 255, 0.9)'),

                    borderColor: isMe
                        ? 'rgba(255, 255, 255, 0.3)'
                        : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)'),

                    borderWidth: 1.5,

                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3
                }}
                className={`max-w-[85%] px-4 py-1 ${isMe ? 'rounded-2xl rounded-tr-none' : 'rounded-2xl rounded-tl-none'
                    }`}
            >
                {!isMe && (
                    <Text
                        className={`text-[9px] font-black mb-1 uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'
                            }`}
                    >
                        {message.authorName}
                    </Text>
                )}

                <Text
                    className={`text-sm font-bold leading-5 ${isMe ? 'text-white' : (isDark ? 'text-zinc-100' : 'text-zinc-900')
                        }`}
                >
                    {message.text}
                </Text>

                <View className="flex-row items-center justify-end mt-1 space-x-1">
                    <Text
                        className={`text-[8px] font-black uppercase tracking-tighter ${isMe ? 'text-white/60' : (isDark ? 'text-zinc-500' : 'text-zinc-400')
                            }`}
                    >
                        {new Date(message.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMe && (
                        <View className="ml-1 opacity-70">
                            <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>
                        </View>
                    )}
                </View>
            </Pressable>
        </View>
    );
})

// 🎨 --- RENDERER FOR BACKEND SVGS ---
const RemoteSvgIcon = React.memo(({ xml, imageUrl, size = 50, color }) => {
    // 1. If an image URL is provided, render it using Expo Image
    if (imageUrl) {
        return (
            <Image
                source={{ uri: imageUrl }}
                style={{ width: size, height: size }}
                contentFit="contain"
            />
        );
    }

    // 2. If no image URL, fallback to existing XML logic
    if (xml) {
        return <SvgXml xml={xml} width={size} height={size} color={color} />;
    }

    // 3. Final fallback
    return (
        <MaterialCommunityIcons
            name="help-circle-outline"
            size={size}
            color={color || "gray"}
        />
    );
});

const getRarityColor = (rarity) => {
    switch (rarity?.toUpperCase()) {
        case 'MYTHIC': return '#ef4444';
        case 'LEGENDARY': return '#fbbf24';
        case 'EPIC': return '#a855f7';
        case 'RARE': return '#3b82f6';
        case 'COMMON': default: return '#9ca3af';
    }
};

// 🔹 1. CLAN ITEM PREVIEW MODAL
const ClanItemPreviewModal = memo(({
    isVisible,
    onClose,
    currentClan,
    selectedProduct,
    onAction,
    isProcessing,
    actionType = "buy"
}) => {

    const previewClan = useMemo(() => {
        if (!selectedProduct) return null;

        const baseClan = currentClan || {
            name: "Preview Clan",
            tag: "PRVW",
            description: "Previewing clan cosmetics.",
            totalPoints: 9999,
            rank: 1,
            members: [],
            specialInventory: []
        };

        const filteredInventory = (baseClan.specialInventory || []).map(item => {
            if (item.category === selectedProduct.category) {
                return { ...item, isEquipped: false };
            }
            return item;
        });

        const normalizedProduct = {
            ...selectedProduct,
            itemId: selectedProduct.id || selectedProduct.itemId,
            isEquipped: true,
            visualConfig: selectedProduct.visualConfig || selectedProduct.visualData || {}
        };

        return {
            ...baseClan,
            specialInventory: [
                ...filteredInventory,
                normalizedProduct
            ]
        };
    }, [currentClan, selectedProduct]);

    if (!isVisible || !selectedProduct) return null;

    const rarityColor = getRarityColor(selectedProduct.rarity);
    const itemCurrency = selectedProduct.currency || 'CC';
    const isCurrentlyEquipped = currentClan?.specialInventory?.find(i => i.itemId === (selectedProduct.id || selectedProduct.itemId))?.isEquipped;

    const isVisualCosmetic = ['BORDER', 'BACKGROUND', 'GLOW', 'WATERMARK'].includes(selectedProduct.category?.toUpperCase());

    return (
        <View style={previewStyles.overlay}>
            <Pressable style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            }} onPress={onClose} disabled={isProcessing} />

            <MotiView
                from={{ opacity: 0, translateY: 100, scale: 0.9 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                exit={{ opacity: 0, translateY: 100, scale: 0.9 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                style={[previewStyles.modalCard, { borderColor: rarityColor, borderWidth: 1 }]}
            >
                <TouchableOpacity onPress={onClose} style={previewStyles.closeButton} disabled={isProcessing}>
                    <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>

                <View style={previewStyles.header}>
                    <MaterialCommunityIcons name="star-four-points" size={16} color={rarityColor} />
                    <Text style={[previewStyles.rarityText, { color: rarityColor }]}>
                        {selectedProduct.rarity?.toUpperCase() || 'COMMON'} {selectedProduct.category === 'UPGRADE' ? 'UPGRADE' : 'ARTIFACT'}
                    </Text>
                </View>

                <View style={previewStyles.stage}>
                    {isVisualCosmetic ? (
                        <View style={{ transform: [{ scale: 0.85 }], alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            {previewClan && (
                                <ClanCard
                                    clan={previewClan}
                                    isDark={true}
                                />
                            )}
                        </View>
                    ) : (
                        <View style={{ backgroundColor: `${rarityColor}15`, borderColor: `${rarityColor}50` }} className="w-40 h-40 rounded-3xl items-center justify-center border-2 shadow-xl">
                            {selectedProduct.visualConfig?.svgCode ? (
                                <RemoteSvgIcon xml={selectedProduct.visualConfig.svgCode} size={80} color={selectedProduct.visualConfig.primaryColor} />
                            ) : (
                                <MaterialCommunityIcons name={selectedProduct.visualConfig?.icon || 'arrow-up-bold-circle'} size={80} color={rarityColor} />
                            )}
                        </View>
                    )}
                </View>

                <View style={previewStyles.detailsContainer}>
                    <Text className="text-2xl font-black text-white text-center mb-1">
                        {selectedProduct.name}
                    </Text>
                    {selectedProduct.expiresInDays && actionType === "buy" && (
                        <Text className="text-xs font-medium text-gray-400 text-center mb-6 uppercase tracking-widest">
                            Duration: {selectedProduct.expiresInDays} Days
                        </Text>
                    )}
                    {actionType === "equip" && (
                        <Text className="text-xs font-medium text-gray-400 text-center mb-6 uppercase tracking-widest">
                            Previewing Artifact
                        </Text>
                    )}

                    <TouchableOpacity
                        disabled={isProcessing}
                        onPress={() => onAction(selectedProduct)}
                        style={[
                            previewStyles.purchaseButton,
                            isProcessing && { opacity: 0.5 },
                            actionType === "equip" && { backgroundColor: isCurrentlyEquipped ? '#ef4444' : '#22c55e' }
                        ]}
                    >
                        {isProcessing ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <>
                                {actionType === "buy" ? (
                                    <>
                                        <Ionicons name="flash" size={18} color="#000" />
                                        <Text className="text-base font-black text-black ml-2 uppercase">
                                            Acquire for {selectedProduct.price} {itemCurrency}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name={isCurrentlyEquipped ? "shield-remove" : "shield-check"} size={18} color="#fff" />
                                        <Text className="text-base font-black text-white ml-2 uppercase">
                                            {isCurrentlyEquipped ? 'Unequip Artifact' : 'Equip Artifact'}
                                        </Text>
                                    </>
                                )}
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </MotiView>
        </View>
    );
});

const previewStyles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
    },
    modalCard: {
        width: width * 0.95,
        backgroundColor: '#111827',
        borderRadius: 32,
        overflow: 'hidden',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 100,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        gap: 6,
    },
    rarityText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
    },
    stage: {
        height: 380,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },
    detailsContainer: {
        padding: 24,
        backgroundColor: '#1f2937',
        borderTopWidth: 1,
        borderColor: '#374151',
    },
    purchaseButton: {
        flexDirection: 'row',
        backgroundColor: '#fbbf24',
        paddingVertical: 16,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

const ItemDescriptionModal = memo(({ isVisible, onClose, selectedProduct, onAction, isProcessing, actionType = "buy" }) => {
    if (!isVisible || !selectedProduct) return null;

    const rarityColor = getRarityColor(selectedProduct.rarity) || '#0ea5e9';
    const itemCurrency = selectedProduct.currency || 'OC';
    const visual = selectedProduct.visualData || selectedProduct.visualConfig || {};

    const isAnimatedItem = ['streak_freeze', 'streak_restore', 'name_change_card', 'name_lock', 'clan_name_change', 'clan_name_lock'].includes(selectedProduct.itemId);

    // Add this helper inside your ItemDescriptionModal component
    const getFallbackDescription = (id) => {
        if (id === 'name_change_card') return "Grants authorization to securely clear and update your profile username across the network.";
        if (id === 'name_lock') return "Establishes a 365-day cryptographic monopoly over your username. No one else can claim it.";
        if (id === 'streak_freeze') return "Pre-emptive passive defense protocol. Automatically consumed to freeze your streak if you miss a 72h window.";
        if (id === 'streak_restore') return "Flashes your database log backward to resurrect a broken streak. Cost scales with streak size.";
        return "System data unavailable. Proceed with caution.";
    };

    return (
        <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
            <View style={descStyles.overlay}>

                {/* Absolute backdrop tap target to safely dismiss modal from outside */}
                <Pressable
                    style={StyleSheet.absoluteFillObject}
                    onPress={onClose}
                    disabled={isProcessing}
                />

                {/* Animated content card anchored right in the center */}
                <MotiView
                    from={{ opacity: 0, translateY: height * 0.3, scale: 0.95 }}
                    animate={{ opacity: 1, translateY: 0, scale: 1 }}
                    exit={{ opacity: 0, translateY: height * 0.3, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 180 }}
                    style={[descStyles.modalCard, { borderColor: `${rarityColor}40`, borderWidth: 1, maxHeight: "100%" }]}
                >
                    {/* Upper close mechanism */}
                    <TouchableOpacity onPress={onClose} style={descStyles.closeButton} disabled={isProcessing}>
                        <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>

                    {/* Content Body (Completely replaced ScrollView with a static, auto-sizing View) */}
                    <View style={descStyles.contentContainer}>
                        <View style={descStyles.header}>
                            <MaterialCommunityIcons name="hexagon-multiple-outline" size={14} color={rarityColor} />
                            <Text style={[descStyles.rarityText, { color: rarityColor }]}>
                                {selectedProduct.rarity?.toUpperCase() || 'STANDARD'} PROTOCOL
                            </Text>
                        </View>

                        {/* The Visual Stage for your updated Animated Items */}
                        <View style={descStyles.stage}>
                            <View style={[descStyles.iconGlow, { backgroundColor: `${rarityColor}15` }]} />
                            {isAnimatedItem ? (
                                <AnimatedItemIcon // ⚡️ CHANGED TO USE YOUR NEW COMPONENT
                                    itemId={selectedProduct.itemId}
                                    primaryColor={visual.primaryColor || rarityColor}
                                    secondaryColor={visual.secondaryColor || '#ffffff'}
                                    size={120}
                                />
                            ) : (
                                <MaterialCommunityIcons name={visual.icon || 'memory'} size={80} color={visual.primaryColor || rarityColor} />
                            )}
                        </View>

                        {/* Text Information block */}
                        <View className="px-4 items-center">
                            <Text className="text-xl font-black text-white text-center mb-2 uppercase tracking-tight">
                                {selectedProduct.name}
                            </Text>
                            <Text className="text-sm font-medium text-zinc-400 text-center leading-relaxed">
                                {selectedProduct.description || getFallbackDescription(selectedProduct.itemId)}
                            </Text>
                        </View>
                    </View>

                    {/* ⚡️ DYNAMIC Purchase / Action Footer */}
                    <View style={descStyles.detailsContainer}>
                        {selectedProduct.expiresInDays && actionType === 'buy' && (
                            <Text className="text-[10px] font-bold text-cyan-400 text-center mb-4 uppercase tracking-widest bg-cyan-500/10 self-center px-2.5 py-1 rounded-md border border-cyan-500/20">
                                Duration: {selectedProduct.expiresInDays} Days
                            </Text>
                        )}

                        {/* If we are just viewing an inventory item, we just show a dismiss/close button */}
                        {actionType === 'view' ? (
                            <TouchableOpacity onPress={onClose} style={[descStyles.purchaseButton, { backgroundColor: '#3f3f46' }]}>
                                <Text className="text-sm font-black text-white uppercase tracking-wide">
                                    Acknowledge
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                disabled={isProcessing}
                                onPress={() => onAction(selectedProduct)}
                                style={[descStyles.purchaseButton, isProcessing && { opacity: 0.5 }]}
                            >
                                {isProcessing ? <ActivityIndicator size="small" color="#000" /> : (
                                    <>
                                        <Ionicons name="hardware-chip" size={18} color="#000" />
                                        <Text className="text-sm font-black text-black ml-2 uppercase tracking-wide">
                                            {actionType === 'use'
                                                ? 'Initialize Sequence'
                                                : `Extract for ${selectedProduct.price} ${itemCurrency}`
                                            }
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </MotiView>

            </View>
        </Modal>
    );
});

const descStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200
    },
    modalCard: {
        width: width * 0.88,
        backgroundColor: '#09090b',
        borderRadius: 28,
        overflow: 'hidden',
        position: 'relative'
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 20,
        padding: 6,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 100
    },
    contentContainer: {
        alignItems: 'center',
        paddingTop: 28,
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 12
    },
    rarityText: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    stage: {
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        position: 'relative',
        marginBottom: 8
    },
    iconGlow: {
        position: 'absolute',
        width: 130,
        height: 130,
        borderRadius: 65,
        opacity: 0.6,
        // Optional soft blur effect if supported, fallback is clean translucent background sizing
        transform: [{ scale: 1.1 }]
    },
    detailsContainer: {
        padding: 20,
        backgroundColor: '#111113',
        borderTopWidth: 1,
        borderColor: '#1f1f23'
    },
    purchaseButton: {
        flexDirection: 'row',
        backgroundColor: '#22d3ee',
        paddingVertical: 14,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center'
    }
});

// 🔹 CLAN STORE MODAL
const ClanStoreModal = memo(({ visible, fetchFullDetails, onClose, isDark, clan }) => {
    const storage = useMMKV();
    const { user } = useUser();
    const { coins, clanCoins, processTransaction, isProcessingTransaction, setCoinData } = useCoins();
    const [isLocalUpdating, setIsLocalUpdating] = useState(false);

    const CustomAlert = useAlert();

    const CACHE_KEY = "CLAN_STORE_CATALOG_V4";
    const isFetching = useRef(false);

    const [catalog, setCatalog] = useState(() => {
        try {
            const cached = storage.getString(CACHE_KEY);
            return cached ? JSON.parse(cached) : { consumables: [], identity: [], verified: [], standaloneItems: [], themes: [] };
        } catch {
            return { consumables: [], identity: [], verified: [], standaloneItems: [], themes: [] };
        }
    });

    const [loading, setLoading] = useState(true);

    // ⚡️ Routing State
    const [currentView, setCurrentView] = useState('ROOT');
    const [selectedTheme, setSelectedTheme] = useState(null);

    // ⚡️ Modal Interaction States (Split based on item type)
    const [itemToPreview, setItemToPreview] = useState(null);   // For cosmetics
    const [itemToDescribe, setItemToDescribe] = useState(null);  // For consumables/identity/badges

    useEffect(() => {
        if (visible) {
            fetchStoreData();
            setCurrentView('ROOT');
        } else {
            setSelectedTheme(null);
            setItemToPreview(null);
            setItemToDescribe(null);
        }
    }, [visible]);

    const fetchStoreData = async () => {
        if (isFetching.current) return;
        isFetching.current = true;
        try {
            const res = await apiFetch(`/store?type=clan`);
            const data = await res.json();

            if (data.success && data.catalog) {
                const newCatalog = {
                    consumables: data.catalog.consumables || [],
                    identity: data.catalog.identity || [],
                    verified: data.catalog.verified || [],
                    standaloneItems: data.catalog.standaloneItems || [],
                    themes: data.catalog.themes || []
                };

                setCatalog(newCatalog);
                storage.set(CACHE_KEY, JSON.stringify(newCatalog));
            }
        } catch (e) {
            console.error("Clan Store fetch error:", e);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    };

    const handleHardwareBack = () => {
        if (currentView === 'THEME_DETAIL') setCurrentView('LIST_THEMES');
        else if (currentView !== 'ROOT') setCurrentView('ROOT');
        else onClose(); // If at root, close the entire modal
    };

    const handleItemClick = (item) => {
        // Decide which modal to open based on category
        const previewCategories = ['WATERMARK', 'BACKGROUND', 'BORDER', 'GLOW', 'AVATAR'];
        if (previewCategories.includes(item.category?.toUpperCase())) {
            setItemToPreview(item);
        } else {
            setItemToDescribe(item);
        }
    };

    const executePurchase = async (item) => {
        const itemCurrency = item.currency || 'CC';
        const currentBalance = itemCurrency === 'CC' ? clanCoins : coins;
        const itemId = item.id || item.itemId;

        if (currentBalance < item.price) {
            CustomAlert("Access Denied", `Insufficient ${itemCurrency} balance in treasury.`);
            return;
        }

        // ⚡️ FORK FOR CLAN IDENTITY & VERIFICATION ITEMS
        if (['clan_name_change', 'clan_name_lock'].includes(itemId)) {
            setIsLocalUpdating(true);
            try {
                const res = await apiFetch('/identity/clan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: { // Passing as an object; apiFetch automatically stringifies it securely
                        deviceId: user.deviceId,
                        context: 'clan',
                        clanId: clan?._id || clan?.tag,
                        actionType: itemId === 'clan_name_change' ? 'name_change' : 'name_lock',
                    }
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    CustomAlert("System Error", errorData.message || "Transaction rejected by server.");
                    return;
                }

                const result = await res.json();

                if (result.success) {
                    CustomAlert("Purchase Complete", result.message);

                    // Note: If using CC, your frontend state might need a dedicated `setClanCoins` equivalent.
                    // If you manage clan coins via the standard setCoinData, update it here.
                    if (typeof fetchFullDetails === 'function') fetchFullDetails();

                    setItemToPreview(null);
                    setItemToDescribe(null);
                } else {
                    CustomAlert("System Error", result.message || "Transaction failed");
                }
            } catch (err) {
                console.error("Clan Identity Purchase Error:", err);
                CustomAlert("Connection Error", "Failed to reach identity matrix.");
            } finally {
                setIsLocalUpdating(false);
            }
            return;
        }

        // --- NORMAL CLAN STORE ITEMS (Cosmetics, Upgrades, Verification) ---
        const result = await processTransaction('buy_item', item.category, {
            itemId: itemId,
            price: item.price,
            name: item.name,
            category: item.category || 'MISC',
            currency: itemCurrency,
            description: item.description,
            visualConfig: item.visualData || item.visualConfig,
            expiresInDays: item.durationDays || item.expiresInDays,
            rarity: item.rarity,
            url: item.url
        });

        if (result.success) {
            CustomAlert("Treasury Updated", "Asset integrated into clan inventory.");
            if (typeof fetchFullDetails === 'function') fetchFullDetails();
            setItemToPreview(null);
            setItemToDescribe(null);
        } else {
            CustomAlert("System Error", result.error || "Transaction failed");
        }
    };

    // --- RENDER HELPERS ---
    const renderCompactCard = (item) => {
        const visual = item.visualData || item.visualConfig || {};
        const isBorder = item.category === 'BORDER';
        const imageUrl = item.url || visual.url || visual.imageUrl;
        const isSkiaItem = ['clan_name_change', 'clan_name_lock'].includes(item.itemId);
        const cardRarityColor = getRarityColor(item.rarity) || '#3b82f6';

        // Define standard icons for non-visual items
        let fallbackIcon = 'star';
        if (item.category === 'VERIFIED') fallbackIcon = 'check-decagram';
        if (item.category === 'UPGRADE') fallbackIcon = 'memory';
        if (item.category === 'IDENTITY') fallbackIcon = 'fingerprint';

        return (
            <TouchableOpacity
                key={item.id || item.itemId}
                onPress={() => handleItemClick(item)}
                className="bg-[#121212] mr-4 p-4 rounded-2xl w-40 border border-zinc-800 shadow-sm mb-4"
                style={{ borderBottomWidth: 3, borderBottomColor: cardRarityColor }}
            >
                <View className="mb-3">
                    <View className="h-24 w-full bg-black/50 rounded-xl items-center justify-center overflow-hidden border border-white/5 relative">
                        {isSkiaItem ? (
                            <AnimatedItemIcon itemId={item.itemId} primaryColor={visual.primaryColor} secondaryColor={visual.secondaryColor} size={60} />
                        ) : isBorder ? (
                            <ClanBorder color={visual.primaryColor || visual.color || "#ff0000"} secondaryColor={visual.secondaryColor} animationType={visual.animationType} duration={visual.duration}>
                                <View className="h-10 flex justify-center items-center"><Text className="text-[10px] text-white/50 font-black uppercase">Frame</Text></View>
                            </ClanBorder>
                        ) : imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                        ) : visual.svgCode ? (
                            <RemoteSvgIcon xml={visual.svgCode} color={visual.glowColor || visual.primaryColor || visual.color} size={50} />
                        ) : (
                            <MaterialCommunityIcons name={visual.icon || fallbackIcon} size={40} color={visual.primaryColor || 'white'} />
                        )}
                        <View style={{ backgroundColor: cardRarityColor }} className="absolute top-2 right-2 w-2 h-2 rounded-full shadow-lg" />
                    </View>
                </View>
                <Text className="text-white font-black text-[11px] uppercase tracking-tight" numberOfLines={1}>{item.name}</Text>

                <View className="flex-row items-center mt-2 justify-between">
                    <View className="flex-row items-center bg-cyan-500/10 px-2 py-1 rounded-md">
                        <Text className="text-cyan-400 font-black text-[10px] mr-1">{item.price}</Text>
                        <CoinIcon type={item.currency || "CC"} size={10} />
                    </View>
                    <Ionicons name="scan-outline" size={16} color="#52525b" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleHardwareBack}>
            {/* Background Tap Overlay */}
            <Pressable className="flex-1 bg-black/80 justify-end" onPress={handleHardwareBack}>
                {/* Modal Container */}
                <Pressable onPress={(e) => e.stopPropagation()} className="bg-[#09090b] h-[85%] rounded-t-[32px] p-6 border-t border-x border-cyan-500/30">

                    {/* Header Bar */}
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            {currentView !== 'ROOT' && (
                                <TouchableOpacity onPress={handleHardwareBack} className="mr-3 p-2 bg-zinc-900 rounded-full border border-zinc-800">
                                    <Ionicons name="chevron-back" size={20} color="#22d3ee" />
                                </TouchableOpacity>
                            )}
                            <View>
                                <Text className="text-2xl font-black uppercase italic tracking-wider text-white">
                                    {currentView === 'ROOT' ? "Clan Vault" :
                                        currentView === 'LIST_CONSUMABLES' ? "Network Boosts" :
                                            currentView === 'LIST_IDENTITY' ? "Identity Cards" :
                                                currentView === 'LIST_VERIFIED' ? "Verification" :
                                                    currentView === 'LIST_UPGRADES' ? "Garrison Upgrades" :
                                                        currentView === 'LIST_THEMES' ? "Thematic Cores" :
                                                            selectedTheme?.label || "Database"}
                                </Text>
                                <View className="flex-row items-center mt-1 bg-zinc-900 self-start px-3 py-1 rounded-md border border-zinc-800">
                                    <Text className="text-green-400 font-black text-[10px] uppercase mr-1.5">CC: {clanCoins || 0}</Text>
                                    <CoinIcon type="CC" size={10} />
                                    <Text className="text-gray-600 mx-2">|</Text>
                                    <Text className="text-cyan-500 font-black text-[10px] uppercase mr-1.5">OC: {coins || 0}</Text>
                                    <CoinIcon type="OC" size={10} />
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity onPress={onClose} className="bg-zinc-900 p-3 rounded-full border border-zinc-800">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Content Area */}
                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#06b6d4" />
                            <Text className="text-cyan-500 font-black uppercase text-xs mt-4 tracking-[0.3em]">Connecting to vault...</Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                            {/* === ROOT VIEW: Hub Grid === */}
                            {currentView === 'ROOT' && (
                                <View className="flex-row flex-wrap justify-between">

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_VERIFIED')} className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View className="bg-yellow-500/20 p-4 rounded-2xl mb-3"><MaterialCommunityIcons name="check-decagram" size={36} color="#eab308" /></View>
                                        <Text className="text-white font-black uppercase text-sm text-center tracking-tight">Verification</Text>
                                        <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">Subscriptions</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_THEMES')} className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View className="bg-cyan-500/20 p-4 rounded-2xl mb-3"><MaterialCommunityIcons name="layers-triple-outline" size={36} color="#06b6d4" /></View>
                                        <Text className="text-white font-black uppercase text-sm text-center tracking-tight">Thematic Cores</Text>
                                        <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">Visual Overhauls</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_CONSUMABLES')} className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View className="bg-blue-500/20 p-4 rounded-2xl mb-3"><MaterialCommunityIcons name="broadcast" size={36} color="#3b82f6" /></View>
                                        <Text className="text-white font-black uppercase text-sm text-center tracking-tight">Boosts</Text>
                                        <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">Network Multipliers</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_IDENTITY')} className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View className="bg-purple-500/20 p-4 rounded-2xl mb-3"><MaterialCommunityIcons name="shield-lock-outline" size={36} color="#a855f7" /></View>
                                        <Text className="text-white font-black uppercase text-sm text-center tracking-tight">Identity</Text>
                                        <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">Network Protection</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_UPGRADES')} className="w-full h-24 bg-[#121212] flex-row justify-between items-center px-6 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View>
                                            <Text className="text-white font-black uppercase text-sm tracking-tight">Garrison Upgrades</Text>
                                            <Text className="text-gray-500 text-[10px] mt-1 uppercase">Expand Capacity</Text>
                                        </View>
                                        <View className="bg-emerald-500/20 p-3 rounded-2xl"><MaterialCommunityIcons name="memory" size={28} color="#10b981" /></View>
                                    </TouchableOpacity>

                                </View>
                            )}

                            {/* === ITEM LISTS === */}
                            {['LIST_CONSUMABLES', 'LIST_IDENTITY', 'LIST_UPGRADES', 'LIST_VERIFIED'].includes(currentView) && (
                                <View className="flex-row flex-wrap justify-between">
                                    {catalog[
                                        currentView === 'LIST_CONSUMABLES' ? 'consumables' :
                                            currentView === 'LIST_IDENTITY' ? 'identity' :
                                                currentView === 'LIST_VERIFIED' ? 'verified' : 'standaloneItems'
                                    ]?.map(item => (
                                        <View key={item.id || item.itemId} className="w-[48%] mb-4">
                                            {renderCompactCard(item)}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* === THEMES LOGIC === */}
                            {currentView === 'LIST_THEMES' && (
                                <View className="flex-row flex-wrap justify-between">
                                    {catalog.themes?.map((theme) => (
                                        <TouchableOpacity
                                            key={theme.id}
                                            onPress={() => { setSelectedTheme(theme); setCurrentView('THEME_DETAIL'); }}
                                            className="w-[48%] bg-[#121212] p-6 rounded-3xl mb-4 items-center border border-zinc-800 shadow-sm"
                                        >
                                            <View className="mb-4"><RemoteSvgIcon imageUrl={theme.iconImg} xml={theme.iconsvg} color="#06b6d4" size={70} /></View>
                                            <Text className="text-white font-black uppercase mt-1 text-center text-[11px]">{theme.label}</Text>
                                            <View className="bg-zinc-800 px-2 py-1 rounded-md mt-2">
                                                <Text className="text-gray-400 text-[8px] uppercase font-bold">{theme.items?.length || 0} Items</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {currentView === 'THEME_DETAIL' && selectedTheme && (
                                <View>
                                    {['BACKGROUND', "WATERMARK", 'GLOW', 'BORDER'].map((cat) => {
                                        const themeItems = selectedTheme.items?.filter(i => i.category?.toUpperCase() === cat) || [];
                                        if (themeItems.length === 0) return null;
                                        return (
                                            <View key={cat} className="mb-6">
                                                <View className="flex-row items-center mb-3">
                                                    <View className="w-1.5 h-1.5 bg-cyan-500 mr-2 transform rotate-45" />
                                                    <Text className="text-cyan-500 font-black uppercase text-[10px] tracking-[0.2em]">{cat}S</Text>
                                                </View>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    {themeItems.map(item => renderCompactCard(item))}
                                                </ScrollView>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    )}
                </Pressable>
            </Pressable>

            {/* Conditional Modals */}
            <ClanItemPreviewModal
                isVisible={!!itemToPreview}
                onClose={() => setItemToPreview(null)}
                currentClan={clan}
                selectedProduct={itemToPreview}
                onAction={executePurchase}
                isProcessing={isProcessingTransaction || isLocalUpdating}
                actionType="buy"
            />

            <ItemDescriptionModal
                isVisible={!!itemToDescribe}
                onClose={() => setItemToDescribe(null)}
                selectedProduct={itemToDescribe}
                onAction={executePurchase}
                isProcessing={isProcessingTransaction || isLocalUpdating}
                actionType="buy"
            />
        </Modal>
    );
});

const ClanInventoryModal = memo(({ visible, onClose, fetchFullDetails, clan, isDark, user }) => {
    const CustomAlert = useAlert();

    // --- STATE ---
    const [isUpdating, setIsUpdating] = useState(false);
    const [currentView, setCurrentView] = useState('ROOT');
    const [itemToPreview, setItemToPreview] = useState(null);

    // Reset view when modal closes
    useEffect(() => {
        if (!visible) {
            setCurrentView('ROOT');
            setItemToPreview(null);
        }
    }, [visible]);

    const handleHardwareBack = () => {
        if (currentView !== 'ROOT') setCurrentView('ROOT');
        else onClose();
    };

    const handleItemClick = (item) => {
        // All clan items (Frames, Backgrounds) currently use the Preview Modal
        setItemToPreview(item);
    };

    // --- DATA PROCESSING & GROUPINGS ---
    let inventory = clan?.specialInventory ? [...clan.specialInventory] : [];

    const nameLockItem = inventory.find(i => i.itemId === 'clan_name_lock');
    const consumables = inventory.filter(i => i.category === 'IDENTITY' && i.itemId !== 'clan_name_lock');
    const environment = inventory.filter(i => ['WATERMARK', 'BACKGROUND'].includes(i.category));
    const auras = inventory.filter(i => ['BORDER', 'GLOW'].includes(i.category));

    // --- VERIFICATION ALLOWANCE TRACKING ---
    const now = new Date();
    const expiry = new Date(clan?.verifiedUntil);
    const isVerifiedActive = clan?.verifiedUntil && expiry > now;

    const getVerifiedItem = () => {
        if (!isVerifiedActive) return null;
        return {
            itemId: 'active_verification_status',
            name: `${clan.activeCustomizations?.verifiedTier || 'Clan'} Verification`,
            category: 'VERIFIED',
            isEquipped: true,
            expiresAt: clan?.verifiedUntil,
            visualConfig: {
                svgCode: clan.activeCustomizations?.verifiedBadgeXml,
                primaryColor: clan.activeCustomizations?.verifiedTier === 'premium' ? '#facc15' :
                    clan.activeCustomizations?.verifiedTier === 'standard' ? '#ef4444' : '#3b82f6'
            }
        };
    };

    const verifiedItem = getVerifiedItem();

    // --- ACTIONS ---
    const handleEquipToggle = async (selectedItem) => {
        if (selectedItem.itemId === 'active_verification_status') return;
        if (isUpdating) return;
        setIsUpdating(true);

        try {
            const res = await apiFetch(`/clans/${clan.tag}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: user.deviceId,
                    action: "EQUIP_ITEM",
                    payload: { itemId: selectedItem.itemId }
                })
            });

            const data = await res.json();
            if (res.ok) {
                if (typeof fetchFullDetails === 'function') fetchFullDetails();
                setItemToPreview(null);
            } else {
                throw new Error(data.message || "Jutsu failed to activate");
            }
        } catch (err) {
            console.error("Equip Error:", err);
            CustomAlert("Scroll Error", "Connection to the village lost.");
        } finally {
            setIsUpdating(false);
        }
    };

    // --- RENDER HELPERS ---
    const getExpirationText = (expiryDate) => {
        if (!expiryDate) return null;
        const diff = new Date(expiryDate) - new Date();
        if (diff <= 0) return "Expired";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days}d remaining`;
        return `${Math.floor(diff / (1000 * 60 * 60))}h remaining`;
    };

    const getListForCurrentView = () => {
        switch (currentView) {
            case 'ENVIRONMENT': return environment;
            case 'AURAS': return auras;
            case 'CONSUMABLES': return consumables;
            default: return [];
        }
    };

    // --- UI COMPONENTS ---
    const renderCategoryCard = (title, subtitle, icon, count, viewId, colorHex) => (
        <TouchableOpacity
            onPress={() => setCurrentView(viewId)}
            className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black"
            style={{ borderBottomWidth: 3, borderBottomColor: colorHex }}
        >
            <View className="p-4 rounded-2xl mb-3" style={{ backgroundColor: `${colorHex}20` }}>
                <MaterialCommunityIcons name={icon} size={36} color={colorHex} />
            </View>
            <Text className="text-white font-black uppercase text-sm text-center tracking-tight">{title}</Text>
            <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">{subtitle}</Text>
            <View className="absolute top-3 right-3 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
                <Text className="text-white font-bold text-[10px]">{count}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderSquareCard = (item) => {
        const expiration = getExpirationText(item.expiresAt);
        const isExpired = expiration === "Expired";
        const isBorder = item.category === 'BORDER';
        const isSkiaItem = ['clan_name_change', 'clan_name_lock'].includes(item.itemId);

        const visual = item.visualConfig || item.visualData || {};
        const cardRarityColor = getRarityColor(item.rarity) || '#3b82f6';
        const imageUrl = item.url || visual.url || visual.imageUrl;

        return (
            <TouchableOpacity
                key={item.itemId || item.id}
                onPress={() => handleItemClick(item)}
                className={`bg-[#121212] mr-4 p-4 rounded-3xl w-[46%] border shadow-sm mb-4 justify-between ${item.isEquipped ? 'bg-blue-500/10 border-blue-500' : 'border-zinc-800'} ${isExpired ? 'opacity-50 border-red-500/30' : ''}`}
                style={{ borderBottomWidth: 3, borderBottomColor: cardRarityColor }}
            >
                <View className="h-24 w-full bg-black/50 rounded-xl items-center justify-center overflow-hidden border border-white/5 relative mb-3">
                    {isSkiaItem ? (
                        <AnimatedItemIcon itemId={item.itemId} primaryColor={visual.primaryColor} secondaryColor={visual.secondaryColor} size={60} />
                    ) : isBorder ? (
                        <ClanBorder color={visual.primaryColor || visual.color || "#ff0000"} secondaryColor={visual.secondaryColor} animationType={visual.animationType} duration={visual.duration}>
                            <View className="h-10 flex justify-center items-center">
                                <Text className="text-[10px] text-white/50 font-black uppercase">Frame</Text>
                            </View>
                        </ClanBorder>
                    ) : imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                    ) : visual.svgCode ? (
                        <RemoteSvgIcon xml={visual.svgCode} color={visual.primaryColor || visual.color} size={50} />
                    ) : (
                        <MaterialCommunityIcons name={visual.icon || 'star'} size={40} color={visual.primaryColor || 'white'} />
                    )}
                    <View style={{ backgroundColor: cardRarityColor }} className="absolute top-2 right-2 w-2 h-2 rounded-full shadow-lg" />
                </View>

                <Text className="text-white font-black text-[11px] uppercase tracking-tight text-center" numberOfLines={1}>{item.name}</Text>
                {expiration && <Text className="text-gray-500 text-[8px] text-center mt-0.5 uppercase tracking-widest">{expiration}</Text>}

                <View className="mt-3 w-full">
                    {isExpired ? (
                        <View className="w-full py-2 bg-red-500/10 rounded-xl border border-red-500/20 items-center">
                            <Text className="text-red-500 text-[10px] font-black uppercase">Voided</Text>
                        </View>
                    ) : item.category === 'IDENTITY' ? (
                        <View className="w-full py-2 bg-zinc-800 rounded-xl items-center flex-row justify-center">
                            <MaterialCommunityIcons name="layers" size={12} color="#a1a1aa" />
                            <Text className="text-zinc-400 text-[10px] font-black uppercase ml-1">Stock: {item.itemCount || 1}</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            disabled={isUpdating}
                            onPress={() => handleEquipToggle(item)}
                            className={`w-full py-2 rounded-xl items-center ${item.isEquipped ? 'bg-green-500' : 'bg-blue-600'} ${isUpdating ? 'opacity-50' : ''}`}
                        >
                            {isUpdating ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white text-[10px] font-black uppercase">{item.isEquipped ? 'Active' : 'Equip'}</Text>}
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleHardwareBack}>
            <Pressable className="flex-1 bg-black/80 justify-end" onPress={handleHardwareBack}>
                <Pressable onPress={(e) => e.stopPropagation()} className="bg-[#09090b] h-[90%] rounded-t-[32px] p-6 border-t border-x border-blue-500/30">

                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            {currentView !== 'ROOT' && (
                                <TouchableOpacity onPress={handleHardwareBack} className="mr-3 p-2 bg-zinc-900 rounded-full border border-zinc-800">
                                    <Ionicons name="chevron-back" size={20} color="#3b82f6" />
                                </TouchableOpacity>
                            )}
                            <View>
                                <Text className="text-2xl font-black uppercase italic tracking-wider text-white">
                                    {currentView === 'ROOT' ? "Clan Arsenal" : currentView}
                                </Text>
                                <Text className="text-blue-500 font-black text-[10px] uppercase tracking-widest">
                                    {currentView === 'ROOT' ? `${inventory.length} Total Assets` : `${getListForCurrentView().length} Secured Items`}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-zinc-900 p-3 rounded-full border border-zinc-800">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                        {/* ROOT MENU VIEW */}
                        {currentView === 'ROOT' && (
                            <>
                                {/* 🛡️ Name Lock Banner */}
                                {nameLockItem && (
                                    <View
                                        className="w-full bg-[#121212] rounded-3xl p-5 mb-4 border border-yellow-500/50 shadow-lg flex-row items-center justify-between"
                                        style={{ borderBottomWidth: 4, borderBottomColor: '#eab308' }}
                                    >
                                        <View className="flex-row items-center flex-1">
                                            <View className="bg-yellow-500/10 w-16 h-16 rounded-2xl items-center justify-center border border-yellow-500/20 mr-4">
                                                <AnimatedItemIcon itemId="clan_name_lock" primaryColor="#eab308" secondaryColor="#fde047" size={40} />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-yellow-500 font-black uppercase text-xs tracking-widest mb-1">Identity Lock Active</Text>
                                                <LiveCountdown expiresAt={nameLockItem.expiresAt} />
                                            </View>
                                        </View>
                                        <MaterialCommunityIcons name="shield-lock-outline" size={28} color="#eab308" style={{ opacity: 0.3 }} />
                                    </View>
                                )}

                                {/* 🛡️ Active Verification & Allowance Tracker */}
                                {verifiedItem && (
                                    <View
                                        className="w-full bg-[#121212] rounded-3xl p-5 mb-6 border shadow-lg"
                                        style={{ borderBottomWidth: 4, borderBottomColor: verifiedItem.visualConfig.primaryColor, borderColor: `${verifiedItem.visualConfig.primaryColor}40` }}
                                    >
                                        <View className="flex-row items-center justify-between mb-4 border-b border-white/5 pb-4">
                                            <View className="flex-row items-center flex-1">
                                                <View className="w-12 h-12 rounded-2xl items-center justify-center border mr-4" style={{ backgroundColor: `${verifiedItem.visualConfig.primaryColor}15`, borderColor: `${verifiedItem.visualConfig.primaryColor}30` }}>
                                                    {verifiedItem.visualConfig.svgCode ? (
                                                        <RemoteSvgIcon xml={verifiedItem.visualConfig.svgCode} color={verifiedItem.visualConfig.primaryColor} size={30} />
                                                    ) : (
                                                        <MaterialCommunityIcons name="check-decagram" size={30} color={verifiedItem.visualConfig.primaryColor} />
                                                    )}
                                                </View>
                                                <View className="flex-1">
                                                    <Text style={{ color: verifiedItem.visualConfig.primaryColor }} className="font-black uppercase text-xs tracking-widest mb-1">
                                                        {verifiedItem.name}
                                                    </Text>
                                                    <Text className="text-gray-400 font-bold text-[10px] uppercase">
                                                        {getExpirationText(verifiedItem.expiresAt)}
                                                    </Text>
                                                </View>
                                            </View>
                                            <MaterialCommunityIcons name="shield-check" size={24} color={verifiedItem.visualConfig.primaryColor} style={{ opacity: 0.5 }} />
                                        </View>

                                        {/* Allowance Breakdown */}
                                        <Text className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-3">Cycle Allowances</Text>

                                        <View className="flex-row items-center justify-between bg-black/40 p-3 rounded-xl mb-2">
                                            <View className="flex-row items-center">
                                                <MaterialCommunityIcons name="form-textbox-password" size={16} color="#8b5cf6" />
                                                <Text className="text-white font-bold text-[11px] ml-2">Free Name Change</Text>
                                            </View>
                                            <Text className={`font-black text-xs ${clan?.allowances?.freeNameChanges > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                                {clan?.allowances?.freeNameChanges || 0} left
                                            </Text>
                                        </View>

                                        {clan.activeCustomizations?.verifiedTier === 'premium' && (
                                            <View className="flex-row items-center justify-between bg-black/40 p-3 rounded-xl mb-2">
                                                <View className="flex-row items-center">
                                                    <MaterialCommunityIcons name="auto-fix" size={16} color="#a855f7" />
                                                    <Text className="text-white font-bold text-[11px] ml-2">Post Resurrection</Text>
                                                </View>
                                                <Text className={`font-black text-xs ${clan?.allowances?.postResurrections > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                                    {clan?.allowances?.postResurrections || 0} left
                                                </Text>
                                            </View>
                                        )}

                                        <View className="flex-row items-center justify-between bg-black/40 p-3 rounded-xl">
                                            <View className="flex-row items-center">
                                                <Ionicons name="snow" size={16} color="#0ea5e9" />
                                                <Text className="text-white font-bold text-[11px] ml-2">Passive Streak Freeze</Text>
                                            </View>
                                            <Text className={`font-black text-xs uppercase ${clan?.allowances?.passiveStreakFreezeActive ? 'text-blue-400' : 'text-gray-500'}`}>
                                                {clan?.allowances?.passiveStreakFreezeActive ? 'Active' : 'Locked'}
                                            </Text>
                                        </View>

                                    </View>
                                )}

                                {/* Category Grid */}
                                <View className="flex-row flex-wrap justify-between mt-2">
                                    {renderCategoryCard("Auras & Frames", "Border Effects", "shield-sun", auras.length, "AURAS", "#ef4444")}
                                    {renderCategoryCard("Card Layout", "BGs & Watermarks", "image-filter-hdr", environment.length, "ENVIRONMENT", "#06b6d4")}
                                    {renderCategoryCard("Consumables", "Patches & Chips", "battery-charging-high", consumables.length, "CONSUMABLES", "#8b5cf6")}
                                </View>
                            </>
                        )}

                        {/* LIST VIEW (Items for selected category) */}
                        {currentView !== 'ROOT' && (
                            <View className="flex-row flex-wrap justify-between">
                                {getListForCurrentView().length > 0 ? (
                                    getListForCurrentView().map(item => renderSquareCard(item))
                                ) : (
                                    <View className="w-full items-center mt-20 opacity-30">
                                        <MaterialCommunityIcons name="package-variant-closed" size={80} color="gray" />
                                        <Text className="mt-4 font-black uppercase text-xs tracking-widest text-white">Archive Empty</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>

            {/* ⚡️ Clan Item Preview Modal */}
            <ClanItemPreviewModal
                isVisible={!!itemToPreview}
                onClose={() => setItemToPreview(null)}
                currentClan={clan}
                selectedProduct={itemToPreview}
                onAction={handleEquipToggle}
                isProcessing={isUpdating}
                actionType={itemToPreview?.category === 'IDENTITY' ? "view" : "equip"}
            />
        </Modal>
    );
});

// --- LIVE COUNTDOWN COMPONENT FOR NAME LOCK ---
const LiveCountdown = ({ expiresAt }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!expiresAt) return;
        const interval = setInterval(() => {
            const diff = new Date(expiresAt) - new Date();
            if (diff <= 0) {
                setTimeLeft('EXPIRED');
                clearInterval(interval);
            } else {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const m = Math.floor((diff / 1000 / 60) % 60);
                const s = Math.floor((diff / 1000) % 60);
                setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    return (
        <Text className="text-yellow-400 font-black text-lg tracking-widest" style={{ fontVariant: ['tabular-nums'] }}>
            {timeLeft}
        </Text>
    );
};

// --- Sub Components

const WarHistoryItem = memo(({ war, clanTag }) => {

    const isWinner = war.winner === clanTag;
    const isDraw = war.winner === "DRAW";
    const opponent = war.challengerTag === clanTag ? war.defenderTag : war.challengerTag;

    const challengerScore = war.currentProgress?.challengerScore || 0;
    const defenderScore = war.currentProgress?.defenderScore || 0;

    return (
        <View className="px-6 mb-4">
            <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-3xl">
                <View className="flex-row justify-between items-center mb-4">
                    <View className="flex-row items-center gap-x-2">
                        <MaterialCommunityIcons
                            name={isDraw ? "scale-balance" : (isWinner ? "trophy-outline" : "skull-outline")}
                            size={20}
                            color={isDraw ? "#9ca3af" : (isWinner ? "#eab308" : "#ef4444")}
                        />
                        <Text className={`font-black uppercase text-[10px] ${isDraw ? 'text-gray-400' : (isWinner ? 'text-yellow-500' : 'text-red-500')}`}>
                            {isDraw ? "Stalemate" : (isWinner ? "Victory" : "Defeated")}
                        </Text>
                    </View>
                    <Text className="text-gray-400 font-bold text-[8px] uppercase">
                        {new Date(war.updatedAt).toLocaleDateString()}
                    </Text>
                </View>

                <View className="flex-row justify-between items-center bg-gray-50 dark:bg-zinc-950 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                    <View className="items-center flex-1">
                        <Text className="text-black dark:text-white font-black text-xs uppercase">{clanTag}</Text>
                        <Text className="text-blue-500 font-black text-sm mt-1">
                            {war.challengerTag === clanTag ? challengerScore : defenderScore}
                        </Text>
                    </View>
                    <Text className="px-4 text-gray-400 font-black italic">VS</Text>
                    <View className="items-center flex-1">
                        <Text className="text-black dark:text-white font-black text-xs uppercase">{opponent}</Text>
                        <Text className="text-gray-400 font-black text-sm mt-1">
                            {war.challengerTag === clanTag ? defenderScore : challengerScore}
                        </Text>
                    </View>
                </View>

                <View className="mt-4 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-x-1">
                        <MaterialCommunityIcons name="sword-cross" size={12} color="#6b7280" />
                        <Text className="text-gray-500 font-bold text-[8px] uppercase tracking-widest">{war.warType} WAR</Text>
                    </View>
                    <View className="bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                        <Text className="text-blue-500 font-black text-[9px] uppercase">
                            Prize: {war.prizePool * 2} Points
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
});

const ExpansionRow = memo(({ icon, glowColor, label, subLabel, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-100 dark:border-zinc-800"
    >
        <View className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full items-center justify-center border border-gray-100 dark:border-zinc-700">
            <MaterialCommunityIcons name={icon} size={20} color={glowColor} />
        </View>
        <View className="flex-1 ml-4">
            <Text className="text-black dark:text-white font-black text-[10px] uppercase">{label}</Text>
            <Text className="text-gray-400 text-[8px] font-bold uppercase">{subLabel}</Text>
        </View>
        <Feather name="chevron-right" size={16} color="#9ca3af" />
    </TouchableOpacity>
));

const StatCard = memo(({ label, value, icon, isCoin, glowColor }) => (
    <View className="w-[48%] bg-white dark:bg-zinc-900/50 p-5 rounded-[30px] mb-4 border border-gray-100 dark:border-zinc-800 shadow-sm">
        <MaterialCommunityIcons name={icon} size={20} color={glowColor || "#3b82f6"} />
        <Text className="text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest mt-2">{label}</Text>
        <View className="flex-row items-center mt-1">
            <Text style={isCoin ? { color: "#9333ea" } : null} className="text-lg font-black mt-1 dark:text-white">{value?.toLocaleString() || 0} </Text>
            {isCoin && <CoinIcon size={20} type="CC" />}
        </View>
    </View>
));

const StatRow = memo(({ label, value, highlight, color }) => (
    <View className="flex-row justify-between px-4 py-4 border-b border-gray-100 dark:border-zinc-900/50 last:border-0">
        <Text className="text-gray-500 dark:text-gray-400 font-bold text-[11px] uppercase">{label}</Text>
        <Text className={`font-black text-xs ${highlight ? '' : 'text-black dark:text-white'}`} style={highlight ? { color: color } : {}}>
            {value || 0}
        </Text>
    </View>
));

const MemberItem = memo(({
    member,
    roleLabel,
    canManage,
    isLeader,
    onKick,
    onAppoint,
    accent,
    isProcessingAction,
    isDark
}) => {
    const router = useRouter();

    const handleProfilePress = () => {
        router.push(`/author/${member._id}`);
    };

    return (
        <Pressable
            onPress={handleProfilePress}
            style={({ pressed }) => [
                {
                    backgroundColor: isDark
                        ? (pressed ? 'rgba(39, 39, 42, 0.98)' : 'rgba(24, 24, 27, 0.95)')
                        : (pressed ? 'rgba(244, 244, 245, 0.98)' : 'rgba(255, 255, 255, 0.95)'),
                    transform: [{ scale: pressed ? 0.98 : 1 }]
                }
            ]}
            className="flex-row items-center mb-3 p-4 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm"
        >
            <View
                className="shadow-sm"
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                }}
            >
                <Image
                    source={{ uri: member.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
                    contentFit="cover"
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        borderWidth: 2,
                    }}
                />
            </View>

            <View className="flex-1 ml-4">
                <Text className="text-black dark:text-white font-black uppercase text-sm tracking-tighter">
                    {member.username}
                </Text>
                <View
                    style={{ backgroundColor: `${accent}15`, alignSelf: 'flex-start' }}
                    className="px-2 py-0.5 rounded-md mt-1"
                >
                    <Text
                        style={{ color: accent }}
                        className="text-[9px] font-black uppercase tracking-widest"
                    >
                        {roleLabel}
                    </Text>
                </View>
            </View>

            <View className="flex-row items-center gap-x-2">
                {isLeader && roleLabel !== "Kage" && roleLabel !== "Jonin" && (
                    <TouchableOpacity
                        onPress={onAppoint}
                        disabled={isProcessingAction}
                        className="bg-blue-500/10 w-10 h-10 items-center justify-center rounded-2xl border border-blue-500/20"
                    >
                        {isProcessingAction ? (
                            <ActivityIndicator size="small" color="#3b82f6" />
                        ) : (
                            <MaterialCommunityIcons name="shield-star-outline" size={20} color="#3b82f6" />
                        )}
                    </TouchableOpacity>
                )}

                {canManage && (
                    <TouchableOpacity
                        onPress={onKick}
                        disabled={isProcessingAction}
                        className="bg-red-500/10 w-10 h-10 items-center justify-center rounded-2xl border border-red-500/20"
                    >
                        {isProcessingAction ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                            <MaterialCommunityIcons name="sword-cross" size={20} color="#ef4444" />
                        )}
                    </TouchableOpacity>
                )}

                <View className="ml-1">
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={isDark ? "#3f3f46" : "#d1d5db"}
                    />
                </View>
            </View>
        </Pressable>
    );
});

const AdminToggle = memo(({ label, status, onPress, appBlue, isDark }) => {
    const isOpen = status === 'OPEN';

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                {
                    backgroundColor: isDark ? 'rgba(45, 45, 50, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                    borderColor: isOpen ? appBlue : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                    borderWidth: 1.5,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                    shadowColor: isOpen ? appBlue : "#000",
                    shadowOpacity: isOpen ? 0.4 : 0.1,
                    shadowRadius: 10,
                    elevation: 5
                }
            ]}
            className="p-5 rounded-[32px] flex-row justify-between items-center mb-4"
        >
            <View>
                <Text className={`font-black uppercase text-[13px] tracking-[2px] ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {label}
                </Text>
                <View className="flex-row items-center mt-1">
                    <View className={`w-1.5 h-1.5 rounded-full mr-2 ${isOpen ? 'bg-green-500' : 'bg-zinc-500'}`} />
                    <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-tighter">
                        {isOpen ? 'Access Unlocked' : 'Access Restricted'}
                    </Text>
                </View>
            </View>

            <View
                style={{ backgroundColor: isOpen ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }}
                className="w-12 h-12 rounded-2xl items-center justify-center border border-white/5"
            >
                <Ionicons
                    name={isOpen ? "lock-open" : "lock-closed"}
                    size={20}
                    color={isOpen ? "#22c55e" : "#ef4444"}
                />
            </View>
        </Pressable>
    );
});

const RequestItem = memo(({ user, onApprove, onDecline, appBlue, isDark, isProcessingAction }) => {
    const isDisabled = !!isProcessingAction;
    const [currentProcess, setCurrentProcess] = useState("")
    return (
        <View
            style={{
                backgroundColor: isDark ? 'rgba(39, 39, 42, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                borderWidth: 1.5,
            }}
            className="flex-row items-center mb-3 p-4 rounded-[28px]"
        >
            <Image
                source={{ uri: user?.profilePic?.url || "https://oreblogda.com/default-avatar.png" }}
                contentFit="cover"
                style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: appBlue }}
            />

            <View className="flex-1 ml-4">
                <Text className={`font-black text-xs ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {user?.username || 'Rogue'}
                </Text>
                <Text className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mt-0.5">
                    Awaiting Auth
                </Text>
            </View>

            <View className="flex-row space-x-2">
                <Pressable
                    onPress={() => {
                        onApprove();
                        setCurrentProcess("approving");
                    }}
                    disabled={isDisabled}
                    style={({ pressed }) => ({
                        backgroundColor: isProcessingAction && currentProcess === 'approving' ? appBlue : 'rgba(255,255,255,0.05)',
                        borderColor: appBlue,
                        borderWidth: 1,
                        opacity: isDisabled && isProcessingAction && currentProcess !== 'approving' ? 0.3 : 1,
                        transform: [{ scale: pressed ? 0.95 : 1 }]
                    })}
                    className="w-11 h-11 rounded-2xl items-center justify-center"
                >
                    {isProcessingAction && currentProcess === 'approving' ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Ionicons name="checkmark-sharp" size={18} color={isDark ? "white" : appBlue} />
                    )}
                </Pressable>

                <Pressable
                    onPress={() => {
                        onDecline();
                        setCurrentProcess("declining");
                    }}
                    disabled={isDisabled}
                    style={({ pressed }) => ({
                        backgroundColor: isProcessingAction && currentProcess === 'declining' ? '#ef4444' : 'rgba(255,255,255,0.05)',
                        borderColor: '#ef4444',
                        borderWidth: 1,
                        opacity: isDisabled && isProcessingAction && currentProcess !== 'declining' ? 0.3 : 1,
                        transform: [{ scale: pressed ? 0.95 : 1 }]
                    })}
                    className="w-11 h-11 rounded-2xl items-center justify-center"
                >
                    {isProcessingAction && currentProcess === 'declining' ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Ionicons name="close-sharp" size={18} color={isDark ? "white" : "#ef4444"} />
                    )}
                </Pressable>
            </View>
        </View>
    );
});

export default React.memo(ClanProfile)