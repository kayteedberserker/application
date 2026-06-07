import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from "expo-image";
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { useVideoPlayer, VideoView } from "expo-video";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useFocusEffect } from 'expo-router';
import { SvgXml } from "react-native-svg";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
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

import * as Crypto from 'expo-crypto';
import HypeModal from "./HypeModal";
import TitleTag from "./TitleTag";

// Helper to format seconds into MM:SS
const formatTime = (timeInSeconds) => {
	if (!timeInSeconds || isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return "00:00";
	const totalSeconds = Math.floor(Math.max(0, timeInSeconds));
	const mins = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;
	return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};


// ⚡️ EXACT Floating Heart Sub-Component (Untouched)
const FloatingHeartInstance = memo(({ heart, onComplete }) => {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withTiming(
			1,
			{ duration: 800, easing: Easing.out(Easing.quad) },
			(finished) => {
				if (finished) {
					runOnJS(onComplete)(heart.id);
				}
			}
		);
	}, [heart.id]);

	const animatedStyle = useAnimatedStyle(() => {
		const translateY = -progress.value * 160;
		const translateX = Math.sin(progress.value * Math.PI * 1.5) * heart.drift;

		const scale = progress.value < 0.15
			? (progress.value / 0.15) * heart.scale
			: (1 - (progress.value - 0.15) / 0.85) * heart.scale;

		const opacity = progress.value > 0.6
			? 1 - (progress.value - 0.6) / 0.4
			: 1;

		return {
			position: 'absolute',
			left: heart.x - 24,
			top: heart.y - 24,
			transform: [
				{ translateX },
				{ translateY },
				{ scale },
				{ rotate: `${heart.rotate + (progress.value * 15)}deg` }
			],
			opacity,
		};
	});

	return (
		<Animated.View style={animatedStyle} pointerEvents="none">
			<MaterialCommunityIcons name="heart" size={48} color={heart.color} style={styles.heartGlowShadow} />
		</Animated.View>
	);
});

