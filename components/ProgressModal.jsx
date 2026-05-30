import { useUploadProgress } from '@/context/UploadProgressContext';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    useColorScheme,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './Text';

const ProgressModal = () => {
    const isDark = useColorScheme() === 'dark';
    const scaleValue = useSharedValue(0.8);
    const opacityValue = useSharedValue(0);

    const { uploadProgress: progress, hideProgress } = useUploadProgress();
    const visible = progress.isVisible;

    React.useEffect(() => {
        if (visible) {
            scaleValue.value = withTiming(1, { duration: 250 });
            opacityValue.value = withTiming(1, { duration: 200 });
        } else {
            scaleValue.value = withTiming(0.8, { duration: 200 });
            opacityValue.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    React.useEffect(() => {
        if (visible && (progress.status === 'error' || progress.status === 'completed')) {
            const timer = setTimeout(() => {
                hideProgress();
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [progress.status, visible, hideProgress]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleValue.value }],
        opacity: opacityValue.value,
    }));

    if (!visible) return null;

    // 🧮 Compute collective data calculations across dictionary keys safely
    const progressKeys = Object.keys(progress.filesProgress || {});
    const totalFiles = progress.totalFiles || 1;

    let totalAccumulatedProgress = 0;
    progressKeys.forEach((key) => {
        totalAccumulatedProgress += progress.filesProgress[key] || 0;
    });

    const safeOverallProgress = Math.min(100, Math.max(0, Math.round(totalAccumulatedProgress / totalFiles)));

    // Counter updates accurately by seeing how many attachments hit 100%
    const completedFilesCount = progressKeys.filter(key => progress.filesProgress[key] >= 100).length;
    const ongoingDisplayIndex = Math.min(totalFiles, completedFilesCount + 1);

    const getDynamicProgressColor = (pct) => {
        if (pct <= 25) return '#EF4444';
        if (pct <= 50) return '#F97316';
        if (pct <= 75) return '#EAB308';
        return '#10B981';
    };

    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (safeOverallProgress / 100) * circumference;

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <View style={[
                styles.widget,
                { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' }
            ]}>
                <View style={styles.circleContainer}>
                    <Svg width={70} height={70} viewBox="0 0 70 70" style={styles.svgCanvas}>
                        <Circle
                            cx="35"
                            cy="35"
                            r={radius}
                            stroke={isDark ? '#374151' : '#e5e7eb'}
                            strokeWidth="4"
                            fill="none"
                        />
                        <Circle
                            cx="35"
                            cy="35"
                            r={radius}
                            stroke={getDynamicProgressColor(safeOverallProgress)}
                            strokeWidth="4"
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                        />
                    </Svg>

                    <View style={styles.textOverlay}>
                        <Text style={[styles.percentageText, { color: isDark ? '#ffffff' : '#111827' }]}>
                            {safeOverallProgress}%
                        </Text>
                    </View>
                </View>

                {totalFiles > 1 && (
                    <Text style={[styles.fileCounter, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        {ongoingDisplayIndex}/{totalFiles}
                    </Text>
                )}

                <View style={styles.statusIndicator}>
                    {progress.status !== 'completed' && progress.status !== 'error' && (
                        <ActivityIndicator
                            size="small"
                            color={getDynamicProgressColor(safeOverallProgress)}
                            style={styles.spinner}
                        />
                    )}
                    {progress.status === 'completed' && (
                        <Text style={{ color: '#10B981', fontSize: 16, fontWeight: '700' }}>✓</Text>
                    )}
                    {progress.status === 'error' && (
                        <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700' }}>✕</Text>
                    )}
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: { position: 'absolute', top: 120, left: 20, zIndex: 999 },
    widget: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
    circleContainer: { width: 70, height: 70, position: 'relative', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    svgCanvas: { position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] },
    textOverlay: { width: "100%", height: "100%", position: 'absolute', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    percentageText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
    fileCounter: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
    statusIndicator: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
    spinner: { transform: [{ scale: 0.75 }] },
});

export default ProgressModal;