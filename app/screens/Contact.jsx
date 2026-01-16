import { Ionicons } from '@expo/vector-icons';
import { Picker } from "@react-native-picker/picker";
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';

const { width } = Dimensions.get('window');

export default function Contact() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", message: "", type: "General" });
  const [status, setStatus] = useState({ loading: false, success: "", error: "" });

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      setStatus({ ...status, error: "Please fill in all fields." });
      return;
    }

    setStatus({ loading: true, success: "", error: "" });

    try {
      const res = await fetch("https://oreblogda.com/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ loading: false, success: "Message sent! We'll get back to you soon.", error: "" });
        setForm({ name: "", email: "", message: "", type: "General" });
      } else {
        setStatus({ loading: false, success: "", error: data.error || "Something went wrong." });
      }
    } catch {
      setStatus({ loading: false, success: "", error: "Network error, check your connection." });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* --- Ambient Background Glows --- */}
      <View style={{ position: 'absolute', top: -50, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowBlue }} />
      <View style={{ position: 'absolute', bottom: 100, left: -100, width: 350, height: 350, borderRadius: 175, backgroundColor: THEME.glowRed }} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          
          {/* --- Header --- */}
          <View className="flex-row items-center mt-8 mb-8">
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
              className="w-12 h-12 items-center justify-center rounded-2xl border-2"
            >
              <Ionicons name="chevron-back" size={24} color={THEME.accent} />
            </TouchableOpacity>
            <View className="ml-5">
              <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Comms Channel</Text>
              <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase">Contact Us</Text>
            </View>
          </View>

          <Text style={{ color: THEME.textSecondary || '#64748b' }} className="font-medium mb-10 leading-6 px-1">
            Have a bug to report or a suggestion for the community? Initiate an uplink and our THE SYSTEM will decrypt your message.
          </Text>

          {/* --- Form Fields --- */}
          <View className="space-y-6">
            
            {/* Name Input */}
            <View>
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Identity Tag</Text>
              <TextInput
                value={form.name}
                onChangeText={(v) => handleChange("name", v)}
                placeholder="ENTER YOUR NAME..."
                placeholderTextColor={THEME.textSecondary + '80' || "#334155"}
                style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                className="border-2 p-5 rounded-2xl font-black italic uppercase"
              />
            </View>

            {/* Email Input */}
            <View className="mt-6">
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Digital Address</Text>
              <TextInput
                value={form.email}
                onChangeText={(v) => handleChange("email", v)}
                placeholder="YOU@EXAMPLE.COM"
                placeholderTextColor={THEME.textSecondary + '80' || "#334155"}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                className="border-2 p-5 rounded-2xl font-black italic uppercase"
              />
            </View>

            {/* Category Picker */}
            <View className="mt-6">
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Subject Priority</Text>
              <View style={{ backgroundColor: THEME.card, borderColor: THEME.border }} className="rounded-2xl border-2 overflow-hidden">
                <Picker
                  selectedValue={form.type}
                  onValueChange={(v) => handleChange("type", v)}
                  dropdownIconColor={THEME.accent}
                  style={{ color: THEME.text }}
                >
                  <Picker.Item label="General Inquiry" value="General" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                  <Picker.Item label="Community Join Request" value="Community" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                  <Picker.Item label="Bug Report" value="Bug" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                  <Picker.Item label="Suggestion" value="Suggestion" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                  <Picker.Item label="Request Account Removal" value="Account Removal" color={Platform.OS === 'ios' ? THEME.text : undefined} />
                </Picker>
              </View>
            </View>

            {/* Message Input */}
            <View className="mt-6">
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-2 ml-1">Data Payload</Text>
              <TextInput
                value={form.message}
                onChangeText={(v) => handleChange("message", v)}
                placeholder="TYPE YOUR MESSAGE HERE..."
                placeholderTextColor={THEME.textSecondary + '80' || "#334155"}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={{ backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                className="p-5 rounded-3xl font-medium border-2 min-h-[160px]"
              />
            </View>

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
            <TouchableOpacity
              disabled={status.loading}
              onPress={handleSubmit}
              activeOpacity={0.8}
              style={{ backgroundColor: status.loading ? THEME.accent + '80' : THEME.accent }}
              className="mt-8 py-6 rounded-[24px] flex-row justify-center items-center shadow-2xl"
            >
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

          <View className="h-24 items-center justify-center">
              <Text style={{ color: THEME.textSecondary || '#334155' }} className="font-black text-[8px] uppercase tracking-[0.4em]">Secure Transmission Channel v1.2</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