// ⚡️ EXACT StatChip Component
const StatChip = ({ icon, label, color, active = false, onPress }) => {
	const Chip = (
		<View style={[styles.statChip, active && { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
			<Ionicons name={icon} size={14} color={active ? '#f43f5e' : color} />
			{label !== undefined && (
				<Text style={[styles.statChipText, { color: active ? '#fff' : '#f8fafc', fontWeight: active ? '900' : '700' }]}>{label}</Text>
			)}
		</View>
	);

	if (!onPress) return Chip;
	return <TouchableOpacity onPress={onPress}>{Chip}</TouchableOpacity>;
};

// ⚡️ EXACT Lightbox Logic WITH added watch_complete background tracking AND skips
const VideoSlide = memo(({ item, isActive, isDark }) => {
	const CustomAlert = useAlert();
	const { uri, title, authorId, author, stats = {}, onDownload, clanInfo = null, liked = false, onLike, onOpenComments, onOpenDiscussions, onWatchComplete, onSkip, onNotInterested, onOpenHype, onShare } = item;

	const theme = { ...THEME, isDark, bg: isDark ? "#05070b" : "#ffffff", card: isDark ? "#111827" : "#f8fafc", text: isDark ? "#ffffff" : "#0f172a", textSecondary: isDark ? "#cbd5e1" : "#475569" };
	const hideTimerRef = useRef(null);
	const scrubTimeRef = useRef(0);
	const tapTimeout = useRef(null);
	const longPressTimer = useRef(null);
	const lastTap = useRef(null);
	const longPressTriggered = useRef(false);
	const suppressBoostRef = useRef(false);

	const [isScrubbing, setIsScrubbing] = useState(false);
	const [localTime, setLocalTime] = useState(0);
	const [showControls, setShowControls] = useState(true);
	const [seekIndicator, setSeekIndicator] = useState(null);
	const [showSpeedMenu, setShowSpeedMenu] = useState(false);
	const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
	const [isBoosting, setIsBoosting] = useState(false);
	const [showMoreOptions, setShowMoreOptions] = useState(false);

	const [localLiked, setLocalLiked] = useState(Boolean(liked));
	const [localStats, setLocalStats] = useState(stats || {});

	const [burstHearts, setBurstHearts] = useState([]);
	const [finalUri, setFinalUri] = useState(uri);

	const hasLoggedWatch = useRef(false);
	const hasInteracted = useRef(false);

	// --- CACHE LOGIC (Silent Background) ---
	useEffect(() => {
		let isMounted = true;
		let downloadResumable = null;

		setFinalUri(uri);

		const prepareVideo = async () => {
			if (!uri) return;
			try {
				const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, uri);
				const finalLocalUri = `${FileSystem.cacheDirectory}${hashed}.mp4`;
				const tempLocalUri = `${FileSystem.cacheDirectory}${hashed}.tmp`;

				const fileInfo = await FileSystem.getInfoAsync(finalLocalUri);

				if (fileInfo.exists) {
					if (fileInfo.size < 1024 * 500) {
						await FileSystem.deleteAsync(finalLocalUri, { idempotent: true });
					} else {
						if (isMounted) setFinalUri(finalLocalUri);
						return;
					}
				}

				downloadResumable = FileSystem.createDownloadResumable(uri, tempLocalUri);
				const result = await downloadResumable.downloadAsync();

				if (result && isMounted) {
					await FileSystem.moveAsync({ from: tempLocalUri, to: finalLocalUri });
					if (isMounted) setFinalUri(finalLocalUri);
				}
			} catch (e) {
				if (__DEV__) console.log("Cache failed or cancelled", e);
			}
		};

		prepareVideo();

		return () => {
			isMounted = false;
			if (downloadResumable) downloadResumable.pauseAsync();
		};
	}, [uri]);

	// --- PLAYER INIT ---
	const player = useVideoPlayer(finalUri, (p) => {
		p.loop = true;
		p.preservesPitch = true;
	});

	useEffect(() => {
		if (player) {
			if (isActive) {
				player.muted = false;
				player.play();
			} else {
				if (
					player.currentTime > 0.5 &&
					player.currentTime < 3.0 &&
					!hasLoggedWatch.current &&
					!hasInteracted.current
				) {
					if (typeof onSkip === 'function') onSkip();
				}

				player.muted = true;
				player.pause();
				player.currentTime = 0;

				hasLoggedWatch.current = false;
				hasInteracted.current = false;
				setShowMoreOptions(false);
			}
		}
	}, [isActive, player, onSkip]);

	// --- EVENTS & STATUS ---
	const isPlayingEvent = useEvent(player, "playingChange");
	const statusEvent = useEvent(player, "statusChange");
	const durationEvent = useEvent(player, "durationChange");
	const mutedEvent = useEvent(player, "mutedChange");

	const isPlaying = isPlayingEvent?.isPlaying ?? player?.playing ?? false;
	const status = statusEvent?.status ?? player?.status ?? 'loading';
	const duration = durationEvent?.duration ?? player?.duration ?? 0;
	const isMuted = mutedEvent?.muted ?? player?.muted ?? false;

	// --- HEARTBEAT FOR REALTIME UI & 🧠 DYNAMIC AFFINITY TRACKING ---
	useEffect(() => {
		const interval = setInterval(() => {
			if (!isScrubbing && player && duration > 0) {
				const current = player.currentTime ?? 0;
				setLocalTime(current);

				if (!hasLoggedWatch.current && current >= duration * 0.9) {
					hasLoggedWatch.current = true;
					if (typeof onWatchComplete === 'function') {
						onWatchComplete();
					}
				}
			}
		}, 250);
		return () => clearInterval(interval);
	}, [player, isScrubbing, duration, onWatchComplete]);

	useEffect(() => {
		setLocalLiked(Boolean(liked));
		setLocalStats(stats || {});
	}, [liked, stats]);

	// --- AUTO HIDE LOGIC ---
	const resetAutoHide = () => {
		if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		if (showControls && isPlaying && !isScrubbing && !showSpeedMenu && !showMoreOptions) {
			hideTimerRef.current = setTimeout(() => {
				setShowControls(false);
			}, 3000);
		}
	};

	useEffect(() => {
		resetAutoHide();
		return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
	}, [showControls, isPlaying, isScrubbing, showSpeedMenu, showMoreOptions]);

	const handleRemoveHeart = useCallback((id) => {
		setBurstHearts((prev) => prev.filter((h) => h.id !== id));
	}, []);

	const handleActionWithPause = (actionCallback) => {
		hasInteracted.current = true;
		if (player) {
			player.pause();
		}
		if (typeof actionCallback === 'function') {
			actionCallback();
		}
	};

	const handleAuthorPress = () => {
		hasInteracted.current = true;
		handleActionWithPause(() => {
			const targetId = authorId || author?._id || author?.id || author?.userId || author?.authorUserId || author?.username;
			if (targetId) DeviceEventEmitter.emit("navigateSafely", `/author/${targetId}`);
		});
	};

	const handleClanPress = () => {
		hasInteracted.current = true;
		handleActionWithPause(() => {
			const targetTag = clanInfo?.tag || clanInfo?.name;
			if (targetTag) DeviceEventEmitter.emit("navigateSafely", `/clans/${targetTag}`);
		});
	};

	// --- INTERACTION HANDLERS ---
	const handleLikePress = async () => {
		hasInteracted.current = true;
		if (localLiked || typeof onLike !== 'function') return;

		const previousLiked = localLiked;
		const previousLikes = Number(localStats.likes || 0);

		setLocalLiked(true);
		setLocalStats((prev) => ({ ...prev, likes: previousLikes + 1 }));

		try {
			await onLike();
		} catch (err) {
			setLocalLiked(previousLiked);
			setLocalStats((prev) => ({ ...prev, likes: previousLikes }));
		}
	};

	const handleTap = (evt) => {
		if (showMoreOptions) {
			setShowMoreOptions(false);
			return;
		}

		const now = Date.now();
		const touchX = evt.nativeEvent.locationX;
		const touchY = evt.nativeEvent.locationY;

		if (lastTap.current && (now - lastTap.current) < 300) {
			if (longPressTimer.current) clearTimeout(longPressTimer.current);

			clearTimeout(tapTimeout.current);
			longPressTriggered.current = false;
			suppressBoostRef.current = true;
			setTimeout(() => { suppressBoostRef.current = false; }, 500);
			lastTap.current = null;

			if (typeof onLike === 'function' && !localLiked) {
				handleLikePress();
			}

			const count = 4;
			const newHearts = Array.from({ length: count }).map((_, index) => {
				const angleOffset = (index - (count - 1) / 2) * 18;
				return {
					id: `${Date.now()}-${index}-${Math.random()}`,
					x: touchX + (Math.random() * 14 - 7),
					y: touchY + (Math.random() * 14 - 7),
					scale: 0.8 + Math.random() * 0.5,
					drift: angleOffset + (Math.random() * 20 - 10),
					rotate: angleOffset + (Math.random() * 16 - 8),
					color: index % 2 === 0 ? '#ef4444' : '#f43f5e'
				};
			});

			setBurstHearts((prev) => [...prev, ...newHearts]);
			setShowControls(true);
			return;
		}

		lastTap.current = now;
		tapTimeout.current = setTimeout(() => {
			if (showSpeedMenu) setShowSpeedMenu(false);
			else setShowControls((prev) => !prev);
			lastTap.current = null;
		}, 300);
	};

	const handlePressIn = () => {
		if (suppressBoostRef.current || showMoreOptions) return;
		if (tapTimeout.current) clearTimeout(tapTimeout.current);

		longPressTriggered.current = false;
		if (longPressTimer.current) clearTimeout(longPressTimer.current);

		longPressTimer.current = setTimeout(() => {
			if (suppressBoostRef.current) return;

			hasInteracted.current = true;
			if (player) {
				player.playbackRate = 2;
				player.preservesPitch = true;
			}
			setPlaybackSpeed(2);
			longPressTriggered.current = true;
			setIsBoosting(true);
			setSeekIndicator('2x');
			setTimeout(() => setSeekIndicator(null), 400);
		}, 450);
	};

	const handlePressOut = () => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
		}

		if (longPressTriggered.current && !suppressBoostRef.current) {
			if (player) {
				player.playbackRate = 1;
				player.preservesPitch = true;
			}
			setPlaybackSpeed(1);
		}
		longPressTriggered.current = false;
		setIsBoosting(false);
		setSeekIndicator(null);
	};

	const panResponder = useMemo(() => PanResponder.create({
		onStartShouldSetPanResponder: () => true,
		onMoveShouldSetPanResponder: () => true,
		onPanResponderGrant: (evt) => {
			setIsScrubbing(true);
			hasInteracted.current = true; // Scrubbing counts as engagement
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
		if (player) {
			// 1. Set the speed
			player.playbackRate = speed;
			player.preservesPitch = true; // 2. FORCE-APPLY pitch correction immediately

			setPlaybackSpeed(speed);
			setShowSpeedMenu(false);
			resetAutoHide();
		}
	};

	const progressPercent = duration > 0 ? (localTime / duration) * 100 : 0;
	const authorName = author?.name || author?.username || "Creator";
	const authorImage = author?.image || author?.avatar || author?.profilePic || null;
	const clanName = clanInfo?.name || clanInfo?.displayName || clanInfo?.tag || null;
	const safeVideoHeight = Math.min(SCREEN_HEIGHT * 0.82, SCREEN_HEIGHT);

	return (
		<View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', backgroundColor: theme.bg }}>
			<View style={[styles.videoFrame, { maxHeight: safeVideoHeight, height: safeVideoHeight }]}>
				{player && (
					<VideoView
						player={player}
						style={{ flex: 1, width: '100%', height: '100%' }}
						contentFit="contain"
						nativeControls={false}
					/>
				)}
			</View>

			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={handleTap}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
			>
				{burstHearts.map((heart) => (
					<FloatingHeartInstance
						key={heart.id}
						heart={heart}
						onComplete={handleRemoveHeart}
					/>
				))}
			</Pressable>

			<View style={styles.infoOverlayTop} pointerEvents="box-none">
				<View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(8, 15, 25, 0.82)' : 'rgba(255, 255, 255, 0.92)', borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.08)' }]}>
					<View style={styles.infoTopRow}>
						<TouchableOpacity onPress={handleAuthorPress} style={styles.infoLeftSlot}>
							{authorImage ? (
								<Image source={{ uri: authorImage }} style={styles.authorAvatar} contentFit="cover" />
							) : (
								<View style={[styles.authorAvatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent + '22' }]}>
									<Feather name="user" size={18} color={theme.text} />
								</View>
							)}
						</TouchableOpacity>

						<View style={styles.infoCenterSlot}>
							<View style={styles.nameRow}>
								<TouchableOpacity onPress={handleAuthorPress}>
									<Text style={[styles.infoAuthor, { color: theme.textSecondary }]}>{authorName}</Text>
								</TouchableOpacity>

								{clanInfo ? <Text style={[styles.nameSep, { color: theme.textSecondary }]}>•</Text> : null}

								{clanInfo ? (
									<TouchableOpacity onPress={handleClanPress}>
										<Text style={[styles.infoClan, { color: theme.text }]}>{clanName}</Text>
									</TouchableOpacity>
								) : null}
							</View>
							<Pressable
								onPress={() => handleActionWithPause(() => DeviceEventEmitter.emit("navigateSafely", `/post/${item.postId || item._id}`))}
								style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingRight: 10 }}
							>
								<Text style={[styles.infoTitle, { color: theme.text, flexShrink: 1 }]} numberOfLines={2}>{title || "Untitled post"}</Text>
								<Feather name="chevron-right" size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
							</Pressable>
						</View>

						<View style={styles.infoRightSlot}>
							{clanInfo ? (
								<TouchableOpacity onPress={handleClanPress}>
									<ClanCrest isVisible={true} isFeed={true} rank={clanInfo.rank} size={32} glowColor={clanInfo.activeGlowColor || null} />
								</TouchableOpacity>
							) : null}
						</View>
					</View>
				</View>
			</View>

			<View style={styles.infoOverlayBottom} pointerEvents="box-none">
				<View style={[styles.statsRow, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(17, 24, 39, 0.72)', borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255,255,255,0.14)' }]}>
					<StatChip icon={localLiked ? 'heart' : 'heart-outline'} label={localStats.likes ?? 0} color="#ef4444" active={localLiked} onPress={typeof onLike === 'function' ? handleLikePress : undefined} />
					<StatChip icon="chatbubble-ellipses-outline" label={localStats.comments ?? 0} color="#38bdf8" onPress={() => handleActionWithPause(onOpenComments)} />
					<StatChip icon="chatbox-ellipses-outline" label={localStats.discussions ?? 0} color="#a78bfa" onPress={() => handleActionWithPause(onOpenDiscussions)} />

					<StatChip icon="flash-outline" label={localStats.hype ?? 0} color="#22c55e" onPress={() => handleActionWithPause(onOpenHype)} />
					<StatChip icon="share-social-outline" label={localStats.shares ?? 0} color="#34d399" onPress={() => handleActionWithPause(onShare)} />

					<View style={{ position: 'relative' }}>
						<StatChip icon="ellipsis-horizontal" color={isDark ? "#9ca3af" : "#4b5563"} onPress={() => setShowMoreOptions(!showMoreOptions)} />

						{showMoreOptions && (
							<View style={{ position: 'absolute', bottom: 40, right: 0, width: 160, backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)' }}>
								<TouchableOpacity onPress={() => { setShowMoreOptions(false); onDownload?.(); }} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
									<Feather name="download" size={16} color={theme.text} style={{ marginRight: 10 }} />
									<Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 13 }}>Save Media</Text>
								</TouchableOpacity>

								<TouchableOpacity onPress={() => {
									setShowMoreOptions(false);
									CustomAlert("Hide Post", "We'll show fewer posts like this.", [
										{ text: "Cancel", style: "cancel" },
										{ text: "Hide", style: "destructive", onPress: () => handleActionWithPause(onNotInterested) }
									]);
								}} style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
									<Feather name="eye-off" size={16} color="#ef4444" style={{ marginRight: 10 }} />
									<Text style={{ color: "#ef4444", fontWeight: 'bold', fontSize: 13 }}>Not Interested</Text>
								</TouchableOpacity>
							</View>
						)}
					</View>
				</View>
			</View>

			{seekIndicator && (
				<View style={styles.seekFeedback}>
					<Feather name="zap" size={30} color="white" />
					<Text style={styles.seekText}>{seekIndicator}</Text>
				</View>
			)}

			{showControls && (
				<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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

					{showSpeedMenu && (
						<View style={[styles.speedMenu, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255,255,255,0.98)', borderColor: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)' }]}>
							{[0.5, 1.0, 1.5, 2.0].map((s) => (
								<TouchableOpacity key={s} onPress={() => changeSpeed(s)} style={styles.speedOption}>
									<Text style={[styles.speedText, { color: playbackSpeed === s ? theme.accent : (isDark ? '#f8fafc' : '#0f172a') }]}>
										{s === 1.0 ? 'Normal' : `${s}x`}
									</Text>
								</TouchableOpacity>
							))}
							<View style={styles.speedDivider} />
						</View>
					)}

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


