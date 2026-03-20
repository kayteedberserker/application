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
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    withSequence, 
    Easing,
    interpolate
} from "react-native-reanimated"; // 🔹 Switched to Reanimated
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import Toast from "react-native-toast-message";
import ViewShot from "react-native-view-shot";
import useSWRInfinite from "swr/infinite";
import AppOnboarding from "../../components/AppOnboarding";
import ClanBorder from "../../components/ClanBorder";
import CoinIcon from "../../components/ClanIcon";
import PlayerCard from "../../components/PlayerCard";
import { SyncLoading } from "../../components/SyncLoading";
import { Text } from "../../components/Text";
import { useAlert } from "../../context/AlertContext";
import { useCoins } from "../../context/CoinContext";
import { useUser } from "../../context/UserContext";
import apiFetch from "../../utils/apiFetch";

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

const AuthorStoreModal = ({ visible, onClose, user, isDark, setInventory }) => {
    const storage = useMMKV(); // 🔹 Using MMKV instance
    const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins();
    
    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState({ themes: [], standaloneItems: [] });
    const [selectedTheme, setSelectedTheme] = useState(null);
    const CustomAlert = useAlert();

    useEffect(() => {
        if (visible) {
            fetchStoreData();
        } else {
            setSelectedTheme(null);
        }
    }, [visible]);

    const fetchStoreData = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/store?type=author`);
            const data = await res.json();

            if (data.success && data.catalog) {
                setCatalog({
                    themes: data.catalog.themes || [],
                    standaloneItems: data.catalog.standaloneItems || []
                });
            }
        } catch (e) {
            console.error("Store fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (item) => {
        const itemCurrency = item.currency || 'OC';
        const currentBalance = itemCurrency === 'CC' ? clanCoins : coins;
        const currencyName = itemCurrency === 'CC' ? "CC" : "OC";

        if (currentBalance < item.price) {
            CustomAlert("Insufficient Funds", `You need more ${currencyName}.`);
            return;
        }

        CustomAlert(
            "Confirm Purchase",
            `Buy ${item.name} for ${item.price} ${itemCurrency}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Purchase",
                    onPress: async () => {
                        const result = await processTransaction('buy_item', item.category, {
                            itemId: item.id,
                            price: item.price,
                            name: item.name,
                            category: item.category,
                            currency: itemCurrency,
                            visualConfig: item.visualData || item.visualConfig
                        });

                        if (result.success) {
                            CustomAlert("Success", "Item added to your inventory!");
                            if (typeof setInventory === 'function') {
                                setInventory(result.inventory);
                            }
                        } else {
                            CustomAlert("Error", result.error || "Transaction failed");
                        }
                    }
                }
            ]
        );
    };

    // 🔹 Group Items by Category
    const groupedStandaloneItems = useMemo(() => {
        return catalog.standaloneItems.reduce((groups, item) => {
            const category = item.category || 'MISC';
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
            return groups;
        }, {});
    }, [catalog.standaloneItems]);

    // 🔹 Compact Card Helper
    const renderCompactCard = (item) => {
        const visual = item.visualData || item.visualConfig || {};
        const isBorder = item.category === 'BORDER';

        return (
            <TouchableOpacity
                key={item.id}
                onPress={() => handlePurchase(item)}
                className="bg-gray-100 dark:bg-[#1a1a1a] mr-4 p-4 rounded-3xl w-40 border border-green-900/20 shadow-sm mb-4"
            >
                <View className="mb-3">
                    <View className="h-24 w-full bg-black/10 dark:bg-black/40 rounded-2xl items-center justify-center overflow-hidden border border-black/5 dark:border-white/5">
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
                        ) : (
                            <RemoteSvgIcon xml={visual.svgCode} color={visual.glowColor || visual.primaryColor || visual.color} size={50} />
                        )}
                    </View>
                </View>
                <Text className="dark:text-white font-black text-[11px] uppercase tracking-tight" numberOfLines={1}>{item.name}</Text>
                <View className="flex-row items-center mt-2 justify-between">
                    <View className="flex-row items-center bg-green-500/10 px-2 py-0.5 rounded-lg">
                        <Text className="text-green-600 dark:text-green-500 font-black text-[10px] mr-1">{item.price}</Text>
                        <CoinIcon type={item.currency || "OC"} size={10} />
                    </View>
                    <View className="bg-green-500 p-1.5 rounded-full shadow-lg shadow-green-500/30">
                        <Ionicons name="cart" size={12} color="white" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-[#0a0a0a] h-[85%] rounded-t-[40px] p-6 border-t-4 border-green-500">

                    {/* Header */}
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
                                    {/* 🔹 Standalone Grouped Sections */}
                                    {Object.entries(groupedStandaloneItems).map(([category, items]) => (
                                        <View key={category} className="mb-8">
                                            <View className="flex-row items-center mb-3">
                                                <View className="w-1 h-3 bg-green-500 rounded-full mr-2" />
                                                <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">{category}S</Text>
                                            </View>
                                            <ScrollView 
                                                horizontal 
                                                showsHorizontalScrollIndicator={false}
                                                style={{ height: items.length > 1 ? 380 : 180 }}
                                                contentContainerStyle={{
                                                    flexDirection: 'column',
                                                    flexWrap: 'wrap'
                                                }}
                                            >
                                                {items.map(item => renderCompactCard(item))}
                                            </ScrollView>
                                        </View>
                                    ))}

                                    {/* Thematic Collections Grid */}
                                    {catalog.themes?.length > 0 && (
                                        <View>
                                            <View className="flex-row items-center mb-4 mt-2">
                                                <View className="w-1 h-3 bg-blue-500 rounded-full mr-2" />
                                                <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">Thematic Collections</Text>
                                            </View>
                                            <div className="flex flex-wrap justify-between">
                                                {catalog.themes.map((theme) => (
                                                <TouchableOpacity
                                                    key={theme.id}
                                                    onPress={() => setSelectedTheme(theme)}
                                                    className="w-[48%] bg-gray-100 dark:bg-[#1a1a1a] p-6 rounded-3xl mb-4 items-center border border-gray-200 dark:border-gray-800 shadow-sm"
                                                >
                                                    <View className="mb-3">
                                                        <RemoteSvgIcon xml={theme.iconsvg} color="#22c55e" size={80} />
                                                    </View>
                                                    <Text className="dark:text-white font-black uppercase mt-1 text-center text-xs">{theme.label}</Text>
                                                    <View className="bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded-md mt-2">
                                                        <Text className="text-gray-500 text-[8px] uppercase font-bold">{theme.items?.length || 0} Items</Text>
                                                    </View>
                                                </TouchableOpacity>
                                                ))}
                                            </div>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    {/* Items within a Theme */}
                                    {['BADGE', 'THEME', 'BACKGROUND', "WATERMARK", 'EFFECT', 'GLOW', 'BORDER'].map((cat) => {
                                        const themeItems = selectedTheme.items?.filter(i => i.category?.toUpperCase() === cat) || [];
                                        if (themeItems.length === 0) return null;

                                        return (
                                            <View key={cat} className="mb-6">
                                                <View className="flex-row items-center mb-3">
                                                    <View className="w-1 h-3 bg-green-500 rounded-full mr-2" />
                                                    <Text className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">{cat}S</Text>
                                                </View>
                                                <ScrollView 
                                                    horizontal 
                                                    showsHorizontalScrollIndicator={false}
                                                    style={{ height: themeItems.length > 1 ? 380 : 180 }}
                                                    contentContainerStyle={{
                                                        flexDirection: 'column',
                                                        flexWrap: 'wrap'
                                                    }}
                                                >
                                                    {themeItems.map(item => renderCompactCard(item))}
                                                </ScrollView>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    )}

                    {isProcessingTransaction && (
                        <View className="absolute inset-0 bg-black/60 items-center justify-center rounded-t-[40px]">
                            <ActivityIndicator size="large" color="#22c55e" />
                            <Text className="text-green-500 font-black uppercase text-[10px] mt-4">Syncing with Chain...</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};


const AuthorInventoryModal = ({ visible, onClose, user, setUser, isDark, theinventory }) => {
    const [filter, setFilter] = useState('ALL');
    const [isUpdating, setIsUpdating] = useState(false);
    const CustomAlert = useAlert();

    const inventory = theinventory || user?.inventory || [];
    const categories = ['ALL', 'GLOW', 'BORDER', 'BADGE', 'WATERMARK'];

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

                    {/* Header */}
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

                    {/* Category Tabs */}
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

                    {/* Inventory List */}
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map((item, idx) => {
                                const expiration = getExpirationText(item.expiresAt);
                                const isExpired = expiration === "Expired";
                                const isBorder = item.category === 'BORDER';
                                const visual = item.visualConfig || {};

                                const PreviewIcon = (
                                    <View className={`w-16 h-16 bg-black/20 items-center justify-center rounded-2xl overflow-hidden ${isBorder ? '' : 'border border-white/5'}`}>
                                        <RemoteSvgIcon xml={visual.svgCode} size={40} color={visual.primaryColor}/>
                                    </View>
                                );

                                return (
                                    <View
                                        key={item.itemId || idx}
                                        className={`flex-row items-center p-4 rounded-3xl mb-3 border ${item.isEquipped
                                            ? 'bg-blue-500/10 border-blue-500'
                                            : 'bg-gray-50 dark:bg-[#161b22] border-gray-100 dark:border-gray-800'
                                        } ${isExpired ? 'opacity-50' : ''}`}
                                    >
                                        <View className="mr-4">
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
                                        </View>

                                        <View className="flex-1">
                                            <Text className="font-black dark:text-white text-sm uppercase italic">
                                                {item.name}
                                            </Text>

                                            <View className="flex-row mt-2 items-center">
                                                <Text className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">
                                                    {item.category}
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

                                        {item.category !== "VERIFIED" && (
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
        </Modal>
    );
};



export default function MobileProfilePage() {
    const storage = useMMKV();
    const CustomAlert = useAlert();
    const [theinventory, setInventory] = useState([]);
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

    // 🔹 REANIMATED SHARED VALUES
    const scanAnim = useSharedValue(0);
    const loadingAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(1);

    const [copied, setCopied] = useState(false);
    const [refCopied, setRefCopied] = useState(false);

    const CACHE_KEY_USER_EXTRAS = `user_profile_cache_${user?.deviceId}`;
    const currentAuraPoints = user?.weeklyAura || 0;
    const aura = useMemo(() => getAuraVisuals(user?.previousRank), [user?.previousRank]);
    const equippedGlow = user?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
    const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || null;
    const dynamicAuraColor = activeGlowColor || aura.color;
    const filledBoxes = Math.min(Math.floor(currentAuraPoints / 10), 10);

    // 🔹 REANIMATED ANIMATION TRIGGERS
    useEffect(() => {
        // DNA Scan Rotation
        scanAnim.value = withRepeat(
            withTiming(1, { duration: 10000, easing: Easing.linear }),
            -1,
            false
        );

        // Aura Pulse Effect
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

    // 🔹 REANIMATED ANIMATED STYLES
    const scanAnimatedStyle = useAnimatedStyle(() => {
        const rotate = interpolate(scanAnim.value, [0, 1], [0, 360]);
        return {
            transform: [{ rotate: `${rotate}deg` }],
            borderColor: `${dynamicAuraColor}40`
        };
    });

    const auraPulseStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: pulseAnim.value }],
            backgroundColor: dynamicAuraColor
        };
    });

    const progressBarAnimationStyle = useAnimatedStyle(() => {
        const transX = interpolate(loadingAnim.value, [0, 1], [-width, width]);
        return {
            transform: [{ translateX: transX }]
        };
    });

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
    }, [user?.deviceId, storage, CACHE_KEY_USER_EXTRAS]);

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

                    const dbAnimes = dbUser.preferences?.favAnimes?.join(', ') || "";
                    const dbGenres = dbUser.preferences?.favGenres?.join(', ') || "";
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
    }, [user?.deviceId, storage, CACHE_KEY_USER_EXTRAS, setUser]);

    const getKey = (pageIndex, previousPageData) => {
        if (!user?._id) return null;
        if (previousPageData && previousPageData.posts?.length < LIMIT) return null;
        return `/posts?author=${user._id}&page=${pageIndex + 1}&limit=${LIMIT}`;
    };

    const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: 10000,
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

                storage.set(CACHE_KEY_USER_EXTRAS, JSON.stringify({
                    username: result.user.username,
                    description: result.user.description,
                    totalPosts: totalPosts,
                    favAnimes: result.user.preferences?.favAnimes?.join(', ') || "",
                    favGenres: result.user.preferences?.favGenres?.join(', ') || "",
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
                    <View className="">
                        <Animated.View style={[{ position: 'absolute', inset: -12, borderRadius: 100, opacity: 0.15 }, auraPulseStyle]} />
                        <Animated.View style={[{ position: 'absolute', inset: -4, borderStyle: 'dashed', borderWidth: 1, borderRadius: 10000 }, scanAnimatedStyle]} />
                        <View style={{ borderColor: dynamicAuraColor }} className="absolute -inset-1 border-2 rounded-full opacity-50" />
                        <TouchableOpacity onPress={pickImage} className="w-40 h-40 rounded-full overflow-hidden border-4 border-white dark:border-[#0a0a0a] bg-gray-900 shadow-2xl">
                            <Image source={{ uri: preview || user?.profilePic?.url || "https://via.placeholder.com/150" }} style={{width:"100%", height: "100%"}} className="object-cover" />
                            <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                <Text className="text-[10px] font-black uppercase tracking-widest text-white">Change DNA</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={{ position: "absolute", left: -5 }} className="flex-col items-center">
                        <ProfileActionButton icon="archive-outline" color="#3b82f6" label="Items" onPress={() => setInventoryVisible(true)} />
                        <ProfileActionButton icon="cog-outline" color="#a855f7" label="Prefs" onPress={() => setPrefsVisible(true)} />
                        <ProfileActionButton icon="cart-outline" color="#22c55e" label="Store" onPress={() => setStoreVisible(true)} />
                        <ProfileActionButton icon="card-account-details-outline" color="#f59e0b" label="Card" onPress={() => setCardPreviewVisible(true)} />
                    </View>
                </View>

                <View className="items-center mb-6">
                    <Pressable onPress={() => setAuraModalVisible(true)} className="flex-row items-center gap-2">
                        <Text style={{ color: isDark ? "#fff" : "#000" }} className="text-2xl font-black uppercase tracking-tighter">{username || user?.username || "GUEST"}</Text>
                        <View className="px-2 py-0.5 rounded-full border" style={{ borderColor: dynamicAuraColor, backgroundColor: `${dynamicAuraColor}10` }}>
                            <Text style={{ color: dynamicAuraColor, fontSize: 8, fontWeight: '900' }}>{aura.label} {currentAuraPoints}</Text>
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
                    <TextInput value={username} onChangeText={setUsername} placeholder="Enter alias..." placeholderTextColor="#4b5563" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl text-sm font-bold dark:text-white" />
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
                    <TextInput multiline value={description} onChangeText={setDescription} placeholder="Write your player bio here..." placeholderTextColor="#4b5563" className="w-full bg-white dark:bg-black/40 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-sm font-medium dark:text-white min-h-[120px]" style={{ textAlignVertical: 'top' }} />
                </View>

                <TouchableOpacity onPress={handleUpdate} disabled={isUpdating} style={{ backgroundColor: dynamicAuraColor }} className="relative w-full h-14 rounded-2xl overflow-hidden items-center justify-center mt-6">
                    <Text className="relative z-10 text-white font-black uppercase italic tracking-widest text-xs">{isUpdating ? "Syncing Changes..." : "Update Character Data"}</Text>
                    {isUpdating && <Animated.View className="absolute bottom-0 h-1 bg-white/40 w-full" style={progressBarAnimationStyle} />}
                </TouchableOpacity>
            </View>

            <View className="flex-row items-center gap-4 mt-16 mb-8">
                <Text className="text-xl font-black uppercase tracking-tighter italic dark:text-white">Transmission Logs</Text>
                <View className="h-[1px] flex-1 bg-gray-100 dark:bg-gray-800" />
            </View>
        </View>
    ), [user, preview, description, username, isUpdating, totalPosts, copied, refCopied, rankTitle, rankIcon, progress, nextMilestone, count, showId, isDark, aura, filledBoxes, currentAuraPoints, dynamicAuraColor, pickImage, handleUpdate, captureAndShare, scanAnimatedStyle, auraPulseStyle, progressBarAnimationStyle]);


    return (
        <View className="flex-1 bg-white dark:bg-[#0a0a0a]" style={{ paddingTop: insets.top }}>
            <AppOnboarding />
            <View className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full" pointerEvents="none" />
            <View className="absolute bottom-0 left-0 w-60 h-60 bg-purple-600/5 rounded-full" pointerEvents="none" />

            <FlatList
                data={posts}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={listHeader}
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
                                <TextInput value={favCharacter} onChangeText={setFavCharacter} placeholder="E.G. ITACHI" placeholderTextColor="#4b5563" className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl dark:text-white font-black italic border border-purple-500/20" />
                            </View>

                            <View className="mt-4">
                                <Text className="text-[10px] font-black uppercase text-gray-400 mb-2">Favorite Animes (Comma separated)</Text>
                                <TextInput value={favAnimes} onChangeText={setFavAnimes} placeholder="One Piece, Naruto, Bleach" placeholderTextColor="#4b5563" className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl dark:text-white font-black italic border border-purple-500/20" />
                            </View>

                            <View className="mt-4">
                                <Text className="text-[10px] font-black uppercase text-gray-400 mb-2">Favorite Genres (Comma separated)</Text>
                                <TextInput value={favGenres} onChangeText={setFavGenres} placeholder="Action, Seinen, Psychological" placeholderTextColor="#4b5563" className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl dark:text-white font-black italic border border-purple-500/20" />
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
                        <MaterialCommunityIcons name={aura.icon} size={60} color={dynamicAuraColor} style={{ alignSelf: 'center', marginBottom: 20 }} />
                        <Text style={{ color: dynamicAuraColor }} className="text-3xl font-black text-center uppercase tracking-widest mb-2">{aura.label} POWER</Text>
                        <Text className="text-gray-500 text-center font-bold text-[10px] uppercase tracking-[0.3em] mb-2">Total Points: {currentAuraPoints}</Text>
                        <View className="flex-row justify-center gap-1 mb-6">{[...Array(10)].map((_, i) => (<View key={i} className="h-2 w-4 rounded-sm" style={{ backgroundColor: i < filledBoxes ? dynamicAuraColor : '#374151' }} />))}</View>
                        <Text className="text-gray-600 dark:text-gray-400 text-center leading-7 mb-8 font-medium">{aura.description}</Text>
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