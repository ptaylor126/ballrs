import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getXPForLevel } from '../lib/xpService';

const padlockIcon = require('../../assets/images/icon-padlock.png');

interface LevelTier {
  name: string;
  minLevel: number;
  maxLevel: number;
}

const LEVEL_TIERS: LevelTier[] = [
  { name: 'Hall of Famer', minLevel: 100, maxLevel: 999 },
  { name: 'Legend', minLevel: 50, maxLevel: 99 },
  { name: 'Master', minLevel: 40, maxLevel: 49 },
  { name: 'Expert', minLevel: 30, maxLevel: 39 },
  { name: 'Veteran', minLevel: 20, maxLevel: 29 },
  { name: 'Pro', minLevel: 10, maxLevel: 19 },
  { name: 'Rising Star', minLevel: 5, maxLevel: 9 },
  { name: 'Rookie', minLevel: 1, maxLevel: 4 },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  currentLevel: number;
  currentXP: number;
}

export default function LevelProgressionModal({
  visible,
  onClose,
  currentLevel,
  currentXP,
}: Props) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(300);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 150,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const getCurrentTier = () => {
    return LEVEL_TIERS.find(
      (tier) => currentLevel >= tier.minLevel && currentLevel <= tier.maxLevel
    );
  };

  const isTierCompleted = (tier: LevelTier) => {
    return currentLevel > tier.maxLevel;
  };

  const isTierCurrent = (tier: LevelTier) => {
    return currentLevel >= tier.minLevel && currentLevel <= tier.maxLevel;
  };

  const isTierFuture = (tier: LevelTier) => {
    return currentLevel < tier.minLevel;
  };

  // Calculate XP progress within current level
  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  const xpIntoLevel = currentXP - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;
  const progressPercent = Math.min((xpIntoLevel / xpNeededForNext) * 100, 100);

  const currentTier = getCurrentTier();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                { transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* Close button */}
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>

              {/* Title */}
              <Text style={styles.title}>Level Progression</Text>

              {/* Level tiers list */}
              <View style={styles.tiersList}>
                {LEVEL_TIERS.map((tier, index) => {
                  const completed = isTierCompleted(tier);
                  const current = isTierCurrent(tier);
                  const future = isTierFuture(tier);

                  return (
                    <View
                      key={tier.name}
                      style={[
                        styles.tierRow,
                        current && styles.tierRowCurrent,
                      ]}
                    >
                      <View style={styles.tierInfo}>
                        <Text
                          style={[
                            styles.tierName,
                            completed && styles.tierNameCompleted,
                            future && styles.tierNameFuture,
                            current && styles.tierNameCurrent,
                          ]}
                        >
                          {tier.name}
                        </Text>
                        <Text
                          style={[
                            styles.tierRange,
                            future && styles.tierRangeFuture,
                          ]}
                        >
                          ({tier.minLevel}{tier.maxLevel === 999 ? '+' : `-${tier.maxLevel}`})
                        </Text>
                      </View>
                      <View style={styles.tierStatus}>
                        {completed && (
                          <Text style={styles.checkmarkIcon}>✓</Text>
                        )}
                        {current && (
                          <>
                            <Text style={styles.starIcon}>★</Text>
                            <Text style={styles.youAreHere}>← You</Text>
                          </>
                        )}
                        {future && (
                          <Image source={padlockIcon} style={styles.lockIcon} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Current progress */}
              <View style={styles.progressSection}>
                <Text style={styles.progressLevelText}>Level {currentLevel}</Text>
                <Text style={styles.progressXPText}>
                  <Text style={styles.progressXPValue}>{xpIntoLevel}/{xpNeededForNext} XP</Text>
                  <Text style={styles.progressXPLabel}> to next level</Text>
                </Text>
                <View style={styles.xpBarOuter}>
                  <LinearGradient
                    colors={['#C57AFB', '#F965B9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.xpBarFill, { width: `${progressPercent}%` }]}
                  />
                </View>
              </View>

              {/* Got it button */}
              <TouchableOpacity style={styles.gotItButton} onPress={handleClose}>
                <Text style={styles.gotItButtonText}>Got it</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 28,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    lineHeight: 28,
  },
  title: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
  },
  tiersList: {
    marginBottom: 20,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  tierRowCurrent: {
    backgroundColor: '#FEF3C7',
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  tierNameCompleted: {
    color: '#1A1A1A',
  },
  tierNameCurrent: {
    color: '#1A1A1A',
  },
  tierNameFuture: {
    color: '#AAAAAA',
  },
  tierRange: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
  },
  tierRangeFuture: {
    color: '#CCCCCC',
  },
  tierStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkmarkIcon: {
    fontSize: 18,
    color: '#1ABC9C',
  },
  starIcon: {
    fontSize: 20,
    color: '#F2C94C',
  },
  lockIcon: {
    width: 16,
    height: 16,
    opacity: 0.4,
  },
  youAreHere: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  progressSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  progressLevelText: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 2,
  },
  progressXPText: {
    textAlign: 'center',
    marginBottom: 10,
  },
  progressXPValue: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1ABC9C',
  },
  progressXPLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
  },
  xpBarOuter: {
    width: '100%',
    height: 16,
    backgroundColor: '#E8E8E8',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  gotItButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  gotItButtonText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
});