// ⚡️ NEW: The Swipe Onboarding Overlay Component
const SwipeTutorialOverlay = memo(() => {
	const translateY = useSharedValue(50);
	const opacity = useSharedValue(0);

	useEffect(() => {
		// Simple repeating upward swipe animation
		translateY.value = withRepeat(
			withSequence(
				withTiming(50, { duration: 0 }), // Start low
				withTiming(-50, { duration: 1200, easing: Easing.out(Easing.quad) }), // Swipe up
				withTiming(-50, { duration: 300 }) // Hold briefly
			),
			-1, // Loop forever while active
			false
		);

		opacity.value = withRepeat(
			withSequence(
				withTiming(0, { duration: 0 }),
				withTiming(1, { duration: 300 }), // Fade in
				withTiming(1, { duration: 900 }), // Stay visible during swipe
				withTiming(0, { duration: 300 })  // Fade out
			),
			-1,
			false
		);

		return () => {
			cancelAnimation(translateY);
			cancelAnimation(opacity);
		};
	}, []);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
		opacity: opacity.value
	}));

	return (
		<View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }]} pointerEvents="none">
			<Animated.View style={[{ alignItems: 'center' }, animatedStyle]}>
				<MaterialCommunityIcons name="gesture-swipe-up" size={100} color="white" />
				<Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>
					Swipe up for more
				</Text>
			</Animated.View>
		</View>
	);
});


