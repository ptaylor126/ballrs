import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
} from 'react-native';
import { AnimatedButton } from './AnimatedComponents';
import { colors, shadows, borders, borderRadius } from '../lib/theme';

// Shield/lock icon
const shieldIcon = require('../../assets/images/icon-padlock.png');

interface LinkEmailPromptModalProps {
  visible: boolean;
  onLinkEmail: () => void;
  onMaybeLater: () => void;
}

export default function LinkEmailPromptModal({
  visible,
  onLinkEmail,
  onMaybeLater,
}: LinkEmailPromptModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onMaybeLater}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Image
              source={shieldIcon}
              style={styles.icon}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>Protect Your Progress</Text>

          {/* Body */}
          <Text style={styles.body}>
            Link an email so you never lose your stats, streaks, and friends - even if you switch phones.
          </Text>

          {/* Primary Button - Link Email */}
          <AnimatedButton
            style={styles.linkButton}
            onPress={onLinkEmail}
          >
            <Text style={styles.linkButtonText}>Link Email</Text>
          </AnimatedButton>

          {/* Secondary Button - Maybe Later */}
          <AnimatedButton
            style={styles.laterButton}
            onPress={onMaybeLater}
          >
            <Text style={styles.laterButtonText}>Maybe Later</Text>
          </AnimatedButton>
        </View>
      </View>
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
  content: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.border,
  },
  icon: {
    width: 32,
    height: 32,
    tintColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  linkButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: borders.button,
    borderColor: colors.border,
    ...shadows.button,
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  laterButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: borders.button,
    borderColor: colors.border,
    ...shadows.button,
  },
  laterButtonText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.5,
  },
});
