import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRef } from 'react';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const videoSource = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default function UltimateVideoPlayer() {
    const player = useVideoPlayer(videoSource, (player) => {
        player.loop = true;
        player.play();
    });

    // Track playback states
    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
    const { status } = useEvent(player, 'statusChange', { status: player.status });
    const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: player.currentTime });
    const { duration } = useEvent(player, 'durationChange', { duration: player.duration });

    // Handle Double Tap Logic
    const lastTap = useRef(null);
    const handleDoubleTap = (side) => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;
        if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
            if (side === 'left') player.seekBy(-10);
            if (side === 'right') player.seekBy(10);
        } else {
            lastTap.current = now;
        }
    };

    // Calculate Progress for the Seeker
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <View style={styles.container}>
            <View style={styles.videoWrapper}>
                <VideoView
                    style={styles.video}
                    player={player}
                    nativeControls={false} // Keep this false for total control
                    contentFit="contain"
                />

                {/* INVISIBLE DOUBLE-TAP ZONES */}
                <View style={styles.gestureOverlay}>
                    <Pressable style={styles.hitZone} onPress={() => handleDoubleTap('left')} />
                    <Pressable style={styles.hitZone} onPress={() => handleDoubleTap('right')} />
                </View>

                {/* LOADING ANIMATION */}
                {status === 'loading' && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#FFD700" />
                    </View>
                )}

                {/* CENTER PLAY/PAUSE BUTTON */}
                <View style={styles.controlsOverlay} pointerEvents="box-none">
                    <TouchableOpacity
                        onPress={() => isPlaying ? player.pause() : player.play()}
                        style={styles.playButton}
                    >
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="white" />
                    </TouchableOpacity>
                </View>

                {/* CUSTOM COLORED PROGRESS BAR */}
                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: '#FFD700' }]} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
    },
    videoWrapper: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#111',
    },
    video: {
        flex: 1,
    },
    gestureOverlay: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
    },
    hitZone: {
        flex: 1,
        // backgroundColor: 'rgba(255,255,255,0.1)', // Uncomment to see the touch zones
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: 15,
        borderRadius: 40,
    },
    progressBarContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    progressBarFill: {
        height: '100%',
    },
});