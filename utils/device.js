import * as Crypto from "expo-crypto";
import * as Device from "expo-device"; // ⚡️ ADDED
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_KEY = "device_fingerprint";

export const getFingerprint = async () => {
  try {
    // --- 1. SOFTWARE ID (The "invented" ID) ---
    // This survives uninstalls but is wiped by "Clear Data"
    let softwareId = null;

    if (Platform.OS === "web") {
      softwareId = localStorage.getItem(STORAGE_KEY);
      if (!softwareId) {
        softwareId = Crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, softwareId);
      }
    } else {
      softwareId = await SecureStore.getItemAsync(STORAGE_KEY);
      if (!softwareId) {
        softwareId = Crypto.randomUUID();
        await SecureStore.setItemAsync(STORAGE_KEY, softwareId);
      }
    }

    // --- 2. HARDWARE SIGNATURE (The phone's "DNA") ---
    // These properties never change, even if storage is cleared.
    const deviceData = [
      Device.modelName,
      Device.totalMemory,
      Device.osBuildId, // Extremely stable on Android
      Device.architecture,
      Platform.OS
    ].join("|");
    // Hash the hardware data so it's a clean, anonymous string
    const hardwareId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      deviceData
    );
    // --- 3. RETURN DUAL-IDENTIFIER ---
    // We send both to the backend. The backend should block if EITHER matches an existing user.
    return {
      softwareId,
      hardwareId
    };

  } catch (error) {
    if (__DEV__) console.log("Fingerprint Sync Failed:", error);
    // Return a fallback so the app doesn't crash, but flag it
    return { softwareId: "error", hardwareId: "error" };
  }
};