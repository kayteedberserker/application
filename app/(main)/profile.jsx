import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMMKV } from "react-native-mmkv"; // 🔹 Swapped to MMKV
import * as Clipboard from 'expo-clipboard';
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useColorScheme as useNativeWind } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import Toast from "react-native-toast-message";
import ViewShot from "react-native-view-shot";
import useSWRInfinite from "swr/infinite";
import AppOnboarding from "../../components/AppOnboarding";
import ClanBorder from "../../components/ClanBorder";
import CoinIcon from "../../components/ClanIcon";
import PlayerCard from "../../components/PlayerCard";
import PlayerNameplate from "../../components/PlayerNameplate";
import { SyncLoading } from "../../components/SyncLoading";
import { Text } from "../../components/Text";
import { useAlert } from "../../context/AlertContext";
import { useCoins } from "../../context/CoinContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";
// ⚡️ Correct Reanimated Imports
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    Easing,
    interpolate
} from "react-native-reanimated";
import AuraAvatar from "../../components/AuraAvatar"; // ⚡️ Needed for the preview
import { MotiView } from 'moti';
import LottieView from 'lottie-react-native'; // ⚡️ Added for Inventory Previews

const { width, height } = Dimensions.get("window");
const API_BASE = "https://oreblogda.com/api";
const LIMIT = 5;

const fetcher = (url) => apiFetch(url).then((res) => res.json());

const getAuraVisuals = (rank) => {
    const AURA_PURPLE = '#a78bfa';
    let visualConfig = {
        color: AURA_PURPLE,
        label: 'AURA OPERATIVE',
        icon: 'target',
        description: 'Your standing in the global hierarchy. Increase your points by engaging and posting logs.'
    };

    if (!rank || rank <= 0) return visualConfig;

    if (rank === 1) {
        visualConfig.color = '#fbbf24';
        visualConfig.label = 'MONARCH';
        visualConfig.icon = 'crown';
        visualConfig.description = 'The absolute peak of the hierarchy. You command the shadows of the network.';
    } else if (rank === 2) {
        visualConfig.color = '#ef4444';
        visualConfig.label = 'YONKO';
        visualConfig.icon = 'flare';
        visualConfig.description = 'An Emperor of the New World. Your influence is felt across all sectors.';
    } else if (rank === 3) {
        visualConfig.color = '#a855f7';
        visualConfig.label = 'KAGE';
        visualConfig.icon = 'moon';
        visualConfig.description = 'The Shadow Leader. Tactical mastery has earned you this seat.';
    } else if (rank === 4) {
        visualConfig.color = '#3b82f6';
        visualConfig.label = 'SHOGUN';
        visualConfig.icon = 'shield-star';
        visualConfig.description = 'Supreme Commander. You lead the elite guard with iron resolve.';
    } else if (rank === 5) {
        visualConfig.color = '#e0f2fe';
        visualConfig.label = 'ESPADA 0';
        visualConfig.icon = 'skull';
        visualConfig.description = 'The Secret Elite. You have surpassed the limits of the numbered guard.';
    } else if (rank >= 6 && rank <= 10) {
        const espadaColors = {
            6: '#cbd5e1',
            7: '#94a3b8',
            8: '#64748b',
            9: '#475569',
            10: '#334155'
        };
        visualConfig.color = espadaColors[rank];
        visualConfig.label = `ESPADA ${rank - 5}`;
        visualConfig.icon = 'sword-cross';
        visualConfig.description = 'One of the ten elite warriors. Continue your ascent to reach the Top 5.';
    } else {
        visualConfig.color = '#1e293b';
        visualConfig.label = 'OPERATIVE';
        visualConfig.icon = 'user';
        visualConfig.description = 'A standard operative in the field. Increase your Aura to rise.';
    }

    return visualConfig;
};

// 🎨 --- RENDERER FOR BACKEND SVGS ---
const RemoteSvgIcon = ({ xml, size = 50, color }) => {
    if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
    return <SvgXml xml={xml} width={size} height={size} color={color} />;
};

const getRarityColor = (rarity) => {
    switch (rarity?.toUpperCase()) {
        case 'MYTHIC': return '#ef4444'; // Red
        case 'LEGENDARY': return '#fbbf24'; // Gold
        case 'EPIC': return '#a855f7'; // Purple
        case 'RARE': return '#3b82f6'; // Blue
        case 'COMMON': default: return '#9ca3af'; // Gray
    }
};

// ==========================================
// 🔹 1. UNIFIED ITEM PREVIEW MODAL (Store & Inventory)
// ==========================================
const ItemPreviewModal = ({
    isVisible,
    onClose,
    currentUser,
    selectedProduct,
    onAction, // Can be handlePurchase OR handleEquip
    isProcessing,
    actionType = "buy" // "buy" or "equip"
}) => {

    const previewUser = useMemo(() => {
        if (!currentUser || !selectedProduct) return null;

        const filteredInventory = (currentUser.inventory || []).map(item => {
            if (item.category === selectedProduct.category) {
                return { ...item, isEquipped: false };
            }
            return item;
        });

        const normalizedProduct = {
            ...selectedProduct,
            isEquipped: true,
            visualConfig: selectedProduct.visualConfig || selectedProduct.visualData || {}
        };

        return {
            ...currentUser,
            inventory: [
                ...filteredInventory,
                normalizedProduct
            ]
        };
    }, [currentUser, selectedProduct]);

    if (!isVisible || !selectedProduct) return null;

    const rarityColor = getRarityColor(selectedProduct.rarity);
    const itemCurrency = selectedProduct.currency || 'OC';

    // Check if the item is already equipped (for inventory view)
    const isCurrentlyEquipped = currentUser?.inventory?.find(i => i.itemId === selectedProduct.itemId)?.isEquipped;

    return (
        <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
            
            {/* ⚡️ FIXED: Pressable background to close on tap outside */}
            <Pressable style={previewStyles.overlay} onPress={onClose} disabled={isProcessing}>
                
                <MotiView
                    from={{ opacity: 0, translateY: 100, scale: 0.9 }}
                    animate={{ opacity: 1, translateY: 0, scale: 1 }}
                    exit={{ opacity: 0, translateY: 100, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    // ⚡️ FIXED: Added maxHeight so it never pushes off-screen
                    style={[previewStyles.modalCard, { borderColor: rarityColor, borderWidth: 1, maxHeight: '85%' }]}
                >
                    {/* ⚡️ FIXED: Inner Pressable stops background tap from triggering when clicking the card */}
                    <Pressable style={{ flexShrink: 1, width: '100%' }} onPress={(e) => e.stopPropagation()}>
                        
                        <TouchableOpacity onPress={onClose} style={previewStyles.closeButton} disabled={isProcessing}>
                            <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>

                        {/* ⚡️ FIXED: Scrollable area for the PlayerCard so it fits on small phones */}
                        <ScrollView 
                            contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            <View style={previewStyles.header}>
                                <MaterialCommunityIcons name="star-four-points" size={16} color={rarityColor} />
                                <Text style={[previewStyles.rarityText, { color: rarityColor }]}>
                                    {selectedProduct.rarity?.toUpperCase() || 'COMMON'} ITEM
                                </Text>
                            </View>

                            {/* THE STAGE */}
                            <View style={previewStyles.stage}>
                                <View style={{ transform: [{ scale: 0.75 }], alignItems: 'center', justifyContent: 'center' }}>
                                    <PlayerCard
                                        author={previewUser}
                                        totalPosts={currentUser?.totalPosts || 0}
                                        isDark={true}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* ⚡️ FIXED: Product Details and Button are Pinned to the bottom outside the ScrollView */}
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
                                    Previewing Item
                                </Text>
                            )}

                            {/* Action Button (Buy vs Equip) */}
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
                                                    Unlock for {selectedProduct.price} {itemCurrency}
                                                </Text>
                                            </>
                                        ) : (
                                            <>
                                                <MaterialCommunityIcons name={isCurrentlyEquipped ? "shield-remove" : "shield-check"} size={18} color="#fff" />
                                                <Text className="text-base font-black text-white ml-2 uppercase">
                                                    {isCurrentlyEquipped ? 'Unequip Item' : 'Equip Item'}
                                                </Text>
                                            </>
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
};

const previewStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
    },
    modalCard: {
        width: width * 0.9,
        backgroundColor: '#111827',
        borderRadius: 32,
        overflow: 'hidden',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 20,
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


// 🔹 2. THE MAIN STORE COMPONENT
const AuthorStoreModal = ({ visible, onClose, user, isDark, setInventory }) => {
    const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins(); 
    const storage = useMMKV(); 
    const CustomAlert = useAlert(); 

    // ⚡️ CACHE CONFIGURATION
    const CACHE_KEY = "STORE_CATALOG_CACHE";
    const hasFetchedThisSession = useRef(false);

    // ⚡️ FIXED: Synchronously initialize from MMKV so there is zero flicker!
    const [catalog, setCatalog] = useState(() => {
        try {
            const cached = storage.getString(CACHE_KEY);
            return cached ? JSON.parse(cached) : { themes: [], standaloneItems: [] };
        } catch {
            return { themes: [], standaloneItems: [] };
        }
    });

    // ⚡️ FIXED: Only start with loading screen if the cache is completely empty
    const [loading, setLoading] = useState(() => {
        try {
            const cached = storage.getString(CACHE_KEY);
            const parsed = cached ? JSON.parse(cached) : null;
            return !(parsed && (parsed.themes?.length > 0 || parsed.standaloneItems?.length > 0));
        } catch {
            return true;
        }
    });

    const [selectedTheme, setSelectedTheme] = useState(null);
    const [itemToPreview, setItemToPreview] = useState(null);

    useEffect(() => {
        if (visible) {
            loadStoreData();
        } else {
            setSelectedTheme(null);
            setItemToPreview(null);
        }
    }, [visible]);

    const loadStoreData = async () => {
        // We already loaded the cache synchronously in useState!
        // Now, we just check if we need to fetch fresh data in the background.
        if (!hasFetchedThisSession.current) {
            try {
                // Failsafe: just in case the catalog is empty
                if (catalog.themes.length === 0 && catalog.standaloneItems.length === 0) {
                    setLoading(true); 
                }
                
                const res = await apiFetch(`/store?type=author`);
                const data = await res.json();

                if (data.success && data.catalog) {
                    const newCatalog = {
                        themes: data.catalog.themes || [],
                        standaloneItems: data.catalog.standaloneItems || []
                    };
                    
                    setCatalog(newCatalog);
                    storage.set(CACHE_KEY, JSON.stringify(newCatalog));
                    hasFetchedThisSession.current = true;
                }
            } catch (e) {
                console.error("Store fetch error:", e);
            } finally {
                setLoading(false);
            }
        }
    };

    const executePurchase = async (item) => {
        const itemCurrency = item.currency || 'OC';
        const currentBalance = itemCurrency === 'CC' ? clanCoins : coins;
        const currencyName = itemCurrency === 'CC' ? "CC" : "OC";

        if (currentBalance < item.price) {
            CustomAlert("Insufficient Funds", `You need more ${currencyName}.`);
            return;
        }

        const result = await processTransaction('buy_item', item.category, {
            itemId: item.id,
            price: item.price,
            name: item.name,
            category: item.category,
            currency: itemCurrency,
            visualConfig: item.visualData || item.visualConfig,
            expiresInDays: item.expiresInDays,
            rarity: item.rarity 
        });

        if (result.success) {
            CustomAlert("Success", "Item added to your inventory!");
            if (typeof setInventory === 'function') {
                setInventory(result.inventory);
            }
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
        const isVfx = item.category === 'AVATAR_VFX';
        const isLottie = !!(visual.lottieUrl || visual.lottieJson);
        const cardRarityColor = getRarityColor(item.rarity);

        return (
            <TouchableOpacity
                key={item.id}
                onPress={() => setItemToPreview(item)}
                className="bg-gray-100 dark:bg-[#1a1a1a] mr-4 p-4 rounded-3xl w-40 border shadow-sm mb-4"
                style={{ borderColor: `${cardRarityColor}40` }}
            >
                <View className="mb-3">
                    <View
                        className="h-24 w-full bg-black/10 dark:bg-black/40 rounded-2xl items-center justify-center overflow-hidden border dark:border-white/5 relative"
                        style={{ borderColor: `${cardRarityColor}20` }}
                    >
                        {isBorder ? (
                            <ClanBorder
                                color={visual.primaryColor || visual.color || "#ff0000"}
                                secondaryColor={visual.secondaryColor}
                                animationType={visual.animationType}
                                duration={visual.duration}
                            >
                                <View className="h-10 flex justify-center items-center rounded-sm">
                                    <Text className="text-[10px] dark:text-white/50 font-black uppercase tracking-tighter">Frame</Text>
                                </View>
                            </ClanBorder>
                        ) : (isVfx || isLottie) ? (
                            <LottieView
                                source={visual.lottieJson ? visual.lottieJson : { uri: visual.lottieUrl }}
                                autoPlay
                                loop
                                style={{
                                    width: isVfx ? '150%' : '100%',
                                    height: isVfx ? '150%' : '100%',
                                    position: 'absolute',
                                    bottom: isVfx ? -10 : 0
                                }}
                                resizeMode="contain"
                            />
                        ) : visual.svgCode ? (
                            <RemoteSvgIcon
                                xml={visual.svgCode}
                                color={visual.glowColor || visual.primaryColor || visual.color}
                                size={50}
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name={visual.icon || 'help-circle-outline'}
                                size={40}
                                color={visual.color || (isDark ? 'white' : 'black')}
                            />
                        )}

                        <View style={{ backgroundColor: cardRarityColor }} className="absolute top-2 right-2 w-2 h-2 rounded-full shadow-lg" />
                    </View>
                </View>

                <Text className="dark:text-white font-black text-[11px] uppercase tracking-tight" numberOfLines={1}>
                    {item.name}
                </Text>

                <View className="flex-row items-center mt-2 justify-between">
                    <View className="flex-row items-center bg-green-500/10 px-2 py-0.5 rounded-lg">
                        <Text className="text-green-600 dark:text-green-500 font-black text-[10px] mr-1">{item.price}</Text>
                        <CoinIcon type={item.currency || "OC"} size={10} />
                    </View>
                    <View style={{backgroundColor: cardRarityColor}} className="p-1.5 rounded-full shadow-lg shadow-blue-500/30">
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
                            <TouchableOpacity
                                onPress={() => selectedTheme ? setSelectedTheme(null) : null}
                                className="flex-row items-center"
                                disabled={!selectedTheme}
                            >
                                {selectedTheme && <Ionicons name="chevron-back" size={20} color="#22c55e" />}
                                <Text className="text-2xl font-black uppercase italic dark:text-white">
                                    {selectedTheme ? selectedTheme.label : "Black Market"}
                                </Text>
                            </TouchableOpacity>
                            <View className="flex-row items-center mt-1 bg-gray-100 dark:bg-zinc-900 self-start px-3 py-1.5 rounded-full">
                                <Text className="text-blue-500 font-black text-[10px] uppercase mr-1">OC: {coins || 0}</Text>
                                <CoinIcon type="OC" size={10} />
                                <Text className="text-gray-400 font-black text-[10px] uppercase mx-2">|</Text>
                                <Text className="text-green-500 font-black text-[10px] uppercase mr-1">CC: {clanCoins || 0}</Text>
                                <CoinIcon type="CC" size={10} />
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
                                                <View className="w-1 h-3 bg-green-500 rounded-full mr-2" />
                                                <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">{category}S</Text>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: items.length > 1 ? 380 : 180 }} contentContainerStyle={{ flexDirection: 'column', flexWrap: 'wrap' }}>
                                                {items.map(item => renderCompactCard(item))}
                                            </ScrollView>
                                        </View>
                                    ))}
                                    {catalog.themes?.length > 0 && (
                                        <View>
                                            <View className="flex-row items-center mb-4 mt-2">
                                                <View className="w-1 h-3 bg-blue-500 rounded-full mr-2" />
                                                <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">Thematic Collections</Text>
                                            </View>
                                            <View className="flex-row flex-wrap justify-between">
                                                {catalog.themes.map((theme) => (
                                                    <TouchableOpacity key={theme.id} onPress={() => setSelectedTheme(theme)} className="w-[48%] bg-gray-100 dark:bg-[#1a1a1a] p-6 rounded-3xl mb-4 items-center border border-gray-200 dark:border-gray-800 shadow-sm">
                                                        <View className="mb-3">
                                                            <RemoteSvgIcon xml={theme.iconsvg} color="#22c55e" size={80} />
                                                        </View>
                                                        <Text className="dark:text-white font-black uppercase mt-1 text-center text-xs">{theme.label}</Text>
                                                        <View className="bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded-md mt-2">
                                                            <Text className="text-gray-500 text-[8px] uppercase font-bold">{theme.items?.length || 0} Items</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    {['BADGE', 'THEME', 'BACKGROUND', "WATERMARK", 'EFFECT', 'GLOW', 'BORDER', 'AVATAR_VFX', 'AVATAR'].map((cat) => {
                                        const themeItems = selectedTheme.items?.filter(i => i.category?.toUpperCase() === cat) || [];
                                        if (themeItems.length === 0) return null;
                                        return (
                                            <View key={cat} className="mb-6">
                                                <View className="flex-row items-center mb-3">
                                                    <View className="w-1 h-3 bg-green-500 rounded-full mr-2" />
                                                    <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">{cat}S</Text>
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

            <ItemPreviewModal
                isVisible={!!itemToPreview}
                onClose={() => setItemToPreview(null)}
                currentUser={user}
                selectedProduct={itemToPreview}
                onAction={executePurchase}
                isProcessing={isProcessingTransaction}
                actionType="buy"
            />
        </Modal>
    );
};

// 🔹 3. THE INVENTORY COMPONENT
const AuthorInventoryModal = ({ visible, onClose, user, setUser, isDark, theinventory }) => {
    const [filter, setFilter] = useState('ALL');
    const [isUpdating, setIsUpdating] = useState(false);
    const [itemToPreview, setItemToPreview] = useState(null); // ⚡️ Setup preview state for inventory
    const CustomAlert = useAlert();

    const inventory = theinventory || user?.inventory || [];
    const categories = ['ALL', 'GLOW', 'BORDER', 'BADGE', 'WATERMARK', "AVATER", 'AVATAR_VFX'];

    const handleEquipToggle = async (selectedItem) => {
        if (isUpdating) return;
        setIsUpdating(true);

        try {
            const updatedInventory = inventory.map(item => {
                if (item.itemId === selectedItem.itemId) {
                    return { ...item, isEquipped: !item.isEquipped };
                }
                if (
                    item.category === selectedItem.category &&
                    selectedItem.category !== 'BADGE' &&
                    !selectedItem.isEquipped
                ) {
                    return { ...item, isEquipped: false };
                }
                return item;
            });

            const formData = new FormData();
            formData.append("userId", user?._id || "");
            formData.append("fingerprint", user?.deviceId || "");
            formData.append("inventory", JSON.stringify(updatedInventory));
            formData.append("username", user?.username || "");
            formData.append("description", user?.description || "");

            if (user?.preferences) {
                formData.append("preferences", JSON.stringify(user.preferences));
            }

            const res = await apiFetch(`/users/upload`, {
                method: "PUT",
                body: formData,
            });

            const result = await res.json();

            if (res.ok) {
                setUser(result.user);
                setItemToPreview(null); // Close modal on equip success
            } else {
                throw new Error(result.message || "Sync failed");
            }
        } catch (err) {
            console.error("Equip Error:", err);
            CustomAlert("Error", "Failed to sync equipment changes.");
        } finally {
            setIsUpdating(false);
        }
    };

    const filteredInventory = filter === 'ALL'
        ? inventory
        : inventory.filter(item => item.category === filter);

    const getExpirationText = (expiry) => {
        if (!expiry) return null;
        const now = new Date();
        const end = new Date(expiry);
        const diff = end - now;

        if (diff <= 0) return "Expired";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days}d remaining`;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        return `${hours}h remaining`;
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-[#0d1117] h-[85%] rounded-t-[40px] p-6 border-t-4 border-blue-500">

                    <View className="flex-row justify-between items-center mb-4">
                        <View>
                            <Text className="text-2xl font-black uppercase italic dark:text-white">Arsenal</Text>
                            <Text className="text-blue-500 font-black text-[10px] uppercase tracking-widest">
                                {inventory.length} Collectibles Owned
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color={!isDark ? "black" : "white"} />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row mb-6">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => setFilter(cat)}
                                    className={`mr-2 px-4 py-2 rounded-full border ${filter === cat ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-gray-700'}`}
                                >
                                    <Text className={`text-[10px] font-black uppercase ${filter === cat ? 'text-white' : 'text-gray-500'}`}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map((item, idx) => {
                                const expiration = getExpirationText(item.expiresAt);
                                const isExpired = expiration === "Expired";
                                const isBorder = item.category === 'BORDER';
                                const isVfx = item.category === 'AVATAR_VFX';
                                const visual = item.visualConfig || {};
                                const rowRarityColor = getRarityColor(item.rarity); // ⚡️ Map color
                                const isLottie = !!(visual.lottieUrl || visual.lottieJson);
                                const PreviewIcon = (
                                    <View
                                        className={`w-16 h-16 bg-black/20 items-center justify-center rounded-2xl overflow-hidden ${isBorder ? '' : 'border relative'}`}
                                        style={{ borderColor: `${rowRarityColor}40` }}
                                    >
                                        {isBorder ? (
                                            <ClanBorder
                                                color={visual.primaryColor || visual.color || "#ff0000"}
                                                secondaryColor={visual.secondaryColor}
                                                animationType={visual.animationType}
                                                duration={visual.duration}
                                            >
                                                <View className="h-6 w-6 flex justify-center items-center">
                                                    <Text className="text-[6px] dark:text-white/40 font-black uppercase">Frame</Text>
                                                </View>
                                            </ClanBorder>
                                        ) : (isVfx || isLottie) ? (
                                            /* ⚡️ Render Lottie for VFX or Animated Watermarks */
                                            <LottieView
                                                source={visual.lottieJson ? visual.lottieJson : { uri: visual.lottieUrl }}
                                                autoPlay
                                                loop
                                                style={{
                                                    width: (isVfx || isLottie) ? '140%' : '100%',
                                                    height: (isVfx || isLottie) ? '140%' : '100%',
                                                    position: 'absolute',
                                                    bottom: isVfx ? -8 : 0
                                                }}
                                                resizeMode="contain"
                                            />
                                        ) : visual.svgCode ? (
                                            <RemoteSvgIcon
                                                xml={visual.svgCode}
                                                size={40}
                                                color={visual.primaryColor || visual.color}
                                            />
                                        ) : (
                                            /* Fallback to Material Icon if no SVG/Lottie exists */
                                            <MaterialCommunityIcons
                                                name={visual.icon || 'star'}
                                                size={30}
                                                color={visual.primaryColor || visual.color || 'white'}
                                            />
                                        )}

                                        {/* Rarity Dot */}
                                        <View
                                            style={{ backgroundColor: rowRarityColor }}
                                            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full shadow-sm"
                                        />
                                    </View>
                                );

                                return (
                                    <View
                                        key={item.itemId || idx}
                                        className={`flex-row items-center p-4 rounded-3xl mb-3 border ${item.isEquipped
                                            ? 'bg-blue-500/10 border-blue-500'
                                            : 'bg-gray-50 dark:bg-[#161b22]'
                                            } ${isExpired ? 'opacity-50 border-red-500/30' : 'border-gray-100 dark:border-gray-800'}`}
                                    >
                                        {/* ⚡️ Tap the Icon to Preview */}
                                        <TouchableOpacity onPress={() => setItemToPreview(item)} className="mr-4">
                                            {isBorder ? (
                                                <ClanBorder
                                                    color={visual.primaryColor || visual.color || "#ff0000"}
                                                    secondaryColor={visual.secondaryColor}
                                                    animationType={visual.animationType}
                                                    duration={visual.duration}
                                                >
                                                    <View className="h-10 flex justify-center items-center rounded-sm">
                                                        <Text>Clan Banner</Text>
                                                    </View>
                                                </ClanBorder>
                                            ) : (
                                                PreviewIcon
                                            )}
                                        </TouchableOpacity>

                                        <View className="flex-1">
                                            <Text className="font-black dark:text-white text-sm uppercase italic">
                                                {item.name}
                                            </Text>

                                            <View className="flex-row mt-2 items-center">
                                                <Text style={{ color: rowRarityColor }} className="text-[9px] uppercase font-bold tracking-widest">
                                                    {item.rarity || 'COMMON'} {item.category}
                                                </Text>

                                                {expiration && (
                                                    <>
                                                        <Text className="text-gray-600 dark:text-gray-400 text-[9px] mx-1">•</Text>
                                                        <View className="flex-row items-center">
                                                            <MaterialCommunityIcons
                                                                name="clock-outline"
                                                                size={10}
                                                                color={isExpired ? "#ef4444" : "#6b7280"}
                                                            />
                                                            <Text className={`text-[9px] font-bold ml-1 ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
                                                                {expiration}
                                                            </Text>
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        </View>

                                        {/* ⚡️ BUG FIX: Only show Equip button if it's NOT EXPIRED */}
                                        {!isExpired && item.category !== "VERIFIED" && (
                                            <TouchableOpacity
                                                disabled={isUpdating}
                                                onPress={() => handleEquipToggle(item)}
                                                className={`px-6 py-3 rounded-xl ${item.isEquipped ? 'bg-green-500' : 'bg-blue-600'
                                                    } ${isUpdating ? 'opacity-50' : ''}`}
                                            >
                                                {isUpdating ? (
                                                    <ActivityIndicator size="small" color="white" />
                                                ) : (
                                                    <Text className="text-white text-[10px] font-black uppercase">
                                                        {item.isEquipped ? 'Active' : 'Equip'}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        )}

                                        {/* ⚡️ Only show VOID if expired */}
                                        {isExpired && (
                                            <View className="px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
                                                <Text className="text-red-500 text-[10px] font-black uppercase">Void</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        ) : (
                            <View className="items-center mt-20 opacity-30">
                                <MaterialCommunityIcons name="package-variant" size={80} color="gray" />
                                <Text className="mt-4 font-black uppercase text-xs tracking-widest dark:text-white">
                                    No {filter === 'ALL' ? '' : filter} items
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>

            {/* ⚡️ Render Universal Preview Modal for Inventory */}
            <ItemPreviewModal
                isVisible={!!itemToPreview}
                onClose={() => setItemToPreview(null)}
                currentUser={user}
                selectedProduct={itemToPreview}
                onAction={handleEquipToggle} // Passes the Equip function instead of Purchase
                isProcessing={isUpdating}
                actionType="equip" // Tells the modal to show Equip UI
            />
        </Modal>
    );
};

const getAuraTier = (rank) => {
    const MONARCH_GOLD = '#fbbf24';
    const CRIMSON_RED = '#ef4444';
    const SHADOW_PURPLE = '#a855f7';
    const STEEL_BLUE = '#3b82f6';
    const REI_WHITE = '#e0f2fe';

    if (!rank || rank > 10 || rank <= 0) return { color: '#3b82f6', label: 'ACTIVE', icon: 'radar' };
    switch (rank) {
        case 1: return { color: MONARCH_GOLD, label: 'MONARCH', icon: 'crown' };
        case 2: return { color: CRIMSON_RED, label: 'YONKO', icon: 'flare' };
        case 3: return { color: SHADOW_PURPLE, label: 'KAGE', icon: 'moon-waxing-crescent' };
        case 4: return { color: STEEL_BLUE, label: 'SHOGUN', icon: 'shield-star' };
        case 5: return { color: REI_WHITE, label: 'ESPADA 0', icon: 'skull' };
        case 6: return { color: '#cbd5e1', label: 'ESPADA 1', icon: 'sword-cross' };
        case 7: return { color: '#94a3b8', label: 'ESPADA 2', icon: 'sword-cross' };
        case 8: return { color: '#64748b', label: 'ESPADA 3', icon: 'sword-cross' };
        case 9: return { color: '#475569', label: 'ESPADA 4', icon: 'sword-cross' };
        case 10: return { color: '#334155', label: 'ESPADA 5', icon: 'sword-cross' };
        default: return { color: '#1e293b', label: 'VANGUARD', icon: 'shield-check' };
    }
};

export default function MobileProfilePage() {
    const storage = useMMKV();

    const CustomAlert = useAlert();
    const [theinventory, setInventory] = useState([])
    const { user, setUser, contextLoading } = useUser();
    const { colorScheme } = useNativeWind();
    const isDark = colorScheme === "dark";
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const playerCardRef = useRef(null);

    const [description, setDescription] = useState("");
    const [username, setUsername] = useState("");
    const [totalPosts, setTotalPosts] = useState(0);
    const [showId, setShowId] = useState(false);
    const [preview, setPreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const [inventoryVisible, setInventoryVisible] = useState(false);
    const [prefsVisible, setPrefsVisible] = useState(false);
    const [storeVisible, setStoreVisible] = useState(false);
    const [rankModalVisible, setRankModalVisible] = useState(false);
    const [auraModalVisible, setAuraModalVisible] = useState(false);
    const [cardPreviewVisible, setCardPreviewVisible] = useState(false);

    const [favAnimes, setFavAnimes] = useState("");
    const [favCharacter, setFavCharacter] = useState("");
    const [favGenres, setFavGenres] = useState("");

    const [copied, setCopied] = useState(false);
    const [refCopied, setRefCopied] = useState(false);

    const [isOnboarding, setIsOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [currentPosTop, setcurrentPosTop] = useState(0)

    const scanAnim = useSharedValue(0);
    const loadingAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(1);

    const tooltipY = useSharedValue(0);
    const pointerX = useSharedValue(0);

    const CACHE_KEY_USER_EXTRAS = `user_profile_cache_${user?.deviceId || 'temp'}`;

    // Safely fallback user properties to prevent render crashes during initial sign-up flow
    const currentAuraPoints = user?.weeklyAura || 0;
    const aura = useMemo(() => getAuraVisuals(user?.previousRank) || { color: '#3b82f6', icon: 'shield-outline', label: 'NOVICE', description: 'Operator initializing...' }, [user?.previousRank]);
    const equippedGlow = user?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || null;
    const dynamicAuraColor = activeGlowColor || aura?.color || '#3b82f6';
    const filledBoxes = Math.min(Math.floor(currentAuraPoints / 10), 10);

    useEffect(() => {
        const hasSeenOnboarding = storage.getBoolean('has_seen_profile_onboarding');
        if (!hasSeenOnboarding) {
            setIsOnboarding(true);
        }
    }, [storage]);

    useEffect(() => {
        tooltipY.value = withSpring(onboardingStep * 60, { damping: 14, stiffness: 90 });
    }, [onboardingStep]);

    useEffect(() => {
        if (isOnboarding) {
            pointerX.value = withRepeat(
                withSequence(
                    withTiming(5, { duration: 500 }),
                    withTiming(0, { duration: 500 })
                ),
                -1,
                true
            );
        } else {
            pointerX.value = 0;
        }
    }, [isOnboarding]);

    const tooltipAnimatedStyle = useAnimatedStyle(() => {
        return { transform: [{ translateY: tooltipY.value }] };
    });

    const pointerAnimatedStyle = useAnimatedStyle(() => {
        return { transform: [{ translateX: pointerX.value }] };
    });

    const onboardingSteps = [
        { title: "Inventory", desc: "Check your acquired items and manage your gear here." },
        { title: "Preferences", desc: "Update your neural preferences and favorite anime characters." },
        { title: "Store", desc: "Visit the store to get new upgrades, auras, and cosmetics." },
        { title: "Player Card", desc: "Preview and broadcast your unique Operator Identity card." },
    ];

    const nextOnboardingStep = () => {
        if (onboardingStep < onboardingSteps.length - 1) {
            setOnboardingStep(prev => prev + 1);
            setcurrentPosTop(-10)
        } else {
            setIsOnboarding(false);
            storage.set('has_seen_profile_onboarding', true);
        }
    };
    const prevOnboardingStep = () => {
        if (onboardingStep > 0) {
            setOnboardingStep(prev => prev - 1);
        }
    };

    const skipOnboarding = () => {
        setIsOnboarding(false);
        storage.set('has_seen_profile_onboarding', true);
    };

    const copyToClipboard = async () => {
        if (user?.deviceId) {
            await Clipboard.setStringAsync(user.deviceId);
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
            console.error("Capture Error:", error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to capture the card.' });
        }
    };

    useEffect(() => {
        scanAnim.value = withRepeat(
            withTiming(1, { duration: 10000, easing: Easing.linear }),
            -1,
            false
        );
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 2000 }),
                withTiming(1, { duration: 2000 })
            ),
            -1,
            true
        );
    }, []);

    useEffect(() => {
        if (isUpdating) {
            loadingAnim.value = withRepeat(
                withTiming(1, { duration: 1500, easing: Easing.linear }),
                -1,
                false
            );
        } else {
            loadingAnim.value = 0;
        }
    }, [isUpdating]);

    // Fixed: Removed unsafe string concatenation for color opacity
    const scanAnimatedStyle = useAnimatedStyle(() => {
        const rotate = interpolate(scanAnim.value, [0, 1], [0, 360]);
        return { 
            transform: [{ rotate: `${rotate}deg` }], 
            borderColor: dynamicAuraColor,
            opacity: 0.4 
        };
    });

    const pulseAnimatedStyle = useAnimatedStyle(() => {
        return { transform: [{ scale: pulseAnim.value }] };
    });

    const progressAnimatedStyle = useAnimatedStyle(() => {
        const transX = interpolate(loadingAnim.value, [0, 1], [-width, width]);
        return { transform: [{ translateX: transX }] };
    });

    useEffect(() => {
        if (!user?.deviceId) return;
        try {
            const cached = storage.getString(CACHE_KEY_USER_EXTRAS);
            if (cached) {
                const data = JSON.parse(cached);
                if (data.username) setUsername(data.username);
                if (data.description) setDescription(data.description);
                if (data.totalPosts) setTotalPosts(data.totalPosts);
                if (data.favAnimes) setFavAnimes(data.favAnimes);
                if (data.favCharacter) setFavCharacter(data.favCharacter);
                if (data.favGenres) setFavGenres(data.favGenres);
            }
        } catch (e) {
            console.error("Cache load error", e);
        }
    }, []);

    useEffect(() => {
        const syncUserWithDB = async () => {
            if (!user?.deviceId) return;
            try {
                const res = await apiFetch(`/users/me?fingerprint=${user.deviceId}`);
                const dbUser = await res.json();

                if (res.ok) {
                    setUser(dbUser);
                    setDescription(dbUser.description || "");
                    setUsername(dbUser.username || "");

                    // Safe array checks before joining
                    const dbAnimes = Array.isArray(dbUser.preferences?.favAnimes) ? dbUser.preferences.favAnimes.join(', ') : "";
                    const dbGenres = Array.isArray(dbUser.preferences?.favGenres) ? dbUser.preferences.favGenres.join(', ') : "";
                    const dbChar = dbUser.preferences?.favCharacter || "";

                    setFavAnimes(dbAnimes);
                    setFavGenres(dbGenres);
                    setFavCharacter(dbChar);

                    const postRes = await apiFetch(`/posts?author=${dbUser._id}&limit=1`);
                    const postData = await postRes.json();
                    const newTotal = postData.total || 0;
                    if (postRes.ok) setTotalPosts(newTotal);

                    storage.set(CACHE_KEY_USER_EXTRAS, JSON.stringify({
                        username: dbUser.username,
                        description: dbUser.description,
                        totalPosts: newTotal,
                        favAnimes: dbAnimes,
                        favGenres: dbGenres,
                        favCharacter: dbChar
                    }));
                }
            } catch (err) { console.error("Sync User Error:", err); }
        };
        syncUserWithDB();
    }, []);

    const getKey = (pageIndex, previousPageData) => {
        if (!user?._id) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `/posts?author=${user._id}&page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: 240000,
        revalidateOnFocus: true,
        dedupingInterval: 5000,
    });

    const posts = useMemo(() => {
        return data ? data.flatMap((page) => page.posts || []) : [];
    }, [data]);

    const isLoadingInitialData = isLoading && !data;
    const isReachingEnd = data && data[data.length - 1]?.posts?.length < LIMIT;
    const isFetchingNextPage = isValidating && data && typeof data[size - 1] === "undefined";

    const count = totalPosts;
    const rankTitle = count > 200 ? "Master_Writer" : count > 150 ? "Elite_Writer" : count > 100 ? "Senior_Writer" : count > 50 ? "Novice_Writer" : count > 25 ? "Senior_Researcher" : "Novice_Researcher";
    const rankIcon = count > 200 ? "👑" : count > 150 ? "💎" : count > 100 ? "🔥" : count > 50 ? "⚔️" : count > 25 ? "📜" : "🛡️";
    const nextMilestone = count > 200 ? 500 : count > 150 ? 200 : count > 100 ? 150 : count > 50 ? 100 : count > 25 ? 50 : 25;
    const progress = Math.min((count / nextMilestone) * 100, 100);

    const pickImage = async () => {
        console.log("picking image");

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            const selected = result.assets[0];
            setPreview(selected.uri);
            setImageFile({ uri: selected.uri, name: "profile.jpg", type: "image/jpeg" });
        }
    };

    const handleUpdate = async () => {
        if (!username.trim()) {
            CustomAlert("Error", "Username cannot be empty.");
            return;
        }

        setIsUpdating(true);
        try {
            const formData = new FormData();
            formData.append("userId", user?._id || "");
            formData.append("fingerprint", user?.deviceId || "");
            formData.append("description", description);
            formData.append("username", username);

            formData.append("preferences", JSON.stringify({
                favCharacter: favCharacter,
                favAnimes: favAnimes.split(',').map(s => s.trim()).filter(Boolean),
                favGenres: favGenres.split(',').map(s => s.trim()).filter(Boolean)
            }));

            if (imageFile) {
                if (Platform.OS === "web") {
                    const blob = await (await fetch(imageFile.uri)).blob();
                    formData.append("file", blob, "profile.jpg");
                } else {
                    formData.append("file", imageFile);
                }
            }

            const res = await apiFetch(`/users/upload`, {
                method: "PUT",
                body: formData,
            });

            const result = await res.json();
            if (res.ok) {
                setUser(result.user);
                setPreview(null);
                setImageFile(null);

                const dbAnimes = Array.isArray(result.user.preferences?.favAnimes) ? result.user.preferences.favAnimes.join(', ') : "";
                const dbGenres = Array.isArray(result.user.preferences?.favGenres) ? result.user.preferences.favGenres.join(', ') : "";

                storage.set(CACHE_KEY_USER_EXTRAS, JSON.stringify({
                    username: result.user.username,
                    description: result.user.description,
                    totalPosts: totalPosts,
                    favAnimes: dbAnimes,
                    favGenres: dbGenres,
                    favCharacter: result.user.preferences?.favCharacter || ""
                }));

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

    const listHeader = useMemo(() => (
        <View className="px-6 mt-3">
            <View className="bg-white dark:bg-[#0a0a0a]">
                <View className="flex-row items-center gap-4 mb-10 border-b border-gray-100 dark:border-gray-800 pb-6">
                    <View className="w-2 h-8" style={{ backgroundColor: dynamicAuraColor }} />
                    <Text className="text-3xl font-black italic tracking-tighter uppercase dark:text-white">Player Profile</Text>
                </View>

                <View style={{ position: "relative" }} className="flex-row flex items-center justify-center mb-10 pr-2">
                    <View className="relative shrink-0 items-center justify-center">

                        {/* ⚡️ FIXED: Passed onPress directly to AuraAvatar. Removed outer TouchableOpacity. */}
                        <AuraAvatar
                            author={{
                                ...user,
                                // 1. Force the image to be the preview if it exists, otherwise use their normal PFP
                                image: preview || user?.profilePic?.url,
                                // 2. If they have a preview active, temporarily "unequip" their Lottie avatar in the UI so they can see the photo
                                inventory: preview
                                    ? user?.inventory?.map(item => item.category === 'AVATAR' ? { ...item, isEquipped: false } : item)
                                    : user?.inventory
                            }}
                            aura={getAuraTier(user?.rank || 100)}
                            isTop10={(user?.rank || 100) <= 10 && (user?.rank || 100) > 0}
                            isDark={isDark}
                            size={160}
                            glowColor={dynamicAuraColor}
                            onPress={pickImage} // 👈 AuraAvatar will now handle the click
                        />

                        {/* ⚡️ THE "CHANGE DNA" OVERLAY */}
                        {/* pointerEvents="none" is crucial here so clicks pass through to the Avatar */}
                        <View
                            className="absolute items-center justify-center rounded-full overflow-hidden"
                            pointerEvents="none"
                            style={{
                                width: 160,
                                height: 160,
                                zIndex: 10,
                                // If they are rank 1, the avatar is rotated 45deg, so we counter-rotate the overlay
                                transform: [(user?.rank || 100) === 1 ? { rotate: '-45deg' } : { rotate: '0deg' }]
                            }}
                        >
                            <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                <Text className="text-[10px] font-black uppercase tracking-widest text-white">
                                    Change DNA
                                </Text>
                            </View>
                        </View>

                    </View>

                    <View style={{ position: "absolute", left: -5, zIndex: 100 }} className="flex-col items-center">
                        <ProfileActionButton icon="archive-outline" color="#3b82f6" label="Items" onPress={() => setInventoryVisible(true)} />
                        <ProfileActionButton icon="cog-outline" color="#a855f7" label="Prefs" onPress={() => setPrefsVisible(true)} />
                        <ProfileActionButton icon="cart-outline" color="#22c55e" label="Store" onPress={() => setStoreVisible(true)} />
                        <ProfileActionButton icon="card-account-details-outline" color="#f59e0b" label="Card" onPress={() => setCardPreviewVisible(true)} />

                        {isOnboarding && (
                            <Animated.View
                                style={[
                                    tooltipAnimatedStyle,
                                    { position: 'absolute', left: 60, top: currentPosTop, width: 220, zIndex: 110 }
                                ]}
                                className="bg-blue-600 dark:bg-blue-900 rounded-2xl p-4 shadow-2xl flex-row items-start"
                            >
                                <Animated.View style={pointerAnimatedStyle} className="absolute -left-3 top-4">
                                    <Ionicons name="caret-back" size={24} color={isDark ? "#1e3a8a" : "#2563eb"} />
                                </Animated.View>
                                <View className="flex-1">
                                    <Text className="text-white font-black text-sm uppercase tracking-widest">
                                        {onboardingSteps[onboardingStep].title}
                                    </Text>
                                    <Text className="text-blue-100 text-[10px] mt-1 font-medium leading-relaxed">
                                        {onboardingSteps[onboardingStep].desc}
                                    </Text>
                                    <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-blue-400/30">
                                        <TouchableOpacity onPress={skipOnboarding}>
                                            <Text className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">Skip</Text>
                                        </TouchableOpacity>
                                        <View className="flex-row gap-2">
                                            {onboardingStep > 0 && (
                                                <TouchableOpacity onPress={prevOnboardingStep} className="bg-blue-500/50 px-3 py-1.5 rounded-lg active:scale-95">
                                                    <Text className="text-white text-[10px] font-black uppercase tracking-widest">Back</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity onPress={nextOnboardingStep} className="bg-white px-3 py-1.5 rounded-lg active:scale-95">
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
                </View>

                <View className="items-center mb-6">
                    {/* ⚡️ REPLACED WITH PLAYERNAMEPLATE */}
                    <Pressable onPress={() => setAuraModalVisible(true)} className="items-center">
                        <PlayerNameplate
                            author={user}
                            themeColor={dynamicAuraColor}
                            equippedGlow={equippedGlow}
                            auraRank={user?.previousRank || 0} // Safe fallback added
                            isDark={isDark}
                            fontSize={24}
                        />

                        {/* Fixed: Replaced ${dynamicAuraColor}10 with explicit safe opacity View */}
                        <View className="px-2 py-0.5 rounded-full border mt-1 overflow-hidden" style={{ borderColor: dynamicAuraColor }}>
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dynamicAuraColor, opacity: 0.1 }} />
                            <Text style={{ color: dynamicAuraColor, fontSize: 8, fontWeight: '900', zIndex: 1 }}>{aura?.label || 'NOVICE'} {currentAuraPoints}</Text>
                        </View>
                    </Pressable>

                    <View className="mt-3 items-center">
                        <View className="flex-row gap-1 mb-1">
                            {[...Array(10)].map((_, i) => (
                                <View key={i} className="h-1.5 w-4 rounded-sm" style={{ backgroundColor: i < filledBoxes ? dynamicAuraColor : (isDark ? '#1f2937' : '#e5e7eb'), opacity: i < filledBoxes ? 1 : 0.3 }} />
                            ))}
                        </View>
                        <Text style={{ color: dynamicAuraColor }} className="text-[8px] font-black uppercase tracking-[0.2em]">Aura Power: {filledBoxes}/10</Text>
                    </View>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1">Class: {rankTitle}</Text>
                </View>
            </View>

            <View className="mt-4 w-full px-4 mb-8">
                <Pressable onPress={() => setRankModalVisible(true)} className="flex-row justify-between items-end mb-2">
                    <View className="flex-row items-center gap-2">
                        <Text className="text-xl">{rankIcon}</Text>
                        <Text className="text-[10px] font-black uppercase tracking-widest dark:text-white">{rankTitle}</Text>
                    </View>
                    <Text className="text-[10px] font-mono font-bold text-gray-500">EXP: {count} / {count > 200 ? "MAX" : nextMilestone}</Text>
                </Pressable>
                <View className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-200 dark:border-white/10">
                    <View style={{ width: `${progress}%`, backgroundColor: dynamicAuraColor }} className="h-full shadow-lg" />
                </View>
            </View>

            <View className="space-y-6">
                <View className="space-y-1">
                    <Text className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Display Name / Alias</Text>
                    <TextInput defaultValue={username} onChangeText={setUsername} placeholder="Enter alias..." placeholderTextColor="#4b5563" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl text-sm font-bold dark:text-white" />
                </View>

                <View className="space-y-1 mt-4">
                    <Text className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Neural Uplink - <Text className="text-[9px] font-black tracking-widest text-gray-500">Used for recovery</Text></Text>
                    <View className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex-row justify-between items-center">
                        <View className="flex-1 mr-4"><Text numberOfLines={1} ellipsizeMode="middle" className={`text-xs font-bold font-mono ${showId ? 'text-gray-500 dark:text-gray-400' : 'text-blue-500/40'}`}>{showId ? (user?.deviceId || "SEARCHING...") : "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"}</Text></View>
                        <View className="flex-row items-center gap-2">
                            <Pressable onPress={() => setShowId(!showId)} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800"><Feather name={showId ? "eye-off" : "eye"} size={16} color={isDark ? "#94a3b8" : "#64748b"} /></Pressable>
                            <Pressable onPress={copyToClipboard} className={`p-2 rounded-xl ${copied ? 'bg-green-500/10' : 'bg-blue-500/10'}`}><Feather name={copied ? "check" : "copy"} size={16} color={copied ? "#22c55e" : "#3b82f6"} /></Pressable>
                        </View>
                    </View>
                </View>

                <View className="space-y-1 mt-4">
                    <Text className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Recruitment Directive - <Text className="text-[9px] font-black tracking-widest text-gray-500">Share to build ranks</Text></Text>
                    <View className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex-row justify-between items-center">
                        <View className="flex-1 mr-4"><Text numberOfLines={1} ellipsizeMode="tail" className="text-xs font-bold font-mono text-purple-500/80 dark:text-purple-400">{user?.referralCode ? `play.google.com/...referrer=${user.referralCode}` : "SYNCHRONIZING_ID..."}</Text></View>
                        <View className="flex-row items-center gap-2">
                            <View className="bg-purple-500/10 px-2 py-1.5 rounded-lg mr-1 border border-purple-500/20"><Text className="text-[9px] font-black text-purple-500 uppercase tracking-widest">{user?.referralCount || 0} Recruits</Text></View>
                            <Pressable onPress={copyReferralToClipboard} className={`p-2 rounded-xl ${refCopied ? 'bg-green-500/10' : 'bg-purple-500/10'}`}><Feather name={refCopied ? "check" : "share-2"} size={16} color={refCopied ? "#22c55e" : "#a855f7"} /></Pressable>
                        </View>
                    </View>
                </View>

                <View className="space-y-1 mt-4">
                    <Text className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Biography / Lore</Text>
                    <TextInput multiline defaultValue={description} onChangeText={setDescription} placeholder="Write your player bio here..." placeholderTextColor="#4b5563" className="w-full bg-white dark:bg-black/40 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-sm font-medium dark:text-white min-h-[120px]" style={{ textAlignVertical: 'top' }} />
                </View>

                <TouchableOpacity onPress={handleUpdate} disabled={isUpdating} style={{ backgroundColor: dynamicAuraColor }} className="relative w-full h-14 rounded-2xl overflow-hidden items-center justify-center mt-6">
                    <Text className="relative z-10 text-white font-black uppercase italic tracking-widest text-xs">{isUpdating ? "Syncing Changes..." : "Update Character Data"}</Text>
                    {isUpdating && <Animated.View className="absolute bottom-0 h-1 bg-white/40 w-full" style={progressAnimatedStyle} />}
                </TouchableOpacity>
            </View>

            <View className="flex-row items-center gap-4 mt-16 mb-8">
                <Text className="text-xl font-black uppercase tracking-tighter italic dark:text-white">Transmission Logs</Text>
                <View className="h-[1px] flex-1 bg-gray-100 dark:bg-gray-800" />
            </View>
        </View>
    ), [user, preview, description, username, isUpdating, totalPosts, copied, refCopied, rankTitle, rankIcon, progress, nextMilestone, count, showId, isDark, aura, filledBoxes, currentAuraPoints, dynamicAuraColor, pickImage, handleUpdate, captureAndShare, isOnboarding, onboardingStep, tooltipAnimatedStyle, pointerAnimatedStyle, scanAnimatedStyle, pulseAnimatedStyle, progressAnimatedStyle]);

    return (
        <View className="flex-1 bg-white dark:bg-[#0a0a0a]" style={{ paddingTop: insets.top }}>
            <AppOnboarding />
            <View className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full" pointerEvents="none" />
            <View className="absolute bottom-0 left-0 w-60 h-60 bg-purple-600/5 rounded-full" pointerEvents="none" />

            <FlatList
                data={posts}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={listHeader}
                scrollEnabled={!isOnboarding}
                onEndReached={() => { if (!isReachingEnd && !isValidating) setSize(size + 1); }}
                onEndReachedThreshold={0.5}
                renderItem={({ item }) => (
                    <View className="px-6 mb-4">
                        <View className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl flex-row justify-between items-center">
                            <Pressable onPress={() => router.push(`/post/${item.slug || item._id}`)} className="flex-1 pr-4">
                                <Text className="font-black text-sm uppercase tracking-tight text-gray-800 dark:text-gray-200" numberOfLines={1}>{item.title || item.message}</Text>
                                <Text className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">{new Date(item.createdAt).toLocaleDateString()}</Text>
                                <View className="flex-row items-center gap-4 mt-2">
                                    <View className="flex-row items-center gap-1"><Ionicons name="heart-outline" size={12} color="#9ca3af" /><Text className="text-gray-500 text-[10px] font-bold">{item.likes?.length || 0}</Text></View>
                                    <View className="flex-row items-center gap-1"><Ionicons name="chatbubble-outline" size={12} color="#9ca3af" /><Text className="text-gray-500 text-[10px] font-bold">{item.comments?.length || 0}</Text></View>
                                    <View className="flex-row items-center gap-1"><Ionicons name="eye-outline" size={12} color="#9ca3af" /><Text className="text-gray-500 text-[10px] font-bold">{item.views || 0}</Text></View>
                                </View>
                            </Pressable>
                            <TouchableOpacity onPress={() => handleDelete(item._id)} className="p-3 bg-red-500/10 rounded-xl"><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={() => isLoadingInitialData ? <SyncLoading /> : (
                    <View className="mx-6 p-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800 items-center">
                        <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400">Empty Logs - Go Post Something!</Text>
                    </View>
                )}
                ListFooterComponent={() => <View style={{ paddingBottom: insets.bottom + 100 }}>{isFetchingNextPage && <ActivityIndicator className="py-4" color="#2563eb" />}</View>}
            />

            <View style={{ position: 'absolute', left: -10000, opacity: 0 }} pointerEvents="none">
                <ViewShot ref={playerCardRef} options={{ format: "png", quality: 1 }}>
                    <PlayerCard author={user} totalPosts={totalPosts} isDark={isDark} />
                </ViewShot>
            </View>

            <Modal visible={rankModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <View className="bg-white dark:bg-[#0d1117] w-full p-8 rounded-[40px] border border-gray-200 dark:border-gray-800">
                        <View className="w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-full items-center justify-center mb-6 self-center"><Text style={{ fontSize: 40 }}>{rankIcon}</Text></View>
                        <Text className="text-2xl font-black text-center uppercase tracking-tighter dark:text-white mb-2">{rankTitle.replace('_', ' ')}</Text>
                        <Text className="text-gray-500 text-center font-bold text-xs uppercase tracking-widest mb-6">Current Standing</Text>
                        <Text className="text-gray-600 dark:text-gray-400 text-center leading-6 mb-8">You have transmitted <Text className="font-black text-blue-600">{count}</Text> logs.{count < 200 ? ` Reach ${nextMilestone} posts to evolve into the next class.` : " You have reached the pinnacle of researchers."}</Text>
                        <TouchableOpacity onPress={() => setRankModalVisible(false)} className="bg-blue-600 p-4 rounded-2xl items-center"><Text className="text-white font-black uppercase tracking-widest text-xs">Close Intel</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <AuthorInventoryModal
                setUser={setUser}
                visible={inventoryVisible}
                onClose={() => setInventoryVisible(false)}
                user={user}
                inventory={theinventory}
                isDark={isDark}
            />

            <Modal visible={prefsVisible} animationType="fade" transparent>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <View className="bg-white dark:bg-[#0d1117] w-full p-8 rounded-[40px] border-2 border-purple-500">
                        <Text className="text-2xl font-black uppercase italic dark:text-white mb-6 text-center">Neural Prefs</Text>
                        <ScrollView className="space-y-4" showsVerticalScrollIndicator={false}>
                            <View>
                                <Text className="text-[10px] font-black uppercase text-gray-400 mb-2">Absolute GOAT Character</Text>
                                <TextInput defaultValue={favCharacter} onChangeText={setFavCharacter} placeholder="E.G. ITACHI" placeholderTextColor="#4b5563" className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl dark:text-white font-black italic border border-purple-500/20" />
                            </View>

                            <View className="mt-4">
                                <Text className="text-[10px] font-black uppercase text-gray-400 mb-2">Favorite Animes (Comma separated)</Text>
                                <TextInput defaultValue={favAnimes} onChangeText={setFavAnimes} placeholder="One Piece, Naruto, Bleach" placeholderTextColor="#4b5563" className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl dark:text-white font-black italic border border-purple-500/20" />
                            </View>

                            <View className="mt-4">
                                <Text className="text-[10px] font-black uppercase text-gray-400 mb-2">Favorite Genres (Comma separated)</Text>
                                <TextInput defaultValue={favGenres} onChangeText={setFavGenres} placeholder="Action, Seinen, Psychological" placeholderTextColor="#4b5563" className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl dark:text-white font-black italic border border-purple-500/20" />
                            </View>
                        </ScrollView>

                        <TouchableOpacity onPress={handleUpdate} disabled={isUpdating} className="bg-purple-600 p-5 rounded-2xl items-center shadow-lg mt-8">
                            {isUpdating ? <ActivityIndicator color="white" /> : <Text className="text-white font-black uppercase tracking-widest text-xs">Sync Preferences</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setPrefsVisible(false)} className="mt-4 items-center"><Text className="text-gray-500 text-[10px] font-black uppercase">Cancel</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <AuthorStoreModal
                setInventory={setInventory}
                visible={storeVisible}
                onClose={() => setStoreVisible(false)}
                user={user}
                isDark={isDark}
            />

            <Modal visible={auraModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <View className="bg-white dark:bg-[#0d1117] w-full p-8 rounded-[40px] border-2" style={{ borderColor: dynamicAuraColor }}>
                        {/* Fixed: Safe fallback for icon name to prevent another native crash */}
                        <MaterialCommunityIcons name={aura?.icon || 'shield-outline'} size={60} color={dynamicAuraColor} style={{ alignSelf: 'center', marginBottom: 20 }} />
                        <Text style={{ color: dynamicAuraColor }} className="text-3xl font-black text-center uppercase tracking-widest mb-2">{aura?.label || 'NOVICE'} POWER</Text>
                        <Text className="text-gray-500 text-center font-bold text-[10px] uppercase tracking-[0.3em] mb-2">Total Points: {currentAuraPoints}</Text>
                        <View className="flex-row justify-center gap-1 mb-6">{[...Array(10)].map((_, i) => (<View key={i} className="h-2 w-4 rounded-sm" style={{ backgroundColor: i < filledBoxes ? dynamicAuraColor : '#374151' }} />))}</View>
                        <Text className="text-gray-600 dark:text-gray-400 text-center leading-7 mb-8 font-medium">{aura?.description || 'Operator initializing...'}</Text>
                        <TouchableOpacity onPress={() => setAuraModalVisible(false)} style={{ backgroundColor: dynamicAuraColor }} className="p-4 rounded-2xl items-center shadow-lg"><Text className="text-white font-black uppercase tracking-widest text-xs">Acknowledge</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={cardPreviewVisible} transparent animationType="slide">
                <View className="flex-1 bg-black/90">
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View className="w-full items-center">
                            <View className="w-full flex-row pt-10 justify-between items-center">
                                <View>
                                    <Text className="text-white font-black text-xl italic uppercase tracking-widest">Operator Identity</Text>
                                    <Text className="text-gray-500 font-bold text-[9px] uppercase tracking-[0.4em] mt-1">Classification Preview</Text>
                                </View>
                                <Pressable
                                    onPress={() => setCardPreviewVisible(false)}
                                    className="w-12 h-12 bg-white/10 rounded-full items-center justify-center"
                                >
                                    <Ionicons name="close" size={28} color="white" />
                                </Pressable>
                            </View>

                            <View
                                style={{
                                    transform: [{ scale: Math.min(1, (width - 40) / 380) }],
                                    width: 380,
                                    alignItems: 'center'
                                }}
                                className="shadow-2xl shadow-blue-500/20"
                            >
                                <PlayerCard author={user} totalPosts={totalPosts} isDark={isDark} />
                            </View>

                            <View className="w-full">
                                <TouchableOpacity
                                    onPress={captureAndShare}
                                    style={{ backgroundColor: dynamicAuraColor }}
                                    className="flex-row items-center justify-center gap-3 w-full h-16 rounded-[30px] shadow-lg"
                                >
                                    <MaterialCommunityIcons name="share-variant-outline" size={24} color="white" />
                                    <Text className="text-white font-black uppercase tracking-[0.2em] text-sm italic">Broadcast Card</Text>
                                </TouchableOpacity>

                                <Pressable
                                    onPress={() => setCardPreviewVisible(false)}
                                    className="mt-6 items-center py-2"
                                >
                                    <Text className="text-gray-500 text-[10px] font-black uppercase tracking-widest underline">Cancel Operation</Text>
                                </Pressable>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const ProfileActionButton = ({ icon, color, onPress, label }) => (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: `${color}15`, borderColor: `${color}40` }} className="w-12 h-12 rounded-2xl items-center justify-center border mb-3 shadow-sm active:scale-90">
        <MaterialCommunityIcons name={icon} size={22} color={color} />
        <Text style={{ color, fontSize: 6 }} className="font-black uppercase mt-1">{label}</Text>
    </TouchableOpacity>
);