export const LightboxVideoPlayer = memo(({ postId, uri, title, author, stats = {}, onDownload, isDark = false, clanInfo = null, liked = false, onLike, onOpenComments, onOpenDiscussions, onWatchComplete, onSkip, onNotInterested, onOpenHype, onShare }) => {
	const [activePostId, setActivePostId] = useState(postId || 'seed-id');
	const [isScreenFocused, setIsScreenFocused] = useState(true);
	const { user } = useUser();
	const storage = useMMKV(); // ⚡️ NEW: MMKV hook

	const [hypeDrawerOpen, setHypeDrawerOpen] = useState(false);
	const [activeHypePost, setActiveHypePost] = useState(null);

	// ⚡️ NEW: Tutorial State logic
	const [showTutorial, setShowTutorial] = useState(false);

	useEffect(() => {
		// Only show if they haven't seen it yet
		const hasSeenTutorial = storage.getBoolean('hasSeenSwipeTutorial');
		if (!hasSeenTutorial) {
			setShowTutorial(true);
			// Auto-hide after 3.5 seconds so it isn't intrusive
			const timer = setTimeout(() => setShowTutorial(false), 3500);
			return () => clearTimeout(timer);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			setIsScreenFocused(true);
			return () => {
				setIsScreenFocused(false);
			};
		}, [])
	);

	// 1. Initial Video Seed
	const seedItem = useMemo(() => ({
		_id: postId || 'seed-id',
		uri, title, author, stats, onDownload, clanInfo, liked, onLike, onOpenComments, onOpenDiscussions, onWatchComplete, onSkip, onNotInterested, onOpenHype, onShare
	}), [postId, uri, title, author, stats, onDownload, clanInfo, liked, onLike, onOpenComments, onOpenDiscussions, onWatchComplete, onSkip, onNotInterested, onOpenHype, onShare]);

	// 2. Fetch the rest
	const getKey = (pageIndex, previousPageData) => {
		if (!postId) return null;
		if (previousPageData && previousPageData.posts?.length < 10) return null;
		return `/posts/video-feed?startingId=${postId}&page=${pageIndex + 1}&limit=10`;
	};

	const { data, size, setSize, isValidating, isLoading, mutate } = useSWRInfinite(getKey, fetcher, {
		revalidateOnFocus: false,
		revalidateIfStale: false
	});

	// 3. Merge them together seamlessly WITH REAL ACTIONS (and tracking)
	const feedList = useMemo(() => {
		const list = [seedItem];
		if (data) {
			data.forEach(page => {
				if (page?.posts) {
					page.posts.forEach(fetchedPost => {

						const handleInfiniteLike = async () => {
							if (!user) return;
							try {
								await apiFetch(`/posts/${fetchedPost._id}`, {
									method: "PATCH",
									body: JSON.stringify({ action: "like", fingerprint: user.deviceId }),
								});
							} catch (err) { console.error("Like failed on infinite feed", err); }
						};

						const handleInfiniteWatchComplete = async () => {
							if (!user?.deviceId) return;
							try {
								await apiFetch(`/posts/${fetchedPost._id}`, {
									method: "PATCH",
									body: JSON.stringify({ action: "watch_complete", fingerprint: user.deviceId }),
								});
							} catch (err) { console.error("Watch log failed on infinite feed", err); }
						};

						const handleInfiniteSkip = async () => {
							if (!user?.deviceId) return;
							try {
								await apiFetch(`/posts/${fetchedPost._id}`, {
									method: "PATCH",
									body: JSON.stringify({ action: "skip", fingerprint: user.deviceId }),
								});
							} catch (err) { }
						};

						const handleInfiniteNotInterested = async () => {
							if (!user?.deviceId) return;
							try {
								await apiFetch(`/posts/${fetchedPost._id}`, {
									method: "PATCH",
									body: JSON.stringify({ action: "not_interested", fingerprint: user.deviceId }),
								});
							} catch (err) { }
						};

						const handleInfiniteShare = async () => {
							try {
								const url = `https://oreblogda.com/post/${fetchedPost._id}`;
								Haptics.selectionAsync();
								const shareResult = await Share.share({ message: `Check out this post on Oreblogda: ${fetchedPost.title}\n${url}` });
								if (shareResult.action === Share.sharedAction) {
									await apiFetch(`/posts/${fetchedPost._id}`, {
										method: "PATCH",
										body: JSON.stringify({ action: "share", fingerprint: user?.deviceId })
									});
								}
							} catch (error) { }
						};

						list.push({
							_id: fetchedPost._id,
							uri: fetchedPost.videoUrl || fetchedPost.mediaUrl,
							title: fetchedPost.title || fetchedPost.content,
							authorId: fetchedPost.authorUserId || fetchedPost.authorId,
							author: fetchedPost.authorData || fetchedPost.author,
							stats: fetchedPost.stats || {},
							clanInfo: fetchedPost.clanData,
							liked: fetchedPost.isLiked,
							onLike: handleInfiniteLike,
							onWatchComplete: handleInfiniteWatchComplete,
							onSkip: handleInfiniteSkip,
							onNotInterested: handleInfiniteNotInterested,
							onShare: handleInfiniteShare,
							onOpenHype: () => {
								setActiveHypePost(fetchedPost);
								setHypeDrawerOpen(true);
							},
							onOpenComments: () => {
								DeviceEventEmitter.emit("navigateSafely", `/post/${fetchedPost._id}?comment=open`);
							},
						});
					});
				}
			});
		}
		return list;
	}, [data, seedItem, user]);

	const handleLightboxHypeSubmit = async (tierKey) => {
		if (!user || !activeHypePost) return;
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
		try {
			await apiFetch(`/posts/hype`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					deviceId: user.deviceId,
					postId: activeHypePost._id,
					hypeType: tierKey
				}),
			});
			mutate();
		} catch (err) {
			console.log("Hype failed inside infinite feed", err);
		}
	};

	const onViewableItemsChanged = useRef(({ viewableItems }) => {
		const visibleItem = viewableItems.find((item) => item.isViewable);
		if (visibleItem && visibleItem.item) {
			setActivePostId(visibleItem.item._id);
		}
	}).current;

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 50,
		viewAreaCoveragePercentThreshold: 50
	}).current;

	const handleEndReached = () => {
		if (!isValidating && !isLoading) setSize(size + 1);
	};

	// ⚡️ NEW: Triggered when the user physically finishes scrolling to a new item
	const handleScrollEnd = (e) => {
		const newIndex = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
		// If they successfully swiped away from the first video
		if (newIndex > 0) {
			storage.set('hasSeenSwipeTutorial', true);
			setShowTutorial(false);
		}
	};

	return (
		<View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: isDark ? "#05070b" : "#ffffff" }}>
			<LegendList
				data={feedList}
				extraData={activePostId}
				keyExtractor={(item, index) => item._id + index}
				renderItem={({ item }) => (
					<VideoSlide
						item={item}
						isActive={item._id === activePostId && isScreenFocused && !hypeDrawerOpen}
						isDark={isDark}
					/>
				)}
				estimatedItemSize={SCREEN_HEIGHT}
				recycleItems={true}
				pagingEnabled
				showsVerticalScrollIndicator={false}
				snapToInterval={SCREEN_HEIGHT}
				snapToAlignment="start"
				decelerationRate="fast"
				disableIntervalMomentum
				onViewableItemsChanged={onViewableItemsChanged}
				viewabilityConfig={viewabilityConfig}
				onEndReached={handleEndReached}
				onEndReachedThreshold={0.5}
				onMomentumScrollEnd={handleScrollEnd} // ⚡️ Tracks if they swiped
			/>

			{/* ⚡️ NEW: The Tutorial Overlay */}
			{showTutorial && <SwipeTutorialOverlay />}

			<HypeModal
				visible={hypeDrawerOpen}
				onClose={() => setHypeDrawerOpen(false)}
				onHype={handleLightboxHypeSubmit}
				isDark={isDark}
			/>
		</View>
	);
});


