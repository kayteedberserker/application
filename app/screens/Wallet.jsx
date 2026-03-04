import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Canvas, Circle, Fill, Group, LinearGradient, Rect, vec } from "@shopify/react-native-skia";
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import Purchases from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import ClanBorder from '../../components/ClanBorder';
import CoinIcon from '../../components/ClanIcon';
import PullSpinModal from '../../components/PullSpinModal'; // NEW IMPORT
import Topbar from '../../components/Topbar';
import THEME from '../../components/useAppTheme';
import { useClan } from '../../context/ClanContext';
import { useCoins } from '../../context/CoinContext';
import { useUser } from '../../context/UserContext';
import apiFetch from '../../utils/apiFetch';

const { width, height } = Dimensions.get('window');
const ITEM_WIDTH = (width - 60) / 3;

const REVENUE_CAT_API_KEYS = {
  ios: "goog_your_ios_key_here",
  android: "goog_cypWcXGzLgDujHkFvHTcUoqUNQi"
};

const CACHE_KEY = '@store_packages_cache';
const VAULT_CACHE_KEY_AUTHOR = '@vault_packs_author_cache';
const VAULT_CACHE_KEY_CLAN = '@vault_packs_clan_cache';
const USER_STATS_CACHE_KEY = '@user_vault_stats_cache';

const RemoteSvgIcon = ({ xml, size = 50, color }) => {
  if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
  return <SvgXml xml={xml} width={size} height={size} color={color} />;
};

