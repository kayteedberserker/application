import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Canvas, Circle, Group, LinearGradient, Rect, vec } from "@shopify/react-native-skia";
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { useMMKV } from 'react-native-mmkv';
import Purchases from 'react-native-purchases';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  ScaleIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import AnimeLoading from '../../components/AnimeLoading';
import ClanBorder from '../../components/ClanBorder';
import CoinIcon from '../../components/ClanIcon';
import PeakBadge from '../../components/PeakBadge';
import PullSpinModal from '../../components/PullSpinModal';
import Topbar from '../../components/Topbar';
import THEME from '../../components/useAppTheme';
import { useAlert } from '../../context/AlertContext';
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
const RECENT_USERS_KEY = '@wallet_recent_users';
const RECENT_AMOUNTS_KEY = '@wallet_recent_amounts';

const PEAK_THRESHOLDS = [1, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const PEAK_REWARDS = [
  { level: 1, title: "Initiate Status", desc: "First purchase completed. Welcome to Peak." },
  { level: 2, title: "Bronze Status", desc: "Peak Level 2 badge." },
  { level: 3, title: "Bronze II Status", desc: "Peak Level 3 badge." },
  { level: 4, title: "Silver Status", desc: "Peak Level 4 badge, Silver theme badge." },
  { level: 5, title: "Silver II Status", desc: "Peak Level 5 badge." },
  { level: 6, title: "Gold Status", desc: "Peak Level 6 badge." },
  { level: 7, title: "Gold II Status", desc: "+5% Bonus to all daily OC claims." },
  { level: 8, title: "Epic Status", desc: "Unlock animated profile VFX & Auras." },
  { level: 9, title: "Epic II Status", desc: "Custom Epic Name Color." },
  { level: 10, title: "Mythic Status", desc: "Absolute Peak. Unlocks all Mythic items." }
];

const RemoteSvgIcon = React.memo(({ xml, size = 50, color }) => {
  if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color={color || "gray"} />;
  return <SvgXml xml={xml} width={size} height={size} color={color} />;
});

// ==========================================
// ⚡️ WALLET ONBOARDING MODAL
// ==========================================
const WalletOnboarding = () => {
  const storage = useMMKV();
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);

  const allFeatures = [
    {
      title: "ENERGY_RESERVES",
      desc: "Welcome to the Vault. Here you manage your Ore Coins (OC) and Clan Coins (CC). OC is the universal currency, while CC is earned and spent exclusively within Clan Alliances.",
      icon: "wallet",
      color: "#3b82f6",
      intel: "SYSTEM: WALLET_INITIALIZED"
    },
    {
      title: "CLAIM_&_DISPATCH",
      desc: "Don't forget to claim your daily OC allowance! Feeling generous? Use the Dispatch feature to transfer OC directly to allied operatives.",
      icon: "send",
      color: "#10b981",
      intel: "ACTION: PEER_TO_PEER"
    },
    {
      title: "THE_PEAK_SYSTEM",
      desc: "Your Ascension begins here. Purchasing OC increases your Peak Level. Reach higher tiers to unlock exclusive permanent rewards and a glowing Peak Badge on your profile.",
      icon: "rocket",
      color: "#ec4899",
      intel: "STATUS: ASCENSION_PROTOCOL"
    },
    {
      title: "THE_VAULT",
      desc: "Access the Vault to purchase Limited Bundles. These packs contain exclusive skins, borders, and OC. Join a Clan to unlock the highly classified Clan Vault.",
      icon: "lock-closed",
      color: "#f59e0b",
      intel: "STORE: VAULT_ACCESS"
    },
    {
      title: "READY_FOR_DEPLOYMENT",
      desc: "Your wallet is fully synced. Secure your assets and upgrade your arsenal, Operator.",
      icon: "checkmark-done-circle",
      color: "#22c55e",
      intel: "FINAL_INIT: SECURE"
    }
  ];

  useEffect(() => {
    const hasSeen = storage.getBoolean('HAS_SEEN_WALLET_ONBOARDING');
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, [storage]);

  const handleComplete = () => {
    storage.set('HAS_SEEN_WALLET_ONBOARDING', true);
    setIsVisible(false);
  };

  const nextStep = () => {
    if (step < allFeatures.length - 1) setStep(step + 1);
    else handleComplete();
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none">
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.96)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
      }}>
        <Animated.View entering={FadeIn} style={{ position: 'absolute', width: '100%', height: '100%' }} />

        <Animated.View
          entering={ScaleIn}
          style={{
            width: '100%',
            height: height * 0.78,
            backgroundColor: '#050505',
            borderRadius: 32,
            borderWidth: 1,
            borderColor: '#1e293b',
            padding: 30,
            justifyContent: 'space-between'
          }}
        >
          {/* --- TOP NAVIGATION BAR --- */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#111',
            paddingBottom: 15
          }}>
            <View style={{ width: 80 }}>
              {step > 0 && (
                <TouchableOpacity
                  onPress={prevStep}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="chevron-back" size={14} color="#60a5fa" />
                  <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: 'bold' }}>PREV_DATA</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: '#22d3ee', fontWeight: 'bold' }}>[ INITIALIZING ]</Text>
            </View>

            <TouchableOpacity onPress={handleComplete}>
              <Text style={{ fontSize: 10, color: '#475569', fontWeight: 'bold', letterSpacing: 1 }}>SKIP_SYNC_X</Text>
            </TouchableOpacity>
          </View>

          <View>
            {/* Icon Container with Glow */}
            <Animated.View key={`icon-${step}`} entering={FadeIn} style={{ marginBottom: 30, marginTop: 10 }}>
              <View style={{
                width: 68, height: 68, borderRadius: 20, backgroundColor: '#000',
                borderWidth: 1, borderColor: allFeatures[step].color,
                justifyContent: 'center', alignItems: 'center',
                shadowColor: allFeatures[step].color, shadowOpacity: 0.3, shadowRadius: 15,
                elevation: 5
              }}>
                {allFeatures[step].icon === "auto-fix" ? (
                  <MaterialCommunityIcons name="auto-fix" size={34} color={allFeatures[step].color} />
                ) : (
                  <Ionicons name={allFeatures[step].icon} size={34} color={allFeatures[step].color} />
                )}
              </View>
            </Animated.View>

            {/* Text Content */}
            <Animated.View key={`text-${step}`} entering={FadeInDown}>
              <Text style={{ fontSize: 10, color: allFeatures[step].color, fontWeight: '900', letterSpacing: 3, marginBottom: 12 }}>
                {allFeatures[step].intel}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 18, lineHeight: 34 }}>
                {allFeatures[step].title.replace(/_/g, ' ')}
              </Text>
              <Text style={{ fontSize: 15, color: '#94a3b8', lineHeight: 24 }}>
                {allFeatures[step].desc}
              </Text>
            </Animated.View>
          </View>

          <View>
            {/* Progress Dots */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 30 }}>
              {allFeatures.map((_, i) => (
                <View key={i} style={{
                  height: 4, width: i === step ? 24 : 6, borderRadius: 10,
                  backgroundColor: i === step ? allFeatures[step].color : '#1e293b'
                }} />
              ))}
            </View>

            {/* Main Action Button */}
            <TouchableOpacity
              onPress={nextStep}
              activeOpacity={0.8}
              style={{
                backgroundColor: allFeatures[step].color,
                paddingVertical: 18, borderRadius: 18,
                alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 10
              }}
            >
              <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 2 }}>
                  {step === allFeatures.length - 1 ? "INITIALIZE_CORE" : "NEXT_SYNC_LEVEL"}
                </Text>
                <Ionicons
                  name={step === allFeatures.length - 1 ? "flash" : "chevron-forward"}
                  size={20}
                  color="#000"
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};


