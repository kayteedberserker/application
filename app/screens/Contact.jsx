import { Ionicons } from '@expo/vector-icons';
import { Picker } from "@react-native-picker/picker";
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Text';
import TopBar from '../../components/Topbar';
import THEME from '../../components/useAppTheme';
import apiFetch from "../../utils/apiFetch";
import { getFingerprint } from "../../utils/device"; // ⚡️ ADDED

const { width } = Dimensions.get('window');

export default function Contact() {
    const router = useRouter();
    const [form, setForm] = useState({ name: "", email: "", message: "", type: "General" });
    // ⚡️ NEW: Separate state for recovery fields
    const [recoveryData, setRecoveryData] = useState({ username: "", clan: "", ocBalance: "" });
    const [status, setStatus] = useState({ loading: false, success: "", error: "" });
    const isDark = useColorScheme() === "dark";

    const handleChange = (key, value) => {
        setForm({ ...form, [key]: value });
    };

    const handleRecoveryChange = (key, value) => {
        setRecoveryData({ ...recoveryData, [key]: value });
    };

    const handleSubmit = async () => {
        // Validation updates based on the selected type
        if (!form.name || !form.email) {
            setStatus({ ...status, error: "Please fill in your Identity Tag and Email." });
            return;
        }

        if (form.type !== "Account Recovery" && !form.message) {
            setStatus({ ...status, error: "Please fill in the message field." });
            return;
        }

        setStatus({ loading: true, success: "", error: "" });

        try {
            // ⚡️ GET HARDWARE SIGNATURE
            const fingerprint = await getFingerprint();

            // ⚡️ STITCH TOGETHER RECOVERY PAYLOAD
            let finalMessage = form.message;
            if (form.type === "Account Recovery") {
                finalMessage = `[ACCOUNT RECOVERY REQUEST]\n` +
                    `Target Username: ${recoveryData.username || "Not provided"}\n` +
                    `Clan Name: ${recoveryData.clan || "Not provided"}\n` +
                    `Approximate OC Balance: ${recoveryData.ocBalance || "Not provided"}\n\n` +
                    `Additional Details:\n${form.message || "No additional details provided."}`;
            }

            const payload = {
                ...form,
                message: finalMessage, // Use the stitched message
                hardwareId: fingerprint.hardwareId,
                softwareId: fingerprint.softwareId
            };

            const res = await apiFetch("/contact", {
                method: "POST",
                headers: {
                    "x-bypass-auth": "true" // ⚡️ Tells the core client gateway to completely ignore token requirements
                },
                body: JSON.stringify(payload), // ⚡️ SEND EXTENDED PAYLOAD
            });

            const data = await res.json();
            console.log("Contact form response:", data);

            if (res.ok) {
                setStatus({ loading: false, success: "Message sent! We'll get back to you soon.", error: "" });
                setForm({ name: "", email: "", message: "", type: "General" });
                setRecoveryData({ username: "", clan: "", ocBalance: "" });
            } else {
                setStatus({ loading: false, success: "", error: data.error || "Something went wrong." });
            }
        } catch (err) {
            setStatus({ loading: false, success: "", error: "Network error, check your connection." });
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
            <TopBar isDark={isDark} />

            {/* --- Ambient Background Glows --- */}
            <View style={{ position: 'absolute', top: -50, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowBlue, zIndex: -1 }} />
            <View style={{ position: 'absolute', bottom: 100, left: -100, width: 350, height: 350, borderRadius: 175, backgroundColor: THEME.glowRed, zIndex: -1 }} />

            {/* ⚡️ FIXED: KeyboardAvoidingView configuration */}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
            >
                {/* ⚡️ FIXED: ScrollView contentContainerStyle and keyboardShouldPersistTaps */}
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
                    className="px-6"
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* --- Header --- */}
                    <View className="flex-row items-center mt-8 mb-8">
                        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="w-12 h-12 items-center justify-center rounded-2xl border-2">
                            <Ionicons name="chevron-back" size={24} color={THEME.accent} />
                        </TouchableOpacity>
                        <View className="ml-5">
                            <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Comms Channel</Text>
                            <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase">Contact Us</Text>
                        </View>
                    </View>

                    <Text style={{ color: THEME.textSecondary || '#64748b' }} className="font-medium mb-10 leading-6 px-1">
                        Have a bug to report or need to recover your identity? Initiate an uplink and THE SYSTEM will decrypt your message.
                    </Text>

                    {/* --- Form Fields --- */}
                    <View className="space-y-6">
                        {/* Name Input */}
                        <View>
                            <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Identity Tag</Text>
                            {/* ⚡️ FIXED: Removed 'uppercase' class to fix typing bug */}
                            <TextInput
                                value={form.name}
                                onChangeText={(v) => handleChange("name", v)}
                                placeholder="Enter your current or contact name..."
                                placeholderTextColor={THEME.textSecondary + '80' || "#334155"}
                                autoCapitalize="words"
                                style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                className="border-2 p-5 rounded-2xl font-black italic"
                            />
                        </View>

                        {/* Email Input */}
                        <View className="mt-6">
                            <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Email Address</Text>
                            {/* ⚡️ FIXED: Removed 'uppercase' class to fix typing bug */}
                            <TextInput
                                value={form.email}
                                onChangeText={(v) => handleChange("email", v)}
                                placeholder="you@example.com"
                                placeholderTextColor={THEME.textSecondary + '80' || "#334155"}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                className="border-2 p-5 rounded-2xl font-black italic"
                            />
                        </View>

                        {/* Category Picker */}
                        <View className="mt-6">
                            <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Subject Priority</Text>
                            <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="rounded-2xl border-2 overflow-hidden">
                                <Picker selectedValue={form.type} onValueChange={(v) => handleChange("type", v)} dropdownIconColor={THEME.accent} style={{ color: THEME.text }}>
                                    <Picker.Item label="General Inquiry" value="General" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                                    <Picker.Item label="Account Recovery" value="Account Recovery" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                                    <Picker.Item label="Community Join Request" value="Community" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                                    <Picker.Item label="Bug Report" value="Bug" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                                    <Picker.Item label="Suggestion" value="Suggestion" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                                    <Picker.Item label="Request Account Removal" value="Account Removal" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                                </Picker>
                            </View>
                        </View>

                        {/* ⚡️ NEW: DYNAMIC ACCOUNT RECOVERY FLOW */}
                        {form.type === "Account Recovery" ? (
                            <View className="mt-6 p-4 rounded-3xl border-2 border-blue-500/30 bg-blue-500/5">
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="shield-checkmark" size={16} color="#3b82f6" />
                                    <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[0.1em] ml-2">Recovery Interface Active</Text>
                                </View>
                                <Text className="text-gray-500 dark:text-gray-400 text-[11px] mb-6 font-medium leading-4">
                                    All fields below are optional, but providing accurate details significantly increases the chances of a successful identity restoration.
                                </Text>

                                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Target Username</Text>
                                <TextInput
                                    value={recoveryData.username}
                                    onChangeText={(v) => handleRecoveryChange("username", v)}
                                    placeholder="e.g. TheSystem01"
                                    placeholderTextColor={THEME.textSecondary + '80'}
                                    autoCapitalize="none"
                                    style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                    className="border-2 p-4 rounded-2xl font-medium mb-4"
                                />

                                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Clan Name (If Any)</Text>
                                <TextInput
                                    value={recoveryData.clan}
                                    onChangeText={(v) => handleRecoveryChange("clan", v)}
                                    placeholder="e.g. The Akatsuki"
                                    placeholderTextColor={THEME.textSecondary + '80'}
                                    style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                    className="border-2 p-4 rounded-2xl font-medium mb-4"
                                />

                                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Approximate OC Balance</Text>
                                <TextInput
                                    value={recoveryData.ocBalance}
                                    onChangeText={(v) => handleRecoveryChange("ocBalance", v)}
                                    placeholder="e.g. 5000 OC"
                                    placeholderTextColor={THEME.textSecondary + '80'}
                                    keyboardType="numeric"
                                    style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                    className="border-2 p-4 rounded-2xl font-medium mb-4"
                                />

                                <Text style={{ color: THEME.textSecondary }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Extra Context / Details</Text>
                                <TextInput
                                    value={form.message}
                                    onChangeText={(v) => handleChange("message", v)}
                                    placeholder="Any specific details you remember..."
                                    placeholderTextColor={THEME.textSecondary + '80'}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                    className="p-4 rounded-2xl font-medium border-2 min-h-[100px]"
                                />
                            </View>
                        ) : (
                            /* Standard Message Input */
                            <View className="mt-6">
                                <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Data Payload</Text>
                                <TextInput
                                    value={form.message}
                                    onChangeText={(v) => handleChange("message", v)}
                                    placeholder="Type your message here..."
                                    placeholderTextColor={THEME.textSecondary + '80' || "#334155"}
                                    multiline
                                    numberOfLines={6}
                                    textAlignVertical="top"
                                    style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                                    className="p-5 rounded-3xl font-medium border-2 min-h-[160px]"
                                />
                            </View>
                        )}

                        {/* Feedback Messages */}
                        {status.success ? (
                            <View className="bg-green-500/10 p-5 rounded-2xl border border-green-500/20 mt-4 flex-row items-center">
                                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                                <Text className="text-green-500 font-black uppercase text-[10px] ml-2 tracking-tight">{status.success}</Text>
                            </View>
                        ) : null}

                        {status.error ? (
                            <View className="bg-red-500/10 p-5 rounded-2xl border border-red-500/20 mt-4 flex-row items-center">
                                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                                <Text className="text-red-500 font-black uppercase text-[10px] ml-2 tracking-tight">{status.error}</Text>
                            </View>
                        ) : null}

                        {/* Submit Button */}
                        <TouchableOpacity disabled={status.loading} onPress={handleSubmit} activeOpacity={0.8} style={{ backgroundColor: status.loading ? THEME.accent + '80' : THEME.accent }} className="mt-8 py-6 rounded-[24px] flex-row justify-center items-center shadow-2xl">
                            {status.loading ? (
                                <ActivityIndicator color="white" size="small" className="mr-2" />
                            ) : (
                                <Ionicons name="flash" size={18} color="white" style={{ marginRight: 10 }} />
                            )}
                            <Text className="text-white font-black italic uppercase tracking-[0.2em] text-lg">
                                {status.loading ? "Transmitting..." : "Initiate Uplink"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View className="h-24 items-center justify-center mt-6">
                        <Text style={{ color: THEME.textSecondary || '#334155' }} className="font-black text-[8px] uppercase tracking-[0.4em]">Secure Transmission Channel v1.2</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}