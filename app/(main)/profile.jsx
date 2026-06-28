import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list"; // ⚡️ High-Performance List
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { requestPermissionsAsync } from 'expo-media-library';
import { useRouter } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import * as Sharing from "expo-sharing";
import { MotiView } from 'moti';
import { useColorScheme as useNativeWind } from "nativewind";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    DeviceEventEmitter,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useMMKV } from "react-native-mmkv";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import Toast from "react-native-toast-message";
import ViewShot from "react-native-view-shot";
import useSWRInfinite from "swr/infinite";
import AppOnboarding from "../../components/AppOnboarding";
import AuraAvatar from "../../components/AuraAvatar";
import ClanBorder from "../../components/ClanBorder";
import CoinIcon from "../../components/ClanIcon";
import AnimatedItemIcon from "../../components/ConsumableSkiaIcon";
import ImageEditorModal from "../../components/ImageEditorModal";
import NeuralPinModal from "../../components/NeuralPinModal";
import PlayerCard from "../../components/PlayerCard";
import PlayerNameplate from "../../components/PlayerNameplate";
import { SyncLoading } from "../../components/SyncLoading";
import { Text } from "../../components/Text";
import TitleTag from "../../components/TitleTag";
import { useAlert } from "../../context/AlertContext";
import { useCoins } from "../../context/CoinContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";

const { width, height } = Dimensions.get("window");
const LIMIT = 5;

const fetcher = (url) => apiFetch(url).then((res) => res.json());

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

// ==========================================
// 🔹 UTILITY CLASSES & CONSTANTS
// ==========================================
const getAuraTier = (rank) => {
    const MONARCH_GOLD = '#fbbf24';
    const JADE_GREEN = '#10b981';
    const SHADOW_PURPLE = '#a855f7';
    const STEEL_BLUE = '#3b82f6';
    const ESPADA_0 = '#f43f5e';
    const ESPADA_1 = '#e11d48';
    const ESPADA_2 = '#be123c';
    const ESPADA_3 = '#9f1239';
    const ESPADA_4 = '#881337';
    const ESPADA_5 = '#4c0519';

    const fallback = { color: '#64748b', label: 'PLAYER', icon: 'shield-check' };

    if (!rank || rank > 10 || rank <= 0) return fallback;

    switch (rank) {
        case 1: return { color: MONARCH_GOLD, label: 'MONARCH', icon: 'crown' };
        case 2: return { color: JADE_GREEN, label: 'YONKO', icon: 'flare' };
        case 3: return { color: SHADOW_PURPLE, label: 'KAGE', icon: 'moon-waxing-crescent' };
        case 4: return { color: STEEL_BLUE, label: 'SHOGUN', icon: 'shield-star' };
        case 5: return { color: ESPADA_0, label: 'ESPADA 0', icon: 'skull' };
        case 6: return { color: ESPADA_1, label: 'ESPADA 1', icon: 'sword-cross' };
        case 7: return { color: ESPADA_2, label: 'ESPADA 2', icon: 'sword-cross' };
        case 8: return { color: ESPADA_3, label: 'ESPADA 3', icon: 'sword-cross' };
        case 9: return { color: ESPADA_4, label: 'ESPADA 4', icon: 'sword-cross' };
        case 10: return { color: ESPADA_5, label: 'ESPADA 5', icon: 'sword-cross' };
        default: return { color: '#1e293b', label: 'VANGUARD', icon: 'shield-check' };
    }
}

