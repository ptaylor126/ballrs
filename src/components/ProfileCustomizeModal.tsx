import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  ProfileFrame,
  ProfileIcon,
  FrameStyle,
  fetchProfileCustomizationData,
  updateSelectedIcon,
  updateSelectedFrame,
  isFrameUnlocked,
  isIconUnlocked,
} from '../lib/profileRewardsService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
  currentEmail: string;
}

const colors = {
  background: '#1a1a2e',
  cardBackground: '#16213e',
  primary: '#e94560',
  accent: '#0f3460',
  textLight: '#ffffff',
  textMuted: '#94a3b8',
  border: '#334155',
  locked: '#1e293b',
  success: '#22c55e',
};

export default function ProfileCustomizeModal({ visible, onClose, onUpdate, currentEmail }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'frames' | 'icons'>('frames');

  const [frames, setFrames] = useState<ProfileFrame[]>([]);
  const [icons, setIcons] = useState<ProfileIcon[]>([]);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState(1);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible && user) {
      loadData();
    }
  }, [visible, user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    const data = await fetchProfileCustomizationData(user.id);

    if (data) {
      setFrames(data.frames);
      setIcons(data.icons);
      setSelectedIconId(data.selectedIconId);
      setSelectedFrameId(data.selectedFrameId);
      setUserLevel(data.userLevel);
      setUnlockedAchievementIds(data.unlockedAchievementIds);
    }

    setLoading(false);
  }

  async function handleSelectFrame(frame: ProfileFrame) {
    if (!user || !isFrameUnlocked(frame, userLevel)) return;

    setSaving(true);
    const success = await updateSelectedFrame(user.id, frame.id);
    if (success) {
      setSelectedFrameId(frame.id);
      onUpdate();
    }
    setSaving(false);
  }

  async function handleSelectIcon(icon: ProfileIcon) {
    if (!user || !isIconUnlocked(icon, userLevel, unlockedAchievementIds)) return;

    setSaving(true);
    const success = await updateSelectedIcon(user.id, icon.id);
    if (success) {
      setSelectedIconId(icon.id);
      onUpdate();
    }
    setSaving(false);
  }

  function getFrameStyle(frame: ProfileFrame): FrameStyle {
    return frame.frame_style;
  }

  function getUnlockText(icon: ProfileIcon): string {
    if (icon.unlock_type === 'level' && icon.unlock_level) {
      return `Level ${icon.unlock_level}`;
    }
    if (icon.unlock_type === 'achievement') {
      return 'Achievement';
    }
    return '';
  }

  const selectedFrame = frames.find(f => f.id === selectedFrameId) || frames[0];
  const selectedIcon = icons.find(i => i.id === selectedIconId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Customize Profile</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Preview */}
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>Preview</Text>
                <View
                  style={[
                    styles.previewAvatar,
                    {
                      borderColor: selectedFrame ? getFrameStyle(selectedFrame).borderColor : colors.border,
                      borderWidth: selectedFrame ? getFrameStyle(selectedFrame).borderWidth : 3,
                      shadowColor: selectedFrame?.frame_style.shadowColor,
                      shadowOpacity: selectedFrame?.frame_style.shadowOpacity || 0,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                    },
                  ]}
                >
                  <Text style={styles.previewAvatarText}>
                    {selectedIcon ? selectedIcon.icon_url : currentEmail.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.frameName}>
                  {selectedFrame?.name || 'Default'} Frame
                </Text>
              </View>

              {/* Tabs */}
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'frames' && styles.tabActive]}
                  onPress={() => setActiveTab('frames')}
                >
                  <Text style={[styles.tabText, activeTab === 'frames' && styles.tabTextActive]}>
                    Frames
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'icons' && styles.tabActive]}
                  onPress={() => setActiveTab('icons')}
                >
                  <Text style={[styles.tabText, activeTab === 'icons' && styles.tabTextActive]}>
                    Icons
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {activeTab === 'frames' ? (
                  <View style={styles.grid}>
                    {frames.map((frame) => {
                      const unlocked = isFrameUnlocked(frame, userLevel);
                      const isSelected = selectedFrameId === frame.id;
                      const style = getFrameStyle(frame);

                      return (
                        <TouchableOpacity
                          key={frame.id}
                          style={[
                            styles.itemCard,
                            !unlocked && styles.itemCardLocked,
                            isSelected && styles.itemCardSelected,
                          ]}
                          onPress={() => handleSelectFrame(frame)}
                          disabled={!unlocked || saving}
                        >
                          <View
                            style={[
                              styles.framePreview,
                              {
                                borderColor: unlocked ? style.borderColor : colors.locked,
                                borderWidth: style.borderWidth,
                              },
                            ]}
                          >
                            <Text style={styles.framePreviewText}>
                              {unlocked ? '👤' : '🔒'}
                            </Text>
                          </View>
                          <Text style={[styles.itemName, !unlocked && styles.textLocked]}>
                            {frame.name}
                          </Text>
                          {!unlocked && (
                            <Text style={styles.unlockRequirement}>
                              Level {frame.unlock_level}
                            </Text>
                          )}
                          {isSelected && (
                            <View style={styles.selectedBadge}>
                              <Text style={styles.selectedBadgeText}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {icons.map((icon) => {
                      const unlocked = isIconUnlocked(icon, userLevel, unlockedAchievementIds);
                      const isSelected = selectedIconId === icon.id;

                      return (
                        <TouchableOpacity
                          key={icon.id}
                          style={[
                            styles.itemCard,
                            !unlocked && styles.itemCardLocked,
                            isSelected && styles.itemCardSelected,
                          ]}
                          onPress={() => handleSelectIcon(icon)}
                          disabled={!unlocked || saving}
                        >
                          <View style={[styles.iconPreview, !unlocked && styles.iconPreviewLocked]}>
                            <Text style={styles.iconPreviewText}>
                              {unlocked ? icon.icon_url : '🔒'}
                            </Text>
                          </View>
                          <Text style={[styles.itemName, !unlocked && styles.textLocked]}>
                            {unlocked ? icon.name : '???'}
                          </Text>
                          {!unlocked && (
                            <Text style={styles.unlockRequirement}>
                              {getUnlockText(icon)}
                            </Text>
                          )}
                          {isSelected && (
                            <View style={styles.selectedBadge}>
                              <Text style={styles.selectedBadgeText}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>

              {/* Level info */}
              <View style={styles.levelInfo}>
                <Text style={styles.levelInfoText}>
                  Your Level: {userLevel}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.textMuted,
    lineHeight: 28,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  previewLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewAvatarText: {
    fontSize: 40,
    color: colors.textLight,
  },
  frameName: {
    fontSize: 16,
    color: colors.textLight,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textLight,
  },
  scrollView: {
    maxHeight: 280,
  },
  scrollContent: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  itemCard: {
    width: '33.33%',
    padding: 6,
    alignItems: 'center',
  },
  itemCardLocked: {
    opacity: 0.5,
  },
  itemCardSelected: {},
  framePreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  framePreviewText: {
    fontSize: 24,
  },
  iconPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconPreviewLocked: {
    backgroundColor: colors.locked,
  },
  iconPreviewText: {
    fontSize: 28,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLight,
    textAlign: 'center',
  },
  textLocked: {
    color: colors.textMuted,
  },
  unlockRequirement: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: 'bold',
  },
  levelInfo: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    marginHorizontal: 16,
  },
  levelInfoText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
