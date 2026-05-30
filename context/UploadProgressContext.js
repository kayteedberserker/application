import {
    createUploadTask,
    FileSystemSessionType,
    FileSystemUploadType,
    SessionType,
    UploadType
} from 'expo-file-system/legacy';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const UploadProgressContext = createContext();

export const UploadProgressProvider = ({ children }) => {
    const [uploadProgress, setUploadProgress] = useState({
        isVisible: false,
        totalFiles: 0,
        filesProgress: {}, // 📊 Dictionary tracking: { [fileUri]: progressPercentage }
        status: 'uploading',
        errorMessage: null,
    });

    const startUpload = useCallback((totalFiles) => {
        setUploadProgress({
            isVisible: true,
            totalFiles,
            filesProgress: {}, // Flush progress mapping tracking
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
            // Force-fill all files to 100 on complete
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

    /**
    * 🚀 NATIVE BACKGROUND UPLOAD ENGINE
    */
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
            const extractedFileName = fileUri.split('/').pop() || 'upload_file';

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
                    const progress = (data.totalBytesSent / data.totalBytesExpectedToSend) * 100;
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