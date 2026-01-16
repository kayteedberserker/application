import { useColorScheme } from "react-native";

/**
 * THEME UI Protocol v2.0
 * Updated to support dynamic glows, streaks, and secondary text levels.
 */
const useAppTheme = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const THEME = {
    isDark,

    // Primary Surfaces
    bg: isDark ? "#0a0a0a" : "#ffffff",
    card: isDark ? "#111111" : "#f8fafc", // Light mode uses a soft slate-gray tint
    
    // Text Hierarchy
    text: isDark ? "#ffffff" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#64748b", // Critical for readability
    
    // Borders and Dividers
    border: isDark ? "#1e293b" : "#e2e8f0",

    // Functional Accents
    accent: "#2563eb", // Primary Blue Uplink
    streak: "#f97316", // Orange for the Flame/Streak system
    danger: "#ef4444",
    success: "#22c55e",

    // Ambient Glows (Using lower opacities for Light Mode to prevent washout)
    glowBlue: isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.05)",
    glowIndigo: isDark ? "rgba(79, 70, 229, 0.15)" : "rgba(79, 70, 229, 0.05)",
    glowRed: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.03)",
    glowGreen: isDark ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.03)",
    glowOrange: isDark ? "rgba(249, 115, 22, 0.1)" : "rgba(249, 115, 22, 0.03)",
  };

  return THEME;
};

// Default export as the constant if you aren't using the Hook version everywhere,
// but for true dynamic switching, the Hook version is recommended.
const THEME = useAppTheme();
export default THEME;
