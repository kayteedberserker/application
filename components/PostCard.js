import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from "expo-image";
import * as MediaLibrary from 'expo-media-library';
import { useVideoPlayer, VideoView } from "expo-video";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View
} from "react-native";
import { useMMKV } from 'react-native-mmkv';

import { useEvent } from "expo";
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SvgXml } from "react-native-svg";
import useSWR from "swr";
import { useAlert } from "../context/AlertContext";
import { useUser } from "../context/UserContext";
import apiFetch from "../utils/apiFetch";
import AuraAvatar from "./AuraAvatar";
import ClanBorder from "./ClanBorder";
import ClanCrest from "./ClanCrest";
import PeakBadge from "./PeakBadge";
import PlayerBackground from "./PlayerBackground";
import PlayerNameplate from "./PlayerNameplate";
import PlayerWatermark from "./PlayerWatermark";
import Poll from "./Poll";
import { SyncLoading } from "./SyncLoading";
import { Text } from "./Text";
import THEME from "./useAppTheme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const fetcher = (url) => apiFetch(url).then((res) => res.json());

// ⚡️ OPTIMIZATION: Memoize static styles outside the component
const MEDIA_GLASS_STYLE = {
  borderWidth: 1,
  borderColor: 'rgba(96, 165, 250, 0.2)',
  shadowColor: "#60a5fa",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.3,
  shadowRadius: 10
};

const getVideoThumbnail = (url) => {
  if (!url) return null;
  return url.replace("/q_auto,vc_auto/", "/f_jpg,q_auto,so_auto,c_pad,b_black/").replace(/\.[^/.]+$/, ".jpg");
};

// --- SUB-COMPONENTS ---

const MediaPlaceholder = ({ height = 250, onPress, type, thumbUrl, showPlayIcon = true }) => (
  <Pressable
    onPress={onPress}
    style={{ height, width: '100%' }}
    className="bg-gray-100 dark:bg-gray-900 items-center justify-center overflow-hidden rounded-2xl relative"
  >
    {thumbUrl ? (
      <Image source={{ uri: thumbUrl }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.6 }} contentFit="cover" />
    ) : null}
    {showPlayIcon && (
      <View className="bg-black/40 p-5 rounded-full mb-2 border border-white/20 z-10">
        <Feather name={type === "video" ? "play" : "image"} size={32} color="white" />
      </View>
    )}
    <View className="bg-black/60 px-4 py-1 rounded-full border border-white/10 z-10">
      <Text className="text-white font-black text-[10px] uppercase tracking-[0.2em]">
        Open {type === "video" ? "Stream" : "Visual"}
      </Text>
    </View>
  </Pressable>
);

const RemoteSvgIcon = React.memo(({ xml, size = 50, color }) => {
  if (!xml) return <MaterialCommunityIcons name="help-circle-outline" size={size} color="gray" />;
  return <SvgXml xml={xml} width={size} height={size} />;
});

import HypeModal from "./HypeModal";