// ==========================================
// ⚡️ MAIN COMPONENT
// ==========================================
const WalletPage = () => {
  const CustomAlert = useAlert();
  const storage = useMMKV();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useUser();

  const { coins, clanCoins, totalPurchasedCoins = 0, peakLevel = 0, processTransaction, isProcessingTransaction } = useCoins();
  const { cCoins, isLoading: clanLoading, userClan, clanRank, isInClan } = useClan();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [activeTab, setActiveTab] = useState('OC');
  const [vaultTab, setVaultTab] = useState('AUTHOR');
  const [packages, setPackages] = useState([]);

  const [userStats, setUserStats] = useState({ postCount: 0, rankLevel: 1 });
  const [isFetchingStore, setIsFetchingStore] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [targetDay, setTargetDay] = useState(1);
  const [canClaimToday, setCanClaimToday] = useState(false);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [isPreviewingPack, setIsPreviewingPack] = useState(false);

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentAmounts, setRecentAmounts] = useState([]);

  const [pullModalVisible, setPullModalVisible] = useState(false);
  const [activePullData, setActivePullData] = useState(null);
  const [minLoadDone, setMinLoadDone] = useState(false);

  const spinValue = useSharedValue(0);
  const pulseValue = useSharedValue(1);

  const TABS = isInClan ? ['OC', 'PEAK', 'CC'] : ['OC', 'PEAK'];

  useEffect(() => {
    const t = setTimeout(() => setMinLoadDone(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const cachedUsers = storage.getString(RECENT_USERS_KEY);
    const cachedAmounts = storage.getString(RECENT_AMOUNTS_KEY);
    if (cachedUsers) setRecentUsers(JSON.parse(cachedUsers));
    if (cachedAmounts) setRecentAmounts(JSON.parse(cachedAmounts));
  }, [storage]);

  useEffect(() => {
    if (!isInClan && activeTab === 'CC') {
      setActiveTab('OC');
    }
  }, [isInClan]);

  useEffect(() => {
    const isLoading = isProcessingTransaction || clanLoading || isFetchingStore;
    if (isLoading) {
      spinValue.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      );
      pulseValue.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      spinValue.value = 0;
      pulseValue.value = 1;
    }
  }, [isProcessingTransaction, clanLoading, isFetchingStore]);

  const spinStyle = useAnimatedStyle(() => {
    const rotate = interpolate(spinValue.value, [0, 1], [0, 360]);
    return {
      transform: [{ rotate: `${rotate}deg` }]
    };
  });

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseValue.value
    };
  });

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
    if (packages.length > 0 && !force) return;
    setIsFetchingStore(true);
    try {
      const cachedStore = storage.getString(CACHE_KEY);
      const cachedAuthorVault = storage.getString(VAULT_CACHE_KEY_AUTHOR);
      const cachedClanVault = storage.getString(VAULT_CACHE_KEY_CLAN);
      const cachedStats = storage.getString(USER_STATS_CACHE_KEY);

      if (cachedStore) setPackages(JSON.parse(cachedStore));
      if (cachedStats) setUserStats(JSON.parse(cachedStats));

      const isConfigured = await Purchases.isConfigured();
      if (!isConfigured) {
        await Purchases.configure({ apiKey: Platform.OS === 'ios' ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android });
      }

      const [offerings] = await Promise.all([
        Purchases.getOfferings(),
      ]);

      if (offerings.current !== null) {
        const availablePkgs = offerings.current.availablePackages;
        setPackages(availablePkgs);
        storage.set(CACHE_KEY, JSON.stringify(availablePkgs));
      }

    } catch (e) {
      console.error("❌ Vault Sync Error", e);
    } finally {
      setIsFetchingStore(false);
    }
  }, [packages.length, storage]);

  useEffect(() => { fetchOfferings(); }, []);

  const handleClaimDaily = async () => {
    const type = targetDay === 7 ? 'daily_login_7' : 'daily_login';
    const result = await processTransaction('claim', type, null, null);
    if (result.success) {
      setMessage({ text: `+${targetDay === 7 ? 50 : 10} OC ACQUIRED`, type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const handleSearchUsers = async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 3) {
      searchResults.length > 0 && setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await apiFetch(`/users/search?query=${query}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.users.filter(u => u.deviceId !== user.deviceId));
      }
    } catch (e) {
      console.error("Search error", e);
    } finally {
      setIsSearching(false);
    }
  };

  const saveToRecents = (recipient, amount) => {
    const updatedUsers = [recipient, ...recentUsers.filter(u => u._id !== recipient._id)].slice(0, 5);
    setRecentUsers(updatedUsers);
    storage.set(RECENT_USERS_KEY, JSON.stringify(updatedUsers));

    const updatedAmounts = [amount, ...recentAmounts.filter(a => a !== amount)].slice(0, 5);
    setRecentAmounts(updatedAmounts);
    storage.set(RECENT_AMOUNTS_KEY, JSON.stringify(updatedAmounts));
  };

  const handleTransfer = async () => {
    const amount = parseInt(transferAmount);
    if (!selectedRecipient || isNaN(amount) || amount <= 0) {
      setMessage({ text: 'INVALID TRANSMISSION DATA', type: 'error' });
      return;
    }
    if (coins < amount) {
      setMessage({ text: 'INSUFFICIENT OC RESERVES', type: 'error' });
      return;
    }

    CustomAlert(
      "Authorize Dispatch",
      `Confirm transmission of ${amount} OC to ${selectedRecipient.username.toUpperCase()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "default",
          onPress: async () => {
            const result = await processTransaction('transfer', 'send_oc', {
              recipientId: selectedRecipient._id,
              amount: amount
            });

            if (result.success) {
              saveToRecents(selectedRecipient, amount);
              setMessage({ text: `TRANSMISSION SUCCESS TO ${selectedRecipient.username.toUpperCase()}`, type: 'success' });
              setShareModalVisible(false);
              setSelectedRecipient(null);
              setTransferAmount('');
              setSearchQuery('');
            } else {
              setMessage({ text: result.error || 'LINK FAILED', type: 'error' });
            }
            setTimeout(() => setMessage({ text: '', type: '' }), 4000);
          }
        }
      ]
    );
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

      const pullReward = selectedPkg.rewards?.find(r => r.requiresPull);

      if (isPreviewingPack && pullReward) {
        setActivePullData({
          reward: pullReward,
          pkgToBuy: pkgToBuy,
          allRewards: selectedPkg.rewards
        });
        setPullModalVisible(true);
      } else {
        finalizePurchase(pkgToBuy, selectedPkg.rewards);
      }
    } catch (e) {
      if (!e.userCancelled) setMessage({ text: 'TRANSMISSION INTERRUPTED', type: 'error' });
    }
  };

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

  const onPullComplete = (generatedNumber) => {
    setPullModalVisible(false);

    const updatedRewards = activePullData.allRewards.map(reward => {
      if (reward.requiresPull) {
        const meta = reward.pullMetadata;
        const numberSvgTag = `<text x="${meta.targetTextX}" y="${meta.targetTextY}" font-family="Arial, sans-serif" font-size="100" fill="${meta.primaryFill || "#00a86b"}" font-weight="bold">${generatedNumber}</text>`;

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

  if (!minLoadDone) {
    return (
      <AnimeLoading
        tipType={"wallet"}
        message={"LOADING_WALLET"}
        subMessage={"Loading Author Account"}
      />
    );
  }

  const currentTierMin = peakLevel === 0 ? 0 : (PEAK_THRESHOLDS[peakLevel - 1] || 0);
  const nextTierMin = peakLevel === 0 ? 1 : (PEAK_THRESHOLDS[peakLevel] || PEAK_THRESHOLDS[PEAK_THRESHOLDS.length - 1]);
  const progressBase = Math.max(0, totalPurchasedCoins - currentTierMin);
  const progressGoal = Math.max(1, nextTierMin - currentTierMin);
  const peakProgress = peakLevel === 10 ? 1 : Math.min(1, progressBase / progressGoal);
  const coinsToNextPeak = peakLevel === 10 ? 0 : nextTierMin - totalPurchasedCoins;

  const correctCoin = activeTab === 'CC' ? (clanCoins || 0) : (coins || 0);
  const correctIcon = activeTab === 'CC' ? "CC" : "OC";

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

      {/* ⚡️ WALLET ONBOARDING ADDED HERE */}
      <WalletOnboarding />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="p-5" showsVerticalScrollIndicator={false}>

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
              <View className="flex-row gap-x-3">
                <TouchableOpacity
                  onPress={handleClaimDaily}
                  disabled={!canClaimToday || isProcessingTransaction}
                  style={{ backgroundColor: canClaimToday ? THEME.accent : 'transparent', borderColor: canClaimToday ? THEME.accent : THEME.border, borderWidth: canClaimToday ? 0 : 2 }}
                  className="flex-1 h-14 rounded-2xl flex-row items-center justify-center shadow-xl"
                >
                  <MaterialCommunityIcons name={canClaimToday ? "lightning-bolt" : "lightning-bolt-outline"} size={22} color={canClaimToday ? "white" : THEME.textSecondary} />
                  <Text className="font-black uppercase text-[12px] ml-2 tracking-[2px]" style={{ color: canClaimToday ? "white" : THEME.textSecondary }}>
                    {canClaimToday ? `Initiate Refuel` : "Depot Empty"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShareModalVisible(true)}
                  style={{ borderColor: THEME.accent, borderWidth: 1 }}
                  className="w-14 h-14 rounded-2xl items-center justify-center bg-white/5"
                >
                  <Ionicons name="send-outline" size={24} color={THEME.accent} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View className="flex-row mb-8 bg-black/5 dark:bg-white/5 p-1 rounded-[22px] border border-black/5 dark:border-white/5">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 py-3.5 rounded-[18px] items-center justify-center"
              style={activeTab === tab ? { backgroundColor: THEME.accent } : {}}
            >
              <Text style={{ color: activeTab === tab ? 'white' : THEME.textSecondary }} className="font-black uppercase text-[9px] tracking-[1.5px]">
                {tab === 'OC' ? "Ore" : tab === 'CC' ? "Clan" : tab === 'PACKS' ? "Vault" : "Peak"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View>
          {message.text !== '' && (
            <View style={{ backgroundColor: THEME.card, borderColor: message.type === 'error' ? THEME.danger : THEME.success }} className="mb-6 p-4 rounded-2xl border-b-2 flex-row items-center justify-center">
              <Text style={{ color: message.type === 'error' ? THEME.danger : THEME.success }} className="font-black uppercase text-[10px] tracking-[2px] italic">{message.text}</Text>
            </View>
          )}

          {activeTab === 'PEAK' && (
            <View>
              <View className="mb-6 px-1 flex-row items-end justify-between">
                <Text style={{ color: THEME.text }} className="text-2xl font-black uppercase italic">Ascension</Text>
                <Text style={{ color: THEME.accent }} className="text-[8px] font-black uppercase tracking-[2px]">Peak System</Text>
              </View>

              <View style={{ backgroundColor: THEME.card, borderColor: THEME.border, borderWidth: 1 }} className="p-8 rounded-[35px] items-center mb-8 shadow-sm">
                <View className="mb-4">
                  {peakLevel > 0 ? (
                    <PeakBadge level={peakLevel} size={90} />
                  ) : (
                    <View style={{ width: 90, height: 90, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.border, borderRadius: 20 }}>
                      <MaterialCommunityIcons name="lock" size={40} color={THEME.textSecondary} />
                    </View>
                  )}
                </View>
                <Text style={{ color: THEME.text }} className="text-2xl font-black uppercase tracking-tighter">
                  {peakLevel > 0 ? `Level ${peakLevel}` : "Unranked"}
                </Text>
                <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-bold uppercase tracking-widest mt-1 mb-8">
                  Acquired: {totalPurchasedCoins.toLocaleString()} OC
                </Text>

                <View className="w-full">
                  <View className="flex-row justify-between mb-2 px-1">
                    <Text style={{ color: THEME.text }} className="text-[10px] font-black tracking-widest">
                      {peakLevel === 0 ? 'LVL 0' : `LVL ${peakLevel}`}
                    </Text>
                    <Text style={{ color: THEME.text }} className="text-[10px] font-black tracking-widest">
                      {peakLevel === 10 ? 'MAX' : `LVL ${peakLevel + 1}`}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: THEME.border }} className="h-3 rounded-full overflow-hidden">
                    <View style={{ width: `${peakProgress * 100}%`, backgroundColor: THEME.accent }} className="h-full rounded-full" />
                  </View>
                  {peakLevel < 10 ? (
                    <Text style={{ color: THEME.accent }} className="text-[9px] font-bold uppercase tracking-widest mt-3 text-center">
                      {coinsToNextPeak.toLocaleString()} OC to next rank
                    </Text>
                  ) : (
                    <Text style={{ color: THEME.success }} className="text-[9px] font-bold uppercase tracking-widest mt-3 text-center">
                      Maximum Peak Achieved
                    </Text>
                  )}
                </View>
              </View>

              <Text style={{ color: THEME.textSecondary }} className="font-black text-[11px] uppercase mb-4 tracking-widest px-1">Tier Rewards</Text>
              <View className="gap-3">
                {PEAK_REWARDS.map((tier, index) => {
                  const isUnlocked = peakLevel >= tier.level;
                  return (
                    <View key={index} style={{ backgroundColor: THEME.card, borderColor: isUnlocked ? THEME.accent : THEME.border, borderWidth: 1, opacity: isUnlocked ? 1 : 0.5 }} className="p-4 rounded-2xl flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1 pr-4">
                        <View className="w-10 items-center justify-center mr-2">
                          <Text style={{ color: isUnlocked ? THEME.accent : THEME.textSecondary }} className="font-black text-lg italic">L.{tier.level}</Text>
                        </View>
                        <View className="flex-1">
                          <Text style={{ color: THEME.text }} className="font-black uppercase text-[11px] mb-1">{tier.title}</Text>
                          <Text style={{ color: THEME.textSecondary }} className="text-[9px] font-bold tracking-tight leading-tight">{tier.desc}</Text>
                        </View>
                      </View>
                      {isUnlocked ? (
                        <MaterialCommunityIcons name="check-decagram" size={24} color={THEME.accent} />
                      ) : (
                        <MaterialCommunityIcons name="lock" size={20} color={THEME.textSecondary} />
                      )}
                    </View>
                  );
                })}
              </View>
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
        </View>
      </ScrollView>

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
                  disabled={selectedPkg.isPurchased || selectedPkg.isLocked}
                  style={{ backgroundColor: selectedPkg.isPurchased ? THEME.success : THEME.accent }}
                  className="h-16 rounded-[20px] flex-row items-center justify-center shadow-2xl"
                >
                  <MaterialCommunityIcons name={selectedPkg.isPurchased ? "check-all" : "shield-check"} size={24} color="white" />
                  <Text className="text-white font-black uppercase ml-1 text-[12px]">
                    {selectedPkg.isPurchased ? "Bundle Already Deployed" : selectedPkg.isLocked ? "Requirements Not met" : `Confirm ${isPreviewingPack ? (packages.find(p => p.product.identifier === selectedPkg.storeId)?.product.priceString || '...') : selectedPkg.product.priceString}`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={shareModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View style={{ backgroundColor: THEME.bg, borderTopLeftRadius: 40, borderTopRightRadius: 40 }} className="h-[85%] p-8">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text style={{ color: THEME.text }} className="text-2xl font-black italic uppercase">Dispatch Energy</Text>
                <Text style={{ color: THEME.accent }} className="text-[8px] font-black uppercase tracking-widest mt-1">Peer-to-Peer Transfer</Text>
              </View>
              <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                <Ionicons name="close-circle" size={32} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <TextInput
                style={{ backgroundColor: THEME.card, color: THEME.text, borderColor: THEME.border, borderWidth: 1 }}
                className="h-14 rounded-2xl px-5 font-bold"
                placeholder="Search username..."
                placeholderTextColor={THEME.textSecondary}
                value={searchQuery}
                onChangeText={handleSearchUsers}
              />
            </View>

            {selectedRecipient ? (
              <View style={{ backgroundColor: THEME.card, borderColor: THEME.accent }} className="p-4 rounded-2xl border-2 flex-row items-center justify-between mb-6">
                <View className="flex-row gap-4 items-center">
                  <Image source={{ uri: selectedRecipient.profilePic?.url }} style={{ width: 40, height: 40, borderRadius: 20 }} className="mr-3 border border-white/10" contentFit="cover" />
                  <Text style={{ color: THEME.text }} className="font-black uppercase text-xs">{selectedRecipient.username}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedRecipient(null)}>
                  <Ionicons name="remove-circle" size={20} color={THEME.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-1 mb-4">
                {searchQuery.length === 0 && recentUsers.length > 0 && (
                  <View className="mb-4">
                    <Text style={{ color: THEME.textSecondary }} className="font-black text-[9px] uppercase mb-3 tracking-widest">Recent Allies</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-4">
                        {recentUsers.map(u => (
                          <TouchableOpacity key={u._id} onPress={() => setSelectedRecipient(u)} className="items-center">
                            <Image source={{ uri: u.profilePic?.url }} style={{ width: 56, height: 56, borderRadius: 28 }} className="border-2 border-white/10 mb-1" contentFit="cover" />
                            <Text style={{ color: THEME.text }} className="text-[8px] font-bold uppercase">{u.username.slice(0, 8)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}
                {isSearching ? <ActivityIndicator color={THEME.accent} /> : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {searchResults.map(u => (
                      <TouchableOpacity key={u._id} onPress={() => setSelectedRecipient(u)} className="py-4 border-b border-white/5 flex-row items-center justify-between">
                        <View className="flex-row gap-4 items-center">
                          <Image source={{ uri: u.profilePic?.url }} style={{ width: 40, height: 40, borderRadius: 20 }} className="mr-3" contentFit="cover" />
                          <Text style={{ color: THEME.text }} className="font-black uppercase text-[11px]">{u.username}</Text>
                        </View>
                        <Ionicons name="add-circle-outline" size={18} color={THEME.accent} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <View className="mb-6">
              <Text style={{ color: THEME.textSecondary }} className="font-black text-[9px] uppercase mb-3 tracking-widest">Amount</Text>
              {recentAmounts.length > 0 && (
                <View className="flex-row gap-2 mb-4">
                  {recentAmounts.map(a => (
                    <TouchableOpacity key={a} onPress={() => setTransferAmount(a.toString())} className="px-4 py-2 rounded-full border border-white/10 bg-white/5">
                      <Text style={{ color: THEME.text }} className="text-[10px] font-black">{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View className="flex-row items-center">
                <TextInput
                  style={{ backgroundColor: THEME.card, color: THEME.text, borderColor: THEME.border, borderWidth: 1 }}
                  className="flex-1 h-14 rounded-2xl px-5 font-black text-xl"
                  placeholder="0"
                  placeholderTextColor={THEME.textSecondary}
                  keyboardType="number-pad"
                  value={transferAmount}
                  onChangeText={setTransferAmount}
                />
                <View className="ml-4"><CoinIcon type="OC" size={32} /></View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleTransfer}
              disabled={isProcessingTransaction || !selectedRecipient}
              style={{ backgroundColor: selectedRecipient ? THEME.accent : THEME.border }}
              className="h-16 rounded-2xl items-center justify-center shadow-2xl"
            >
              <Text className="text-white font-black uppercase tracking-[2px] text-xs">Authorize Dispatch</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {activePullData && (
        <PullSpinModal
          isVisible={pullModalVisible}
          rewardName={activePullData.reward.name}
          pullMetadata={activePullData.reward.pullMetadata}
          onClose={() => setPullModalVisible(false)}
          onComplete={onPullComplete}
        />
      )}

      {(isProcessingTransaction || clanLoading || isFetchingStore) && (
        <View className="absolute inset-0 z-[100] items-center justify-center">
          <Canvas style={{ position: 'absolute', width: '100%', height: '100%' }}>
            <Rect x={0} y={0} width={width} height={height} color={isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)"} />
          </Canvas>
          <View className="items-center">
            <Animated.View style={[spinStyle]}>
              <Canvas style={{ width: 120, height: 120 }}>
                <Group opacity={0.3}><Circle cx={60} cy={60} r={50} color={THEME.accent} style="stroke" strokeWidth={2} /></Group>
                <Circle cx={60} cy={10} r={6} color={THEME.accent} />
              </Canvas>
            </Animated.View>
            <Animated.View style={[pulseStyle]} className="mt-10 items-center">
              <Text style={{ color: THEME.text }} className="font-black uppercase tracking-[6px] text-[11px] italic">Accessing Vault...</Text>
            </Animated.View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default WalletPage;