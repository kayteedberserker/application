import { Coffee, X, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases from 'react-native-purchases'; // RevenueCat
import { useAlert } from '../context/AlertContext';
import apiFetch from '../utils/apiFetch';

const CoffeeSupport = ({ userUid }) => {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const CustomAlert = useAlert()

    const handlePurchase = async () => {
        setLoading(true);
        try {
            // 1. Fetch the 'Coffee' package from your RevenueCat Offering
            const offerings = await Purchases.getOfferings();
            const coffeePackage = offerings.current.availablePackages.find(p => p.identifier === 'buy_us_a_coffee');
            console.log(coffeePackage);

            if (coffeePackage) {
                // 2. Execute Purchase
                const { customerInfo } = await Purchases.purchasePackage(coffeePackage);

                // 3. Update your Backend
                await apiFetch('coins/coffee', {
                    method: 'POST',
                    body: JSON.stringify({ uid: userUid, purchaseId: customerInfo.originalAppUserId }),
                    headers: { 'Content-Type': 'application/json' }
                });

                CustomAlert("System Energized! Thank you for the coffee. ☕️");
                setVisible(false);
            }
        } catch (e) {
            if (!e.userCancelled) {
                console.error("Purchase Error", e);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Button for Layout */}
            <TouchableOpacity
                style={styles.floatingBtn}
                onPress={() => setVisible(true)}
            >
                <Coffee color="#FFDD00" size={24} />
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
                            <X color="#fff" size={20} />
                        </TouchableOpacity>

                        <View style={styles.iconCircle}>
                            <Coffee color="#FFDD00" size={40} />
                        </View>

                        <Text style={styles.title}>ENERGY RECHARGE</Text>
                        <Text style={styles.description}>
                            The Architect is running low on fuel. Buy a coffee to keep the servers synced and the System growing.
                        </Text>

                        <View style={styles.rewardBox}>
                            <Zap color="#FFDD00" size={16} />
                            <Text style={styles.rewardText}>Unlocks 'System Patron' Title</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.buyBtn}
                            onPress={handlePurchase}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.buyBtnText}>SEND $0.99 COFFEE</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    floatingBtn: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        backgroundColor: '#1A1A1A',
        padding: 15,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: '#333',
        elevation: 5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#0D0D0D',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFDD0033',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        color: '#FFDD00',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 10,
    },
    description: {
        color: '#AAA',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    rewardBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        padding: 10,
        borderRadius: 10,
        marginBottom: 25,
    },
    rewardText: {
        color: '#FFDD00',
        fontSize: 12,
        marginLeft: 8,
        fontWeight: 'bold',
    },
    buyBtn: {
        backgroundColor: '#FFDD00',
        width: '100%',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    buyBtnText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 16,
    },
    closeBtn: {
        position: 'absolute',
        top: 15,
        right: 15,
    }
});

export default CoffeeSupport;