// Helper to format seconds into MM:SS
const formatTime = (timeInSeconds) => {
  if (!timeInSeconds || isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return "00:00";
  const totalSeconds = Math.floor(Math.max(0, timeInSeconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

import * as Crypto from 'expo-crypto';
import TitleTag from "./TitleTag";

const LightboxVideoPlayer = memo(({ uri }) => {
  const isDark = useColorScheme() === "dark";
  const theme = THEME;
  const hideTimerRef = useRef(null);
  const scrubTimeRef = useRef(0);
  const tapTimeout = useRef(null);
  const lastTap = useRef(null);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [seekIndicator, setSeekIndicator] = useState(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // --- CACHE STATES ---
  // We initialize finalUri with the remote uri so it plays immediately
  const [finalUri, setFinalUri] = useState(uri);

  // --- CACHE LOGIC (Silent Background) ---
  useEffect(() => {
    let isMounted = true;

    const prepareVideo = async () => {
      if (!uri) return;

      try {
        const hashed = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          uri
        );

        const finalLocalUri = `${FileSystem.cacheDirectory}${hashed}.mp4`;
        const tempLocalUri = `${FileSystem.cacheDirectory}${hashed}.tmp`;

        const fileInfo = await FileSystem.getInfoAsync(finalLocalUri);

        if (fileInfo.exists) {
          // LEGACY REPAIR: If existing cache is too small, it's likely corrupt
          if (fileInfo.size < 1024 * 500) { // If file is smaller than 500KB, consider it corrupted
            if (__DEV__) console.log("Deleting corrupted legacy file...");
            await FileSystem.deleteAsync(finalLocalUri, { idempotent: true });
          } else {
            if (__DEV__) console.log("Switching to complete cache:", finalLocalUri);
            if (isMounted) setFinalUri(finalLocalUri);
            return;
          }
        }

        // DOWNLOAD IN BACKGROUND
        if (__DEV__) console.log("Streaming from remote, caching in background...");

        await FileSystem.downloadAsync(uri, tempLocalUri);
        await FileSystem.moveAsync({
          from: tempLocalUri,
          to: finalLocalUri
        });

        if (__DEV__) console.log("Background cache complete. Ready for next time.");
        // We DO NOT call setFinalUri here. 
        // The native player is already buffering the remote stream for seamless looping.
        // Hot-swapping the URI mid-watch would restart the video.

      } catch (e) {
        if (__DEV__) console.log("Cache failed, staying on remote stream", e);
      }
    };

    prepareVideo();
    return () => { isMounted = false; };
  }, [uri]);

  // --- PLAYER INIT ---
  const player = useVideoPlayer(finalUri, (p) => {
    p.loop = true;
    p.play();
  });

  // --- EVENTS & STATUS ---
  const isPlayingEvent = useEvent(player, "playingChange");
  const statusEvent = useEvent(player, "statusChange");
  const durationEvent = useEvent(player, "durationChange");
  const mutedEvent = useEvent(player, "mutedChange");

  const isPlaying = isPlayingEvent?.isPlaying ?? player?.playing ?? false;
  const status = statusEvent?.status ?? player?.status ?? 'loading';
  const duration = durationEvent?.duration ?? player?.duration ?? 0;
  const isMuted = mutedEvent?.muted ?? player?.muted ?? false;

  // --- HEARTBEAT FOR REALTIME UI ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isScrubbing && player && duration > 0) {
        setLocalTime(player.currentTime ?? 0);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [player, isScrubbing, duration]);

  // --- AUTO HIDE LOGIC ---
  const resetAutoHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (showControls && isPlaying && !isScrubbing && !showSpeedMenu) {
      hideTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    resetAutoHide();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [showControls, isPlaying, isScrubbing, showSpeedMenu]);

  // --- INTERACTION HANDLERS ---
  const handleSmartTap = (side) => {
    const now = Date.now();
    if (lastTap.current && (now - lastTap.current) < 300) {
      clearTimeout(tapTimeout.current);
      lastTap.current = null;
      const seekAmount = side === 'left' ? -10 : 10;
      player.seekBy(seekAmount);
      setSeekIndicator(side);
      setTimeout(() => setSeekIndicator(null), 600);
      setShowControls(true);
    } else {
      lastTap.current = now;
      tapTimeout.current = setTimeout(() => {
        if (showSpeedMenu) setShowSpeedMenu(false);
        else setShowControls((prev) => !prev);
        lastTap.current = null;
      }, 300);
    }
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsScrubbing(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      const touchX = evt.nativeEvent.pageX;
      const progress = Math.max(0, Math.min(touchX / SCREEN_WIDTH, 1));
      const newTime = progress * duration;
      scrubTimeRef.current = newTime;
      setLocalTime(newTime);
    },
    onPanResponderMove: (evt, gestureState) => {
      const touchX = gestureState.moveX || evt.nativeEvent.pageX;
      const progress = Math.max(0, Math.min(touchX / SCREEN_WIDTH, 1));
      const newTime = progress * duration;
      scrubTimeRef.current = newTime;
      setLocalTime(newTime);
    },
    onPanResponderRelease: () => {
      if (player) player.currentTime = scrubTimeRef.current;
      setIsScrubbing(false);
      resetAutoHide();
    },
  }), [duration, player]);

  const changeSpeed = (speed) => {
    if (player) player.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    resetAutoHide();
  };

  const progressPercent = duration > 0 ? (localTime / duration) * 100 : 0;

  return (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', backgroundColor: theme.bg }}>
      {player && (
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="contain"
          nativeControls={false}
        />
      )}

      {/* TAP ZONES */}
      <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      }} pointerEvents="box-none" flexDirection="row">
        <Pressable style={{ flex: 1 }} onPress={() => handleSmartTap('left')} />
        <Pressable style={{ flex: 1 }} onPress={() => handleSmartTap('right')} />
      </View>

      {/* SEEK FEEDBACK */}
      {seekIndicator && (
        <View style={[styles.seekFeedback, seekIndicator === 'left' ? { left: '15%' } : { right: '15%' }]}>
          <Feather name={seekIndicator === 'left' ? "rotate-ccw" : "rotate-cw"} size={30} color="white" />
          <Text style={styles.seekText}>10s</Text>
        </View>
      )}

      {/* HUD OVERLAY */}
      {showControls && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

          {/* CENTER PLAY/PAUSE */}
          <View style={styles.centerControl} pointerEvents="box-none">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (player) isPlaying ? player.pause() : player.play();
                resetAutoHide();
              }}
              style={[styles.playButton, { borderColor: theme.glowBlue || 'transparent', shadowColor: theme.accent || '#000' }]}
            >
              {status === 'loading' ? <ActivityIndicator color="white" /> : <Feather name={isPlaying ? 'pause' : 'play'} size={36} color="white" />}
            </TouchableOpacity>
          </View>

          {/* SPEED MENU */}
          {showSpeedMenu && (
            <View style={[styles.speedMenu, { backgroundColor: theme.card }]}>
              {[0.5, 1.0, 1.5, 2.0].map((s) => (
                <TouchableOpacity key={s} onPress={() => changeSpeed(s)} style={styles.speedOption}>
                  <Text style={[styles.speedText, { color: playbackSpeed === s ? theme.accent : theme.text }]}>
                    {s === 1.0 ? 'Normal' : `${s}x`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* BOTTOM HUD */}
          <View style={styles.bottomHud} pointerEvents="box-none">
            <View style={styles.timerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.timerText, { color: theme.text }]}>{formatTime(localTime)}</Text>
                <Text style={[styles.timerText, { color: theme.textSecondary, marginHorizontal: 5 }]}>/</Text>
                <Text style={[styles.timerText, { color: theme.text }]}>{formatTime(duration)}</Text>
              </View>

              <View style={styles.rightControls}>
                <TouchableOpacity
                  onPress={() => setShowSpeedMenu(!showSpeedMenu)}
                  style={styles.iconButton}
                >
                  <Feather name="settings" size={20} color={theme.text} />
                  <Text style={[styles.speedLabel, { color: theme.text }]}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { if (player) player.muted = !isMuted; }} style={styles.iconButton}>
                  <Feather name={isMuted ? "volume-x" : "volume-2"} size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* PROGRESS BAR */}
            <View {...panResponder.panHandlers} style={styles.progressBarBg}>
              <View style={{ position: 'absolute', width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }} />
              <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: theme.accent }]}>
                <View style={[styles.progressDot, { backgroundColor: theme.text }]} />
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center' },
  seekFeedback: { position: 'absolute', top: '45%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 20, borderRadius: 60, zIndex: 100 },
  seekText: { color: 'white', fontWeight: '900', marginTop: 5, fontSize: 12 },
  loaderContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  centerControl: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playButton: { backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 22, borderRadius: 60, borderWidth: 2, elevation: 12 },

  bottomHud: { position: 'absolute', bottom: 0, width: '100%', paddingBottom: 25 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12, alignItems: 'center' },
  timerText: { fontSize: 12, fontWeight: '900' },

  rightControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconButton: { flexDirection: 'row', alignItems: 'center' },
  speedLabel: { fontSize: 12, fontWeight: 'bold', marginLeft: 5 },

  speedMenu: { position: 'absolute', bottom: 70, right: 20, padding: 10, borderRadius: 12, width: 100, zIndex: 200 },
  speedOption: { paddingVertical: 8, alignItems: 'center' },
  speedText: { fontSize: 14, fontWeight: 'bold' },

  progressBarBg: { width: '100%', height: 30, justifyContent: 'center' },
  progressTrack: { position: 'absolute', width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressFill: { height: 6, justifyContent: 'center' },
  progressDot: { position: 'absolute', right: -10, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }
});

