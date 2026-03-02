import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

const DynamicProductIcon = ({ xmlString, size = 40, color }) => {
    if (!xmlString) return null;

    // Optional: Replace a placeholder in your SVG string with the dynamic color
    // e.g., in your DB, use fill="currentColor" in the SVG code
    const processedXml = xmlString.replace(/currentColor/g, color || '#22c55e');

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <SvgXml xml={processedXml} width={size} height={size} />
        </View>
    );
};