const WalletPage = () => {
  const navigation = useNavigation();
  const { user } = useUser();
  const { coins, clanCoins, processTransaction, isProcessingTransaction } = useCoins();
  const { cCoins, isLoading: clanLoading, userClan, clanRank } = useClan();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [activeTab, setActiveTab] = useState('OC');
  const [vaultTab, setVaultTab] = useState('AUTHOR'); // 'AUTHOR' | 'CLAN'
  const [packages, setPackages] = useState([]);

  const [authorVaultPacks, setAuthorVaultPacks] = useState([]);
  const [clanVaultPacks, setClanVaultPacks] = useState([]);

  const [userStats, setUserStats] = useState({ postCount: 0, rankLevel: 1 });
  const [isFetchingStore, setIsFetchingStore] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [targetDay, setTargetDay] = useState(1);
  const [canClaimToday, setCanClaimToday] = useState(false);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [isPreviewingPack, setIsPreviewingPack] = useState(false);

  // 🔹 PULL LOGIC STATES
  const [pullModalVisible, setPullModalVisible] = useState(false);
  const [activePullData, setActivePullData] = useState(null);

  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const spinAnimInstance = useRef(null);
  const pulseAnimInstance = useRef(null);

  useEffect(() => {
    const isLoading = isProcessingTransaction || clanLoading || isFetchingStore;
    if (isLoading) {
      spinAnimInstance.current = Animated.loop(
        Animated.timing(spinValue, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
      );
      spinAnimInstance.current.start();

      pulseAnimInstance.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, { toValue: 0.5, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseValue, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulseAnimInstance.current.start();
    } else {
      if (spinAnimInstance.current) spinAnimInstance.current.stop();
      if (pulseAnimInstance.current) pulseAnimInstance.current.stop();
      spinValue.setValue(0);
      pulseValue.setValue(1);
    }
  }, [isProcessingTransaction, clanLoading, isFetchingStore]);

  useEffect(() => {
    if (user) {
      const lastClaim = user.lastClaimedDate ? new Date(user.lastClaimedDate) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentStreak = user.consecutiveStreak || 0;
      let isSameDay = false;
      if (lastClaim) {
        lastClaim.setHours(0, 0, 0, 0);
        isSameDay = today.getTime() === lastClaim.getTime();
      }
      setCanClaimToday(!isSameDay);
      if (isSameDay) {
        setTargetDay(currentStreak);
      } else {
        setTargetDay((currentStreak % 7) + 1);
      }
    }
  }, [user, coins]);

  const fetchOfferings = useCallback(async (force = false) => {
    if (packages.length > 0 && authorVaultPacks.length > 0 && clanVaultPacks.length > 0 && !force) return;
    setIsFetchingStore(true);
    try {
      const [cachedStore, cachedAuthorVault, cachedClanVault, cachedStats] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY),
        AsyncStorage.getItem(VAULT_CACHE_KEY_AUTHOR),
        AsyncStorage.getItem(VAULT_CACHE_KEY_CLAN),
        AsyncStorage.getItem(USER_STATS_CACHE_KEY)
      ]);

      if (cachedStore) setPackages(JSON.parse(cachedStore));
      if (cachedAuthorVault) setAuthorVaultPacks(JSON.parse(cachedAuthorVault));
      if (cachedClanVault) setClanVaultPacks(JSON.parse(cachedClanVault));
      if (cachedStats) setUserStats(JSON.parse(cachedStats));

      const isConfigured = await Purchases.isConfigured();
      if (!isConfigured) {
        await Purchases.configure({ apiKey: Platform.OS === 'ios' ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android });
      }

      const [offerings, authorPackRes, clanPackRes] = await Promise.all([
        Purchases.getOfferings(),
        apiFetch('/packs?type=author'),
        apiFetch('/packs?type=clan')
      ]);

      if (offerings.current !== null) {
        const availablePkgs = offerings.current.availablePackages;
        setPackages(availablePkgs);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(availablePkgs));
      }

      if (authorPackRes && authorPackRes.ok) {
        const packData = await authorPackRes.json();
        if (packData.success) {
          setAuthorVaultPacks(packData.packs);
          const stats = { postCount: packData.meta.postCount, rankLevel: packData.meta.rankLevel };
          setUserStats(stats);
          await AsyncStorage.setItem(VAULT_CACHE_KEY_AUTHOR, JSON.stringify(packData.packs));
          await AsyncStorage.setItem(USER_STATS_CACHE_KEY, JSON.stringify(stats));
        }
      }

      if (clanPackRes && clanPackRes.ok) {
        const clanData = await clanPackRes.json();
        if (clanData.success) {
          setClanVaultPacks(clanData.packs);
          await AsyncStorage.setItem(VAULT_CACHE_KEY_CLAN, JSON.stringify(clanData.packs));
        }
      }

    } catch (e) {
      console.error("❌ Vault Sync Error", e);
    } finally {
      setIsFetchingStore(false);
    }
  }, [packages.length, authorVaultPacks.length, clanVaultPacks.length]);

  useEffect(() => { fetchOfferings(); }, []);

  const handleClaimDaily = async () => {
    const type = targetDay === 7 ? 'daily_login_7' : 'daily_login';
    const result = await processTransaction('claim', type, null, null);
    if (result.success) {
      setMessage({ text: `+${targetDay === 7 ? 50 : 10} OC ACQUIRED`, type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const openPreview = (pkg, isPack = false) => {
    setSelectedPkg(pkg);
    setIsPreviewingPack(isPack);
    setPreviewVisible(true);
  };

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setPreviewVisible(false);

    const pkgToBuy = isPreviewingPack
      ? packages.find(p => p.product.identifier === selectedPkg.storeId)
      : selectedPkg;

    if (!pkgToBuy) {
      setMessage({ text: 'TRANSMISSION LINK OFFLINE', type: 'error' });
      return;
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkgToBuy);

      // Check if any reward requires a pull
      const pullReward = selectedPkg.rewards?.find(r => r.requiresPull);

      if (isPreviewingPack && pullReward) {
        // Intercept for the pull spin
        setActivePullData({
          reward: pullReward,
          pkgToBuy: pkgToBuy,
          allRewards: selectedPkg.rewards
        });
        setPullModalVisible(true);
      } else {
        // Proceed with standard purchase
        finalizePurchase(pkgToBuy, selectedPkg.rewards);
      }
    } catch (e) {
      if (!e.userCancelled) setMessage({ text: 'TRANSMISSION INTERRUPTED', type: 'error' });
    }
  };

  // 🔹 FINAL STEP: SAVING TO DATABASE
  const finalizePurchase = async (pkgToBuy, rewardsArray) => {
    const action = isPreviewingPack ? 'purchase_pack' : 'buy_coins';
    const packIdentifier = pkgToBuy.product.identifier;
    const coinType = isPreviewingPack ? (vaultTab === 'CLAN' ? 'CC' : 'OC') : (activeTab === 'CC' ? 'CC' : 'OC');

    const result = await processTransaction(
      action,
      packIdentifier,
      {
        currency: coinType,
        rewards: rewardsArray
      },
      userClan?.tag
    );

    if (result.success) {
      setMessage({ text: 'TRANSMISSION COMPLETE', type: 'success' });
      fetchOfferings(true);
    } else {
      setMessage({ text: result.error || 'SYNC ERROR', type: 'error' });
    }
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  // 🔹 HANDLE SPIN COMPLETION
  const onPullComplete = (generatedNumber) => {
    setPullModalVisible(false);
    
    // Create modified rewards array with injected number into SVG
    const updatedRewards = activePullData.allRewards.map(reward => {
      if (reward.requiresPull) {
        const meta = reward.pullMetadata;
        const numberSvgTag = `<text x="${meta.targetTextX}" y="${meta.targetTextY}" font-family="Arial, sans-serif" font-size="100" fill="${meta.primaryFill || "#00a86b"}" font-weight="bold">${generatedNumber}</text>`;
        
        // Inject tag before the closing </svg>
        const updatedSvg = reward.visualConfig.svgCode.replace('</svg>', `${numberSvgTag}</svg>`);
        
        return {
          ...reward,
          visualConfig: { ...reward.visualConfig, svgCode: updatedSvg },
          pulledNumber: generatedNumber,
          label: `${reward.label || reward.name} #${generatedNumber}`
        };
      }
      return reward;
    });

    // Save to DB
    finalizePurchase(activePullData.pkgToBuy, updatedRewards);
    setActivePullData(null);
  };

  const getCleanAmount = (title) => {
    if (title.includes("CC") || title.includes("21000")) {
      const match = title.match(/\d+/);
      if (match) {
        let numStr = match[0];
        if (numStr.endsWith('0')) { return numStr.slice(0, -1); }
        return numStr;
      }
      return title;
    } else {
      const match = title.match(/\d+/);
      return match ? match[0] : title;
    }
  };

  const getFilteredPackages = () => {
    return packages.filter(pkg => {
      const id = pkg.product.identifier.toLowerCase();
      if (id.includes('pack')) return false;
      return activeTab === 'OC' ? id.includes('ore') : id.includes('clan');
    }).sort((a, b) => {
      const amountA = parseInt(getCleanAmount(a.product.title), 10) || 0;
      const amountB = parseInt(getCleanAmount(b.product.title), 10) || 0;
      return amountA - amountB;
    });
  };

  const getRankRequirements = (rank) => {
    const requirements = { 1: 0, 2: 25, 3: 51, 4: 101, 5: 151, 6: 201 };
    return requirements[rank] || 0;
  };

  const renderPackProgressBar = (requiredRank) => {
    if (vaultTab === 'CLAN') {
      const currentClanLvl = typeof clanRank === 'number' ? clanRank : (clanRank?.level || 1);
      const remaining = Math.max(0, requiredRank - currentClanLvl);
      return (
        <View className="mt-3">
          <View className="flex-row justify-between mb-1">
            <Text style={{ color: THEME.textSecondary }} className="text-[7px] font-black uppercase tracking-tighter">
              {remaining > 0 ? `Unlocks at Clan Rank ${requiredRank}` : 'Rank Achieved'}
            </Text>
          </View>
        </View>
      );
    } else {
      const requiredPosts = getRankRequirements(requiredRank);
      const currentPosts = userStats.postCount || 0;
      const remaining = Math.max(0, requiredPosts - currentPosts);
      const progress = Math.min(1, currentPosts / requiredPosts);
      return (
        <View className="mt-3">
          <View className="flex-row justify-between mb-1">
            <Text style={{ color: THEME.textSecondary }} className="text-[7px] font-black uppercase tracking-tighter">
              {remaining > 0 ? `Unlocks in ${remaining} Posts` : 'Rank Achieved'}
            </Text>
            <Text style={{ color: THEME.text }} className="text-[7px] font-black">{currentPosts}/{requiredPosts}</Text>
          </View>
          <View style={{ backgroundColor: THEME.border }} className="h-1 rounded-full overflow-hidden">
            <View style={{ width: `${progress * 100}%`, backgroundColor: THEME.accent }} className="h-full" />
          </View>
        </View>
      );
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const correctCoin = activeTab === 'CC' ? (clanCoins || 0) : (coins || 0);
  const correctIcon = activeTab === 'CC' ? "CC" : "OC";
  const currentVaultPacks = vaultTab === 'AUTHOR' ? authorVaultPacks : clanVaultPacks;

  const renderRewardPreview = (reward) => {
    const visual = reward.visualConfig || {};
    if (reward.type === 'BORDER') {
      return (
        <View className="w-10 h-10 overflow-hidden rounded-md">
          <ClanBorder
            color={visual.primaryColor || THEME.accent}
            animationType={visual.animationType || 'singleSnake'}
            duration={visual.duration}
            snakeLength={visual.snakeLength}
          >
            <View className="flex-1 bg-black/20" />
          </ClanBorder>
        </View>
      );
    }
    if (visual.svgCode) {
      return <RemoteSvgIcon xml={visual.svgCode} size={24} color={visual.primaryColor || THEME.accent} />;
    }
    switch (reward.type) {
      case 'OC': return <CoinIcon size={18} type='OC' />;
      case 'CC': return <CoinIcon size={18} type='CC' />;
      case 'MULTIPLIER': return <MaterialCommunityIcons name="trending-up" size={20} color={THEME.accent} />;
      case 'UPGRADE': return <MaterialCommunityIcons name="arrow-up-bold" size={20} color={THEME.accent} />;
      default: return <Ionicons name="cube-outline" size={20} color={THEME.accent} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <StatusBar barStyle={THEME.isDark ? "light-content" : "dark-content"} />
      <Topbar isDark={isDark} />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="p-5" showsVerticalScrollIndicator={false}>
        {/* 🔹 BALANCE CARD */}
        <View className="mb-6 rounded-[35px] overflow-hidden h-fit" style={{ backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border }}>
          <Canvas style={{ flex: 1, position: 'absolute', width: '100%', height: '100%' }}>
            <Rect x={0} y={0} width={width} height={200}>
              <LinearGradient start={vec(0, 0)} end={vec(width, 200)} colors={[THEME.card, THEME.isDark ? "#121212" : "#f0f4f8", THEME.card]} />
            </Rect>
            <Circle cx={width * 0.85} cy={60} r={100} color={THEME.glowBlue} />
            <Circle cx={40} cy={160} r={60} color={THEME.glowIndigo} />
          </Canvas>

          <View className="flex-1 p-6 gap-4 justify-between">
            <View className="flex-row justify-between items-start">
              <View>
                <Text style={{ color: THEME.accent }} className="font-black uppercase text-[10px] tracking-[4px]">Energy Reserve</Text>
                <View className="flex-row items-baseline mt-2">
                  <Text style={{ color: THEME.text }} className="text-5xl font-black italic tracking-tighter">{correctCoin.toLocaleString()}</Text>
                </View>
              </View>
              <CoinIcon size={40} type={correctIcon} />
            </View>

            {activeTab === 'OC' && (
              <TouchableOpacity
                onPress={handleClaimDaily}
                disabled={!canClaimToday || isProcessingTransaction}
                style={{ backgroundColor: canClaimToday ? THEME.accent : 'transparent', borderColor: canClaimToday ? THEME.accent : THEME.border, borderWidth: canClaimToday ? 0 : 2 }}
                className="h-14 rounded-2xl flex-row items-center justify-center shadow-xl"
              >
                <MaterialCommunityIcons name={canClaimToday ? "lightning-bolt" : "lightning-bolt-outline"} size={22} color={canClaimToday ? "white" : THEME.textSecondary} />
                <Text className="font-black uppercase text-[12px] ml-2 tracking-[2px]" style={{ color: canClaimToday ? "white" : THEME.textSecondary }}>
                  {canClaimToday ? `Initiate Refuel` : "Depot Empty"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 🔹 TABS */}
        <View className="flex-row mb-8 bg-black/5 dark:bg-white/5 p-1 rounded-[22px] border border-black/5 dark:border-white/5">
          {['OC', 'CC', 'PACKS'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 py-3.5 rounded-[18px] items-center justify-center"
              style={activeTab === tab ? { backgroundColor: THEME.accent } : {}}
            >
              <Text style={{ color: activeTab === tab ? 'white' : THEME.textSecondary }} className="font-black uppercase text-[9px] tracking-[2.5px]">
                {tab === 'OC' ? "Ore" : tab === 'CC' ? "Clan" : "Vault"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 🔹 CONTENT AREA */}
        <View>
          {message.text !== '' && (
            <View style={{ backgroundColor: THEME.card, borderColor: message.type === 'error' ? THEME.danger : THEME.success }} className="mb-6 p-4 rounded-2xl border-b-2 flex-row items-center justify-center">
              <Text style={{ color: message.type === 'error' ? THEME.danger : THEME.success }} className="font-black uppercase text-[10px] tracking-[2px] italic">{message.text}</Text>
            </View>
          )}

          {(activeTab === 'OC' || activeTab === 'CC') && (
            <View>
              <View className="mb-6 px-1 flex-row items-end justify-between">
                <Text style={{ color: THEME.text }} className="text-2xl font-black uppercase italic">{activeTab === 'OC' ? "OC STORE" : "CC STORE"}</Text>
                <Text style={{ color: THEME.accent }} className="text-[8px] font-black uppercase tracking-[2px]">Encrypted</Text>
              </View>

              <View className="flex-row flex-wrap gap-4 justify-start">
                {getFilteredPackages().map((pkg) => (
                  <TouchableOpacity key={pkg.product.identifier} onPress={() => openPreview(pkg)} style={{ backgroundColor: THEME.card, borderColor: THEME.border, width: ITEM_WIDTH - 2 }} className="px-2 py-4 rounded-[28px] border-2 mb-4 items-center">
                    <View className="flex-row items-center mb-2">
                      <Text style={{ color: THEME.text }} className="font-black text-lg italic mr-1">{getCleanAmount(pkg.product.title)}</Text>
                      <CoinIcon size={18} type={correctIcon} />
                    </View>
                    <View style={{ backgroundColor: THEME.accent }} className="w-[85%] py-2 rounded-xl items-center">
                      <Text className="text-white font-black text-[9px] uppercase">{pkg.product.priceString}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'PACKS' && (
            <View>
              <View className="mb-6 px-1">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: THEME.text }} className="text-2xl font-black uppercase italic">Limited Bundles</Text>
                  <Text style={{ color: THEME.accent }} className="text-[8px] font-black uppercase tracking-[2px]">Rank-Locked Equipment</Text>
                </View>

                {userClan && (
                  <View className="flex-row mt-4 bg-black/5 dark:bg-white/5 rounded-2xl p-1 border border-black/5 dark:border-white/5">
                    <TouchableOpacity
                      onPress={() => setVaultTab('AUTHOR')}
                      className="flex-1 py-2.5 items-center justify-center rounded-xl"
                      style={vaultTab === 'AUTHOR' ? { backgroundColor: THEME.accent } : {}}
                    >
                      <Text style={{ color: vaultTab === 'AUTHOR' ? 'white' : THEME.textSecondary }} className="font-black uppercase tracking-widest text-[9px]">Author Packs</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setVaultTab('CLAN')}
                      className="flex-1 py-2.5 items-center justify-center rounded-xl"
                      style={vaultTab === 'CLAN' ? { backgroundColor: THEME.accent } : {}}
                    >
                      <Text style={{ color: vaultTab === 'CLAN' ? 'white' : THEME.textSecondary }} className="font-black uppercase tracking-widest text-[9px]">Clan Packs</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {currentVaultPacks.length === 0 ? (
                <Text style={{ color: THEME.textSecondary }} className="text-center font-bold uppercase tracking-widest text-[10px] mt-10">No packs available.</Text>
              ) : currentVaultPacks.map((pack) => {
                const storePkg = packages.find(p => p.product.identifier === pack.storeId);
                let isLocked = pack.isLocked;
                if (vaultTab === 'CLAN') {
                  const currentClanLvl = typeof clanRank === 'number' ? clanRank : (clanRank?.level || 1);
                  isLocked = currentClanLvl < pack.requiredRank;
                }
                const isOwned = pack.isPurchased;
                const cardColor = isLocked ? '#444' : (pack.color || THEME.accent);

                return (
                  <TouchableOpacity
                    key={pack.id}
                    disabled={!isLocked && !isOwned}
                    onPress={() => openPreview(pack, true)}
                    className={`mb-8 rounded-[35px] overflow-hidden border-2 ${isLocked ? 'opacity-60' : ''}`}
                    style={{ borderColor: cardColor, height: 240, backgroundColor: THEME.card }}
                  >
                    <Canvas style={{ position: 'absolute', width: '100%', height: '100%' }}>
                      <Fill color={THEME.isDark ? "#0a0a0a" : "#f8fafc"} />
                      <Group>
                        <LinearGradient start={vec(0, 0)} end={vec(width, 240)} colors={[cardColor + "20", cardColor + "40", cardColor + "10"]} />
                        <Rect x={0} y={0} width={width} height={240} />
                      </Group>
                    </Canvas>

                    <View className="flex-1 p-6 justify-between">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-4">
                          <View className="flex-row items-center mb-1">
                            <Text className="font-black text-xl italic uppercase" style={{ color: isLocked ? THEME.textSecondary : THEME.text }}>{pack.name}</Text>
                            {isLocked && <MaterialCommunityIcons name="lock" size={18} color={THEME.textSecondary} style={{ marginLeft: 8 }} />}
                            {isOwned && <MaterialCommunityIcons name="check-decagram" size={20} color={THEME.success} style={{ marginLeft: 8 }} />}
                          </View>
                          <Text style={{ color: THEME.textSecondary }} className="font-bold text-[10px] uppercase tracking-widest">{pack.description}</Text>
                          {isLocked && renderPackProgressBar(pack.requiredRank)}
                          {isOwned && <Text style={{ color: THEME.success }} className="text-[8px] font-black uppercase tracking-widest mt-2">Ownership Verified</Text>}
                        </View>
                        <View style={{ backgroundColor: cardColor }} className="p-3 rounded-2xl shadow-lg">
                          <MaterialCommunityIcons name={isLocked ? "shield-lock" : (pack.visualData?.icon || "flash")} size={24} color="white" />
                        </View>
                      </View>

                      <View className="flex-row justify-between items-end">
                        <View className="flex-1 flex-row flex-wrap gap-2 mr-2">
                          {pack.rewards && pack.rewards.slice(0, 3).map((reward, idx) => (
                            <View key={idx} className="bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 flex-row items-center gap-1.5">
                              {renderRewardPreview(reward)}
                              <Text style={{ color: THEME.text }} className="font-black text-[7.5px] uppercase">{reward.label || reward.name}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={{ backgroundColor: isLocked ? THEME.border : (isOwned ? THEME.success : THEME.accent) }} className="px-5 py-3 rounded-2xl shadow-xl">
                          <Text className="text-white font-black text-[10px] uppercase">
                            {isLocked ? "CLASSIFIED" : (isOwned ? "DEPLOYED" : (storePkg ? storePkg.product.priceString : "LINKING..."))}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 🔹 PURCHASE PREVIEW MODAL */}
      <Modal visible={previewVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View style={{ backgroundColor: THEME.bg, borderTopLeftRadius: 40, borderTopRightRadius: 40, borderTopWidth: 4, borderColor: selectedPkg?.isPurchased ? THEME.success : THEME.accent }} className="h-[75%] p-8">
            <TouchableOpacity onPress={() => setPreviewVisible(false)} className="absolute right-6 top-6 z-10">
              <Ionicons name="close-circle" size={32} color={THEME.textSecondary} />
            </TouchableOpacity>

            {selectedPkg && (
              <View className="flex-1">
                <View className="items-center mb-8">
                  <View className="p-6 rounded-full mb-4" style={{ backgroundColor: (selectedPkg.color || THEME.accent) + '15' }}>
                    {isPreviewingPack ? (
                      <MaterialCommunityIcons name={selectedPkg.visualData?.icon || "package-variant-closed"} size={80} color={selectedPkg.color || THEME.accent} />
                    ) : (
                      <CoinIcon size={80} type={activeTab === 'OC' ? 'OC' : 'CC'} />
                    )}
                  </View>
                  <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase text-center">
                    {isPreviewingPack ? selectedPkg.name : `${getCleanAmount(selectedPkg.product.title)} ${activeTab === 'OC' ? 'OC' : 'CC'}`}
                  </Text>
                  <Text style={{ color: THEME.accent }} className="font-black tracking-[4px] uppercase text-[10px] mt-2">Vault Transmission</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} className="flex-1 mb-6">
                  {isPreviewingPack ? (
                    <View>
                      <Text style={{ color: THEME.textSecondary }} className="text-center font-bold mb-6 text-xs uppercase tracking-widest">{selectedPkg.description}</Text>
                      <View className="gap-3">
                        {selectedPkg.rewards?.map((reward, idx) => (
                          <View key={idx} style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="flex-row items-center p-4 rounded-2xl border">
                            <View className="w-12 h-12 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: THEME.bg }}>
                              {renderRewardPreview(reward)}
                            </View>
                            <View className="flex-1">
                              <Text style={{ color: THEME.text }} className="font-black uppercase text-[11px]">{reward.name || reward.label}</Text>
                              <Text style={{ color: THEME.textSecondary }} className="text-[9px] uppercase font-bold tracking-tighter">{reward.type.replace('_', ' ')}</Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={16} color={THEME.accent} />
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View className="items-center py-10">
                      <Text style={{ color: THEME.textSecondary }} className="text-center italic uppercase font-bold text-xs">
                        Confirm top up of {getCleanAmount(selectedPkg.product.title)} {activeTab === 'OC' ? 'OC' : 'CC'}.
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity
                  onPress={handlePurchase}
                  disabled={selectedPkg.isPurchased}
                  style={{ backgroundColor: selectedPkg.isPurchased ? THEME.success : THEME.accent }}
                  className="h-16 rounded-[20px] flex-row items-center justify-center shadow-2xl"
                >
                  <MaterialCommunityIcons name={selectedPkg.isPurchased ? "check-all" : "shield-check"} size={24} color="white" />
                  <Text className="text-white font-black uppercase ml-3 tracking-[2px]">
                    {selectedPkg.isPurchased ? "Bundle Already Deployed" : `Confirm ${isPreviewingPack ? (packages.find(p => p.product.identifier === selectedPkg.storeId)?.product.priceString || '...') : selectedPkg.product.priceString}`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 🔹 PULL SPIN MODAL */}
      {activePullData && (
        <PullSpinModal 
          isVisible={pullModalVisible}
          rewardName={activePullData.reward.name}
          pullMetadata={activePullData.reward.pullMetadata}
          onClose={() => setPullModalVisible(false)}
          onComplete={onPullComplete}
        />
      )}

      {/* 🔹 LOADING OVERLAY */}
      {(isProcessingTransaction || clanLoading || isFetchingStore) && (
        <View className="absolute inset-0 z-[100] items-center justify-center">
          <Canvas style={{ position: 'absolute', width: '100%', height: '100%' }}>
            <Rect x={0} y={0} width={width} height={height} color={isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)"} />
          </Canvas>
          <View className="items-center">
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Canvas style={{ width: 120, height: 120 }}>
                <Group opacity={0.3}><Circle cx={60} cy={60} r={50} color={THEME.accent} style="stroke" strokeWidth={2} /></Group>
                <Circle cx={60} cy={10} r={6} color={THEME.accent} />
              </Canvas>
            </Animated.View>
            <Animated.View style={{ opacity: pulseValue }} className="mt-10 items-center">
              <Text style={{ color: THEME.text }} className="font-black uppercase tracking-[6px] text-[11px] italic">Accessing Vault...</Text>
            </Animated.View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default WalletPage;