// Create the Animated version of FlatList so it can accept UI-thread props
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const MediaModal = memo(({ isOpen, onClose, mediaItems, currentIndex, setCurrentIndex, handleDownload, isDownloading, isMediaSaved }) => {
  const [assetLoading, setAssetLoading] = useState(false);
  const theme = THEME; // Ensure your THEME context is available here
  const flatListRef = useRef(null);

  // 1. REPLACED React State with a UI Thread Shared Value
  const isScrollEnabled = useSharedValue(true);

  // 2. Connect the shared value directly to the FlatList's native properties
  const animatedProps = useAnimatedProps(() => {
    return {
      scrollEnabled: isScrollEnabled.value,
    };
  });

  const goToNext = () => {
    if (currentIndex < mediaItems.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    }
  };

  const renderLightboxContent = (item, isActive) => {
    const lowerUrl = item.url?.toLowerCase() || "";
    const isDirectVideo = item.type?.startsWith("video") || lowerUrl.match(/\.(mp4|mov|m4v|webm)$/i);

    if (isDirectVideo) {
      if (!isActive) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
      return <LightboxVideoPlayer key={item.url} uri={item.url} />;
    }

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Pass our UI-thread shared value down instead of a JS callback */}
        <ZoomableImage
          uri={item.url}
          onClose={onClose}
          setAssetLoading={setAssetLoading}
          isScrollEnabledUI={isScrollEnabled}
        />

        {assetLoading && isActive && (
          <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)' }} pointerEvents="none">
            <SyncLoading message="Synchronizing Visuals" />
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>

        <AnimatedFlatList
          ref={flatListRef}
          data={mediaItems}
          animatedProps={animatedProps} // <-- Bound to the UI thread!
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={currentIndex}
          getItemLayout={(data, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          keyExtractor={(item, index) => item.url + index}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            if (newIndex !== currentIndex) {
              setCurrentIndex(newIndex);
            }
          }}
          renderItem={({ item, index }) => (
            <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
              {renderLightboxContent(item, index === currentIndex)}
            </View>
          )}
        />

        {/* --- UI HUD (Absolute Overlay) --- */}
        <View style={{ position: 'absolute', inset: 0 }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 24, top: 56 }} pointerEvents="box-none">
            {mediaItems[currentIndex]?.type !== "youtube" && mediaItems[currentIndex]?.type !== "tiktok" ? (
              <Pressable
                onPress={handleDownload}
                disabled={isDownloading || isMediaSaved}
                style={{ backgroundColor: theme.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)', borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, padding: 12, borderRadius: 50, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                {isDownloading ? <ActivityIndicator size="small" color={theme.accent} /> : <Feather name={isMediaSaved ? "check" : "download"} size={24} color={theme.text} />}
              </Pressable>
            ) : <View style={{ width: 48 }} />}

            {mediaItems.length > 1 && (
              <View pointerEvents="none" style={{ backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)', borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ color: theme.text, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Asset {currentIndex + 1} / {mediaItems.length}
                </Text>
              </View>
            )}

            <Pressable onPress={onClose} style={{ backgroundColor: theme.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)', borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, padding: 12, borderRadius: 50 }}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          {mediaItems.length > 1 && (
            <>
              {currentIndex > 0 && (
                <Pressable onPress={goToPrev} style={{ position: 'absolute', left: 16, top: '50%', marginTop: -20, backgroundColor: theme.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)', borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, padding: 10, borderRadius: 30 }}>
                  <Feather name="chevron-left" size={20} color={theme.text} />
                </Pressable>
              )}
              {currentIndex < mediaItems.length - 1 && (
                <Pressable onPress={goToNext} style={{ position: 'absolute', right: 16, top: '50%', marginTop: -20, backgroundColor: theme.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)', borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, padding: 10, borderRadius: 30 }}>
                  <Feather name="chevron-right" size={20} color={theme.text} />
                </Pressable>
              )}
            </>
          )}
        </View>

        {isDownloading && (
          <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)', zIndex: 100 }}>
            <SyncLoading message="Saving to Gallery..." />
          </View>
        )}

      </GestureHandlerRootView>
    </Modal>
  );
});


const MemoizedClanHeader = memo(({ clanInfo, postId, isDark, isFeed, isVisible }) => {
  if (!clanInfo) return null;

  const isVerified = clanInfo.verifiedUntil && new Date(clanInfo.verifiedUntil) > new Date();
  const verifiedTier = clanInfo.activeCustomizations?.verifiedTier;
  const verifiedColor = verifiedTier === "premium" ? "#facc15" : verifiedTier === "standard" ? "#ef4444" : verifiedTier === "basic" ? "#3b82f6" : "";
  const highlightColor = isVerified ? verifiedColor : THEME.accent;

  const equippedBadges = clanInfo.specialInventory?.filter(i => i.category === 'BADGE' && i.isEquipped) || [];
  const displayBadge = equippedBadges.length > 0 ? equippedBadges[0] : null;

  const equippedGlow = clanInfo.specialInventory?.find(i => i.category === 'GLOW' && i.isEquipped);
  const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || equippedGlow?.visualData?.glowColor || null;

  const equippedBg = clanInfo.specialInventory?.find(i => i.category === 'BACKGROUND' && i.isEquipped);
  const equippedBorder = clanInfo.specialInventory?.find(i => i.category === 'BORDER' && i.isEquipped);
  const borderVisual = equippedBorder?.visualConfig || equippedBorder?.visualData || {};

  const borderActiveColor = borderVisual.primaryColor || borderVisual.color || "#ff0000";
  const borderSecondaryColor = borderVisual.secondaryColor || null;
  const animationType = borderVisual.animationType || "singleSnake";
  const snakeLength = borderVisual.snakeLength || 120;
  const animDuration = borderVisual.duration || 3000;

  const CardContent = (
    <View
      style={{ backgroundColor: THEME.card, borderColor: equippedBorder ? 'transparent' : THEME.border }}
      className="flex-row items-center justify-between px-4 py-4 rounded-[28px] border-2 relative overflow-hidden"
    >
      <PlayerBackground
        equippedBg={equippedBg}
        themeColor={activeGlowColor || '#22c55e'}
        isFeed={isFeed}
        borderRadius={28}
        isVisible={isVisible}
      />

      <Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/clans/${clanInfo.tag}`)} className="flex-row items-center flex-1 z-10">
        <View className="mr-4">
          <ClanCrest isVisible={isVisible} isFeed={true} rank={clanInfo.rank} size={48} glowColor={activeGlowColor} />
        </View>
        <View>
          <View className="flex-row gap-1 items-center">
            <PlayerNameplate
              author={{ username: clanInfo.name }}
              themeColor={THEME.text}
              equippedGlow={equippedGlow}
              fontSize={16}
              showPeakBadge={false}
              showFlame={false}
              isFeed={true}
              isDark={isDark}
              isVisible={isVisible}
            />
            {isVerified && <RemoteSvgIcon size={24} xml={clanInfo.activeCustomizations?.verifiedBadgeXml} />}
          </View>
          <View className="flex-row items-center mt-1">
            <View style={{ backgroundColor: highlightColor }} className="w-1 h-3 mr-2 rounded-full" />
            <Text style={{ color: THEME.textSecondary }} className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
              {clanInfo.displayRank || "Wandering Ronin"}
            </Text>
          </View>
        </View>
      </Pressable>

      <View className="flex-row items-center z-10 pl-4 border-l border-white/5">
        {clanInfo.isInWar ? (
          <View className="items-center">
            <View className="bg-red-500 p-2 rounded-xl rotate-45 shadow-sm shadow-red-500/50">
              <View className="-rotate-45"><MaterialCommunityIcons name="sword-cross" size={18} color="white" /></View>
            </View>
            <Text className="text-[8px] text-red-500 font-black uppercase mt-2 tracking-widest">In Battle</Text>
          </View>
        ) : (
          <View className="items-end">
            <View className="flex-row items-center">
              <Text style={{ color: THEME.text }} className="text-[15px] font-black italic">{clanInfo.followerCount || "0"}</Text>
              <MaterialCommunityIcons name="account-group" size={15} color={THEME.textSecondary} style={{ marginLeft: 4, opacity: 0.5 }} />
            </View>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View className="mb-4">
      {equippedBorder ? (
        <ClanBorder isFeed={isFeed} isVisible={isVisible} color={borderActiveColor} secondaryColor={borderSecondaryColor} animationType={animationType} snakeLength={snakeLength} duration={animDuration}>
          {CardContent}
        </ClanBorder>
      ) : CardContent}
    </View>
  );
});

import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import ZoomableImage from "./ZoomableImage";

// ⚡️ Create an Animated version of Pressable so we can scale the whole button on touch
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ⚡️ MAIN COMPONENT
const PostCardComponent = ({ post, authorData, clanData, setPosts, isFeed, hideMedia, syncing, isVisible = false }) => {

  useEffect(() => {
  }, [isVisible]);

  if (__DEV__) {
    console.log("Im rerendering on scroll", post?.title);
  }

  const CustomAlert = useAlert();
  const { user } = useUser();
  const isDark = useColorScheme() === "dark"

  const storage = useMMKV()

  const [lightbox, setLightbox] = useState({ open: false, index: 0 });
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [isMediaSaved, setIsMediaSaved] = useState(false);

  // ⚡️ HYPE INTERACTION VISIBILITY STATE
  const [hypeDrawerOpen, setHypeDrawerOpen] = useState(false);

  // ⚡️ HYPE BUTTON REANIMATED STATES
  const pulseScale = useSharedValue(0.8);
  const pulseOpacity = useSharedValue(0.5);
  const boltScale = useSharedValue(1);
  const boltRotate = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    if (!isVisible) {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      cancelAnimation(boltScale);
      cancelAnimation(boltRotate);
      return;
    }
    // 1. Ambient Beacon Pulse Ring (Continuous loop)
    pulseScale.value = withRepeat(
      withTiming(1.8, { duration: 1600, easing: Easing.out(Easing.ease) }),
      -1, // -1 means infinite loop
      false // false means don't reverse (restart from beginning)
    );
    pulseOpacity.value = withRepeat(
      withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    // 2. Core Snappy Lightning Bolt (Complex sequence wobble)
    boltScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 300 }),
        withTiming(1, { duration: 300 }),
        withTiming(1, { duration: 800 }),
        withTiming(1.1, { duration: 300 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      false
    );
    boltRotate.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 150 }),
        withTiming(8, { duration: 150 }),
        withTiming(0, { duration: 150 }),
        withTiming(0, { duration: 2050 }) // Pause before next shake
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      cancelAnimation(boltScale);
      cancelAnimation(boltRotate);
    };
  }, [isVisible]);

  // ⚡️ REANIMATED STYLES
  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const animatedBoltStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: boltScale.value },
      { rotate: `${boltRotate.value}deg` }
    ]
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }]
  }));
  // Add this near your other Reanimated hooks
  const fillWidth = useSharedValue(0);

  // Logic: Map HP to width. Assuming 10,000 HP is "full" for the 50% limit.
  // You can adjust the MAX_HP_CAP based on what you consider "max"
  const MAX_HP_CAP = 3000000;

  useEffect(() => {
    // 0.5 is 50%
    const amountToUSe = totalHypePoints > 10000 ? totalHypePoints : 2000; // If HP is very low, use 2000 to show some progress
    const progress = Math.min(amountToUSe / MAX_HP_CAP, 0.5);
    fillWidth.value = withTiming(progress, { duration: 1000, easing: Easing.out(Easing.exp) });
  }, [totalHypePoints]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value * 100}%`
  }));

  // ⚡️ SERVER-DRIVEN AUTHOR DATA
  // We now prioritize server-precomputed visuals (auraVisuals, displayRank)
  const author = authorData || post?.authorData || {
    name: post?.authorName || "Unknown",
    image: null,
    streak: 0,
    rank: 0,
    rankLevel: 1,
    aura: 0,
    equippedGlow: null,
    equippedBadges: [],
    inventory: [],
    peakLevel: 0,
    displayRank: "Verified Author",
    auraVisuals: { color: '#1e293b', label: 'Player', icon: 'target' }
  };

  const clanInfo = clanData || post?.clanData || null;

  const { data: postData, mutate } = useSWR(
    (!syncing && post?._id && isVisible) ? `/posts/${post._id}` : null,
    fetcher,
    {
      refreshInterval: 600000,
      fallbackData: post,
      revalidateOnMount: true, // ⚡️ FETCH FRESH DATA WHEN COMPONENT MOUNTS/BECOMES VISIBLE
      revalidateIfStale: true // ⚡️ ALWAYS REVALIDATE IF DATA IS STALE
    }
  );

  // ⚡️ SYNC local like state with the freshest server data
  useEffect(() => {
    const latestHasLiked = postData?.hasLiked ?? post?.hasLiked;
    if (latestHasLiked !== undefined && latestHasLiked !== null) {
      setLiked(latestHasLiked);
    }
  }, [post?._id, post?.hasLiked, postData?.hasLiked, isVisible]);

  const mediaItems = useMemo(() => {
    if (post.media && Array.isArray(post.media) && post.media.length > 0) return post.media;
    if (post.mediaUrl) return [{ url: post.mediaUrl, type: post.mediaType || "image" }];
    return [];
  }, [post.media, post.mediaUrl, post.mediaType]);

  const closeLightbox = () => {
    setLightbox((prev) => ({ ...prev, open: false }));
    return true;
  };

  useEffect(() => {
    const backAction = () => {
      if (lightbox.open) {
        closeLightbox();
        return true;
      }
      if (hypeDrawerOpen) {
        setHypeDrawerOpen(false);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [lightbox.open, hypeDrawerOpen]);

  // ⚡️ CONSUME SERVER-BAKED COUNTS
  const totalLikes = postData?.likesCount ?? postData?.likes?.length ?? post?.likesCount ?? post?.likes?.length ?? 0;
  const totalComments = postData?.commentsCount ?? postData?.comments?.length ?? post?.commentsCount ?? post?.comments?.length ?? 0;
  const totalViews = postData?.viewsCount ?? postData?.views ?? post?.viewsCount ?? post?.views ?? 0;

  // ⚡️ Use Server Discussion Count or fall back to client logic if data is old
  const totalDiscussions = postData?.discussionCount ?? post?.discussionCount ?? 0;
  // ⚡️ NEW: Consume Hype Points
  const totalHypePoints = postData?.hypePoints ?? post?.hypePoints ?? 0;

  useEffect(() => {
    // Skip if already viewed per server, syncing, or not visible
    if (!post?._id || !user?.deviceId || syncing || !isVisible || postData?.hasViewed) return;
    const handleView = async () => {
      try {
        const res = await apiFetch(`/posts/${post._id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "view", fingerprint: user.deviceId }),
        });

        if (res.ok) {
          if (typeof mutate === 'function') mutate();
        }
      } catch (err) { console.error("View track err:", err); }
    };
    handleView();
  }, [post?._id, user?.deviceId, syncing, isVisible, storage, postData?.hasViewed]);

  const handleLike = async () => {
    if (liked || !user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (!user) {
        CustomAlert("Hold on", "Please register to interact with posts.");
        DeviceEventEmitter.emit("navigateSafely", "screens/FirstLaunchScreen");
      }
      return;
    }
    const fingerprint = user?.deviceId;
    const previousData = postData || post;
    const currentLikes = totalLikes;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(true);
    mutate({
      ...(postData || post),
      likesCount: currentLikes + 1,
      likes: [...((postData || post)?.likes || []), { fingerprint }]
    }, false);

    try {
      const res = await apiFetch(`/posts/${post?._id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "like", fingerprint }),
      });
      if (res.status === 400 || res.ok) {
        if (__DEV__) console.log("Like registered successfully");
      } else { throw new Error("Server rejected like request"); }
    } catch (err) {
      setLiked(false);
      mutate(previousData, false);
      CustomAlert("Sync Error", "Could not register your like.");
    }
  };

  const handleHypeSubmit = async (tierKey) => {
    if (!user) {
      CustomAlert("Hold on", "Please register to interact with posts.");
      DeviceEventEmitter.emit("navigateSafely", "screens/FirstLaunchScreen");
      return;
    }

    const PRODUCTS = {
      FREE: { points: 50 },
      STANDARD: { points: 100 },
      SUPER: { points: 600 },
      MEGA: { points: 3000 }
    };

    const pointsToAdd = PRODUCTS[tierKey]?.points || 0;
    const previousData = postData || post;

    // Optimistic UI Update for instant feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    mutate({
      ...(postData || post),
      hypePoints: totalHypePoints + pointsToAdd,
      hypeCount: (previousData?.hypeCount || 0) + 1,
    }, false);

    try {
      const res = await apiFetch(`/posts/hype`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: user.deviceId, // ⚡️ Matches your backend req.json()
          postId: post?._id,
          hypeType: tierKey
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (__DEV__) console.log(`Hyped! Source: ${data.source}, New Balance: ${data.newBalance}`);
        // Background refresh to sync exact coin balances and inventory 
        mutate();
      } else {
        throw new Error(data.error || "Server rejected hype request");
      }
    } catch (err) {
      // Rollback on failure
      mutate(previousData, false);
      CustomAlert("Transmission Failed", err.message || "Could not complete the hype protocol.");
    }
  };

  const handleNativeShare = async () => {
    try {
      const url = `https://oreblogda.com/post/${post?.slug || post?._id}`;
      Haptics.selectionAsync();
      const shareResult = await Share.share({ message: `Check out this post on Oreblogda: ${post?.title}\n${url}` });
      if (shareResult.action === Share.sharedAction) {
        const res = await apiFetch(`/posts/${post?._id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "share", fingerprint: user?.deviceId })
        });
        if (res.ok) mutate();
      }
    } catch (error) { console.error("Share error", error); }
  };

  const handleDownloadMedia = async () => {
    const item = mediaItems[currentAssetIndex];
    if (!item || !item.url) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsDownloading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        CustomAlert("Permission Denied", "We need gallery permissions to save media.");
        setIsDownloading(false);
        return;
      }

      // --- INSTANT SAVE CACHE CHECK ---
      // 1. Check if our LightboxVideoPlayer already hashed and cached this
      const hashed = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        item.url
      );
      const cachedVideoUri = `${FileSystem.cacheDirectory}${hashed}.mp4`;
      const videoInfo = await FileSystem.getInfoAsync(cachedVideoUri);

      let uriToSave;

      if (videoInfo.exists) {
        // It's already cached! We use this for an instant save.
        uriToSave = cachedVideoUri;
      } else {
        // 2. Fallback check for standard filename cache (or download it if missing)
        const fileName = item.url.split('/').pop() || (item.type === "video" ? "video.mp4" : "image.jpg");
        const fileUri = FileSystem.cacheDirectory + fileName;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);

        if (fileInfo.exists) {
          uriToSave = fileUri;
        } else {
          const downloadRes = await FileSystem.downloadAsync(item.url, fileUri);
          uriToSave = downloadRes.uri;
        }
      }

      await MediaLibrary.saveToLibraryAsync(uriToSave);
      setIsMediaSaved(true);
      setTimeout(() => setIsMediaSaved(false), 3000);

      // Clean up the temp file ONLY if it's not the cached video our player relies on
      if (uriToSave !== cachedVideoUri) {
        await FileSystem.deleteAsync(uriToSave, { idempotent: true });
      }
    } catch (error) {
      CustomAlert("System Failure", "Unable to download media.");
    } finally { setIsDownloading(false); }
  };

  const parseCustomSyntax = (text) => {
    if (!text) return [];
    const regex = /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      if (match[1] || match[2]) parts.push({ type: 'section', content: match[1] || match[2] });
      else if (match[3] || match[4]) parts.push({ type: 'heading', content: match[3] || match[4] });
      else if (match[5] || match[6]) parts.push({ type: 'listItem', content: match[5] || match[6] });
      else if (match[7] && match[8]) parts.push({ type: 'link', url: match[7], content: match[8] });
      else if (match[9] && match[10]) parts.push({ type: 'link', url: match[9], content: match[10] });
      else if (match[0] === 'br()' || match[0] === 'br') parts.push({ type: 'br' });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) });
    return parts;
  };

  const handleCopyFullText = async () => {
    let cleanText = post.message.replace(/br\(\)|\[br\]/g, '\n');
    cleanText = cleanText.replace(
      /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]/gs,
      (match, p1, p2, p3, p4, p5, p6, p8, p10) => p1 || p2 || p3 || p4 || p5 || p6 || p8 || p10 || ''
    ).trim();
    await Clipboard.setStringAsync(cleanText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    CustomAlert("Scroll Copied", "Text copied to clipboard.");
  };

  const renderContent = useMemo(() => {
    // ⚡️ IF FEED: Use pre-cleaned server excerpt (Zero Regex Lag)
    if (isFeed && post.feedExcerpt) {
      return <Text style={{ color: isDark ? "#9ca3af" : "#4b5563" }} className="text-base leading-6">{post.feedExcerpt || "Decrypting content..."}</Text>;
    }

    const parts = parseCustomSyntax(post.message);
    const contentNodes = parts.map((part, i) => {
      switch (part.type) {
        case "text": return <Text key={i} className="text-base leading-7 text-gray-800 dark:text-gray-200">{part.content}</Text>;
        case "br": return <View key={i} className="h-2" />;
        case "link":
          return (
            <Pressable
              key={i}
              onPress={() => Linking.openURL(part.url)}
              style={({ pressed }) => [
                {
                  backgroundColor: pressed ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginVertical: 2,
                  alignSelf: 'flex-start', // Keeps the bubble tight to the text
                }
              ]}
            >
              <Feather
                name="link-2"
                size={14}
                color="#60a5fa"
                style={{ marginRight: 6 }}
              />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  color: '#60a5fa',
                  fontWeight: '700',
                  fontSize: 14,
                  textDecorationLine: 'none' // Removing the ugly underline
                }}
              >
                {part.content}
              </Text>
              <Feather
                name="external-link"
                size={12}
                color="#60a5fa"
                style={{ marginLeft: 6, opacity: 0.7 }}
              />
            </Pressable>
          );
        case "heading": return <Text key={i} className="text-xl font-bold mt-4 mb-2 text-black dark:text-white uppercase tracking-tight">{part.content}</Text>;
        case "listItem": return <View key={i} className="flex-row items-start ml-4 my-1"><Text className="text-blue-500 mr-2 text-lg">•</Text><Text className="flex-1 text-base leading-6 text-gray-800 dark:text-gray-200">{part.content}</Text></View>;
        case "section": return <View key={i} className="bg-gray-100 dark:bg-gray-800/60 p-4 my-3 rounded-2xl border-l-4 border-blue-500"><Text className="text-base italic leading-6 text-gray-700 dark:text-gray-300">{part.content}</Text></View>;
        default: return null;
      }
    });

    return (
      <Pressable onLongPress={handleCopyFullText} delayLongPress={300}>
        {contentNodes}
      </Pressable>
    );
  }, [post.message, post.feedExcerpt, isFeed, isDark]);


  const renderMediaContent = useMemo(() => {
    if (mediaItems.length === 0) return null;

    const glassStyle = {
      borderWidth: 1,
      borderColor: 'rgba(96, 165, 250, 0.2)',
      shadowColor: "#60a5fa",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10
    };
    const count = mediaItems.length;
    const openItem = (index) => {
      setCurrentAssetIndex(index);
      setLightbox({ open: true, index });
    };

    return (
      <View className="my-2 rounded-2xl overflow-hidden bg-black" style={[glassStyle, { height: 300 }]}>
        {count === 1 ? (
          <View className="w-full h-full relative">
            {mediaItems[0].type?.startsWith("video") || mediaItems[0].url.toLowerCase().includes("youtube") || mediaItems[0].url.toLowerCase().includes("tiktok") ? (
              <MediaPlaceholder height="100%" type="video" thumbUrl={getVideoThumbnail(mediaItems[0].url)} onPress={() => openItem(0)} />
            ) : (
              <Pressable onPress={() => openItem(0)} className="w-full h-full relative">
                <Image source={{ uri: mediaItems[0].url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
              </Pressable>
            )}
          </View>
        ) : count === 2 ? (
          <View className="flex-row w-full h-full gap-[2px]">
            {mediaItems.slice(0, 2).map((item, idx) => (
              <Pressable key={idx} onPress={() => openItem(idx)} className="flex-1 relative">
                <Image source={{ uri: item.type === "video" ? getVideoThumbnail(item.url) : item.url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
                {item.type === "video" && <View className="absolute inset-0 items-center justify-center bg-black/20"><Feather name="play" size={24} color="white" /></View>}
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="flex-row w-full h-full gap-[2px]">
            <Pressable onPress={() => openItem(0)} className="w-1/2 h-full relative">
              <Image source={{ uri: mediaItems[0].type === "video" ? getVideoThumbnail(mediaItems[0].url) : mediaItems[0].url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
              {mediaItems[0].type === "video" && <View className="absolute inset-0 items-center justify-center bg-black/20"><Feather name="play" size={30} color="white" /></View>}
            </Pressable>
            <View className="w-1/2 h-full gap-[2px]">
              <Pressable onPress={() => openItem(1)} className="flex-1 relative">
                <Image source={{ uri: mediaItems[1].type === "video" ? getVideoThumbnail(mediaItems[1].url) : mediaItems[1].url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
                {mediaItems[1].type === "video" && <View className="absolute inset-0 items-center justify-center bg-black/20"><Feather name="play" size={20} color="white" /></View>}
              </Pressable>
              <Pressable onPress={() => openItem(2)} className="flex-1 relative">
                <Image source={{ uri: mediaItems[2].type === "video" ? getVideoThumbnail(mediaItems[2].url) : mediaItems[2].url }} style={{ width: '100%', height: '100%', flex: 1 }} contentFit="cover" />
                {count > 3 && <View className="absolute inset-0 bg-black/60 items-center justify-center z-10"><Text className="text-white text-2xl font-black">+{count - 3}</Text></View>}
                {mediaItems[2].type === "video" && count <= 3 && <View className="absolute inset-0 items-center justify-center bg-black/20 z-10"><Feather name="play" size={20} color="white" /></View>}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  }, [mediaItems]);

  const aura = author.auraVisuals || { color: '#1e293b', label: 'OPERATIVE', icon: 'target' };
  const isTop10 = author.rank > 0 && author.rank <= 10;
  const activeGlowColor = author.equippedGlow?.visualConfig?.primaryColor || author.equippedGlow?.visualConfig?.glowColor || null;
  const isClanPost = !!(post.clanId || post.clanTag);
  const customBadges = author.equippedBadges?.slice(0, 2) || [];
  const equippedWatermark = author.inventory?.find(i => i.category === 'WATERMARK' && i.isEquipped);

  return (
    <View className={`mb-8 overflow-hidden rounded-[32px] border ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-100 shadow-sm"} relative`}>

      <PlayerWatermark isVisible={isVisible} isFeed={isFeed} equippedWatermark={equippedWatermark} isDark={isDark} />

      {isTop10 && (
        <View className="absolute inset-0 opacity-[0.04]" style={{ backgroundColor: activeGlowColor || aura.color }} pointerEvents="none" />
      )}

      <View className={`h-[3px] w-full bg-blue-600 opacity-20`} />

      <View className="p-4 px-2">
        <View className="mb-5">
          {isClanPost && clanInfo && (
            <MemoizedClanHeader isVisible={isVisible} clanInfo={clanInfo} isDark={isDark} postId={post._id} isFeed={isFeed} />
          )}

          <View className="flex-row justify-between items-start">
            <View className="flex-row items-center gap-4 flex-1 pr-2">
              <AuraAvatar isVisible={isVisible} author={author} glowColor={activeGlowColor} aura={aura} isTop10={isTop10} isDark={isDark} size={44} isFeed={isFeed} onPress={() => DeviceEventEmitter.emit("navigateSafely", `/author/${post.authorUserId}`)} />
              <View className="flex-1">
                <Pressable onPress={() => DeviceEventEmitter.emit("navigateSafely", `/author/${post.authorUserId}`)}>
                  <View className="flex-row items-center gap-[2px]">
                    <View className="flex-shrink">
                      <PlayerNameplate
                        author={author}
                        themeColor={activeGlowColor || (isTop10 ? aura?.color : (isDark ? "#60a5fa" : "#2563eb"))}
                        equippedGlow={author.equippedGlow}
                        auraRank={author.rank || null}
                        fontSize={13}
                        isDark={isDark}
                        showPeakBadge={false}
                        showFlame={false}
                        isFeed={isFeed}
                        isVisible={isVisible}
                      />
                    </View>
                    <Text className="text-gray-500 font-normal flex-shrink-0"> • </Text>
                    <Ionicons name="flame" size={12} color={author.streak < 0 ? "#ef4444" : "#f97316"} />
                    <Text className="text-gray-500 text-[10px] font-bold flex-shrink-0">{author?.streak || "0"}</Text>
                  </View>
                  <View className="">
                    <TitleTag isDark={isDark}
                      isTop10={isTop10}
                      size={8}
                      key={author?.equippedTitle}
                      rank={author.rank}
                      auraVisuals={author?.auraVisuals}
                      equippedTitle={author?.equippedTitle}
                      isVisible={isVisible}
                      isFeed={isFeed}
                    />
                  </View>
                  <Text className="text-[10px] mt-1 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">{author.displayRank}</Text>
                </Pressable>
              </View>
            </View>

            <View className="items-end justify-center">
              {/* ⚡️ CONDITIONAL DISPLAY: Only show high-impact view counts, use a clean placeholder tag otherwise */}
              {(post.viewsCount ?? post.views ?? 0) >= 100 ? (
                <View className="shrink-0 flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
                  <View className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <Text className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{post.formattedViews || "0"}</Text>
                </View>
              ) : (
                <View className="shrink-0 bg-gray-50/50 dark:bg-gray-800/30 px-3 py-1.5 rounded-full border border-gray-100/50 dark:border-gray-700/40">
                  <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {post.category || "FRESH"}
                  </Text>
                </View>
              )}

              {/* ⚡️ BADGES CONTAINER: Aligns the isTrending indicator and PeakBadge side-by-side cleanly */}
              <View className="flex-row items-center gap-1.5 mt-2">
                {post.isTrending && (
                  <View className="flex-row items-center gap-1 bg-orange-500/10 dark:bg-orange-500/20 px-2.5 py-1 rounded-full border border-orange-500/30 dark:border-orange-500/40">
                    <Ionicons name="flame" size={11} color="#f97316" />
                    <Text className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">TRENDING</Text>
                  </View>
                )}

                {author.peakLevel > 0 && (
                  <View className="flex-row items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/30">
                    <PeakBadge isVisible={isVisible} level={author.peakLevel} size={25} isFeed={isFeed} />
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <Pressable onPress={() => isFeed && DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}`)} className="mb-4">
          <Text selectable={true} className={`font-[900] uppercase italic tracking-tighter leading-tight mb-2 ${isDark ? "text-white" : "text-gray-900"} ${isFeed ? "text-2xl" : "text-3xl"}`}>
            {post?.title}
          </Text>
          <View className="opacity-90">{renderContent}</View>
        </Pressable>

        <View className="mb-4 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
          {renderMediaContent}
        </View>

        {post.poll && (
          <View className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
            <Poll poll={post.poll} isVisible={isFeed} postId={post?._id} deviceId={user?.deviceId} />
          </View>
        )}

        {/* ⚡️ RE-ENGINEERED HIGH-ENERGY ACTION BAR */}
        <View className="flex-row items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3 mt-2 px-1">

          {/* LEFT MODULE: STANDARD UTILITIES */}
          <View className="flex-row items-center gap-5">
            {/* LIKES */}
            <Pressable onPress={handleLike} disabled={liked} className="flex-row items-center gap-1.5 py-1">
              <Ionicons name={liked ? "heart" : "heart-outline"} size={19} color={liked ? "#ef4444" : isDark ? "#9ca3af" : "#4b5563"} />
              <Text className={`text-xs font-black ${liked ? "text-red-500" : "text-gray-500"}`}>
                {totalLikes > 0 ? (post.formattedLikes || totalLikes) : "Like"}
              </Text>
            </Pressable>

            {/* COMMENTS */}
            <Pressable onPress={() => isFeed && DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}?comment=open`)} className="flex-row items-center gap-1.5 py-1">
              <MaterialCommunityIcons name="comment-text-outline" size={18} color={isDark ? "#9ca3af" : "#4b5563"} />
              <Text className="text-xs font-black text-gray-500">{totalComments}</Text>
            </Pressable>

            {/* DISCUSSIONS */}
            <Pressable onPress={() => isFeed && DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}?comment=open`)} className="flex-row items-center gap-1.5 py-1 opacity-80">
              <MaterialCommunityIcons name="forum-outline" size={18} color={isDark ? "#9ca3af" : "#4b5563"} />
              <Text className="text-xs font-black text-gray-500">{totalDiscussions}</Text>
            </Pressable>
          </View>

          {/* RIGHT MODULE: REACTIVE HYPE BEACON & ACTIONS */}
          <View className="flex-row items-center gap-4">

            {/* ⚡️ CYBERPUNK HYPING TRIGGER (WITH PROGRESS FILL)  */}
            <AnimatedPressable
              onPress={() => setHypeDrawerOpen(true)}
              onPressIn={() => buttonScale.value = withSpring(0.9)}
              onPressOut={() => buttonScale.value = withSpring(1)}
              className="relative flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 dark:bg-[#00ffcc]/5 border border-emerald-500/10 dark:border-[#00ffcc]/10 overflow-hidden"
              style={animatedButtonStyle}
            >
              {/* Progress Fill Bar */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: 2,
                    backgroundColor: '#00ffcc',
                    opacity: 0.3
                  },
                  animatedFillStyle
                ]}
              />

              <View className="items-center justify-center w-5 h-5">
                <Animated.View
                  style={[StyleSheet.absoluteFill, { backgroundColor: '#00ffcc', borderRadius: 999 }, animatedPulseStyle]}
                />
                <Animated.View style={animatedBoltStyle}>
                  <Ionicons name="flash" size={18} color="#00ffcc" style={{
                    shadowColor: '#00ffcc',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 5,
                  }} />
                </Animated.View>
              </View>

              <Text className="text-xs font-black tracking-wider text-emerald-600 dark:text-[#00ffcc]">
                {totalHypePoints > 0 ? `${totalHypePoints} HP` : "HYPE"}
              </Text>
            </AnimatedPressable>

            {/* NATIVE SHARE BUTTON */}
            <Pressable
              onPress={handleNativeShare}
              className="w-8 h-8 items-center justify-center bg-gray-50 dark:bg-gray-800/80 rounded-full border border-gray-100 dark:border-gray-700/60"
            >
              <Feather name="share-2" size={14} color={isDark ? "#9ca3af" : "#4b5563"} />
            </Pressable>

          </View>
        </View>
      </View>

      {/* LIGHTBOX MODAL OVERLAY */}
      {lightbox.open && (
        <MediaModal
          isOpen={lightbox.open}
          onClose={closeLightbox}
          mediaItems={mediaItems}
          currentIndex={currentAssetIndex}
          setCurrentIndex={setCurrentAssetIndex}
          handleDownload={handleDownloadMedia}
          isDownloading={isDownloading}
          isMediaSaved={isMediaSaved}
        />
      )}
      {/* ⚡️ NEW: MOUNT HYPE DRAWER */}
      <HypeModal
        visible={hypeDrawerOpen}
        onClose={() => setHypeDrawerOpen(false)}
        onHype={handleHypeSubmit}
        isDark={isDark}
      />
    </View>
  );
};

export default memo(PostCardComponent, (prevProps, nextProps) => {
  // Recompare if ANY of these change: ID, visibility, syncing, OR engagement flags
  return prevProps.post._id === nextProps.post._id &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.syncing === nextProps.syncing &&
    prevProps.post.hasLiked === nextProps.post.hasLiked &&
    prevProps.post.hasVoted === nextProps.post.hasVoted &&
    prevProps.post.hasViewed === nextProps.post.hasViewed &&
    prevProps.post.likesCount === nextProps.post.likesCount &&
    prevProps.post.likes?.length === nextProps.post.likes?.length &&
    prevProps.post.votesCount === nextProps.post.votesCount &&
    prevProps.post.votes?.length === nextProps.post.votes?.length &&
    prevProps.post.viewsCount === nextProps.post.viewsCount &&
    prevProps.post.commentsCount === nextProps.post.commentsCount &&
    prevProps.post.comments?.length === nextProps.post.comments?.length;
});