const AURA_TIERS = [
    { level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", color: "#94a3b8" },
    { level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", color: "#34d399" },
    { level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", color: "#f87171" },
    { level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", color: "#a78bfa" },
    { level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", color: "#60a5fa" },
    { level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", color: "#fcd34d" },
    { level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", color: "#f472b6" },
    { level: 8, req: 12000, title: "Monarch", icon: "👑", color: "#fbbf24" },
];

const resolveUserRank = (level, currentAura) => {
    const safeLevel = Math.max(1, Math.min(8, level || 1));
    const currentTier = AURA_TIERS[safeLevel - 1];
    const nextTier = AURA_TIERS[safeLevel] || currentTier;

    let progress = 100;
    if (safeLevel < 8) {
        progress = ((currentAura - currentTier.req) / (nextTier.req - currentTier.req)) * 100;
    }

    return {
        title: currentTier.title.toUpperCase().replace(/ /g, "_"),
        icon: currentTier.icon,
        color: currentTier.color,
        progress: Math.min(Math.max(progress, 0), 100),
        req: currentTier.req,
        nextReq: nextTier.req
    };
}

const ProfileActionButton = memo(({ icon, color, onPress, label }) => (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: `${color}15`, borderColor: `${color}40` }} className="w-12 h-12 rounded-2xl items-center justify-center border mb-3 shadow-sm active:scale-90">
        <MaterialCommunityIcons name={icon} size={22} color={color} />
        <Text style={{ color, fontSize: 6 }} className="font-black uppercase mt-1">{label}</Text>
    </TouchableOpacity>
));

// ==========================================
// 🔹 MEMOIZED SUB-MODALS
// ==========================================

const ItemPreviewModal = memo(({ isVisible, onClose, currentUser, selectedProduct, onAction, isProcessing, actionType = "buy" }) => {
    const previewUser = useMemo(() => {
        if (!currentUser || !selectedProduct) return null;
        const filteredInventory = (currentUser.inventory || []).map(item => {
            if (item.category === selectedProduct.category) return { ...item, isEquipped: false };
            return item;
        });
        const normalizedProduct = { ...selectedProduct, isEquipped: true, visualConfig: selectedProduct.visualConfig || selectedProduct.visualData || {} };
        return { ...currentUser, inventory: [...filteredInventory, normalizedProduct] };
    }, [currentUser, selectedProduct]);

    if (!isVisible || !selectedProduct) return null;
    const rarityColor = getRarityColor(selectedProduct.rarity);
    const itemCurrency = selectedProduct.currency || 'OC';
    const isCurrentlyEquipped = currentUser?.inventory?.find(i => i.itemId === selectedProduct.itemId)?.isEquipped;

    return (
        <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
            <Pressable style={previewStyles.overlay} onPress={onClose} disabled={isProcessing}>
                <MotiView
                    from={{ opacity: 0, translateY: 100, scale: 0.9 }}
                    animate={{ opacity: 1, translateY: 0, scale: 1 }}
                    exit={{ opacity: 0, translateY: 100, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    style={[previewStyles.modalCard, { borderColor: rarityColor, borderWidth: 1, maxHeight: '85%' }]}
                >
                    <Pressable style={{ flexShrink: 1, width: '100%' }} onPress={(e) => e.stopPropagation()}>
                        <TouchableOpacity onPress={onClose} style={previewStyles.closeButton} disabled={isProcessing}>
                            <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }} showsVerticalScrollIndicator={false} bounces={false}>
                            <View style={previewStyles.header}>
                                <MaterialCommunityIcons name="star-four-points" size={16} color={rarityColor} />
                                <Text style={[previewStyles.rarityText, { color: rarityColor }]}>{selectedProduct.rarity?.toUpperCase() || 'COMMON'} ITEM</Text>
                            </View>
                            <View style={previewStyles.stage}>
                                <View style={{ transform: [{ scale: 0.75 }], alignItems: 'center', justifyContent: 'center' }}>
                                    <PlayerCard author={previewUser} totalPosts={currentUser?.totalPosts || 0} isDark={true} />
                                </View>
                            </View>
                        </ScrollView>
                        <View style={previewStyles.detailsContainer}>
                            <Text className="text-2xl font-black text-white text-center mb-1">{selectedProduct.name}</Text>
                            {selectedProduct.expiresInDays && actionType === "buy" && (
                                <Text className="text-xs font-medium text-gray-400 text-center mb-6 uppercase tracking-widest">Duration: {selectedProduct.expiresInDays} Days</Text>
                            )}
                            {actionType === "equip" && (
                                <Text className="text-xs font-medium text-gray-400 text-center mb-6 uppercase tracking-widest">Previewing Item</Text>
                            )}
                            <TouchableOpacity
                                disabled={isProcessing}
                                onPress={() => onAction(selectedProduct)}
                                style={[previewStyles.purchaseButton, isProcessing && { opacity: 0.5 }, actionType === "equip" && { backgroundColor: isCurrentlyEquipped ? '#ef4444' : '#22c55e' }]}
                            >
                                {isProcessing ? <ActivityIndicator size="small" color="#000" /> : (
                                    <>
                                        {actionType === "buy" ? (
                                            <><Ionicons name="flash" size={18} color="#000" /><Text className="text-base font-black text-black ml-2 uppercase">Unlock for {selectedProduct.price} {itemCurrency}</Text></>
                                        ) : (
                                            <><MaterialCommunityIcons name={isCurrentlyEquipped ? "shield-remove" : "shield-check"} size={18} color="#fff" /><Text className="text-base font-black text-white ml-2 uppercase">{isCurrentlyEquipped ? 'Unequip Item' : 'Equip Item'}</Text></>
                                        )}
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </MotiView>
            </Pressable>
        </Modal>
    );
});

const previewStyles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 200 },
    modalCard: { width: width * 0.9, backgroundColor: '#111827', borderRadius: 32, overflow: 'hidden' },
    closeButton: { position: 'absolute', top: 16, right: 16, zIndex: 20, padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 6 },
    rarityText: { fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    stage: { height: 380, justifyContent: 'center', alignItems: 'center', paddingVertical: 10 },
    detailsContainer: { padding: 24, backgroundColor: '#1f2937', borderTopWidth: 1, borderColor: '#374151' },
    purchaseButton: { flexDirection: 'row', backgroundColor: '#fbbf24', paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }
});

const ItemDescriptionModal = memo(({ isVisible, onClose, selectedProduct, onAction, isProcessing, actionType = "buy" }) => {
    if (!isVisible || !selectedProduct) return null;

    const rarityColor = getRarityColor(selectedProduct.rarity) || '#0ea5e9';
    const itemCurrency = selectedProduct.currency || 'OC';
    const visual = selectedProduct.visualData || selectedProduct.visualConfig || {};

    const isAnimatedItem = ['streak_freeze', 'streak_restore', 'name_change_card', 'name_lock'].includes(selectedProduct.itemId);

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

const SecurityModal = memo(({ visible, onClose, user, setUser, isDark }) => {
    const CustomAlert = useAlert();
    const [pinModalVisible, setPinModalVisible] = useState(false);
    const [emailModalVisible, setEmailModalVisible] = useState(false);
    const [email, setEmail] = useState(user?.email || "");
    const [isSettingEmail, setIsSettingEmail] = useState(false);
    const [requirePin, setRequirePin] = useState(false);
    const [isChangePin, setIsChangePin] = useState(false);

    const getSecurityLevelText = (level) => {
        switch (level) { case 1: return "Device Only"; case 2: return "PIN Protected"; case 3: return "Email Verified"; default: return "Unknown"; }
    };

    const getSecurityLevelColor = (level) => {
        switch (level) { case 1: return "#ef4444"; case 2: return "#f59e0b"; case 3: return "#22c55e"; default: return "#6b7280"; }
    };

    const handleChangePin = () => {
        setRequirePin(false); setIsChangePin(user?.securityLevel >= 2); setPinModalVisible(true);
    };

    const handleSetEmail = async () => {
        if (!email.trim()) { CustomAlert("Error", "Please enter a valid email address."); return; }
        if (user?.securityLevel === 1) { CustomAlert("Error", "You need to have a PIN before setting email."); return; }

        if (user?.securityLevel === 2 || user?.securityLevel === 3) {
            setRequirePin(true); setIsChangePin(false); setPinModalVisible(true);
        } else {
            setIsSettingEmail(true);
            try {
                const res = await apiFetch('/mobile/secure-uplink', { method: 'POST', body: JSON.stringify({ uid: user.uid, email: email.trim() }) });
                const data = await res.json();
                if (res.ok) {
                    setUser({ ...user, email: email.trim(), securityLevel: data.securityLevel });
                    CustomAlert("Success", "Email has been set successfully!");
                    setEmailModalVisible(false); setRequirePin(false);
                    if (data.accessToken && data.refreshToken) {
                        await SecureStore.setItemAsync('userToken', data.accessToken);
                        await SecureStore.setItemAsync('refreshToken', data.refreshToken);
                    }
                } else { CustomAlert("Error", data.message || "Failed to set email."); }
            } catch (err) { CustomAlert("Error", "Failed to set email. Please try again."); } finally { setIsSettingEmail(false); }
        }
    };

    const handlePinVerifiedForEmail = async (enteredPin) => {
        setPinModalVisible(false); setIsSettingEmail(true);
        try {
            const res = await apiFetch('/mobile/secure-uplink', { method: 'POST', body: JSON.stringify({ uid: user.uid, pin: enteredPin, email: email.trim() }) });
            const data = await res.json();
            if (res.ok) {
                setUser({ ...user, email: email.trim(), securityLevel: data.securityLevel });
                CustomAlert("Success", "Email has been set successfully!");
                setEmailModalVisible(false);
                if (data.accessToken && data.refreshToken) {
                    await SecureStore.setItemAsync('userToken', data.accessToken);
                    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
                }
            } else { CustomAlert("Error", data.message || "Failed to set email."); }
        } catch (err) { CustomAlert("Error", "Failed to set email. Please try again."); } finally { setIsSettingEmail(false); }
    };

    const handleChangePinSubmit = async (oldPinValue, newPinValue) => {
        setPinModalVisible(false);
        try {
            const res = await apiFetch('/mobile/changepin', { method: 'POST', body: JSON.stringify({ uid: user.uid, oldPin: oldPinValue, newPin: newPinValue }) });
            const data = await res.json();
            if (res.ok) {
                CustomAlert('Success', 'PIN has been updated successfully!');
                setUser({ ...user, securityLevel: data.securityLevel || user.securityLevel });
            } else { CustomAlert('Error', data.message || 'Failed to change PIN.'); }
        } catch (err) { CustomAlert('Error', 'Failed to change PIN. Please try again.'); }
    };

    const levelColor = getSecurityLevelColor(user?.securityLevel);

    return (
        <>
            <Modal visible={visible} animationType="fade" transparent>
                <View className={`flex-1 items-center justify-center p-6 ${isDark ? 'bg-black/80' : 'bg-black/50'}`}>
                    <View className={`w-full p-8 rounded-[40px] border-2 shadow-2xl ${isDark ? 'bg-[#0d1117] border-gray-800' : 'bg-white border-gray-100'}`} style={{ shadowColor: levelColor, shadowOpacity: 0.2 }}>
                        <Text className={`text-2xl font-black uppercase italic mb-8 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>Security Settings</Text>
                        <View className="space-y-8">
                            <View className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                                <Text className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-4">Current Security Level</Text>
                                <View className="flex-row items-center justify-between mb-4 space-x-2">
                                    {[1, 2, 3].map((step) => (
                                        <View key={step} className="flex-1 h-3 rounded-full" style={{ backgroundColor: user?.securityLevel >= step ? levelColor : (isDark ? '#1f2937' : '#e5e7eb'), opacity: user?.securityLevel >= step ? 1 : 0.5 }} />
                                    ))}
                                </View>
                                <Text style={{ color: levelColor }} className="text-lg font-black uppercase italic">{getSecurityLevelText(user?.securityLevel)}</Text>
                            </View>
                            <View>
                                <Text className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 ml-1">PIN Protection</Text>
                                <View className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                                    <Text className={`text-sm mb-5 font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{user?.securityLevel > 1 ? "Change your 6-digit PIN for enhanced security." : "Set up a 6-digit PIN to protect your account."}</Text>
                                    <TouchableOpacity onPress={handleChangePin} className="bg-blue-600 py-4 rounded-2xl items-center active:opacity-80 shadow-lg shadow-blue-600/30">
                                        <Text className="text-white font-black uppercase tracking-widest text-xs">{user?.securityLevel > 1 ? "Change PIN" : "Set PIN"}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View>
                                <Text className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 ml-1">Email Verification</Text>
                                <View className={`p-5 rounded-3xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                                    <Text className={`text-sm mb-5 font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{user?.email ? `Current email: ${user.email}` : "Add an email address for account recovery."}</Text>
                                    {user?.email ? (
                                        <View className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20 items-center">
                                            <Text className="text-green-500 text-xs font-black uppercase tracking-widest">✓ Verified Connection</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity onPress={() => setEmailModalVisible(true)} className="bg-green-600 py-4 rounded-2xl items-center active:opacity-80 shadow-lg shadow-green-600/30">
                                            <Text className="text-white font-black uppercase tracking-widest text-xs">Set Email</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} className="mt-10 p-2 items-center">
                            <Text className="text-gray-500 text-[11px] font-black uppercase tracking-[3px] underline">Close Terminal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <NeuralPinModal
                visible={pinModalVisible}
                onSuccess={async (result) => {
                    if (requirePin) { await handlePinVerifiedForEmail(result); setRequirePin(false); }
                    else if (isChangePin) { if (result?.oldPin && result?.newPin) { await handleChangePinSubmit(result.oldPin, result.newPin); } }
                    else { setPinModalVisible(false); CustomAlert("Success", "PIN has been updated!"); }
                    setIsChangePin(false);
                }}
                onClose={() => { setPinModalVisible(false); setRequirePin(false); setIsChangePin(false); }}
                returnPinOnly={requirePin}
                changePin={isChangePin}
            />

            <Modal visible={emailModalVisible} animationType="fade" transparent>
                <View className={`flex-1 items-center justify-center p-6 ${isDark ? 'bg-black/90' : 'bg-black/60'}`}>
                    <View className={`w-full p-8 rounded-[40px] border-2 border-green-500 shadow-2xl shadow-green-500/20 ${isDark ? 'bg-[#0d1117]' : 'bg-white'}`}>
                        <Text className={`text-xl font-black uppercase italic mb-8 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>Set Email Address</Text>
                        <View className="space-y-4">
                            <Text className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Uplink Address</Text>
                            <TextInput
                                value={email} onChangeText={setEmail} placeholder="Enter your email address" placeholderTextColor={isDark ? "#4b5563" : "#9ca3af"} keyboardType="email-address" autoCapitalize="none"
                                className={`p-5 rounded-2xl font-bold border ${isDark ? 'bg-gray-900 text-white border-gray-800' : 'bg-gray-50 text-gray-900 border-gray-200'}`}
                            />
                        </View>
                        <TouchableOpacity onPress={handleSetEmail} disabled={isSettingEmail} className="bg-green-600 p-5 rounded-2xl items-center mt-8 active:opacity-80 shadow-lg shadow-green-600/30">
                            {isSettingEmail ? <ActivityIndicator color="white" /> : <Text className="text-white font-black uppercase tracking-widest text-sm">Update Email</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEmailModalVisible(false)} className="mt-6 p-2 items-center">
                            <Text className="text-gray-500 text-[11px] font-black uppercase tracking-widest underline">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
});

const AuthorStoreModal = memo(({ visible, onClose, user, isDark, setInventory }) => {
    const { coins, processTransaction, isProcessingTransaction, setCoinData } = useCoins();
    const [isLocalUpdating, setIsLocalUpdating] = useState(false)
    const storage = useMMKV();
    const CustomAlert = useAlert();
    const CACHE_KEY = "STORE_CATALOG_CACHE_V3";

    const [catalog, setCatalog] = useState(() => {
        try {
            const cached = storage.getString(CACHE_KEY);
            return cached ? JSON.parse(cached) : { consumables: [], identity: [], standaloneItems: [], themes: [] };
        } catch { return { consumables: [], identity: [], standaloneItems: [], themes: [] }; }
    });

    const [loading, setLoading] = useState(true);
    const isFetching = useRef(false);

    // Routing State
    const [currentView, setCurrentView] = useState('ROOT');
    const [selectedTheme, setSelectedTheme] = useState(null);

    // Modal Interaction States (Split based on item type)
    const [itemToPreview, setItemToPreview] = useState(null);    // For cosmetics
    const [itemToDescribe, setItemToDescribe] = useState(null);  // For consumables/identity

    useEffect(() => {
        if (visible) {
            loadStoreData();
            setCurrentView('ROOT');
        } else {
            setItemToPreview(null);
            setItemToDescribe(null);
            setSelectedTheme(null);
        }
    }, [visible]);

    const loadStoreData = async () => {
        if (isFetching.current) return;
        isFetching.current = true;
        try {
            const res = await apiFetch('/store?type=author');
            const data = await res.json();
            if (data.success && data.catalog) {
                const newCatalog = {
                    consumables: data.catalog.consumables || [],
                    identity: data.catalog.identity || [],
                    standaloneItems: data.catalog.standaloneItems || [],
                    themes: data.catalog.themes || []
                };
                setCatalog(newCatalog);
                storage.set(CACHE_KEY, JSON.stringify(newCatalog));
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); isFetching.current = false; }
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
        const itemCurrency = item.currency || 'OC';
        const itemId = item.id || item.itemId;

        if (coins < item.price) {
            CustomAlert("Access Denied", `Insufficient ${itemCurrency} balance.`);
            return;
        }

        // ⚡️ FORK FOR IDENTITY ITEMS
        if (itemId === 'name_change_card' || itemId === 'name_lock') {
            setIsLocalUpdating(true)
            try {
                const res = await apiFetch('/identity/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: { // Passing as an object; apiFetch automatically stringifies it securely
                        deviceId: user.deviceId,
                        context: 'user',
                        actionType: itemId === 'name_change_card' ? 'name_change' : 'name_lock',
                    }
                });

                // Check if the response was successful before trying to parse JSON
                if (!res.ok) {
                    const errorData = await res.json();
                    CustomAlert("System Error", errorData.message || "Transaction rejected by server.");
                    return;
                }

                const result = await res.json();

                if (result.success) {
                    CustomAlert("Purchase Complete", result.message);

                    // ⚡️ UPDATE THE COIN CONTEXT INSTANTLY
                    setCoinData({ balance: result.balance });
                    if (typeof setInventory === 'function') setInventory(result.inventory);

                    setItemToPreview(null);
                    setItemToDescribe(null);
                } else {
                    CustomAlert("System Error", result.message || "Transaction failed");
                }
            } catch (err) {
                console.error("Identity Purchase Catch Error:", err);

                const errorString = err.toString();
                // 🧠 DETECT EXPO STREAMING CRASH EXPLOIT/BUG
                const isStreamingBug = errorString.includes("startStreaming") ||
                    errorString.includes("enqueue") ||
                    errorString.includes("state that permits");

                if (isStreamingBug) {
                    // The transaction went through on the server safely! Sync the balance state locally.
                    CustomAlert("Extraction Authorized", "Asset secured in inventory matrix. Synchronizing local counters...");

                    // Silent state recovery: Fetch fresh coin values to clear out the local cache lag
                    if (typeof fetchCoins === 'function') fetchCoins();

                    setItemToPreview(null);
                    setItemToDescribe(null);
                } else {
                    CustomAlert("Connection Error", "Failed to reach identity matrix.");
                }
            } finally {
                setIsLocalUpdating(false)
            }
            return;
        }

        // --- NORMAL STORE ITEMS (Cosmetics, etc) ---
        const result = await processTransaction('buy_item', item.category, {
            itemId: itemId,
            price: item.price,
            name: item.name,
            category: item.category || 'MISC',
            currency: itemCurrency,
            description: item.description, // ⚡️ ADD THIS LINE HERE
            visualConfig: item.visualData || item.visualConfig,
            expiresInDays: item.expiresInDays,
            rarity: item.rarity,
            url: item.url
        });

        if (result.success) {
            CustomAlert("Download Complete", "Asset integrated into your inventory.");
            if (typeof setInventory === 'function') setInventory(result.inventory);
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
        const isSkiaItem = ['streak_freeze', 'streak_restore', 'name_change_card', 'name_lock'].includes(item.itemId);
        const cardRarityColor = getRarityColor(item.rarity) || '#3b82f6';

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
                            <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                        ) : visual.svgCode ? (
                            <RemoteSvgIcon xml={visual.svgCode} color={visual.glowColor || visual.primaryColor || visual.color} size={50} />
                        ) : (
                            <MaterialCommunityIcons name={visual.icon || 'hexagon-outline'} size={40} color={visual.primaryColor || 'white'} />
                        )}
                        <View style={{ backgroundColor: cardRarityColor }} className="absolute top-2 right-2 w-2 h-2 rounded-full shadow-lg" />
                    </View>
                </View>
                <Text className="text-white font-black text-[11px] uppercase tracking-tight" numberOfLines={1}>{item.name}</Text>

                <View className="flex-row items-center mt-2 justify-between">
                    <View className="flex-row items-center bg-cyan-500/10 px-2 py-1 rounded-md">
                        <Text className="text-cyan-400 font-black text-[10px] mr-1">{item.price}</Text>
                        <CoinIcon type={item.currency || "OC"} size={10} />
                    </View>
                    <Ionicons name="scan-outline" size={16} color="#52525b" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        // `onRequestClose` fires when the hardware back button is pressed on Android
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleHardwareBack}>
            {/* Background Tap Overlay */}
            <Pressable className="flex-1 bg-black/80 justify-end" onPress={handleHardwareBack}>
                {/* Modal Container: Stop propagation so tapping inside doesn't close */}
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
                                    {currentView === 'ROOT' ? "Black Market" :
                                        currentView === 'LIST_CONSUMABLES' ? "Consumables" :
                                            currentView === 'LIST_IDENTITY' ? "Identity Cards" :
                                                currentView === 'LIST_STANDALONE' ? "Upgrades" :
                                                    currentView === 'LIST_THEMES' ? "Thematic Cores" :
                                                        selectedTheme?.label || "Database"}
                                </Text>
                                <View className="flex-row items-center mt-1 bg-zinc-900 self-start px-3 py-1 rounded-md border border-zinc-800">
                                    {/* Changed CREDITS to OC */}
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
                            <Text className="text-cyan-500 font-black uppercase text-xs mt-4 tracking-[0.3em]">Connecting to network...</Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                            {/* === ROOT VIEW: 2x2 Grid Hub === */}
                            {currentView === 'ROOT' && (
                                <View className="flex-row flex-wrap justify-between">

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_CONSUMABLES')} className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View className="bg-blue-500/20 p-4 rounded-2xl mb-3"><MaterialCommunityIcons name="battery-charging-high" size={36} color="#3b82f6" /></View>
                                        <Text className="text-white font-black uppercase text-sm text-center tracking-tight">Consumables</Text>
                                        <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">Hardware Patches</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_IDENTITY')} className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View className="bg-purple-500/20 p-4 rounded-2xl mb-3"><MaterialCommunityIcons name="fingerprint" size={36} color="#a855f7" /></View>
                                        <Text className="text-white font-black uppercase text-sm text-center tracking-tight">Identity</Text>
                                        <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">Network Modifiers</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_STANDALONE')} className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View className="bg-emerald-500/20 p-4 rounded-2xl mb-3"><MaterialCommunityIcons name="memory" size={36} color="#10b981" /></View>
                                        <Text className="text-white font-black uppercase text-sm text-center tracking-tight">Upgrades</Text>
                                        <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">Standalone Tech</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setCurrentView('LIST_THEMES')} className="w-[48%] aspect-square bg-[#121212] flex-col justify-center items-center p-4 rounded-3xl border border-zinc-800 mb-4 shadow-lg shadow-black">
                                        <View className="bg-cyan-500/20 p-4 rounded-2xl mb-3"><MaterialCommunityIcons name="layers-triple-outline" size={36} color="#06b6d4" /></View>
                                        <Text className="text-white font-black uppercase text-sm text-center tracking-tight">Thematic Cores</Text>
                                        <Text className="text-gray-500 text-[10px] text-center mt-1 uppercase">Visual Overhauls</Text>
                                    </TouchableOpacity>

                                </View>
                            )}

                            {/* === ITEM LISTS === */}
                            {(currentView === 'LIST_CONSUMABLES' || currentView === 'LIST_IDENTITY' || currentView === 'LIST_STANDALONE') && (
                                <View className="flex-row flex-wrap justify-between">
                                    {catalog[
                                        currentView === 'LIST_CONSUMABLES' ? 'consumables' :
                                            currentView === 'LIST_IDENTITY' ? 'identity' : 'standaloneItems'
                                    ].map(item => (
                                        <View key={item.id || item.itemId} className="w-[48%] mb-4">
                                            {renderCompactCard(item)}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* === THEMES LOGIC === */}
                            {currentView === 'LIST_THEMES' && (
                                <View className="flex-row flex-wrap justify-between">
                                    {catalog.themes.map((theme) => (
                                        <TouchableOpacity
                                            key={theme.id}
                                            onPress={() => { setSelectedTheme(theme); setCurrentView('THEME_DETAIL'); }}
                                            className="w-[48%] bg-[#121212] p-6 rounded-3xl mb-4 items-center border border-zinc-800 shadow-sm"
                                        >
                                            <View className="mb-4"><RemoteSvgIcon imageUrl={theme.iconImg} xml={theme.iconsvg} color="#06b6d4" size={70} /></View>
                                            <Text className="text-white font-black uppercase mt-1 text-center text-[11px]">{theme.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {currentView === 'THEME_DETAIL' && selectedTheme && (
                                <View>
                                    {['BACKGROUND', "WATERMARK", 'GLOW', 'BORDER', 'AVATAR'].map((cat) => {
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
            <ItemPreviewModal
                isVisible={!!itemToPreview}
                onClose={() => setItemToPreview(null)}
                currentUser={user}
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

const HYPE_TIERS = {
    FREE: { cost: 0, points: 50, label: 'FREE HYPE', rarity: 'COMMON', abbr: 'FH', colors: ['#475569', '#1e293b', '#0f172a'], glow: '#94a3b8' },
    STANDARD: { cost: 20, points: 100, label: 'STANDARD', rarity: 'RARE', abbr: 'SH', colors: ['#0284c7', '#0369a1', '#082f49'], glow: '#38bdf8' },
    SUPER: { cost: 100, points: 600, label: 'SUPER HYPE', rarity: 'EPIC', abbr: 'SP', colors: ['#9333ea', '#6b21a8', '#3b0764'], glow: '#c084fc' },
    MEGA: { cost: 400, points: 3000, label: 'MEGA BLAST', rarity: 'LEGENDARY', abbr: 'ME', colors: ['#d97706', '#92400e', '#451a03'], glow: '#fbbf24' }
};

const HypeIconDisplay = memo(({ tierKey, color, size = 26 }) => {
    const renderLayout = () => {
        if (tierKey === 'ME') {
            return (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={size * 0.8} color={color} style={{ marginBottom: -12, zIndex: 2 }} />
                    <View style={{ flexDirection: 'row' }}>
                        <MaterialCommunityIcons name="lightning-bolt" size={size * 0.8} color={color} style={{ marginRight: -8 }} />
                        <MaterialCommunityIcons name="lightning-bolt" size={size * 0.8} color={color} style={{ marginLeft: -8 }} />
                    </View>
                </View>
            );
        }
        if (tierKey === 'SP') {
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={size * 1.1} color={color} style={{ marginRight: -12 }} />
                    <MaterialCommunityIcons name="lightning-bolt" size={size * 1.1} color={color} style={{ marginLeft: -13 }} />
                </View>
            );
        }
        return <MaterialCommunityIcons name="lightning-bolt" size={size * 1.3} color={color} />;
    };

    return (
        <View style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
            <MotiView from={{ opacity: 0.3, scale: 0.85 }} animate={{ opacity: 0.8, scale: 1.15 }} transition={{ type: 'timing', duration: 1000, loop: true, direction: 'alternate' }} style={{ position: 'absolute', textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>
                {renderLayout()}
            </MotiView>
            <View style={{ position: 'absolute' }}>{renderLayout()}</View>
        </View>
    );
})

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

const AuthorInventoryModal = memo(({ visible, onClose, user, setUser, isDark, theinventory, refreshStreak }) => {
    const CustomAlert = useAlert();
    const inventory = theinventory?.length > 0 ? theinventory : user?.inventory || [];

    // --- STATE ---
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatingTitle, setUpdatingTitle] = useState(null);
    const [currentView, setCurrentView] = useState('ROOT');

    const [itemToPreview, setItemToPreview] = useState(null);
    const [itemToDescribe, setItemToDescribe] = useState(null);

    // --- CATEGORY GROUPINGS ---
    const nameLockItem = inventory.find(i => i.itemId === 'name_lock');
    const consumables = inventory.filter(i => ['STREAK_MODIFIER', 'IDENTITY'].includes(i.category) && i.itemId !== 'name_lock');
    const hypes = inventory.filter(i => i.category === 'HYPE');
    const avatars = inventory.filter(i => ['AVATAR', 'AVATAR_VFX'].includes(i.category));
    const environment = inventory.filter(i => ['WATERMARK', 'BACKGROUND'].includes(i.category));
    const auras = inventory.filter(i => ['BORDER', 'GLOW'].includes(i.category));
    const titles = user?.unlockedTitles || [];

    useEffect(() => {
        if (!visible) {
            setCurrentView('ROOT');
            setItemToPreview(null);
            setItemToDescribe(null);
        }
    }, [visible]);

    const handleHardwareBack = () => {
        if (currentView !== 'ROOT') setCurrentView('ROOT');
        else onClose();
    };

    const handleItemClick = (item) => {
        const previewCategories = ['WATERMARK', 'BACKGROUND', 'BORDER', 'GLOW', 'AVATAR', 'AVATAR_VFX'];
        if (previewCategories.includes(item.category?.toUpperCase())) {
            setItemToPreview(item);
        } else {
            setItemToDescribe(item);
        }
    };

    // --- ACTIONS ---
    const handleEquipToggle = async (selectedItem) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            const updatedInventory = inventory.map(item => {
                if (item.itemId === selectedItem.itemId) return { ...item, isEquipped: !item.isEquipped };
                if (item.category === selectedItem.category && selectedItem.category !== 'STICKER' && !selectedItem.isEquipped) {
                    return { ...item, isEquipped: false };
                }
                return item;
            });

            const formData = new FormData();
            formData.append("userId", user?._id || "");
            formData.append("fingerprint", user?.deviceId || "");
            // ⚡️ OPTIMIZATION: ONLY send the inventory array!
            formData.append("inventory", JSON.stringify(updatedInventory));

            const res = await apiFetch(`/users/upload`, { method: "PUT", body: formData });
            const result = await res.json();

            if (res.ok) {
                setUser(result.user);
                setItemToPreview(null);
            } else {
                throw new Error(result.message || "Sync failed");
            }
        } catch (err) {
            CustomAlert("Error", "Failed to sync equipment changes.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleEquipTitle = async (selectedTitle) => {
        if (isUpdating) return;
        setIsUpdating(true);
        setUpdatingTitle(selectedTitle.name);
        try {
            const formData = new FormData();
            formData.append("userId", user?._id || "");
            formData.append("fingerprint", user?.deviceId || "");

            const titleName = user?.equippedTitle?.name || "";
            const isCurrentlyEquipped = titleName === selectedTitle.name;
            const newEquippedTitle = isCurrentlyEquipped ? null : { name: selectedTitle.name, tier: selectedTitle.tier };

            // ⚡️ OPTIMIZATION: ONLY send the new title!
            formData.append("equippedTitle", newEquippedTitle ? JSON.stringify(newEquippedTitle) : "");

            const res = await apiFetch(`/users/upload`, { method: "PUT", body: formData });
            const result = await res.json();
            if (res.ok) { setUser(result.user); } else { throw new Error(result.message || "Sync failed"); }
        } catch (err) {
            CustomAlert("Error", "Failed to sync title changes.");
        } finally {
            setIsUpdating(false);
            setUpdatingTitle(null);
        }
    };

    const handleConsumeAction = (item) => {
        if (item.itemId === 'streak_freeze') {
            CustomAlert(
                "Activate Freeze Protocol",
                "Do you want to initialize the Streak Freeze? Once activated, it will lock your streak safely for 48 hours.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Initialize",
                        onPress: async () => {
                            if (isUpdating) return;
                            setIsUpdating(true);
                            try {
                                const res = await apiFetch('/streak/action', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        deviceId: user.deviceId,
                                        actionType: 'streak_freeze'
                                    })
                                });

                                const result = await res.json();

                                if (result.success) {
                                    CustomAlert("Protocol Engaged", result.message);
                                    if (typeof refreshStreak === 'function') refreshStreak();
                                    if (typeof setUser === 'function') {
                                        setUser(prev => ({ ...prev, inventory: result.inventory }));
                                    }
                                    setItemToDescribe(null);
                                } else {
                                    CustomAlert("Initialization Failed", result.message || "Could not freeze streak.");
                                }
                            } catch (err) {
                                console.error("Streak Freeze Error:", err);
                                CustomAlert("Connection Error", "Failed to reach matrix servers.");
                            } finally {
                                setIsUpdating(false);
                            }
                        }
                    }
                ]
            );
        } else {
            handleItemClick(item);
        }
    };

    // --- RENDER HELPERS ---
    const getExpirationText = (expiry) => {
        if (!expiry) return null;
        const diff = new Date(expiry) - new Date();
        if (diff <= 0) return "Expired";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days}d remaining`;
        return `${Math.floor(diff / (1000 * 60 * 60))}h remaining`;
    };

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

    const renderSquareCard = (item, isTitleRow = false) => {
        if (isTitleRow) {
            const isEquipped = user?.equippedTitle?.name === item.name;
            const isThisTitleUpdating = isUpdating && updatingTitle === item.name;
            return (
                <TouchableOpacity
                    key={item.name}
                    onPress={() => handleEquipTitle(item)}
                    disabled={isUpdating}
                    className={`w-[48%] aspect-square bg-[#121212] p-4 rounded-3xl mb-4 border shadow-sm justify-between ${isEquipped ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800'}`}
                >
                    <View className="items-center justify-center flex-1">
                        <MaterialCommunityIcons name="format-title" size={30} color={isEquipped ? "#3b82f6" : "#52525b"} />
                        <View className="mt-3 w-full items-center">
                            <TitleTag isDark={isDark} isVisible={true} title={item.name} size={10} tier={item.tier} />
                        </View>
                    </View>
                    <View className={`w-full py-2 rounded-xl mt-2 items-center ${isEquipped ? 'bg-blue-600' : 'bg-zinc-800'}`}>
                        {isThisTitleUpdating ? <ActivityIndicator size="small" color="white" /> : <Text className={`text-[10px] font-black uppercase ${isEquipped ? 'text-white' : 'text-gray-400'}`}>{isEquipped ? 'Equipped' : 'Equip'}</Text>}
                    </View>
                </TouchableOpacity>
            );
        }

        const expiration = getExpirationText(item.expiresAt);
        const isExpired = expiration === "Expired";
        const isBorder = item.category === 'BORDER';
        const isHype = item.category === 'HYPE';
        const isSkiaItem = ['streak_freeze', 'streak_restore', 'name_change_card', 'name_lock'].includes(item.itemId);
        const visual = item.visualData || item.visualConfig || {};
        const cardRarityColor = getRarityColor(item.rarity) || '#3b82f6';
        const imageUrl = item.url || visual.url || visual.imageUrl;
        const hypeConfig = isHype ? (HYPE_TIERS[item.hypeType] || HYPE_TIERS.FREE) : null;

        return (
            <TouchableOpacity
                key={item.id || item.itemId}
                onPress={() => handleItemClick(item)}
                className={`bg-[#121212] mr-4 p-4 rounded-3xl w-40 border shadow-sm mb-4 justify-between ${item.isEquipped ? 'bg-blue-500/10 border-blue-500' : 'border-zinc-800'} ${isExpired ? 'opacity-50 border-red-500/30' : ''}`}
                style={{ borderBottomWidth: 3, borderBottomColor: cardRarityColor }}
            >
                <View className="h-24 w-full bg-black/50 rounded-xl items-center justify-center overflow-hidden border border-white/5 relative mb-3">
                    {isSkiaItem ? (
                        <AnimatedItemIcon itemId={item.itemId} primaryColor={visual.primaryColor} secondaryColor={visual.secondaryColor} size={60} />
                    ) : isHype ? (
                        <HypeIconDisplay tierKey={hypeConfig.abbr} color={hypeConfig.glow} size={40} />
                    ) : isBorder ? (
                        <ClanBorder color={visual.primaryColor || visual.color || "#ff0000"} secondaryColor={visual.secondaryColor} animationType={visual.animationType} duration={visual.duration}>
                            <View className="h-10 flex justify-center items-center"><Text className="text-[10px] text-white/50 font-black uppercase">Frame</Text></View>
                        </ClanBorder>
                    ) : imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                    ) : visual.svgCode ? (
                        <RemoteSvgIcon xml={visual.svgCode} color={visual.glowColor || visual.primaryColor || visual.color} size={50} />
                    ) : (
                        <MaterialCommunityIcons name={visual.icon || 'hexagon-outline'} size={40} color={visual.primaryColor || 'white'} />
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
                    ) : item.category === 'IDENTITY' || item.itemId === 'streak_restore' ? (
                        <View className="w-full py-2 bg-zinc-800 rounded-xl items-center flex-row justify-center">
                            <MaterialCommunityIcons name="layers" size={12} color="#a1a1aa" />
                            <Text className="text-zinc-400 text-[10px] font-black uppercase ml-1">Stock: {item.itemCount || 1}</Text>
                        </View>
                    ) : item.itemId === 'streak_freeze' ? (
                        <View className="flex-row justify-between items-center w-full">
                            <View className="py-2 px-2 bg-zinc-800 rounded-lg items-center">
                                <Text className="text-zinc-400 text-[10px] font-black uppercase">x{item.itemCount || 1}</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleConsumeAction(item)} className="py-2 px-4 bg-cyan-500 rounded-lg items-center flex-1 ml-1">
                                <Text className="text-black text-[10px] font-black uppercase">Use</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity disabled={isUpdating} onPress={() => handleEquipToggle(item)} className={`w-full py-2 rounded-xl items-center ${item.isEquipped ? 'bg-green-500' : 'bg-blue-600'} ${isUpdating ? 'opacity-50' : ''}`}>
                            {isUpdating ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white text-[10px] font-black uppercase">{item.isEquipped ? 'Active' : 'Equip'}</Text>}
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const getListForCurrentView = () => {
        switch (currentView) {
            case 'TITLES': return titles;
            case 'HYPES': return hypes;
            case 'AVATARS': return avatars;
            case 'ENVIRONMENT': return environment;
            case 'AURAS': return auras;
            case 'CONSUMABLES': return consumables;
            default: return [];
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleHardwareBack}>
            <Pressable className="flex-1 bg-black/80 justify-end" onPress={handleHardwareBack}>
                <Pressable onPress={(e) => e.stopPropagation()} className="bg-[#09090b] h-[90%] rounded-t-[32px] p-6 border-t border-x border-blue-500/30">

                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            {currentView !== 'ROOT' && (
                                <TouchableOpacity onPress={handleHardwareBack} className="mr-3 p-2 bg-zinc-900 rounded-full border border-zinc-800">
                                    <Ionicons name="chevron-back" size={20} color="#3b82f6" />
                                </TouchableOpacity>
                            )}
                            <View>
                                <Text className="text-2xl font-black uppercase italic tracking-wider text-white">
                                    {currentView === 'ROOT' ? "Arsenal Hub" : currentView.replace('LIST_', '')}
                                </Text>
                                <Text className="text-blue-500 font-black text-[10px] uppercase tracking-widest">
                                    {currentView === 'ROOT' ? `${inventory.length + titles.length} Total Assets` : `${getListForCurrentView().length} Secured Items`}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-zinc-900 p-3 rounded-full border border-zinc-800">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                        {currentView === 'ROOT' && (
                            <>
                                {nameLockItem && (
                                    <TouchableOpacity
                                        onPress={() => setItemToDescribe(nameLockItem)}
                                        className="w-full bg-[#121212] rounded-3xl p-5 mb-6 border border-yellow-500/50 shadow-lg flex-row items-center justify-between"
                                        style={{ borderBottomWidth: 4, borderBottomColor: '#eab308' }}
                                    >
                                        <View className="flex-row items-center flex-1">
                                            <View className="bg-yellow-500/10 w-16 h-16 rounded-2xl items-center justify-center border border-yellow-500/20 mr-4">
                                                <AnimatedItemIcon itemId="name_lock" primaryColor="#eab308" secondaryColor="#fde047" size={40} />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-yellow-500 font-black uppercase text-xs tracking-widest mb-1">Identity Lock Active</Text>
                                                <LiveCountdown expiresAt={nameLockItem.expiresAt} />
                                            </View>
                                        </View>
                                        <MaterialCommunityIcons name="shield-lock-outline" size={28} color="#eab308" style={{ opacity: 0.3 }} />
                                    </TouchableOpacity>
                                )}

                                <View className="flex-row flex-wrap justify-between">
                                    {renderCategoryCard("Titles", "Earned Titles", "format-title", titles.length, "TITLES", "#8b5cf6")}
                                    {renderCategoryCard("Glow & Frames", "Border Effects", "shield-sun", auras.length, "AURAS", "#ef4444")}
                                    {renderCategoryCard("Card Layout", "BGs & Watermarks", "image-filter-hdr", environment.length, "ENVIRONMENT", "#06b6d4")}
                                    {renderCategoryCard("Avatars", "Avatars & VFX", "account-cowboy-hat", avatars.length, "AVATAR", "#10b981")}
                                    {renderCategoryCard("Consumables", "Patches & Chips", "battery-charging-high", consumables.length, "CONSUMABLES", "#3b82f6")}
                                    {renderCategoryCard("Hype", "Digital Tributes", "lightning-bolt", hypes.length, "HYPES", "#f59e0b")}
                                </View>
                            </>
                        )}

                        {currentView !== 'ROOT' && (
                            <View className="flex-row flex-wrap justify-between">
                                {getListForCurrentView().length > 0 ? (
                                    getListForCurrentView().map(item => renderSquareCard(item, currentView === 'TITLES'))
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

            <ItemPreviewModal
                isVisible={!!itemToPreview}
                onClose={() => setItemToPreview(null)}
                currentUser={user}
                selectedProduct={itemToPreview}
                onAction={handleEquipToggle}
                isProcessing={isUpdating}
                actionType="equip"
            />

            <ItemDescriptionModal
                isVisible={!!itemToDescribe}
                onClose={() => setItemToDescribe(null)}
                selectedProduct={itemToDescribe}
                onAction={handleConsumeAction}
                isProcessing={isUpdating}
                actionType={itemToDescribe?.itemId === 'streak_freeze' ? "use" : "view"}
            />
        </Modal>
    );
});

// ==========================================
// 🔹 ATOMIZED COMPONENTS FOR HIGH FPS
// ==========================================

const ProfileAvatarHeader = memo(({
    user, preview, pickImage, isDark, dynamicAuraColor, weeklyGloryRank, weeklyAuraTier, equippedGlow,
    setInventoryVisible, setPrefsVisible, setStoreVisible, setCardPreviewVisible, setSecurityVisible,
    isOnboarding, tooltipAnimatedStyle, currentPosTop, pointerAnimatedStyle, onboardingSteps, onboardingStep,
    skipOnboarding, prevOnboardingStep, nextOnboardingStep, setAuraModalVisible
}) => {
    return (
        <View className="px-6 mt-4">
            <View className="flex-row items-center gap-4 mb-3 border-b border-gray-200 dark:border-gray-800 pb-5">
                <View className="w-2 h-8 rounded-full" style={{ backgroundColor: dynamicAuraColor }} />
                <Text className="text-3xl font-black italic tracking-tighter uppercase dark:text-white">Player Profile</Text>
            </View>

            <View style={{ position: "relative" }} className="flex-row items-center justify-center mb-3">
                <View className="relative shrink-0 items-center justify-center">
                    <AuraAvatar
                        author={{
                            ...user,
                            rank: weeklyGloryRank,
                            image: preview || user?.profilePic?.url,
                            inventory: preview
                                ? user?.inventory?.map(item => item.category === 'AVATAR' ? { ...item, isEquipped: false } : item)
                                : user?.inventory
                        }}
                        aura={weeklyAuraTier}
                        isTop10={weeklyGloryRank > 0 && weeklyGloryRank <= 10}
                        isDark={isDark}
                        size={160}
                        glowColor={dynamicAuraColor}
                        isVisible={true}
                        onPress={pickImage}
                    />

                    <View
                        className="absolute items-center justify-center rounded-full overflow-hidden"
                        pointerEvents="none"
                        style={{
                            width: 160,
                            height: 160,
                            zIndex: 10,
                            transform: [(weeklyGloryRank || 100) === 1 ? { rotate: '-45deg' } : { rotate: '0deg' }]
                        }}
                    >
                        <View className="absolute inset-0 bg-black/30 items-center justify-center">
                            <Text className="text-[10px] font-black uppercase tracking-widest text-white drop-shadow-md">
                                Change DNA
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Left Floating Actions */}
                <View style={{ position: "absolute", left: -10, zIndex: 200, elevation: 200 }} className="flex-col gap-y-1 items-center">
                    <ProfileActionButton icon="archive-outline" color="#3b82f6" label="Items" onPress={() => setInventoryVisible(true)} />
                    <ProfileActionButton icon="cog-outline" color="#a855f7" label="Prefs" onPress={() => setPrefsVisible(true)} />
                    <ProfileActionButton icon="cart-outline" color="#22c55e" label="Store" onPress={() => setStoreVisible(true)} />
                    <ProfileActionButton icon="card-account-details-outline" color="#f59e0b" label="Card" onPress={() => setCardPreviewVisible(true)} />
                </View>

                {/* Right Floating Actions (Security) */}
                <View style={{ position: "absolute", right: -10, top: 13, zIndex: 200, elevation: 200 }} className="items-center">
                    <View className="flex-row mb-1 space-x-0.5 justify-center items-center">
                        {[1, 2, 3].map((step) => {
                            const level = user?.securityLevel || 1;
                            const isActive = level >= step;
                            let pillColor = isDark ? "#374151" : "#e5e7eb";
                            if (isActive) {
                                if (level === 1) pillColor = "#ef4444";
                                else if (level === 2) pillColor = "#f59e0b";
                                else if (level === 3) pillColor = "#22c55e";
                            }
                            return <View key={step} style={{ width: 10, height: 3, borderRadius: 4, backgroundColor: pillColor, opacity: isActive ? 1 : 0.4 }} />;
                        })}
                    </View>
                    <ProfileActionButton
                        icon={user?.securityLevel > 2 ? "lock" : "lock-open"}
                        color={user?.securityLevel === 1 ? "#ef4444" : user?.securityLevel === 2 ? "#f59e0b" : "#22c55e"}
                        label="Security"
                        onPress={() => setSecurityVisible(true)}
                    />
                </View>

                {/* Onboarding Tooltip Overlay */}
                {isOnboarding && (
                    <Animated.View
                        style={[
                            tooltipAnimatedStyle,
                            { position: 'absolute', left: 70, top: currentPosTop, width: 230, zIndex: 999, elevation: 999 }
                        ]}
                        className="bg-blue-600 dark:bg-blue-900 rounded-2xl p-5 shadow-2xl flex-row items-start"
                    >
                        <Animated.View style={pointerAnimatedStyle} className="absolute -left-3 top-5">
                            <Ionicons name="caret-back" size={24} color={isDark ? "#1e3a8a" : "#2563eb"} />
                        </Animated.View>
                        <View className="flex-1">
                            <Text className="text-white font-black text-sm uppercase tracking-widest mb-1">
                                {onboardingSteps[onboardingStep].title}
                            </Text>
                            <Text className="text-blue-100 text-xs font-medium leading-relaxed">
                                {onboardingSteps[onboardingStep].desc}
                            </Text>
                            <View className="flex-row justify-between items-center mt-4 pt-4 border-t border-blue-400/30">
                                <TouchableOpacity onPress={skipOnboarding} className="px-2 py-1">
                                    <Text className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">Skip</Text>
                                </TouchableOpacity>
                                <View className="flex-row gap-2">
                                    {onboardingStep > 0 && (
                                        <TouchableOpacity onPress={prevOnboardingStep} className="bg-blue-500/40 px-4 py-2 rounded-lg active:scale-95">
                                            <Text className="text-white text-[10px] font-black uppercase tracking-widest">Back</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={nextOnboardingStep} className="bg-white px-4 py-2 rounded-lg active:scale-95">
                                        <Text className="text-blue-600 dark:text-blue-900 text-[10px] font-black uppercase tracking-widest">
                                            {onboardingStep === 3 ? "Done" : "Next"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </View>

            {/* Nameplate & Class */}
            <View className="items-center mb-3">
                <Pressable onPress={() => setAuraModalVisible(true)} className="items-center">
                    <PlayerNameplate
                        author={user}
                        themeColor={dynamicAuraColor}
                        equippedGlow={equippedGlow}
                        auraRank={weeklyGloryRank}
                        showPeakBadge={false}
                        showFlame={false}
                        isDark={isDark}
                        fontSize={24}
                        isVisible={true}
                    />

                    <View className="mt-2 flex justify-center items-center">
                        <TitleTag isDark={isDark} key={user?.equippedTitle} isVisible={true} rank={weeklyGloryRank} auraVisuals={weeklyAuraTier} equippedTitle={user?.equippedTitle} isTop10={weeklyGloryRank ? true : false} />
                    </View>
                </Pressable>
            </View>
        </View>
    );
});

const RpgProgressionStats = memo(({
    user, totalPosts, dynamicAuraColor, writerRank, totalAura, weeklyGloryRank, weeklyGloryPoints, totalHyped, totalHypes, setRankModalVisible
}) => {
    return (
        <View className="px-6">
            <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 text-center">
                Class: {writerRank.title}
            </Text>

            {/* 4-COLUMN STATS */}
            <View className="mt-4 border-y border-gray-200 dark:border-gray-800 w-full py-1">
                <View className="flex-row justify-between w-full py-3 px-2">
                    <View className="items-center flex-1">
                        <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Aura</Text>
                        <Text className="text-lg font-black" style={{ color: writerRank.color }}>{totalAura.toLocaleString()}</Text>
                    </View>
                    <View className="items-center flex-1 border-l border-gray-200 dark:border-gray-800">
                        <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Weekly Aura</Text>
                        <Text className="text-lg font-black" style={{ color: '#ec4899' }}>+{weeklyGloryPoints.toLocaleString()}</Text>
                    </View>
                    <View className="items-center flex-1 border-l border-gray-200 dark:border-gray-800">
                        <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Docs</Text>
                        <Text className="text-lg font-black text-gray-900 dark:text-white">{totalPosts.toLocaleString()}</Text>
                    </View>
                </View>
                <View className="border-t border-gray-200 dark:border-gray-800 mx-4" />
                <View className="flex-row justify-between w-full py-3 px-2">
                    <View className="items-center flex-1">
                        <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Rank</Text>
                        <Text className="text-lg font-black" style={{ color: dynamicAuraColor }}>#{weeklyGloryRank || '??'}</Text>
                    </View>
                    <View className="items-center flex-1 border-l border-gray-200 dark:border-gray-800">
                        <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">TOTAL HYPES</Text>
                        <Text className="text-lg font-black" style={{ color: '#fbbf24' }}>#{totalHyped || '??'}</Text>
                    </View>
                    <View className="items-center flex-1 border-l border-gray-200 dark:border-gray-800">
                        <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">TOTAL HP</Text>
                        <Text className="text-lg font-black" style={{ color: '#d946ef' }}>#{totalHypes || '??'}</Text>
                    </View>
                </View>
            </View>

            {/* RPG PROGRESS BAR */}
            <View className="mt-8 w-full mb-10">
                <Pressable onPress={() => setRankModalVisible(true)} className="flex-row justify-between items-end mb-3 px-1">
                    <View className="flex-row items-center gap-3">
                        <Text className="text-3xl">{writerRank.icon}</Text>
                        <View>
                            <Text style={{ color: writerRank.color }} className="text-[9px] font-mono uppercase tracking-[0.2em] leading-none mb-1">PLAYER_CLASS</Text>
                            <Text className="text-xs font-black uppercase tracking-widest dark:text-white">{writerRank.title}</Text>
                        </View>
                    </View>
                    <Text className="text-[10px] font-mono font-bold text-gray-500 mb-1">
                        EXP: {totalAura.toLocaleString()} / {writerRank.nextReq.toLocaleString()}
                    </Text>
                </Pressable>
                <View className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <View style={{ width: `${writerRank.progress}%`, backgroundColor: writerRank.color }} className="h-full" />
                </View>
            </View>
        </View>
    );
});

// ⚡️ PERFORMANCE FIX: Text inputs are completely isolated so typing doesn't re-render the whole profile!
const ProfileEditor = memo(({
    user, isDark, dynamicAuraColor, initialUsername, initialDescription,
    handleUpdate, tryhandleLogout, isUpdating, isLoggingOut
}) => {
    const [username, setUsername] = useState(initialUsername);
    const [description, setDescription] = useState(initialDescription);
    const [showId, setShowId] = useState(false);
    const [copied, setCopied] = useState(false);
    const [refCopied, setRefCopied] = useState(false);
    const CustomAlert = useAlert();

    // Re-sync local state if db changes
    useEffect(() => {
        setUsername(initialUsername);
        setDescription(initialDescription);
    }, [initialUsername, initialDescription]);

    const copyToClipboard = async () => {
        if (user?.uid) {
            await Clipboard.setStringAsync(user.uid);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const copyReferralToClipboard = async () => {
        if (user?.referralCode) {
            const playStoreLink = `https://play.google.com/store/apps/details?id=com.kaytee.oreblogda&referrer=${user.referralCode}`;
            await Clipboard.setStringAsync(playStoreLink);
            setRefCopied(true);
            setTimeout(() => setRefCopied(false), 2000);
        } else {
            Toast.show({ type: 'info', text1: 'Syncing Code...', text2: 'Your referral ID is currently being generated.' });
        }
    };

    return (
        <View className="px-6 space-y-6 mb-4">
            <View className="space-y-2">
                <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Display Name / Alias</Text>
                <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter alias..."
                    placeholderTextColor="#9ca3af"
                    className="w-full bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-gray-800 p-4 rounded-2xl text-sm font-bold text-gray-900 dark:text-white"
                />
            </View>

            <View className="space-y-2 mt-2">
                <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                    User Id(UID) <Text className="text-gray-500 tracking-normal lowercase">- Used for recovery</Text>
                </Text>
                <View className="bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-gray-800 p-4 rounded-2xl flex-row justify-between items-center">
                    <View className="flex-1 mr-4">
                        <Text numberOfLines={1} ellipsizeMode="middle" className={`text-xs font-bold font-mono ${showId ? 'text-gray-700 dark:text-gray-300' : 'text-blue-500/50'}`}>
                            {showId ? (user?.uid || "SEARCHING...") : "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"}
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <Pressable onPress={() => setShowId(!showId)} className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 active:scale-95">
                            <Feather name={showId ? "eye-off" : "eye"} size={16} color={isDark ? "#94a3b8" : "#475569"} />
                        </Pressable>
                        <Pressable onPress={copyToClipboard} className={`p-2.5 rounded-xl active:scale-95 ${copied ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                            <Feather name={copied ? "check" : "copy"} size={16} color={copied ? "#22c55e" : "#3b82f6"} />
                        </Pressable>
                    </View>
                </View>
            </View>

            <View className="space-y-2 mt-2">
                <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                    Recruitment Directive <Text className="text-gray-500 tracking-normal lowercase">- Share to invite friends</Text>
                </Text>
                <View className="bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-gray-800 p-4 rounded-2xl flex-row justify-between items-center">
                    <View className="flex-1 mr-4">
                        <Text numberOfLines={1} ellipsizeMode="tail" className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400 opacity-90">
                            {user?.referralCode ? `play.google.com/...referrer=${user.referralCode}` : "SYNCHRONIZING_ID..."}
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <View className="bg-purple-500/10 px-3 py-2 rounded-xl border border-purple-500/20">
                            <Text className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">{user?.referralCount || 0} Recruits</Text>
                        </View>
                        <Pressable onPress={copyReferralToClipboard} className={`p-2.5 rounded-xl active:scale-95 ${refCopied ? 'bg-green-500/20' : 'bg-purple-500/20'}`}>
                            <Feather name={refCopied ? "check" : "share-2"} size={16} color={refCopied ? "#22c55e" : "#a855f7"} />
                        </Pressable>
                    </View>
                </View>
            </View>

            <View className="space-y-2 mt-2">
                <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Biography / Lore</Text>
                <TextInput
                    multiline
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Write your player bio here..."
                    placeholderTextColor="#9ca3af"
                    className="w-full bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 text-sm font-medium text-gray-900 dark:text-white min-h-[120px]"
                    style={{ textAlignVertical: 'top' }}
                />
            </View>

            <TouchableOpacity
                onPress={() => handleUpdate(username, description)}
                disabled={isUpdating}
                style={{ backgroundColor: dynamicAuraColor }}
                className="relative w-full h-14 rounded-2xl overflow-hidden items-center justify-center mt-6 active:opacity-80 shadow-md"
            >
                <Text className="relative z-10 text-white font-black uppercase tracking-widest text-[13px]">
                    {isUpdating ? "Syncing Changes..." : "Update Character Data"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={tryhandleLogout}
                disabled={isLoggingOut}
                className="relative w-full h-14 rounded-2xl items-center justify-center mt-2 border-2 border-red-500/20 bg-red-500/5 active:bg-red-500/10 transition-all"
            >
                <View className="flex-row items-center gap-2">
                    <Ionicons name="power" size={16} color="#ef4444" />
                    <Text className="text-red-500 font-black uppercase tracking-widest text-[11px]"> {!isLoggingOut ? "De-Synchronize (Log Out)" : "Desynchronizing"}</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
});


// ==========================================
// ⚡️ OPTIMIZATION 1: MEMOIZED POST ITEM (UPSCALED ED.)
// Extracted outside the main component so it never recreates unnecessarily
// ==========================================
const ProfilePostItem = memo(({ item, isDark, onNavigate, onAction, onDelete }) => {
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
                        <TouchableOpacity
                            onPress={() => onAction(item._id, 'boost')}
                            className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-xl items-center justify-center active:scale-90 shadow-sm"
                        >
                            <Ionicons name="rocket-outline" size={20} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onAction(item._id, 'resurrect')}
                            className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 rounded-xl items-center justify-center active:scale-90 shadow-sm"
                        >
                            <MaterialCommunityIcons name="auto-fix" size={20} color="#a855f7" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onDelete(item._id)}
                            className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-xl items-center justify-center active:scale-90 shadow-sm"
                        >
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 📊 Upscaled Engagement Metric Footing */}
                <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/60">
                    <View className="flex-row items-center gap-4">
                        <View className="items-center flex-row gap-1.5">
                            <Ionicons name="heart" size={16} color="#ef4444" />
                            <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.likesCount || 0}</Text>
                        </View>
                        <View className="items-center flex-row gap-1.5">
                            <Ionicons name="chatbubble" size={16} color="#3b82f6" />
                            <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.commentsCount || 0}</Text>
                        </View>
                        <View className="items-center flex-row gap-1.5">
                            <Ionicons name="chatbox-ellipses" size={16} color="#f59e0b" />
                            <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.discussionCount || 0}</Text>
                        </View>
                        <View className="items-center flex-row gap-1.5">
                            <Ionicons name="flash" size={16} color="#00ff00" />
                            <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.hypePointsCount || 0}</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-4">
                        <View className="items-center flex-row gap-1.5">
                            <Ionicons name="eye" size={16} color={isDark ? "#6b7280" : "#9ca3af"} />
                            <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.formattedViews || "0"}</Text>
                        </View>
                        <View className="items-center flex-row gap-1.5">
                            <Ionicons name="share-social" size={16} color={isDark ? "#6b7280" : "#9ca3af"} />
                            <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold">{item.sharesCount || 0}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    return prevProps.item === nextProps.item && prevProps.isDark === nextProps.isDark;
});


// ==========================================
// 🔹 MAIN COMPONENT
// ==========================================
export default function MobileProfilePage() {
    const storage = useMMKV();
    const CustomAlert = useAlert();
    const [theinventory, setInventory] = useState([]);
    const { user, setUser, contextLoading, handleLogout, refreshStreak, isLoggingOut } = useUser();

    const { colorScheme } = useNativeWind();
    const isDark = colorScheme === "dark";
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const playerCardRef = useRef(null);

    const [totalPosts, setTotalPosts] = useState(0);
    const [preview, setPreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ⚡️ FILTER TAB STATE
    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'HIGHLIGHTS'

    // ⚡️ MODAL STATES
    const [inventoryVisible, setInventoryVisible] = useState(false);
    const [prefsVisible, setPrefsVisible] = useState(false);
    const [storeVisible, setStoreVisible] = useState(false);
    const [securityVisible, setSecurityVisible] = useState(false);
    const [rankModalVisible, setRankModalVisible] = useState(false);
    const [auraModalVisible, setAuraModalVisible] = useState(false);
    const [isEditorVisible, setIsEditorVisible] = useState(false);
    const [imageToEditUri, setImageToEditUri] = useState(null);
    const [cardPreviewVisible, setCardPreviewVisible] = useState(false);

    const [favAnimes, setFavAnimes] = useState("");
    const [favCharacter, setFavCharacter] = useState("");
    const [favGenres, setFavGenres] = useState("");

    const [isOnboarding, setIsOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);

    const CACHE_KEY_USER_EXTRAS = `user_profile_cache_${user?.deviceId || 'temp'}`;

    // ⚡️ EXTRACT RPG PROGRESSION DATA
    const totalAura = user?.aura || 0;
    const rankLevel = user?.currentRankLevel || 1;
    const writerRank = useMemo(() => resolveUserRank(rankLevel, totalAura), [rankLevel, totalAura]);

    // ⚡️ EXTRACT WEEKLY GLORY DATA
    const weeklyGloryRank = user?.previousRank || 0;
    const totalHypes = user?.totalHypePointsGiven || 0;
    const totalHyped = user?.totalHypePointsReceived || 0;
    const weeklyAuraTier = useMemo(() => getAuraTier(weeklyGloryRank), [weeklyGloryRank]);
    const weeklyGloryPoints = user?.weeklyAura || 0;

    // ⚡️ INVENTORY
    const equippedGlow = user?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || null;
    const dynamicAuraColor = activeGlowColor || weeklyAuraTier?.color || '#3b82f6';

    const [cachedUsername, setCachedUsername] = useState(user?.username || "");
    const [cachedDescription, setCachedDescription] = useState(user?.description || "");

    useEffect(() => {
        if (!user?.deviceId) return;
        const syncUserWithDB = async () => {
            try {
                const res = await apiFetch(`/users/me?fingerprint=${user.deviceId}`, { headers: { "x-oreblogda-secret": "thisismyrandomsuperlongsecretkey" } });
                const data = await res.json();
                if (res.ok) {
                    const { user: dbUser, totalPosts: newTotal } = data;
                    setUser({ ...user, ...dbUser });
                    setCachedUsername(dbUser.username || "");
                    setCachedDescription(dbUser.description || "");
                    setTotalPosts(newTotal);

                    const dbAnimes = Array.isArray(dbUser.preferences?.favAnimes) ? dbUser.preferences.favAnimes.join(', ') : "";
                    const dbGenres = Array.isArray(dbUser.preferences?.favGenres) ? dbUser.preferences.favGenres.join(', ') : "";
                    const dbChar = dbUser.preferences?.favCharacter || "";

                    setFavAnimes(dbAnimes);
                    setFavGenres(dbGenres);
                    setFavCharacter(dbChar);

                    storage.set(CACHE_KEY_USER_EXTRAS, JSON.stringify({
                        username: dbUser.username,
                        description: dbUser.description,
                        totalPosts: newTotal,
                        favAnimes: dbAnimes,
                        favGenres: dbGenres,
                        favCharacter: dbChar
                    }));
                }
            } catch (err) { console.error("Sync User UI Error:", err); }
        };
        syncUserWithDB();
    }, [user?.deviceId]);

    const getKey = (pageIndex, previousPageData) => {
        if (!user?._id || !user?.deviceId) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `/posts?author=${user._id}&page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: 240000,
        revalidateOnFocus: true,
        dedupingInterval: 5000,
    });

    const captureAndShare = async () => {
        try {
            if (playerCardRef.current) {
                Toast.show({ type: 'info', text1: 'Generating...', text2: 'Preparing your player card.' });
                const uri = await playerCardRef.current.capture();
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                } else {
                    CustomAlert("Error", "Sharing is not available on this device.");
                }
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to capture the card.' });
        }
    };

    const captureAndSave = async () => {
        try {
            if (playerCardRef.current) {
                setIsSaving(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const uri = await playerCardRef.current.capture();
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
            CustomAlert("Error", "Failed to save the clan scroll.");
        } finally {
            setIsSaving(false);
        }
    };

    const tryhandleLogout = () => {
        CustomAlert("De-Synchronize", "Hibernating neural link... Your environment will be preserved for quick re-entry.", [
            { text: "Cancel", style: "cancel" },
            { text: "LogOut", style: "destructive", onPress: async () => { handleLogout() } }
        ])
    };

    // ⚡️ POSTS FILTERING LOGIC
    const posts = useMemo(() => {
        const allPosts = data ? data.flatMap((page) => page.posts || []) : [];
        if (activeTab === 'HIGHLIGHTS') {
            return allPosts.filter(p => p.isBoosted || p.isResurrected || p.isTrending);
        }
        return allPosts;
    }, [data, activeTab]);

    const isLoadingInitialData = isLoading && !data;
    const isReachingEnd = data && data[data.length - 1]?.posts?.length < LIMIT;
    const isFetchingNextPage = isValidating && data && typeof data[size - 1] === "undefined";

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
        });

        if (!result.canceled) {
            const selected = result.assets[0];
            setPreview(selected.uri);
            setImageFile({ localUri: selected.uri, type: "image", fileSize: selected.fileSize });
            setImageToEditUri(selected.uri);
            setIsEditorVisible(true);
        }
    };

    const handleSaveEditedImage = async (editedUri) => {
        setPreview(editedUri);
        setImageFile(prev => ({ ...prev, localUri: editedUri }));
        setIsEditorVisible(false);
        setImageToEditUri(null);
        CustomAlert("Success", "Profile image updated locally. Save changes to sync.");
    };

    const handleUpdate = async (updatedUsername, updatedDescription) => {
        if (!updatedUsername.trim()) {
            CustomAlert("Error", "Username cannot be empty.");
            return;
        }

        let isChangingName = false;
        let usingNameChangeCard = false;

        if (updatedUsername.trim() !== cachedUsername) {
            isChangingName = true;

            const hasNameChangeCard = user?.inventory?.some(item => item.itemId === "name_change_card");

            if (hasNameChangeCard) {
                usingNameChangeCard = true;
                Toast.show({ type: 'info', text1: 'Using Name Card', text2: 'Consuming 1x Name Change Card' });
            } else {
                const userConfirmed = await new Promise((resolve) => {
                    CustomAlert(
                        "Card Required",
                        `You do not have a Name Change Card. Your name will not be updated, but other profile modifications will proceed. Continue?`,
                        [
                            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                            { text: "Confirm", style: "destructive", onPress: () => resolve(true) }
                        ]
                    );
                });

                if (!userConfirmed) return;
            }
        }

        setIsUpdating(true);
        try {
            const formData = new FormData();
            formData.append("userId", user?._id || "");
            formData.append("fingerprint", user?.deviceId || "");

            if (updatedDescription !== cachedDescription) {
                formData.append("description", updatedDescription);
            }

            if (isChangingName && usingNameChangeCard) {
                formData.append("username", updatedUsername.trim());
                formData.append("isChangingName", "true");
                formData.append("usingNameChangeCard", "true");
            }

            formData.append("preferences", JSON.stringify({
                favCharacter: favCharacter,
                favAnimes: favAnimes.split(',').map(s => s.trim()).filter(Boolean),
                favGenres: favGenres.split(',').map(s => s.trim()).filter(Boolean)
            }));

            if (imageFile) {
                const targetUri = imageFile.localUri || imageFile.uri;
                const fileExtension = targetUri.split('.').pop()?.toLowerCase() || 'jpg';
                const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
                const fileName = `profile_${Date.now()}.${fileExtension}`;

                if (Platform.OS === "web") {
                    const blob = await (await fetch(targetUri)).blob();
                    formData.append("file", blob, fileName);
                } else {
                    const nativeFilePayload = { uri: targetUri, name: fileName, type: mimeType };
                    formData.append("file", nativeFilePayload);
                }
            }

            const res = await apiFetch(`/users/upload`, { method: "PUT", body: formData });
            const result = await res.json();

            if (res.ok) {
                setUser(result.user);
                setCachedUsername(result.user.username);
                setCachedDescription(result.user.description);
                setPreview(null);
                setImageFile(null);

                if (result.partialSuccess || (!usingNameChangeCard && isChangingName)) {
                    CustomAlert("Update Partial", result.message || "Profile updated, but identity remained locked due to missing item card.");
                } else {
                    CustomAlert("Success", result.message || "Character Data Updated.");
                }
            } else {
                CustomAlert("Error", result.message || "Failed to update.");
            }
        } catch (err) {
            CustomAlert("Error", "Failed to sync changes.");
        } finally {
            setIsUpdating(false);
        }
    };

    // ⚡️ OPTIMIZATION 2: USECALLBACK FOR ACTIONS
    const handleDelete = useCallback((postId) => {
        CustomAlert("Confirm Deletion", "Erase this transmission log?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    Toast.show({ type: 'info', text1: 'Processing...', text2: 'Attempting to delete post', autoHide: false });
                    try {
                        const response = await apiFetch(`/posts/delete`, {
                            method: "DELETE",
                            body: JSON.stringify({ postId, fingerprint: user?.deviceId }),
                        });
                        const data = await response.json();
                        if (response.ok) {
                            mutate();
                            setTotalPosts(prev => prev - 1);
                            Toast.show({ type: 'success', text1: 'Deleted', text2: data.message || 'Post removed successfully' });
                        } else {
                            Toast.show({ type: 'error', text1: 'Deletion Blocked', text2: data.message || 'This post cannot be deleted.' });
                        }
                    } catch (err) {
                        Toast.show({ type: 'error', text1: 'Connection Error', text2: 'Failed to reach the server.' });
                    }
                },
            },
        ]);
    }, [user?.deviceId, mutate]);

    const handlePostAction = useCallback((postId, actionType) => {
        const isBoost = actionType === 'boost';
        const title = isBoost ? 'Boost Transmission' : 'Resurrect Transmission';
        const msg = isBoost
            ? 'Spend OC or a Boost Scroll to amplify this post for 24 hours?'
            : 'Spend OC or a Resurrection Scroll to bring this post back to the top of the feed?';

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
                                context: 'user',
                                actionType
                            })
                        });
                        const data = await response.json();

                        if (response.ok && data.success) {
                            mutate(); // Refreshes the SWR cache so badges update instantly
                            Toast.show({ type: 'success', text1: 'Protocol Complete', text2: data.message });
                        } else {
                            Toast.show({ type: 'error', text1: 'Action Failed', text2: data.message || 'Failed to apply effect.' });
                        }
                    } catch (err) {
                        Toast.show({ type: 'error', text1: 'Connection Error', text2: 'Server unreachable.' });
                    }
                }
            }
        ]);
    }, [user?.deviceId, mutate]);

    const handleNavigate = useCallback((path) => {
        router.push(path);
    }, [router]);

    // ⚡️ OPTIMIZATION 3: MEMOIZE RENDER ITEM
    const renderPostItem = useCallback(({ item }) => (
        <ProfilePostItem
            item={item}
            isDark={isDark}
            onNavigate={handleNavigate}
            onAction={handlePostAction}
            onDelete={handleDelete}
        />
    ), [isDark, handleNavigate, handlePostAction, handleDelete]);


    // ⚡️ ONBOARDING TOOLTIP STATE ANIMATIONS
    const [currentPosTop, setcurrentPosTop] = useState(0);
    const tooltipY = useSharedValue(0);
    const pointerX = useSharedValue(0);

    useEffect(() => {
        const hasSeenOnboarding = storage.getBoolean('has_seen_profile_onboarding');
        if (!hasSeenOnboarding) setIsOnboarding(true);
    }, []);

    useEffect(() => { tooltipY.value = withSpring(onboardingStep * 60, { damping: 14, stiffness: 90 }); }, [onboardingStep]);
    useEffect(() => {
        if (isOnboarding) pointerX.value = withRepeat(withSequence(withTiming(5, { duration: 500 }), withTiming(0, { duration: 500 })), -1, true);
        else pointerX.value = 0;
    }, [isOnboarding]);

    const tooltipAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: tooltipY.value }] }));
    const pointerAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pointerX.value }] }));

    const onboardingSteps = useMemo(() => [
        { title: "Inventory", desc: "Check your acquired items and manage your gear here." },
        { title: "Preferences", desc: "Update your neural preferences and favorite anime characters." },
        { title: "Store", desc: "Visit the store to get new upgrades, auras, and cosmetics." },
        { title: "Security", desc: "Manage your PIN and email security settings." },
        { title: "Player Card", desc: "Preview and broadcast your unique Operator Identity card." }
    ], []);

    const skipOnboarding = () => { setIsOnboarding(false); storage.set('has_seen_profile_onboarding', true); };
    const prevOnboardingStep = () => { if (onboardingStep > 0) setOnboardingStep(prev => prev - 1); };
    const nextOnboardingStep = () => {
        if (onboardingStep < onboardingSteps.length - 1) { setOnboardingStep(prev => prev + 1); setcurrentPosTop(-10); }
        else skipOnboarding();
    };

    // ⚡️ PERFORMANCE OPTIMIZATION: Isolate the entire Header into one Memoized Block
    const listHeader = useMemo(() => (
        <View>
            <ProfileAvatarHeader
                user={user} preview={preview} pickImage={pickImage} isDark={isDark}
                dynamicAuraColor={dynamicAuraColor} weeklyGloryRank={weeklyGloryRank}
                weeklyAuraTier={weeklyAuraTier} equippedGlow={equippedGlow}
                setInventoryVisible={setInventoryVisible} setPrefsVisible={setPrefsVisible}
                setStoreVisible={setStoreVisible} setCardPreviewVisible={setCardPreviewVisible}
                setSecurityVisible={setSecurityVisible}
                setAuraModalVisible={setAuraModalVisible}
                isOnboarding={isOnboarding} tooltipAnimatedStyle={tooltipAnimatedStyle}
                currentPosTop={currentPosTop} pointerAnimatedStyle={pointerAnimatedStyle}
                onboardingSteps={onboardingSteps} onboardingStep={onboardingStep}
                skipOnboarding={skipOnboarding} prevOnboardingStep={prevOnboardingStep} nextOnboardingStep={nextOnboardingStep}
            />

            <RpgProgressionStats
                user={user} totalPosts={totalPosts} dynamicAuraColor={dynamicAuraColor}
                writerRank={writerRank} totalAura={totalAura} weeklyGloryRank={weeklyGloryRank}
                weeklyGloryPoints={weeklyGloryPoints} totalHyped={totalHyped} totalHypes={totalHypes}
                setRankModalVisible={setRankModalVisible}
            />

            <ProfileEditor
                user={user} isDark={isDark} dynamicAuraColor={dynamicAuraColor}
                initialUsername={cachedUsername} initialDescription={cachedDescription}
                handleUpdate={handleUpdate} tryhandleLogout={tryhandleLogout}
                isUpdating={isUpdating} isLoggingOut={isLoggingOut}
            />

            {/* ⚡️ NEW: Highlight Tabs Toggle */}
            <View className="px-6 mt-6 mb-2 flex-row gap-4 items-center">
                <TouchableOpacity
                    onPress={() => setActiveTab('ALL')}
                    className={`py-2 px-4 rounded-full border ${activeTab === 'ALL' ? 'bg-blue-600 border-blue-500' : isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-100 border-gray-200'}`}
                >
                    <Text className={`font-black uppercase text-[11px] tracking-widest ${activeTab === 'ALL' ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>All Transmissions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('HIGHLIGHTS')}
                    className={`py-2 px-4 flex-row items-center rounded-full border ${activeTab === 'HIGHLIGHTS' ? 'bg-orange-600 border-orange-500' : isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-100 border-gray-200'}`}
                >
                    <MaterialCommunityIcons name="star-shooting" size={14} color={activeTab === 'HIGHLIGHTS' ? 'white' : isDark ? '#9ca3af' : '#6b7280'} className="mr-1" />
                    <Text className={`font-black uppercase text-[11px] ml-1 tracking-widest ${activeTab === 'HIGHLIGHTS' ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>Highlights</Text>
                </TouchableOpacity>
            </View>

        </View>
    ), [user, preview, isDark, dynamicAuraColor, weeklyGloryRank, weeklyAuraTier, equippedGlow, totalPosts, writerRank, totalAura, weeklyGloryPoints, totalHyped, totalHypes, cachedUsername, cachedDescription, isUpdating, isLoggingOut, isOnboarding, onboardingStep, currentPosTop, activeTab]);

    // ⚡️ OPTIMIZATION 4: MEMOIZE EMPTY AND FOOTER STATES
    const renderEmptyComponent = useCallback(() => (
        isLoadingInitialData ? <SyncLoading /> : (
            <View className="mx-6 p-10 bg-gray-50 dark:bg-[#121212] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 items-center my-4">
                <Ionicons name={activeTab === 'HIGHLIGHTS' ? "star-outline" : "document-text-outline"} size={32} color={isDark ? "#4b5563" : "#9ca3af"} />
                <Text className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-4">
                    {activeTab === 'HIGHLIGHTS' ? 'No Highlights' : 'Empty Logs'}
                </Text>
                <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium text-center leading-5">
                    {activeTab === 'HIGHLIGHTS' ? "You don't have any boosted, trending, or resurrected transmissions yet." : "Your intel diary is empty.\nStart writing to build your archive."}
                </Text>
            </View>
        )
    ), [isLoadingInitialData, activeTab, isDark]);

    const renderFooterComponent = useCallback(() => (
        <View style={{ paddingBottom: insets.bottom + 100 }}>
            {isFetchingNextPage && <ActivityIndicator className="py-6" color="#2563eb" />}
        </View>
    ), [insets.bottom, isFetchingNextPage]);

    return (
        <View className="flex-1 bg-white dark:bg-[#0a0a0a]" style={{ paddingTop: insets.top }}>
            <AppOnboarding />

            <View className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full" pointerEvents="none" />
            <View className="absolute bottom-0 left-0 w-60 h-60 bg-purple-600/5 rounded-full" pointerEvents="none" />

            <LegendList
                data={posts}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={listHeader}
                scrollEnabled={!isOnboarding}
                onScroll={(e) => DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                estimatedItemSize={200}
                removeClippedSubviews={true}
                onEndReached={() => { if (!isReachingEnd && !isValidating) setSize(size + 1); }}
                onEndReachedThreshold={0.5}
                renderItem={renderPostItem}
                ListEmptyComponent={renderEmptyComponent}
                ListFooterComponent={renderFooterComponent}
            />

            {/* ⚡️ WIN 2: Modals only mount if they are visible */}
            {rankModalVisible && (
                <Modal visible={rankModalVisible} transparent animationType="fade">
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <View className="bg-white dark:bg-[#0d1117] w-full p-8 rounded-[40px] border border-gray-200 dark:border-gray-800" style={{ borderColor: writerRank.color }}>
                            <View className="w-20 h-20 rounded-full items-center justify-center mb-6 self-center" style={{ backgroundColor: writerRank.color + '20' }}>
                                <Text style={{ fontSize: 40 }}>{writerRank.icon}</Text>
                            </View>
                            <Text className="text-2xl font-black text-center uppercase tracking-tighter text-gray-900 dark:text-white mb-2" style={{ color: writerRank.color }}>{writerRank.title.replace(/_/g, ' ')}</Text>
                            <Text className="text-gray-500 text-center font-bold text-xs uppercase tracking-widest mb-6">Current Standing</Text>
                            <Text className="text-gray-600 dark:text-gray-400 text-center leading-6 mb-8 px-2">
                                You have amassed <Text className="font-black" style={{ color: writerRank.color }}>{totalAura.toLocaleString()} Aura</Text>.
                                {rankLevel < 8 ? ` Reach ${writerRank.nextReq.toLocaleString()} Aura to evolve into the next class.` : " You have reached the pinnacle of power."}
                            </Text>
                            <TouchableOpacity onPress={() => setRankModalVisible(false)} style={{ backgroundColor: writerRank.color }} className="p-4 rounded-2xl items-center shadow-lg active:opacity-80">
                                <Text className="text-black font-black uppercase tracking-widest text-xs">Close Intel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {auraModalVisible && (
                <Modal visible={auraModalVisible} transparent animationType="fade">
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <View className="bg-white dark:bg-[#0d1117] w-full p-8 rounded-[40px] border-2" style={{ borderColor: dynamicAuraColor }}>
                            <MaterialCommunityIcons name={weeklyAuraTier?.icon || 'shield-outline'} size={60} color={dynamicAuraColor} style={{ alignSelf: 'center', marginBottom: 20 }} />
                            <Text style={{ color: dynamicAuraColor }} className="text-3xl font-black text-center uppercase tracking-widest mb-2">{weeklyAuraTier?.label || 'NOVICE'} STATUS</Text>
                            <Text className="text-gray-500 text-center font-bold text-[10px] uppercase tracking-[0.3em] mb-5">Total Weekly Aura: {weeklyGloryPoints.toLocaleString()}</Text>
                            <Text className="text-gray-600 dark:text-gray-400 text-center leading-6 mb-8 font-medium px-2">This is your competitive ranking for the week. Dominate the leaderboards to earn higher statuses and seasonal rewards!</Text>
                            <TouchableOpacity onPress={() => setAuraModalVisible(false)} style={{ backgroundColor: dynamicAuraColor }} className="p-4 rounded-2xl items-center shadow-lg active:opacity-80">
                                <Text className="text-white font-black uppercase tracking-widest text-xs">Acknowledge</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {inventoryVisible && (
                <AuthorInventoryModal setUser={setUser} refreshStreak={refreshStreak} visible={inventoryVisible} onClose={() => setInventoryVisible(false)} user={user} theinventory={theinventory} isDark={isDark} />
            )}

            {prefsVisible && (
                <NeuralPrefsModal
                    visible={prefsVisible}
                    onClose={() => setPrefsVisible(false)}
                    favCharacter={favCharacter}
                    setFavCharacter={setFavCharacter}
                    favAnimes={favAnimes}
                    setFavAnimes={setFavAnimes}
                    favGenres={favGenres}
                    setFavGenres={setFavGenres}
                    handleUpdate={handleUpdate}
                    cachedUsername={cachedUsername}
                    cachedDescription={cachedDescription}
                    isUpdating={isUpdating}
                />
            )}

            {securityVisible && (
                <SecurityModal visible={securityVisible} onClose={() => setSecurityVisible(false)} user={user} setUser={setUser} isDark={isDark} />
            )}

            {storeVisible && (
                <AuthorStoreModal setInventory={setInventory} visible={storeVisible} onClose={() => setStoreVisible(false)} user={user} isDark={isDark} />
            )}

            {cardPreviewVisible && (
                <Modal visible={cardPreviewVisible} transparent animationType="slide">
                    <View className="flex-1 bg-black/95">
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setCardPreviewVisible(false)} />
                        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }} showsVerticalScrollIndicator={false}>
                            <View className="w-full items-center">
                                <View className="w-full flex-row pt-10 pb-6 justify-between items-center">
                                    <View>
                                        <Text className="text-white font-black text-xl italic uppercase tracking-widest">Operator Identity</Text>
                                        <Text className="text-gray-500 font-bold text-[9px] uppercase tracking-[0.4em] mt-1">Classification Preview</Text>
                                    </View>
                                    <Pressable onPress={() => setCardPreviewVisible(false)} className="w-12 h-12 bg-white/10 rounded-full items-center justify-center active:bg-white/20">
                                        <Ionicons name="close" size={24} color="white" />
                                    </Pressable>
                                </View>

                                {/* ⚡️ WIN 3: Wrapped ViewShot directly around the visible UI */}
                                <View style={{ transform: [{ scale: Math.min(1, (width - 40) / 380) }], width: 380, alignItems: 'center', marginVertical: 20 }} className="shadow-2xl shadow-blue-500/20">
                                    <ViewShot ref={playerCardRef} options={{ format: "png", quality: 1 }}>
                                        <PlayerCard author={user} totalPosts={totalPosts} isDark={isDark} />
                                    </ViewShot>
                                </View>

                                <View className="w-full mt-6">
                                    <View className="flex-row gap-3 w-full">
                                        <TouchableOpacity onPress={captureAndSave} disabled={isSaving} className="flex-1 h-16 bg-gray-800 rounded-[30px] items-center justify-center border border-gray-700 active:scale-95">
                                            {isSaving ? <ActivityIndicator size="small" color="white" /> : (
                                                <View className="flex-row items-center gap-2">
                                                    <Feather name="download" size={20} color="white" />
                                                    <Text className="text-white font-black uppercase text-[10px] tracking-widest italic">Save</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={captureAndShare} style={{ backgroundColor: dynamicAuraColor }} className="flex-[2] h-16 rounded-[30px] flex-row items-center justify-center gap-3 shadow-lg active:scale-95">
                                            <MaterialCommunityIcons name="share-variant-outline" size={22} color="white" />
                                            <Text className="text-white font-black uppercase tracking-[0.2em] text-xs italic">Broadcast Card</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Pressable onPress={() => setCardPreviewVisible(false)} className="mt-6 items-center p-3">
                                        <Text className="text-gray-500 text-[11px] font-black uppercase tracking-widest underline">Cancel Operation</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </Modal>
            )}

            {isEditorVisible && (
                <ImageEditorModal isVisible={isEditorVisible} isProfilePicture={true} imageUri={imageToEditUri} onClose={() => { setIsEditorVisible(false); setImageToEditUri(null); }} onSave={handleSaveEditedImage} />
            )}
        </View>
    );
}



const NeuralPrefsModal = memo(({
    visible,
    onClose,
    favCharacter, setFavCharacter,
    favAnimes, setFavAnimes,
    favGenres, setFavGenres,
    handleUpdate,
    cachedUsername,
    cachedDescription,
    isUpdating
}) => {
    // Convert comma-separated strings into arrays for the UI chips
    const [localCharacter, setLocalCharacter] = useState(favCharacter || '');
    const [localAnimes, setLocalAnimes] = useState([]);
    const [localGenres, setLocalGenres] = useState([]);

    // State for handling new inline inputs
    const [activeInput, setActiveInput] = useState(null); // 'character' | 'anime' | 'genre' | null
    const [tempValue, setTempValue] = useState('');

    // Sync initial props to local state when modal opens
    useEffect(() => {
        if (visible) {
            setLocalCharacter(favCharacter || '');
            setLocalAnimes(favAnimes ? favAnimes.split(',').map(s => s.trim()).filter(Boolean) : []);
            setLocalGenres(favGenres ? favGenres.split(',').map(s => s.trim()).filter(Boolean) : []);
            setActiveInput(null);
            setTempValue('');
        }
    }, [visible, favCharacter, favAnimes, favGenres]);

    // --- Action Handlers ---
    const handleSaveInput = () => {
        if (!tempValue.trim()) {
            setActiveInput(null);
            return;
        }

        if (activeInput === 'character') {
            setLocalCharacter(tempValue.trim()); // Replaces the old one
        } else if (activeInput === 'anime') {
            setLocalAnimes([...localAnimes, tempValue.trim()]); // Appends to list
        } else if (activeInput === 'genre') {
            setLocalGenres([...localGenres, tempValue.trim()]); // Appends to list
        }

        setTempValue('');
        setActiveInput(null);
    };

    const handleRemove = (type, index) => {
        if (type === 'character') setLocalCharacter('');
        if (type === 'anime') setLocalAnimes(localAnimes.filter((_, i) => i !== index));
        if (type === 'genre') setLocalGenres(localGenres.filter((_, i) => i !== index));
    };

    const onSyncPreferences = () => {
        // Update parent state first
        setFavCharacter(localCharacter);
        setFavAnimes(localAnimes.join(', '));
        setFavGenres(localGenres.join(', '));

        // Trigger the backend update function
        handleUpdate(cachedUsername, cachedDescription);
        onClose();
    };

    // --- Render Helpers ---
    const renderChip = (text, type, index = 0) => (
        <View key={`${type}-${index}`} className="flex-row items-center justify-between bg-[#121212] border border-purple-500/30 px-4 py-3 rounded-2xl mb-3 shadow-sm">
            <View className="flex-row items-center flex-1">
                <View className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-3 shadow-sm shadow-purple-500" />
                <Text className="text-white font-black italic uppercase text-xs flex-1 tracking-wider" numberOfLines={1}>
                    {text}
                </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(type, index)} className="p-1 bg-red-500/10 rounded-full">
                <Ionicons name="close" size={16} color="#ef4444" />
            </TouchableOpacity>
        </View>
    );

    const renderInputArea = (type, placeholder) => {
        if (activeInput === type) {
            return (
                <View className="flex-row items-center bg-[#121212] border-2 border-purple-500 rounded-2xl px-4 py-2 mt-1 mb-3">
                    <TextInput
                        autoFocus
                        value={tempValue}
                        onChangeText={setTempValue}
                        placeholder={placeholder}
                        placeholderTextColor="#6b7280"
                        className="flex-1 text-white font-black italic text-xs h-10"
                        onSubmitEditing={handleSaveInput}
                    />
                    <TouchableOpacity onPress={handleSaveInput} className="bg-purple-500 p-1.5 rounded-lg ml-2">
                        <Ionicons name="checkmark-sharp" size={16} color="white" />
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <TouchableOpacity
                onPress={() => setActiveInput(type)}
                className="flex-row items-center justify-center bg-purple-500/10 border border-purple-500/20 py-3 rounded-2xl mb-3 border-dashed"
            >
                <Ionicons name="add" size={16} color="#a855f7" />
                <Text className="text-purple-400 font-black uppercase text-[10px] tracking-widest ml-1">
                    Add {type === 'character' ? 'Character' : type === 'anime' ? 'Anime' : 'Genre'}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} // Force the modal to ignore status bar height changes
            statusBarTranslucent
            presentationStyle="overFullScreen">
            {/* FIX 1: Android Modals handle keyboards natively. 
              Only force 'padding' on iOS to prevent the double-offset downward push.
            */}
            <View className="flex-1 justify-end">

                {/* Backdrop */}
                <Pressable
                    className="absolute inset-0 bg-black/80"
                    onPress={onClose}
                />

                {/* Container */}
                <View className="bg-[#09090b] w-full max-h-[85%] flex-shrink rounded-t-[32px] p-6 border-t border-x border-purple-500/30">

                    {/* Header Bar */}
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-2xl font-black uppercase italic tracking-wider text-white">Neural Prefs</Text>
                            <Text className="text-purple-500 font-black text-[10px] uppercase mt-1 tracking-widest">Identity Matrix Parameters</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-zinc-900 p-3 rounded-full border border-zinc-800">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        /* FIX 2: flexGrow 1 ensures it fills space without breaking layout */
                        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
                        keyboardShouldPersistTaps="handled"
                        /* FIX 3: Magic prop that stops the auto-scroll-to-top reset */
                        automaticallyAdjustKeyboardInsets={true}
                    >

                        {/* GOAT Character Section */}
                        <View className="mb-6">
                            <View className="flex-row items-center mb-3">
                                <MaterialCommunityIcons name="account-star" size={16} color="#a855f7" />
                                <Text className="text-gray-400 font-black uppercase text-[10px] tracking-widest ml-2">Absolute GOAT Character</Text>
                            </View>
                            {localCharacter ? (
                                renderChip(localCharacter, 'character')
                            ) : (
                                renderInputArea('character', 'E.G. ITACHI UCHIHA')
                            )}
                        </View>

                        {/* Favorite Animes Section */}
                        <View className="mb-6">
                            <View className="flex-row items-center mb-3">
                                <MaterialCommunityIcons name="animation-play" size={16} color="#a855f7" />
                                <Text className="text-gray-400 font-black uppercase text-[10px] tracking-widest ml-2">Favorite Animes</Text>
                            </View>
                            {localAnimes.map((anime, idx) => renderChip(anime, 'anime', idx))}
                            {renderInputArea('anime', 'E.G. ONE PIECE')}
                        </View>

                        {/* Favorite Genres Section */}
                        <View className="mb-6">
                            <View className="flex-row items-center mb-3">
                                <MaterialCommunityIcons name="shape-plus" size={16} color="#a855f7" />
                                <Text className="text-gray-400 font-black uppercase text-[10px] tracking-widest ml-2">Favorite Genres</Text>
                            </View>
                            {localGenres.map((genre, idx) => renderChip(genre, 'genre', idx))}
                            {renderInputArea('genre', 'E.G. PSYCHOLOGICAL')}
                        </View>

                    </ScrollView>

                    {/* Sticky Footer */}
                    <View className="pt-4 border-t border-zinc-800">
                        <TouchableOpacity
                            onPress={onSyncPreferences}
                            disabled={isUpdating}
                            className={`bg-purple-600 p-4 rounded-2xl items-center shadow-lg shadow-purple-600/30 active:opacity-80 flex-row justify-center ${isUpdating ? 'opacity-50' : ''}`}
                        >
                            {isUpdating ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="sync" size={18} color="white" className="mr-2" />
                                    <Text className="text-white font-black uppercase tracking-widest text-[13px] ml-2">Sync Preferences</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
});