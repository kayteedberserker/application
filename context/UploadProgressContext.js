import notifee, { AndroidImportance } from '@notifee/react-native';
import {
    createUploadTask,
    FileSystemSessionType,
    FileSystemUploadType,
    SessionType,
    UploadType
} from 'expo-file-system/legacy';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const UploadProgressContext = createContext();

export const UploadProgressProvider = ({ children }) => {
    const [uploadProgress, setUploadProgress] = useState({
        isVisible: false,
        totalFiles: 0,
        filesProgress: {},
        status: 'uploading',
        errorMessage: null,
    });

    const lastNotifiedProgress = useRef(-1);
    // ✅ FIX 1: Initialize the ref with the static ID string
    const notificationIdRef = useRef('upload_foreground');

    // ✅ IMPROVEMENT #1: Create the channel ONCE on startup
    useEffect(() => {
        notifee.createChannel({
            id: 'upload_channel',
            name: 'Media Uploads',
            vibration: false,
            importance: AndroidImportance.LOW,
        });
    }, []);

    // ⚡️ Foreground Service Tracker
    useEffect(() => {
        const updateNativeForegroundService = async () => {
            if (!uploadProgress.isVisible) return;

            const progressKeys = Object.keys(uploadProgress.filesProgress || {});
            const totalFiles = uploadProgress.totalFiles || 1;

            let totalAccumulatedProgress = 0;
            progressKeys.forEach((key) => {
                totalAccumulatedProgress += uploadProgress.filesProgress[key] || 0;
            });

            const safeOverallProgress = Math.min(100, Math.max(0, Math.round(totalAccumulatedProgress / totalFiles)));

            // ✅ SERIOUS ISSUE #2 FIX: Throttle notification updates to every 5%
            const throttledProgress = Math.floor(safeOverallProgress / 2) * 2

            if (uploadProgress.status === 'uploading' && throttledProgress !== lastNotifiedProgress.current) {
                lastNotifiedProgress.current = throttledProgress;

                // ✅ FIX 1: Don't assign to the ref, just use the static string
                await notifee.displayNotification({
                    id: notificationIdRef.current,
                    title: 'Deploying Media to Grid',
                    body: `Transmission in progress: ${throttledProgress}%`,
                    android: {
                        channelId: 'upload_channel', // Reusing the channel created on mount
                        asForegroundService: true,
                        color: '#10B981',
                        smallIcon: 'notification_icon',
                        onlyAlertOnce: true,
                        progress: {
                            max: 100,
                            current: throttledProgress, // Using the throttled value
                        },
                    },
                });
            } else if (uploadProgress.status === 'completed') {
                // 🌟 FIX 2: Explicitly kill the foreground service
                await notifee.stopForegroundService();

                // 🌟 FIX 2: Manually cancel the progress notification to prevent duplicates on some OEMs
                await notifee.cancelNotification(notificationIdRef.current);

                // Spawn a brand new, regular notification with a different ID
                await notifee.displayNotification({
                    id: 'upload_success_alert',
                    title: 'Media Uploaded',
                    body: 'All media successfully synced with the server grid.',
                    android: {
                        channelId: 'upload_channel',
                        color: '#10B981',
                        smallIcon: 'notification_icon',
                        autoCancel: true, // 🌟 UX FIX: Dismisses automatically when tapped
                        pressAction: {
                            id: 'default',
                        },
                    }
                });
                lastNotifiedProgress.current = -1;

            } else if (uploadProgress.status === 'error') {
                // 🌟 FIX 2: Explicitly kill the foreground service
                await notifee.stopForegroundService();

                // 🌟 FIX 2: Manually cancel the progress notification
                await notifee.cancelNotification(notificationIdRef.current);

                // Spawn a brand new, regular notification
                await notifee.displayNotification({
                    id: 'upload_error_alert',
                    title: 'Media Transfer Interrupted',
                    body: uploadProgress.errorMessage || 'An attachment in the sequence failed to upload.',
                    android: {
                        channelId: 'upload_channel',
                        color: '#EF4444',
                        smallIcon: 'notification_icon',
                        autoCancel: true, // 🌟 UX FIX: Dismisses automatically when tapped
                        pressAction: {
                            id: 'default',
                        },
                    }
                });
                lastNotifiedProgress.current = -1;
            }
        };

        updateNativeForegroundService();
    }, [uploadProgress]);

    const startUpload = useCallback((totalFiles) => {
        setUploadProgress({
            isVisible: true,
            totalFiles,
            filesProgress: {},
            status: 'uploading',
            errorMessage: null,
        });
    }, []);

    const updateProgress = useCallback((fileId, fileProgress) => {
        const safeProgress = isNaN(fileProgress) || !isFinite(fileProgress)
            ? 0
            : Math.min(100, Math.max(0, fileProgress));

        setUploadProgress((prev) => ({
            ...prev,
            filesProgress: {
                ...prev.filesProgress,
                [fileId]: safeProgress
            }
        }));
    }, []);

    const setStatus = useCallback((status, errorMessage = null) => {
        setUploadProgress((prev) => ({
            ...prev,
            status,
            errorMessage,
        }));
    }, []);

    const completeUpload = useCallback(() => {
        setUploadProgress((prev) => {
            const completedMap = { ...prev.filesProgress };
            Object.keys(completedMap).forEach(key => { completedMap[key] = 100; });
            return {
                ...prev,
                status: 'completed',
                filesProgress: completedMap,
            };
        });
    }, []);

    const hideProgress = useCallback(() => {
        setUploadProgress({
            isVisible: false,
            totalFiles: 0,
            filesProgress: {},
            status: 'uploading',
            errorMessage: null,
        });
    }, []);

    const uploadWithNativeEngine = useCallback(async (
        endpointUrl,
        fileUri,
        headers = {},
        parameters = {},
        fieldName = 'file',
        httpMethod = 'POST',
        onCustomProgress = null
    ) => {
        try {
            if (!onCustomProgress) {
                startUpload(1);
            }

            const MULTIPART_TYPE = UploadType?.MULTIPART ?? FileSystemUploadType?.MULTIPART ?? 1;
            const BACKGROUND_SESSION = SessionType?.BACKGROUND ?? FileSystemSessionType?.BACKGROUND ?? 0;

            const sanitizedParameters = {};
            if (parameters && typeof parameters === 'object') {
                Object.keys(parameters).forEach((key) => {
                    if (parameters[key] !== undefined && parameters[key] !== null) {
                        sanitizedParameters[key] = String(parameters[key]);
                    }
                });
            }

            const uploadTask = createUploadTask(
                endpointUrl,
                fileUri,
                {
                    uploadType: MULTIPART_TYPE,
                    fieldName: fieldName,
                    httpMethod: httpMethod,
                    headers: headers,
                    parameters: sanitizedParameters,
                    sessionType: BACKGROUND_SESSION,
                },
                (data) => {
                    // ✅ IMPROVEMENT #2 FIX: Protect against division by zero
                    const total = data.totalBytesExpectedToSend || 1;
                    const progress = (data.totalBytesSent / total) * 100;

                    if (onCustomProgress) {
                        onCustomProgress(progress, fileUri);
                    } else {
                        updateProgress(fileUri, progress);
                    }
                }
            );

            const response = await uploadTask.uploadAsync();

            if (response.status >= 200 && response.status < 300) {
                if (!onCustomProgress) {
                    completeUpload();
                }
                try {
                    return response.body ? JSON.parse(response.body) : {};
                } catch (e) {
                    return { rawBody: response.body };
                }
            } else {
                throw new Error(`Server rejected upload with status: ${response.status}`);
            }
        } catch (error) {
            if (!onCustomProgress) {
                setStatus('error', error.message);
            }
            console.error("Native Upload Failed:", error);
            throw error;
        }
    }, [startUpload, updateProgress, completeUpload, setStatus]);

    const contextValue = useMemo(() => ({
        uploadProgress,
        startUpload,
        updateProgress,
        setStatus,
        completeUpload,
        hideProgress,
        uploadWithNativeEngine,
    }), [
        uploadProgress,
        startUpload,
        updateProgress,
        setStatus,
        completeUpload,
        hideProgress,
        uploadWithNativeEngine,
    ]);

    return (
        <UploadProgressContext.Provider value={contextValue}>
            {children}
        </UploadProgressContext.Provider>
    );
};

export const useUploadProgress = () => {
    const context = useContext(UploadProgressContext);
    if (!context) {
        throw new Error('useUploadProgress must be used within UploadProgressProvider');
    }
    return context;
};