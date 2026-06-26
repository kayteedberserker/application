import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list"; // ⚡️ High-Performance List
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { useRouter } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import * as Sharing from "expo-sharing";
import { MotiView } from 'moti';
import { useColorScheme as useNativeWind } from "nativewind";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
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

const { width } = Dimensions.get("window");
const LIMIT = 5;

const fetcher = (url) => apiFetch(url).then((res) => res.json());

// 🎨 --- RENDERER FOR BACKEND SVGS ---
const RemoteSvgIcon = React.memo(({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    return <SvgXml xml={xml} width={size} height={size} color={color} />;
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
    const { coins, processTransaction, isProcessingTransaction } = useCoins();
    const storage = useMMKV();
    const CustomAlert = useAlert();

    const CACHE_KEY = "STORE_CATALOG_CACHE";

    const [catalog, setCatalog] = useState(() => {
        try {
            const cached = storage.getString(CACHE_KEY);
            return cached ? JSON.parse(cached) : { themes: [], standaloneItems: [] };
        } catch { return { themes: [], standaloneItems: [] }; }
    });

    const [loading, setLoading] = useState(() => {
        try {
            const cached = storage.getString(CACHE_KEY);
            const parsed = cached ? JSON.parse(cached) : null;
            return !(parsed && (parsed.themes?.length > 0 || parsed.standaloneItems?.length > 0));
        } catch { return true; }
    });

    const [selectedTheme, setSelectedTheme] = useState(null);
    const [itemToPreview, setItemToPreview] = useState(null);
    const isFetching = useRef(false);

    useEffect(() => {
        if (visible) loadStoreData();
        else { setSelectedTheme(null); setItemToPreview(null); }
    }, [visible]);

    const loadStoreData = async () => {
        if (isFetching.current) return;
        isFetching.current = true;
        try {
            const res = await apiFetch('/store?type=author');
            const data = await res.json();
            if (data.success && data.catalog) {
                const newCatalog = { themes: data.catalog.themes || [], standaloneItems: data.catalog.standaloneItems || [] };
                setCatalog(newCatalog);
                storage.set(CACHE_KEY, JSON.stringify(newCatalog));
            }
        } catch (err) { console.error(err); } finally { setLoading(false); isFetching.current = false; }
    };

    const executePurchase = async (item) => {
        const itemCurrency = item.currency || 'OC';
        const currentBalance = coins;
        const currencyName = "OC";

        if (currentBalance < item.price) {
            CustomAlert("Insufficient Funds", `You need more ${currencyName}.`);
            return;
        }

        const result = await processTransaction('buy_item', item.category, {
            itemId: item.id, price: item.price, name: item.name, category: item.category, currency: itemCurrency,
            visualConfig: item.visualData || item.visualConfig, expiresInDays: item.expiresInDays, rarity: item.rarity
        });

        if (result.success) {
            CustomAlert("Success", "Item added to your inventory!");
            if (typeof setInventory === 'function') setInventory(result.inventory);
            setItemToPreview(null);
        } else {
            CustomAlert("Error", result.error || "Transaction failed");
        }
    };

    const groupedStandaloneItems = useMemo(() => {
        return catalog.standaloneItems.reduce((groups, item) => {
            const category = item.category || 'MISC';
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
            return groups;
        }, {});
    }, [catalog.standaloneItems]);

    const renderCompactCard = (item) => {
        const visual = item.visualData || item.visualConfig || {};
        const isBorder = item.category === 'BORDER';
        const cardRarityColor = getRarityColor(item.rarity);

        return (
            <TouchableOpacity key={item.id} onPress={() => setItemToPreview(item)} className="bg-gray-100 dark:bg-[#1a1a1a] mr-4 p-4 rounded-3xl w-40 border shadow-sm mb-4" style={{ borderColor: `${cardRarityColor}40` }}>
                <View className="mb-3">
                    <View className="h-24 w-full bg-black/10 dark:bg-black/40 rounded-2xl items-center justify-center overflow-hidden border dark:border-white/5 relative" style={{ borderColor: `${cardRarityColor}20` }}>
                        {isBorder ? (
                            <ClanBorder color={visual.primaryColor || visual.color || "#ff0000"} secondaryColor={visual.secondaryColor} animationType={visual.animationType} duration={visual.duration}>
                                <View className="h-10 flex justify-center items-center rounded-sm"><Text className="text-[10px] dark:text-white/50 font-black uppercase tracking-tighter">Frame</Text></View>
                            </ClanBorder>
                        ) : visual.svgCode ? (
                            <RemoteSvgIcon xml={visual.svgCode} color={visual.glowColor || visual.primaryColor || visual.color} size={50} />
                        ) : (
                            <MaterialCommunityIcons name={visual.icon || 'help-circle-outline'} size={40} color={visual.color || (isDark ? 'white' : 'black')} />
                        )}
                        <View style={{ backgroundColor: cardRarityColor }} className="absolute top-2 right-2 w-2 h-2 rounded-full shadow-lg" />
                    </View>
                </View>
                <Text className="dark:text-white font-black text-[11px] uppercase tracking-tight" numberOfLines={1}>{item.name}</Text>
                <View className="flex-row items-center mt-2 justify-between">
                    <View className="flex-row items-center bg-green-500/10 px-2 py-0.5 rounded-lg">
                        <Text className="text-green-600 dark:text-green-500 font-black text-[10px] mr-1">{item.price}</Text>
                        <CoinIcon type={item.currency || "OC"} size={10} />
                    </View>
                    <View style={{ backgroundColor: cardRarityColor }} className="p-1.5 rounded-full shadow-lg shadow-blue-500/30">
                        <Ionicons name="eye" size={12} color="white" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-[#0a0a0a] h-[85%] rounded-t-[40px] p-6 border-t-4 border-green-500">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <TouchableOpacity onPress={() => selectedTheme ? setSelectedTheme(null) : null} className="flex-row items-center" disabled={!selectedTheme}>
                                {selectedTheme && <Ionicons name="chevron-back" size={20} color="#22c55e" />}
                                <Text className="text-2xl font-black uppercase italic dark:text-white">{selectedTheme ? selectedTheme.label : "Black Market"}</Text>
                            </TouchableOpacity>
                            <View className="flex-row items-center mt-1 bg-gray-100 dark:bg-zinc-900 self-start px-3 py-1.5 rounded-full">
                                <Text className="text-blue-500 font-black text-[10px] uppercase mr-1">OC: {coins || 0}</Text><CoinIcon type="OC" size={10} />
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-gray-100 dark:bg-zinc-900 p-3 rounded-full">
                            <Ionicons name="close" size={24} color={isDark ? "white" : "black"} />
                        </TouchableOpacity>
                    </View>
                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#22c55e" />
                            <Text className="text-green-500 font-black uppercase text-[10px] mt-4 tracking-widest">Downloading Assets...</Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                            {!selectedTheme ? (
                                <View>
                                    {Object.entries(groupedStandaloneItems).map(([category, items]) => (
                                        <View key={category} className="mb-8">
                                            <View className="flex-row items-center mb-3">
                                                <View className="w-1 h-3 bg-green-500 rounded-full mr-2" /><Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">{category}S</Text>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: items.length > 1 ? 380 : 180 }} contentContainerStyle={{ flexDirection: 'column', flexWrap: 'wrap' }}>
                                                {items.map(item => renderCompactCard(item))}
                                            </ScrollView>
                                        </View>
                                    ))}
                                    {catalog.themes?.length > 0 && (
                                        <View>
                                            <View className="flex-row items-center mb-4 mt-2">
                                                <View className="w-1 h-3 bg-blue-500 rounded-full mr-2" /><Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">Thematic Collections</Text>
                                            </View>
                                            <View className="flex-row flex-wrap justify-between">
                                                {catalog.themes.map((theme) => (
                                                    <TouchableOpacity key={theme.id} onPress={() => setSelectedTheme(theme)} className="w-[48%] bg-gray-100 dark:bg-[#1a1a1a] p-6 rounded-3xl mb-4 items-center border border-gray-200 dark:border-gray-800 shadow-sm">
                                                        <View className="mb-3"><RemoteSvgIcon xml={theme.iconsvg} color="#22c55e" size={80} /></View>
                                                        <Text className="dark:text-white font-black uppercase mt-1 text-center text-xs">{theme.label}</Text>
                                                        <View className="bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded-md mt-2"><Text className="text-gray-500 text-[8px] uppercase font-bold">{theme.items?.length || 0} Items</Text></View>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    {['BACKGROUND', "WATERMARK", 'GLOW', 'BORDER', 'AVATAR_VFX', 'AVATAR'].map((cat) => {
                                        const themeItems = selectedTheme.items?.filter(i => i.category?.toUpperCase() === cat) || [];
                                        if (themeItems.length === 0) return null;
                                        return (
                                            <View key={cat} className="mb-6">
                                                <View className="flex-row items-center mb-3">
                                                    <View className="w-1 h-3 bg-green-500 rounded-full mr-2" /><Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">{cat}S</Text>
                                                </View>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: themeItems.length > 1 ? 380 : 180 }} contentContainerStyle={{ flexDirection: 'column', flexWrap: 'wrap' }}>
                                                    {themeItems.map(item => renderCompactCard(item))}
                                                </ScrollView>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
            <ItemPreviewModal isVisible={!!itemToPreview} onClose={() => setItemToPreview(null)} currentUser={user} selectedProduct={itemToPreview} onAction={executePurchase} isProcessing={isProcessingTransaction} actionType="buy" />
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
});

const AuthorInventoryModal = memo(({ visible, onClose, user, setUser, isDark, theinventory }) => {
    const [filter, setFilter] = useState('ALL');
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatingTitle, setUpdatingTitle] = useState(null);
    const [itemToPreview, setItemToPreview] = useState(null);
    const CustomAlert = useAlert();

    const inventory = theinventory || user?.inventory || [];
    const categories = ['ALL', 'TITLE', 'GLOW', 'BORDER', 'WATERMARK', "AVATAR", 'AVATAR_VFX', 'HYPE'];

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
            formData.append("userId", user?._id || ""); formData.append("fingerprint", user?.deviceId || "");
            formData.append("inventory", JSON.stringify(updatedInventory)); formData.append("username", user?.username || "");
            formData.append("description", user?.description || "");
            if (user?.preferences) formData.append("preferences", JSON.stringify(user.preferences));
            const res = await apiFetch(`/users/upload`, { method: "PUT", body: formData });
            const result = await res.json();
            if (res.ok) { setUser(result.user); setItemToPreview(null); } else { throw new Error(result.message || "Sync failed"); }
        } catch (err) { CustomAlert("Error", "Failed to sync equipment changes."); } finally { setIsUpdating(false); }
    };

    const handleEquipTitle = async (selectedTitle) => {
        if (isUpdating) return;
        setIsUpdating(true); setUpdatingTitle(selectedTitle.name);
        try {
            const formData = new FormData();
            formData.append("userId", user?._id || ""); formData.append("fingerprint", user?.deviceId || "");
            formData.append("inventory", JSON.stringify(inventory)); formData.append("username", user?.username || "");
            formData.append("description", user?.description || "");
            const titleName = user?.equippedTitle?.name || "";
            const isCurrentlyEquipped = titleName === selectedTitle.name;
            const newEquippedTitle = isCurrentlyEquipped ? null : { name: selectedTitle.name, tier: selectedTitle.tier };
            formData.append("equippedTitle", newEquippedTitle ? JSON.stringify(newEquippedTitle) : "");
            if (user?.preferences) formData.append("preferences", JSON.stringify(user.preferences));
            const res = await apiFetch(`/users/upload`, { method: "PUT", body: formData });
            const result = await res.json();
            if (res.ok) { setUser(result.user); } else { throw new Error(result.message || "Sync failed"); }
        } catch (err) { CustomAlert("Error", "Failed to sync title changes."); } finally { setIsUpdating(false); setUpdatingTitle(null); }
    };

    const confirmEquipTitle = (title) => {
        const isEquipped = user?.equippedTitle?.name === title.name;
        const actionText = isEquipped ? "Unequip" : "Equip";
        CustomAlert(`${actionText} Title`, `Do you want to ${actionText.toLowerCase()} the [${title.tier}] ${title.name} title?`, [
            { text: "Cancel", style: "cancel" }, { text: actionText, onPress: () => handleEquipTitle(title) }
        ]);
    };

    const filteredInventory = filter === 'ALL' ? inventory : inventory.filter(item => item.category === filter);

    const getExpirationText = (expiry) => {
        if (!expiry) return null;
        const diff = new Date(expiry) - new Date();
        if (diff <= 0) return "Expired";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days}d remaining`;
        return `${Math.floor(diff / (1000 * 60 * 60))}h remaining`;
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-[#0d1117] h-[85%] rounded-t-[40px] p-6 border-t-4 border-blue-500">
                    <View className="flex-row justify-between items-center mb-4">
                        <View>
                            <Text className="text-2xl font-black uppercase italic dark:text-white">Arsenal</Text>
                            <Text className="text-blue-500 font-black text-[10px] uppercase tracking-widest">{filter === 'TITLE' ? user?.unlockedTitles?.length || 0 : inventory.length} Collectibles Owned</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={!isDark ? "black" : "white"} /></TouchableOpacity>
                    </View>

                    <View className="flex-row mb-6">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {categories.map((cat) => (
                                <TouchableOpacity key={cat} onPress={() => setFilter(cat)} className={`mr-2 px-4 py-2 rounded-full border ${filter === cat ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-gray-700'}`}>
                                    <Text className={`text-[10px] font-black uppercase ${filter === cat ? 'text-white' : 'text-gray-500'}`}>
                                        {cat}{cat === "TITLE" && user?.unlockedTitles?.length > 0 && <Text className={`text-[10px] font-black uppercase ${filter === cat ? 'text-white' : 'text-gray-500'}`}> ({user.unlockedTitles.length})</Text>}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {filter === 'TITLE' ? (
                            user?.unlockedTitles && user.unlockedTitles.length > 0 ? (
                                user.unlockedTitles.map((title, idx) => {
                                    const isEquipped = user?.equippedTitle?.name === title.name;
                                    const isThisTitleUpdating = isUpdating && updatingTitle === title.name;
                                    return (
                                        <TouchableOpacity key={`title-${idx}`} onPress={() => confirmEquipTitle(title)} disabled={isUpdating} className={`flex-row items-center justify-between py-4 px-2 rounded-3xl mb-3 border ${isEquipped ? 'bg-blue-500/10 border-blue-500' : 'bg-gray-50 dark:bg-[#161b22] border-gray-100 dark:border-gray-800'}`}>
                                            <View className="flex-1 mr-4"><TitleTag isDark={isDark} isVisible={true} key={title.name} title={title.name} size={12} tier={title.tier} /></View>
                                            <View className="items-center justify-center min-w-[60px]">
                                                {isThisTitleUpdating ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text className={`text-[10px] font-black uppercase ${isEquipped ? 'text-blue-500' : 'text-gray-400'}`}>{isEquipped ? 'Equipped' : 'Equip'}</Text>}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <View className="items-center mt-20 opacity-30"><MaterialCommunityIcons name="format-title" size={80} color="gray" /><Text className="mt-4 font-black uppercase text-xs tracking-widest dark:text-white">No Titles Unlocked</Text></View>
                            )
                        ) : (
                            filteredInventory.length > 0 ? (
                                filteredInventory.map((item, idx) => {
                                    const expiration = getExpirationText(item.expiresAt);
                                    const isExpired = expiration === "Expired";
                                    const isBorder = item.category === 'BORDER';
                                    const isHype = item.category === 'HYPE';
                                    const visual = item.visualConfig || {};
                                    const rowRarityColor = getRarityColor(item.rarity);
                                    const imageUrl = item.url || visual.url;
                                    const hypeConfig = isHype ? (HYPE_TIERS[item.hypeType] || HYPE_TIERS.FREE) : null;

                                    const PreviewIcon = (
                                        <View className={`w-16 h-16 bg-black/20 items-center justify-center rounded-2xl overflow-hidden ${(isBorder || isHype) ? '' : 'border relative'}`} style={{ borderColor: `${rowRarityColor}40` }}>
                                            {isHype ? (
                                                <HypeIconDisplay tierKey={hypeConfig.abbr} color={hypeConfig.glow} size={38} />
                                            ) : isBorder ? (
                                                <ClanBorder color={visual.primaryColor || visual.color || "#ff0000"} secondaryColor={visual.secondaryColor} animationType={visual.animationType} duration={visual.duration}>
                                                    <View className="h-6 w-6 flex justify-center items-center"><Text className="text-[6px] dark:text-white/40 font-black uppercase">Frame</Text></View>
                                                </ClanBorder>
                                            ) : imageUrl ? (
                                                <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                                            ) : visual.svgCode ? (
                                                <RemoteSvgIcon xml={visual.svgCode} size={40} color={visual.primaryColor || visual.color} />
                                            ) : (
                                                <MaterialCommunityIcons name={visual.icon || 'star'} size={30} color={visual.primaryColor || visual.color || 'white'} />
                                            )}
                                            <View style={{ backgroundColor: rowRarityColor }} className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full shadow-sm" />
                                        </View>
                                    );

                                    return (
                                        <View key={item.itemId || idx} className={`flex-row items-center p-4 rounded-3xl mb-3 border ${item.isEquipped ? 'bg-blue-500/10 border-blue-500' : 'bg-gray-50 dark:bg-[#161b22]'} ${isExpired ? 'opacity-50 border-red-500/30' : 'border-gray-100 dark:border-gray-800'}`}>
                                            {item.isConsumable ? (
                                                <View className="mr-4">{isBorder ? <ClanBorder color={visual.primaryColor || visual.color || "#ff0000"} secondaryColor={visual.secondaryColor} animationType={visual.animationType} duration={visual.duration}><View className="h-10 flex justify-center items-center rounded-sm"><Text>Clan Banner</Text></View></ClanBorder> : PreviewIcon}</View>
                                            ) : (
                                                <TouchableOpacity onPress={() => setItemToPreview(item)} className="mr-4">{isBorder ? <ClanBorder color={visual.primaryColor || visual.color || "#ff0000"} secondaryColor={visual.secondaryColor} animationType={visual.animationType} duration={visual.duration}><View className="h-10 flex justify-center items-center rounded-sm"><Text>Clan Banner</Text></View></ClanBorder> : PreviewIcon}</TouchableOpacity>
                                            )}
                                            <View className="flex-1">
                                                <Text className="font-black dark:text-white text-sm uppercase italic">{item.name}{item.isConsumable && (item.itemCount || 1) > 1 && <Text className="text-blue-500 font-extrabold text-xs normal-case not-italic"> (x{item.itemCount})</Text>}</Text>
                                                <View className="flex-row mt-2 items-center">
                                                    <Text style={{ color: rowRarityColor }} className="text-[9px] uppercase font-bold tracking-widest">{item.rarity || 'COMMON'} {item.category}</Text>
                                                    {expiration && <><Text className="text-gray-600 dark:text-gray-400 text-[9px] mx-1">•</Text><View className="flex-row items-center"><MaterialCommunityIcons name="clock-outline" size={10} color={isExpired ? "#ef4444" : "#6b7280"} /><Text className={`text-[9px] font-bold ml-1 ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>{expiration}</Text></View></>}
                                                </View>
                                            </View>
                                            {!isExpired && item.category !== "VERIFIED" && !item.isConsumable && (
                                                <TouchableOpacity disabled={isUpdating} onPress={() => handleEquipToggle(item)} className={`px-6 py-3 rounded-xl ${item.isEquipped ? 'bg-green-500' : 'bg-blue-600'} ${isUpdating && !updatingTitle ? 'opacity-50' : ''}`}>
                                                    {isUpdating && !updatingTitle ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white text-[10px] font-black uppercase">{item.isEquipped ? 'Active' : 'Equip'}</Text>}
                                                </TouchableOpacity>
                                            )}
                                            {!isExpired && item.isConsumable && <View className="px-4 py-2 bg-blue-500/10 rounded-xl border border-blue-500/20"><Text className="text-blue-500 text-[10px] font-black uppercase">Stock: {item.itemCount || 1}</Text></View>}
                                            {isExpired && <View className="px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/20"><Text className="text-red-500 text-[10px] font-black uppercase">Void</Text></View>}
                                        </View>
                                    );
                                })
                            ) : (
                                <View className="items-center mt-20 opacity-30"><MaterialCommunityIcons name="package-variant" size={80} color="gray" /><Text className="mt-4 font-black uppercase text-xs tracking-widest dark:text-white">No {filter === 'ALL' ? '' : filter} items</Text></View>
                            )
                        )}
                    </ScrollView>
                </View>
            </View>
            <ItemPreviewModal isVisible={!!itemToPreview} onClose={() => setItemToPreview(null)} currentUser={user} selectedProduct={itemToPreview} onAction={handleEquipToggle} isProcessing={isUpdating} actionType="equip" />
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
// 🔹 MAIN COMPONENT
// ==========================================
export default function MobileProfilePage() {
    const storage = useMMKV();
    const CustomAlert = useAlert()
    const [theinventory, setInventory] = useState([])
    const { user, setUser, contextLoading, handleLogout, isLoggingOut } = useUser();

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
                    await Asset.create(uri);
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

    const posts = useMemo(() => {
        return data ? data.flatMap((page) => page.posts || []) : [];
    }, [data])

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

        // --- NEW: Name Change Logic ---
        let isChangingName = false;
        let usingNameChangeCard = false;

        if (updatedUsername !== cachedUsername) {
            isChangingName = true;

            // Check if they have the card in inventory
            const hasNameChangeCard = user?.inventory?.some(item =>
                item.itemId === "name_change_card" && item.category === "CONSUMABLE"
            );

            if (hasNameChangeCard) {
                usingNameChangeCard = true;
                // You might want to use a CustomAlert to confirm consuming the card here, 
                // but for seamless UX, using it automatically is often preferred.
                Toast.show({ type: 'info', text1: 'Using Name Card', text2: 'Consuming 1x Name Change Card' });
            } else {
                // If no card, check OC balance
                const OC_COST = 200;
                if ((user?.coins || 0) < OC_COST) {
                    CustomAlert("Insufficient Funds", `A Name Change requires a Name Change Card or ${OC_COST} OC. You currently have ${user?.coins || 0} OC.`);
                    return; // Stop the update process
                }

                // Await user confirmation to spend OC
                const userConfirmed = await new Promise((resolve) => {
                    CustomAlert(
                        "Confirm Name Change",
                        `Changing your identity costs ${OC_COST} OC. Proceed?`,
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
            formData.append("description", updatedDescription);
            formData.append("username", updatedUsername);

            // Append Economy Flags
            formData.append("isChangingName", isChangingName);
            formData.append("usingNameChangeCard", usingNameChangeCard);

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
                setCachedUsername(result.user.username); // Update cache so consecutive saves don't trigger name change logic
                setPreview(null);
                setImageFile(null);
                CustomAlert("Success", "Character Data Updated.");
            } else {
                CustomAlert("Error", result.message || "Failed to update.");
            }
        } catch (err) {
            CustomAlert("Error", "Failed to sync changes.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = (postId) => {
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
    };

    // ⚡️ ONBOARDING TOOLTIP STATE ANIMATIONS (Moved cleanly into the main block)
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
        </View>
    ), [user, preview, isDark, dynamicAuraColor, weeklyGloryRank, weeklyAuraTier, equippedGlow, totalPosts, writerRank, totalAura, weeklyGloryPoints, totalHyped, totalHypes, cachedUsername, cachedDescription, isUpdating, isLoggingOut, isOnboarding, onboardingStep, currentPosTop]);

    return (
        <View className="flex-1 bg-white dark:bg-[#0a0a0a]" style={{ paddingTop: insets.top }}>
            <AppOnboarding />

            <View className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full" pointerEvents="none" />
            <View className="absolute bottom-0 left-0 w-60 h-60 bg-purple-600/5 rounded-full" pointerEvents="none" />

            {/* ⚡️ WIN 1: High Performance LegendList */}
            <LegendList
                data={posts}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={listHeader}
                scrollEnabled={!isOnboarding}
                onScroll={(e) => DeviceEventEmitter.emit("onScroll", e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                estimatedItemSize={250} // ⚡️ Key for fast measuring
                removeClippedSubviews={true}
                onEndReached={() => { if (!isReachingEnd && !isValidating) setSize(size + 1); }}
                onEndReachedThreshold={0.5}
                renderItem={({ item }) => (
                    <View className="px-6 mb-4">
                        <View className="bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
                            <View className="flex-row justify-between items-start mb-3">
                                <Pressable onPress={() => router.push(`/post/${item.slug || item._id}`)} className="flex-1 pr-4">
                                    <Text className="font-black text-base uppercase tracking-tight text-gray-900 dark:text-white" numberOfLines={2}>
                                        {item.title || item.message}
                                    </Text>
                                    <View className="flex-row items-center mt-2">
                                        <View className="bg-blue-500/10 px-2 py-0.5 rounded-md mr-2">
                                            <Text className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        {item.category && <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">• {item.category}</Text>}
                                    </View>
                                </Pressable>
                                <TouchableOpacity onPress={() => handleDelete(item._id)} className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg">
                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-gray-50 dark:border-gray-800/50">
                                <View className="flex-row items-center gap-4">
                                    <View className="items-center flex-row gap-1"><Ionicons name="heart" size={14} color="#ef4444" /><Text className="text-gray-600 dark:text-gray-400 text-[11px] font-bold">{item.likesCount || 0}</Text></View>
                                    <View className="items-center flex-row gap-1"><Ionicons name="chatbubble" size={14} color="#3b82f6" /><Text className="text-gray-600 dark:text-gray-400 text-[11px] font-bold">{item.commentsCount || 0}</Text></View>
                                    <View className="items-center flex-row gap-1"><Ionicons name="chatbox-ellipses" size={14} color="#f59e0b" /><Text className="text-gray-600 dark:text-gray-400 text-[11px] font-bold">{item.discussionCount || 0}</Text></View>
                                    <View className="items-center flex-row gap-1"><Ionicons name="flash" size={14} color="#00ff00" /><Text className="text-gray-600 dark:text-gray-400 text-[11px] font-bold">{item.hypePointsCount || 0}</Text></View>
                                </View>
                                <View className="flex-row items-center gap-4">
                                    <View className="items-center flex-row gap-1"><Ionicons name="eye" size={14} color={isDark ? "#6b7280" : "#9ca3af"} /><Text className="text-gray-600 dark:text-gray-400 text-[11px] font-bold">{item.formattedViews || "0"}</Text></View>
                                    <View className="items-center flex-row gap-1"><Ionicons name="share-social" size={14} color={isDark ? "#6b7280" : "#9ca3af"} /><Text className="text-gray-600 dark:text-gray-400 text-[11px] font-bold">{item.sharesCount || 0}</Text></View>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
                ListEmptyComponent={() => isLoadingInitialData ? <SyncLoading /> : (
                    <View className="mx-6 p-10 bg-gray-50 dark:bg-[#121212] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 items-center my-4">
                        <Ionicons name="document-text-outline" size={32} color={isDark ? "#4b5563" : "#9ca3af"} />
                        <Text className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-4">Empty Logs</Text>
                        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium text-center leading-5">Your intel diary is empty.{"\n"}Start writing to build your archive.</Text>
                    </View>
                )}
                ListFooterComponent={() => <View style={{ paddingBottom: insets.bottom + 100 }}>{isFetchingNextPage && <ActivityIndicator className="py-6" color="#2563eb" />}</View>}
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
                <AuthorInventoryModal setUser={setUser} visible={inventoryVisible} onClose={() => setInventoryVisible(false)} user={user} inventory={theinventory} isDark={isDark} />
            )}

            {prefsVisible && (
                <Modal visible={prefsVisible} animationType="fade" transparent>
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <View className="bg-white dark:bg-[#0d1117] w-full p-8 rounded-[40px] border-2 border-purple-500 shadow-2xl shadow-purple-500/20">
                            <Text className="text-2xl font-black uppercase italic text-gray-900 dark:text-white mb-6 text-center">Neural Prefs</Text>
                            <ScrollView className="space-y-5" showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                                <View className="space-y-2">
                                    <Text className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Absolute GOAT Character</Text>
                                    <TextInput defaultValue={favCharacter} onChangeText={setFavCharacter} placeholder="E.G. ITACHI" placeholderTextColor="#9ca3af" className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl text-gray-900 dark:text-white font-black italic border border-purple-500/20" />
                                </View>
                                <View className="space-y-2 mt-4">
                                    <Text className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Favorite Animes (Comma separated)</Text>
                                    <TextInput defaultValue={favAnimes} onChangeText={setFavAnimes} placeholder="One Piece, Naruto, Bleach" placeholderTextColor="#9ca3af" className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl text-gray-900 dark:text-white font-black italic border border-purple-500/20" />
                                </View>
                                <View className="space-y-2 mt-4 mb-2">
                                    <Text className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Favorite Genres (Comma separated)</Text>
                                    <TextInput defaultValue={favGenres} onChangeText={setFavGenres} placeholder="Action, Seinen, Psychological" placeholderTextColor="#9ca3af" className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl text-gray-900 dark:text-white font-black italic border border-purple-500/20" />
                                </View>
                            </ScrollView>
                            <TouchableOpacity onPress={() => { handleUpdate(cachedUsername, cachedDescription); setPrefsVisible(false); }} disabled={isUpdating} className="bg-purple-600 p-5 rounded-2xl items-center shadow-lg shadow-purple-600/30 mt-8 active:opacity-80">
                                {isUpdating ? <ActivityIndicator color="white" /> : <Text className="text-white font-black uppercase tracking-widest text-[13px]">Sync Preferences</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setPrefsVisible(false)} className="mt-4 p-2 items-center">
                                <Text className="text-gray-500 text-[11px] font-black uppercase tracking-widest underline">Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
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