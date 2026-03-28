import { Text as RNText } from "react-native";
import THEME from "./useAppTheme";

export function Text({ className = "", selectable, children, style, ...props }) {
  // 1. Improved Regex to detect any color class 
  // It looks for "text-" followed by colors, but ignores sizes (xl, lg) and alignment (center, left)
  const colorRegex = /\btext-(?!xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify|italic|bold)/;
  const hasColorInClassName = colorRegex.test(className);

  // 2. Check if a color is being passed directly via the style object
  const hasColorInStyle = style && (style.color || (Array.isArray(style) && style.some(s => s?.color)));

  const hasColor = hasColorInClassName || hasColorInStyle;

  // 3. Only apply default theme colors if NO other color is provided
  const defaultClasses = hasColor ? "" : "text-gray-600 dark:text-gray-100";
  
  return (
    <RNText
      selectable={selectable || false}
      style={[
        { 
          includeFontPadding: false, // Kills the top gap
        },
        // Only apply the THEME.text fallback if no color is detected
        !hasColor && { color: THEME.text },
        style
      ]}
      // We use a template literal to ensure classes are clean
      className={`font-space ${defaultClasses} ${className}`}
      {...props}
    >
      {children}
    </RNText>
  );
}