// ⚡️ EXACT Styles (Untouched)
const styles = StyleSheet.create({
	seekFeedback: { position: 'absolute', top: '45%', left: '5%', alignSelf: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 20, borderRadius: 60, zIndex: 100 },
	seekText: { color: 'white', fontWeight: '900', marginTop: 5, fontSize: 12 },
	centerControl: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	playButton: { backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 22, borderRadius: 60, borderWidth: 2, elevation: 12 },
	bottomHud: { position: 'absolute', bottom: 0, width: '100%', paddingBottom: 95 },
	timerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12, alignItems: 'center' },
	timerText: { fontSize: 12, fontWeight: '900' },
	rightControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
	iconButton: { flexDirection: 'row', alignItems: 'center' },
	speedLabel: { fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
	speedMenu: { position: 'absolute', bottom: 70, right: 20, padding: 10, borderRadius: 16, width: 150, zIndex: 200, borderWidth: 1 },
	speedOption: { paddingVertical: 8, alignItems: 'center' },
	speedText: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
	speedDivider: { height: 1, backgroundColor: 'rgba(148,163,184,0.2)', marginVertical: 4 },
	progressBarBg: { width: '100%', height: 30, justifyContent: 'center' },
	progressFill: { height: 6, justifyContent: 'center', position: 'relative' },
	progressDot: { position: 'absolute', right: -10, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
	infoOverlayTop: { position: 'absolute', top: 54, left: 14, right: 14, zIndex: 10 },
	infoOverlayBottom: { position: 'absolute', bottom: 8, left: 12, right: 12, zIndex: 10 },
	videoFrame: { width: SCREEN_WIDTH, alignSelf: 'center', justifyContent: 'center', overflow: 'hidden' },
	infoCard: { borderRadius: 24, borderWidth: 1, padding: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
	infoTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	infoLeftSlot: { width: 48, alignItems: 'center', justifyContent: 'center' },
	infoCenterSlot: { flex: 1, minWidth: 0 },
	infoRightSlot: { width: 40, alignItems: 'center', justifyContent: 'center' },
	authorAvatar: { width: 46, height: 46, borderRadius: 23 },
	nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
	nameSep: { marginHorizontal: 4, fontSize: 11, fontWeight: '900' },
	infoTitle: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
	infoAuthor: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
	infoClan: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
	statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
	statChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
	statChipText: { marginLeft: 4, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
	heartGlowShadow: { shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
	loveBurst: { position: 'absolute', top: '45%', left: '50%', marginLeft: -24, marginTop: -24, zIndex: 120, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 40, padding: 12 }
});

// Create the Animated version of FlatList so it can accept UI-thread props
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const MediaModal = memo(({ isOpen, onClose, mediaItems, currentIndex, setCurrentIndex, handleDownload, isDownloading, isMediaSaved, post, author, stats, clanInfo, isDark = false, liked = false, onLike, onOpenComments, onOpenDiscussions, onWatchComplete, onSkip, onNotInterested, onOpenHype, onShare }) => {
	const CustomAlert = useAlert();
	const [assetLoading, setAssetLoading] = useState(false);
	const [loveBurst, setLoveBurst] = useState(false);
	const [showMoreOptions, setShowMoreOptions] = useState(false);

	const theme = { ...THEME, isDark, bg: isDark ? '#05070b' : '#ffffff', card: isDark ? '#111827' : '#f8fafc', text: isDark ? '#ffffff' : '#0f172a', textSecondary: isDark ? '#cbd5e1' : '#475569' };
	const flatListRef = useRef(null);
	const imageTapTimeout = useRef(null);
	const imageLastTap = useRef(null);

	const isScrollEnabled = useSharedValue(true);

	const animatedProps = useAnimatedProps(() => {
		return {
			scrollEnabled: isScrollEnabled.value,
		};
	});

	const goToNext = () => {
		if (currentIndex < mediaItems.length - 1) {
			setShowMoreOptions(false);
			const nextIndex = currentIndex + 1;
			setCurrentIndex(nextIndex);
			flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
		}
	};

	const goToPrev = () => {
		if (currentIndex > 0) {
			setShowMoreOptions(false);
			const prevIndex = currentIndex - 1;
			setCurrentIndex(prevIndex);
			flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
		}
	};

	const handleImageLike = async () => {
		if (liked || typeof onLike !== 'function') return;
		try {
			await onLike();
		} catch (err) {
			console.log(err)
		}
	};

	const handleImageDoubleTap = () => {
		if (showMoreOptions) {
			setShowMoreOptions(false);
			return;
		}

		const now = Date.now();
		if (imageLastTap.current && now - imageLastTap.current < 300) {
			clearTimeout(imageTapTimeout.current);
			imageLastTap.current = null;
			handleImageLike();
			setLoveBurst(true);
			setTimeout(() => setLoveBurst(false), 500);
			return;
		}

		imageLastTap.current = now;
		imageTapTimeout.current = setTimeout(() => {
			imageLastTap.current = null;
		}, 300);
	};

	const renderLightboxContent = (item, isActive) => {
		const lowerUrl = item.url?.toLowerCase() || "";
		const isDirectVideo = item.type?.startsWith("video") || lowerUrl.match(/\.(mp4|mov|m4v|webm)$/i);

		if (isDirectVideo) {
			if (!isActive) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
			return <LightboxVideoPlayer key={item.url} uri={item.url} postId={item.postId} title={post?.title} author={author} stats={stats} onDownload={handleDownload} isDark={isDark} clanInfo={clanInfo} liked={liked} onLike={onLike} onOpenComments={onOpenComments} onOpenDiscussions={onOpenDiscussions} onWatchComplete={onWatchComplete} onSkip={onSkip} onNotInterested={onNotInterested} onOpenHype={onOpenHype} onShare={onShare} />;
		}

		const authorName = author?.name || author?.username || 'Creator';
		const authorImage = author?.image || author?.avatar || author?.profilePic || null;
		const clanName = clanInfo?.name || clanInfo?.displayName || clanInfo?.tag || null;

		const handleAuthorPress = () => {
			const targetId = post?.authorUserId || author?._id || author?.id || author?.userId || author?.authorUserId || author?.username;
			if (targetId) DeviceEventEmitter.emit('navigateSafely', `/author/${targetId}`);
		};

		const handleClanPress = () => {
			const targetTag = clanInfo?.tag || clanInfo?.name;
			if (targetTag) DeviceEventEmitter.emit('navigateSafely', `/clans/${targetTag}`);
		};

		return (
			<View style={{ flex: 1, backgroundColor: theme.bg }}>
				<ImageZoom
					uri={item.url}
					style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
					resizeMode="contain"
					onLoadStart={() => setAssetLoading(true)}
					onLoadEnd={() => setAssetLoading(false)}
					maxScale={8}
					doubleTapScale={2.5}
					isDoubleTapEnabled
				/>

				<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
					<Pressable style={[StyleSheet.absoluteFill, { zIndex: 1 }]} onPress={handleImageDoubleTap} />

					<View style={[styles.infoOverlayTop, { zIndex: 2 }]} pointerEvents="box-none">
						<View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(8, 15, 25, 0.82)' : 'rgba(255, 255, 255, 0.92)', borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.08)' }]}>
							<View style={styles.infoTopRow}>
								<Pressable onPress={handleAuthorPress} style={styles.infoLeftSlot}>
									{authorImage ? (
										<Image source={{ uri: authorImage }} style={styles.authorAvatar} contentFit="cover" />
									) : (
										<View style={[styles.authorAvatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent + '22' }]}>
											<Feather name="user" size={18} color={theme.text} />
										</View>
									)}
								</Pressable>
								<View style={styles.infoCenterSlot}>
									<View style={styles.nameRow}>
										<Pressable onPress={handleAuthorPress}>
											<Text style={[styles.infoAuthor, { color: theme.textSecondary }]}>{authorName}</Text>
										</Pressable>
										{clanInfo ? <Text style={[styles.nameSep, { color: theme.textSecondary }]}>•</Text> : null}
										{clanInfo ? (
											<Pressable onPress={handleClanPress}>
												<Text style={[styles.infoClan, { color: theme.text }]}>{clanName}</Text>
											</Pressable>
										) : null}
									</View>
									<Pressable
										onPress={() => DeviceEventEmitter.emit("navigateSafely", `/post/${item.postId || post?._id}`)}
										style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingRight: 10 }}
									>
										<Text style={[styles.infoTitle, { color: theme.text, flexShrink: 1 }]} numberOfLines={2}>{post?.title || 'Untitled post'}</Text>
										<Feather name="chevron-right" size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
									</Pressable>
								</View>
								<Pressable onPress={handleClanPress} style={styles.infoRightSlot}>
									{clanInfo ? <ClanCrest isVisible isFeed rank={clanInfo.rank} size={32} glowColor={clanInfo.activeGlowColor || null} /> : null}
								</Pressable>
							</View>
						</View>
					</View>

					<View style={[styles.infoOverlayBottom, { zIndex: 3 }]} pointerEvents="box-none">
						<View style={[styles.statsRow, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(17, 24, 39, 0.72)', borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255,255,255,0.14)' }]}>
							<StatChip icon={liked ? 'heart' : 'heart-outline'} label={stats.likes ?? 0} color="#ef4444" active={liked} onPress={typeof onLike === 'function' ? onLike : undefined} />
							<StatChip icon="chatbubble-ellipses-outline" label={stats.comments ?? 0} color="#38bdf8" onPress={onOpenComments} />
							<StatChip icon="chatbox-ellipses-outline" label={stats.discussions ?? 0} color="#a78bfa" onPress={onOpenDiscussions} />

							<StatChip icon="flash-outline" label={stats.hype ?? 0} color="#22c55e" onPress={onOpenHype} />
							<StatChip icon="share-social-outline" label={stats.shares ?? 0} color="#34d399" onPress={onShare} />

							{((stats.views ?? 0) > 100) ? <StatChip icon="eye" label={stats.views ?? 0} color="#38bdf8" /> : null}

							<View style={{ position: 'relative' }}>
								<StatChip icon="ellipsis-horizontal" color={isDark ? "#9ca3af" : "#4b5563"} onPress={() => setShowMoreOptions(!showMoreOptions)} />

								{showMoreOptions && (
									<View style={{ position: 'absolute', bottom: 40, right: 0, width: 160, backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)' }}>
										<TouchableOpacity onPress={() => { setShowMoreOptions(false); handleDownload?.(); }} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
											<Feather name="download" size={16} color={theme.text} style={{ marginRight: 10 }} />
											<Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 13 }}>Save Media</Text>
										</TouchableOpacity>

										<TouchableOpacity onPress={() => {
											setShowMoreOptions(false);
											CustomAlert("Hide Post", "We'll show fewer posts like this.", [
												{ text: "Cancel", style: "cancel" },
												{ text: "Hide", style: "destructive", onPress: onNotInterested }
											]);
										}} style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
											<Feather name="eye-off" size={16} color="#ef4444" style={{ marginRight: 10 }} />
											<Text style={{ color: "#ef4444", fontWeight: 'bold', fontSize: 13 }}>Not Interested</Text>
										</TouchableOpacity>
									</View>
								)}
							</View>
						</View>
					</View>

					{loveBurst && (
						<View style={styles.loveBurst} pointerEvents="none">
							<Feather name="heart" size={38} color="#f472b6" />
						</View>
					)}
				</View>

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
					animatedProps={animatedProps}
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

				<View style={{ position: 'absolute', inset: 0 }} pointerEvents="box-none">
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 16, top: 16 }} pointerEvents="box-none">
						<View style={{ flex: 1, alignItems: 'flex-start' }}>
							<View style={{ width: 42 }} />
						</View>

						{mediaItems.length > 1 && (
							<View pointerEvents="none" style={{ backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)', borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
								<Text style={{ color: theme.text, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
									Asset {currentIndex + 1} / {mediaItems.length}
								</Text>
							</View>
						)}

						<View style={{ width: 42 }} />
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
	runOnJS,
	useAnimatedProps,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PostCardComponent = ({ post, authorData, clanData, setPosts, isFeed, hideMedia, syncing, isVisible = false }) => {

	const CustomAlert = useAlert();
	const { user } = useUser();
	const isDark = useColorScheme() === "dark"

	const storage = useMMKV()

	const [lightbox, setLightbox] = useState({ open: false, index: 0 });
	const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
	const [isDownloading, setIsDownloading] = useState(false);
	const isCardVisible = isVisible && !lightbox.open;
	const [liked, setLiked] = useState(false);
	const [isMediaSaved, setIsMediaSaved] = useState(false);
	const [hypeDrawerOpen, setHypeDrawerOpen] = useState(false);

	const pulseScale = useSharedValue(0.8);
	const pulseOpacity = useSharedValue(0.5);
	const boltScale = useSharedValue(1);
	const boltRotate = useSharedValue(0);
	const buttonScale = useSharedValue(1);

	useEffect(() => {
		if (!isCardVisible) {
			cancelAnimation(pulseScale);
			cancelAnimation(pulseOpacity);
			cancelAnimation(boltScale);
			cancelAnimation(boltRotate);
			return;
		}
		pulseScale.value = withRepeat(
			withTiming(1.8, { duration: 1600, easing: Easing.out(Easing.ease) }),
			-1,
			false
		);
		pulseOpacity.value = withRepeat(
			withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }),
			-1,
			false
		);

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
				withTiming(0, { duration: 2050 })
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
	}, [isCardVisible]);

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
	const fillWidth = useSharedValue(0);
	const { data: postData, mutate } = useSWR(
		(isVisible) ? `/posts/${post._id}` : null,
		fetcher,
		{
			fallbackData: post,       // Use the prop data immediately
			revalidateOnMount: false, // ⚡️ DISABLE: Don't fetch just because it appeared
			revalidateIfStale: false, // ⚡️ DISABLE: Don't re-fetch unless you manually trigger it
			revalidateOnFocus: false, // ⚡️ DISABLE: Don't re-fetch when you switch tabs
			dedupingInterval: 600000, // ⚡️ IMPORTANT: Cache results for 10 minutes
		}
	)

	const totalLikes = postData?.likesCount ?? postData?.likes?.length ?? post?.likesCount ?? post?.likes?.length ?? 0;
	useEffect(() => {
		console.log(totalLikes, postData?.likesCount, "is the likecount b4 and after?", post?.likesCount, postData?.likes?.length, post?.likes?.length, post?.title);
	}, [totalLikes, postData?.likesCount]);

	const totalComments = postData?.commentsCount ?? postData?.comments?.length ?? post?.commentsCount ?? post?.comments?.length ?? 0;
	const totalViews = postData?.viewsCount ?? postData?.views ?? post?.viewsCount ?? post?.views ?? 0;
	const totalShares = postData?.sharesCount ?? post?.sharesCount ?? post?.shares ?? 0;
	const totalDiscussions = postData?.discussionCount ?? post?.discussionCount ?? 0;
	const totalHypePoints = postData?.hypePoints ?? post?.hypePoints ?? 0;

	const memoizedStats = ({
		likes: totalLikes,
		comments: totalComments,
		discussions: totalDiscussions,
		shares: totalShares,
		hype: totalHypePoints,
		views: totalViews,
	})

	const MAX_HP_CAP = 3000000;

	useEffect(() => {
		const amountToUSe = totalHypePoints > 10000 ? totalHypePoints : 2000;
		const progress = Math.min(amountToUSe / MAX_HP_CAP, 0.5);
		fillWidth.value = withTiming(progress, { duration: 1000, easing: Easing.out(Easing.exp) });
	}, [totalHypePoints]);

	const animatedFillStyle = useAnimatedStyle(() => ({
		width: `${fillWidth.value * 100}%`
	}));

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

	useEffect(() => {
		const latestHasLiked = postData?.hasLiked ?? post?.hasLiked;
		if (latestHasLiked !== undefined && latestHasLiked !== null) {
			setLiked(latestHasLiked);
		}
	}, [post?._id, post?.hasLiked, postData?.hasLiked]);

	const mediaItems = useMemo(() => {
		const currentPostId = post._id || post.id;

		if (post.media && Array.isArray(post.media) && post.media.length > 0) {
			return post.media.map(item => ({
				...item,
				postId: currentPostId
			}));
		}

		if (post.mediaUrl) {
			return [{
				url: post.mediaUrl,
				type: post.mediaType || "image",
				postId: currentPostId
			}];
		}

		return [];
	}, [post.media, post.mediaUrl, post.mediaType, post._id, post.id]);

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


	useEffect(() => {
		if (!post?._id || !user?.deviceId || syncing || !isCardVisible || postData?.hasViewed) return;
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
	}, [post?._id, user?.deviceId, syncing, isCardVisible, storage, postData?.hasViewed]);

	const handleWatchComplete = useCallback(async () => {
		if (!user?.deviceId || !post?._id) return;
		try {
			await apiFetch(`/posts/${post._id}`, {
				method: "PATCH",
				body: JSON.stringify({ action: "watch_complete", fingerprint: user.deviceId })
			});
		} catch (err) { console.log("Failed to log watch complete", err); }
	}, [user, post?._id]);

	const handleSkip = useCallback(async () => {
		if (!user?.deviceId || !post?._id) return;
		try {
			await apiFetch(`/posts/${post._id}`, {
				method: "PATCH",
				body: JSON.stringify({ action: "skip", fingerprint: user.deviceId })
			});
		} catch (err) { console.log("Failed to log skip", err); }
	}, [user, post?._id]);

	const handleNotInterested = useCallback(async () => {
		if (!user?.deviceId || !post?._id) return;

		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		CustomAlert("Updated", "We'll show fewer posts like this.");

		try {
			await apiFetch(`/posts/${post._id}`, {
				method: "PATCH",
				body: JSON.stringify({ action: "not_interested", fingerprint: user.deviceId })
			});
		} catch (err) { console.log("Failed to log not interested", err); }
	}, [user, post?._id, CustomAlert]);

	const handleLike = useCallback(async () => {
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
		console.log(currentLikes, "is the likecount b4 liking");

		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		setLiked(true);

		mutate({
			...(postData || post),
			likesCount: currentLikes + 1,
			likes: [...((postData || post)?.likes || []), { fingerprint }],
			hasLiked: true
		}, false);
		console.log(postData?.likesCount, "is supposed to be the new likeCount");

		try {
			const res = await apiFetch(`/posts/${post?._id}`, {
				method: "PATCH",
				body: JSON.stringify({ action: "like", fingerprint }),
			});
			if (res.status === 400 || res.ok) {
			} else { throw new Error("Server rejected like request"); }
		} catch (err) {
			setLiked(false);
			mutate(previousData, false);
			CustomAlert("Sync Error", "Could not register your like.");
		}
	}, [liked, user, post?._id, totalLikes, postData, post, mutate, CustomAlert]);

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
					deviceId: user.deviceId,
					postId: post?._id,
					hypeType: tierKey
				}),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				mutate();
			} else {
				throw new Error(data.error || "Server rejected hype request");
			}
		} catch (err) {
			mutate(previousData, false);
			CustomAlert("Transmission Failed", err.message || "Could not complete the hype protocol.");
		}
	};

	const openPostComments = useCallback(() => {
		closeLightbox();
		if (isFeed) DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}?comment=open`);
	}, [isFeed, post.slug, post?._id]);

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

	const handleDownloadMedia = useCallback(async () => {
		const item = mediaItems[currentAssetIndex];
		if (!item || !item.url) return;
		try {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			setIsDownloading(true);

			const { status } = await requestPermissionsAsync();
			if (status !== 'granted') {
				CustomAlert("Permission Denied", "We need gallery permissions to save media.");
				setIsDownloading(false);
				return;
			}

			const hashed = await Crypto.digestStringAsync(
				Crypto.CryptoDigestAlgorithm.SHA256,
				item.url
			);
			const cachedVideoUri = `${FileSystem.cacheDirectory}${hashed}.mp4`;
			const videoInfo = await FileSystem.getInfoAsync(cachedVideoUri);

			let uriToSave;

			if (videoInfo.exists) {
				uriToSave = cachedVideoUri;
			} else {
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

			await Asset.create(uriToSave);

			setIsMediaSaved(true);
			setTimeout(() => setIsMediaSaved(false), 3000);

			if (uriToSave !== cachedVideoUri) {
				await FileSystem.deleteAsync(uriToSave, { idempotent: true });
			}
		} catch (error) {
			console.log(error);
			CustomAlert("System Failure", "Unable to download media.");
		} finally {
			setIsDownloading(false);
		}
	}, [mediaItems, currentAssetIndex, CustomAlert]);


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
									alignSelf: 'flex-start',
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
									textDecorationLine: 'none'
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

			<PlayerWatermark isVisible={isCardVisible} isFeed={isFeed} equippedWatermark={equippedWatermark} isDark={isDark} />

			{isTop10 && (
				<View className="absolute inset-0 opacity-[0.04]" style={{ backgroundColor: activeGlowColor || aura.color }} pointerEvents="none" />
			)}

			<View className={`h-[3px] w-full bg-blue-600 opacity-20`} />

			<View className="p-4 px-2">
				<View className="mb-5">
					{isClanPost && clanInfo && (
						<MemoizedClanHeader isVisible={isCardVisible} clanInfo={clanInfo} isDark={isDark} postId={post._id} isFeed={isFeed} />
					)}

					<View className="flex-row justify-between items-start">
						<View className="flex-row items-center gap-4 flex-1 pr-2">
							<AuraAvatar isVisible={isCardVisible} author={author} glowColor={activeGlowColor} aura={aura} isTop10={isTop10} isDark={isDark} size={44} isFeed={isFeed} onPress={() => DeviceEventEmitter.emit("navigateSafely", `/author/${post.authorUserId}`)} />
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
												isVisible={isCardVisible}
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
											isVisible={isCardVisible}
											isFeed={isFeed}
										/>
									</View>
									<Text className="text-[10px] mt-1 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">{author.displayRank}</Text>
								</Pressable>
							</View>
						</View>

						<View className="items-end justify-center">
							{totalShares > 0 ? (
								<View className="shrink-0 flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
									<Feather name="share-2" size={11} color={isDark ? "#9ca3af" : "#4b5563"} />
									<Text className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{post.formattedShares || totalShares}</Text>
								</View>
							) : (
								<View className="shrink-0 bg-gray-50/50 dark:bg-gray-800/30 px-3 py-1.5 rounded-full border border-gray-100/50 dark:border-gray-700/40">
									<Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
										{post.category || "FRESH"}
									</Text>
								</View>
							)}

							<View className="flex-row items-center gap-1.5 mt-2">
								{post.isTrending && (
									<View className="flex-row items-center gap-1 bg-orange-500/10 dark:bg-orange-500/20 px-2.5 py-1 rounded-full border border-orange-500/30 dark:border-orange-500/40">
										<Ionicons name="flame" size={11} color="#f97316" />
										<Text className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">TRENDING</Text>
									</View>
								)}

								{author.peakLevel > 0 && (
									<View className="flex-row items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/30">
										<PeakBadge isVisible={isCardVisible} level={author.peakLevel} size={25} isFeed={isFeed} />
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
						<Poll poll={post.poll} isVisible={isFeed && isCardVisible} postId={post?._id} deviceId={user?.deviceId} />
					</View>
				)}

				<View className="flex-row items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3 mt-2 px-1">

					<View className="flex-row items-center gap-5">
						<Pressable onPress={handleLike} disabled={liked} className="flex-row items-center gap-1.5 py-1">
							<Ionicons name={liked ? "heart" : "heart-outline"} size={19} color={liked ? "#ef4444" : isDark ? "#9ca3af" : "#4b5563"} />
							<Text className={`text-xs font-black ${liked ? "text-red-500" : "text-gray-500"}`}>
								{totalLikes > 0 ? totalLikes : "Like"}
							</Text>
						</Pressable>

						<Pressable onPress={() => isFeed && DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}?comment=open`)} className="flex-row items-center gap-1.5 py-1">
							<MaterialCommunityIcons name="comment-text-outline" size={18} color={isDark ? "#9ca3af" : "#4b5563"} />
							<Text className="text-xs font-black text-gray-500">{totalComments}</Text>
						</Pressable>

						<Pressable onPress={() => isFeed && DeviceEventEmitter.emit("navigateSafely", `/post/${post.slug || post?._id}?comment=open`)} className="flex-row items-center gap-1.5 py-1 opacity-80">
							<MaterialCommunityIcons name="forum-outline" size={18} color={isDark ? "#9ca3af" : "#4b5563"} />
							<Text className="text-xs font-black text-gray-500">{totalDiscussions}</Text>
						</Pressable>
					</View>

					<View className="flex-row items-center gap-4">

						<AnimatedPressable
							onPress={() => setHypeDrawerOpen(true)}
							onPressIn={() => buttonScale.value = withSpring(0.9)}
							onPressOut={() => buttonScale.value = withSpring(1)}
							className="relative flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 dark:bg-[#00ffcc]/5 border border-emerald-500/10 dark:border-[#00ffcc]/10 overflow-hidden"
							style={animatedButtonStyle}
						>
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

						<Pressable
							onPress={handleNativeShare}
							className="w-8 h-8 items-center justify-center bg-gray-50 dark:bg-gray-800/80 rounded-full border border-gray-100 dark:border-gray-700/60"
						>
							<Feather name="share-2" size={14} color={isDark ? "#9ca3af" : "#4b5563"} />
						</Pressable>

					</View>
				</View>
			</View>

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
					post={post}
					author={author}
					clanInfo={clanInfo}
					isDark={isDark}
					liked={liked}
					onLike={handleLike}
					onOpenComments={openPostComments}
					onOpenDiscussions={openPostComments}
					stats={memoizedStats}
					onWatchComplete={handleWatchComplete}
					onSkip={handleSkip}
					onNotInterested={handleNotInterested}
					onOpenHype={() => setHypeDrawerOpen(true)} // ⚡️ PASSED TO MODAL
					onShare={handleNativeShare} // ⚡️ PASSED TO MODAL
				/>
			)}
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