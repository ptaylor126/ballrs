import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
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
  onBack: () => void;
}

// Icon image mapping
const iconImages: Record<string, any> = {
  'basketball': require('../../assets/images/icon-basketball.png'),
  'soccer': require('../../assets/images/icon-soccer.png'),
  'football': require('../../assets/images/icon-football.png'),
  'baseball': require('../../assets/images/icon-baseball.png'),
  'fire': require('../../assets/images/icon-fire.png'),
  'duel': require('../../assets/images/icon-duel.png'),
  'check': require('../../assets/images/icon-check.png'),
  'profile': require('../../assets/images/icon-profile.png'),
  'home': require('../../assets/images/icon-home.png'),
  'leagues': require('../../assets/images/icon-leagues.png'),
  'padlock': require('../../assets/images/icon-padlock.png'),
};

// Map icon_url (emoji or name) to image key
function getIconImage(iconUrl: string): any | null {
  const iconMap: Record<string, string> = {
    '🏀': 'basketball',
    '⚽': 'soccer',
    '🏈': 'football',
    '⚾': 'baseball',
    '🔥': 'fire',
    '⚔️': 'duel',
    '✓': 'check',
    '👤': 'profile',
    'basketball': 'basketball',
    'soccer': 'soccer',
    'football': 'football',
    'baseball': 'baseball',
    'fire': 'fire',
    'duel': 'duel',
  };

  const key = iconMap[iconUrl];
  return key ? iconImages[key] : null;
}

export default function CustomizeProfileScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'icons' | 'frames'>('icons');

  const [frames, setFrames] = useState<ProfileFrame[]>([]);
  const [icons, setIcons] = useState<ProfileIcon[]>([]);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState(1);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([]);
  const [username, setUsername] = useState<string>('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

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

    // Fetch username from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (profile?.username) {
      setUsername(profile.username);
    }

    setLoading(false);
  }

  async function handleSelectFrame(frame: ProfileFrame) {
    if (!user || !isFrameUnlocked(frame, userLevel) || saving) return;

    setSaving(true);
    const success = await updateSelectedFrame(user.id, frame.id);
    if (success) {
      setSelectedFrameId(frame.id);
    }
    setSaving(false);
  }

  async function handleSelectIcon(icon: ProfileIcon) {
    if (!user || !isIconUnlocked(icon, userLevel, unlockedAchievementIds) || saving) return;

    setSaving(true);
    const success = await updateSelectedIcon(user.id, icon.id);
    if (success) {
      setSelectedIconId(icon.id);
    }
    setSaving(false);
  }

  function openUsernameModal() {
    setNewUsername(username);
    setUsernameError(null);
    setShowUsernameModal(true);
  }

  async function handleSaveUsername() {
    if (!user || !newUsername.trim()) return;

    const trimmedUsername = newUsername.trim();

    // Validate username
    if (trimmedUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }
    if (trimmedUsername.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);

    // Check if username is taken
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmedUsername)
      .neq('id', user.id)
      .single();

    if (existing) {
      setUsernameError('Username is already taken');
      setSavingUsername(false);
      return;
    }

    // Update username
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmedUsername })
      .eq('id', user.id);

    if (error) {
      setUsernameError('Failed to update username');
      setSavingUsername(false);
      return;
    }

    setUsername(trimmedUsername);
    setShowUsernameModal(false);
    setSavingUsername(false);
  }

  function getFrameStyle(frame: ProfileFrame): FrameStyle {
    return frame.frame_style;
  }

  function getUnlockText(icon: ProfileIcon): string {
    if (icon.unlock_type === 'level' && icon.unlock_level) {
      return `Unlocks at Level ${icon.unlock_level}`;
    }
    if (icon.unlock_type === 'achievement') {
      return 'Unlock via Achievement';
    }
    return '';
  }

  const selectedFrame = frames.find(f => f.id === selectedFrameId) || frames[0];
  const selectedIcon = icons.find(i => i.id === selectedIconId);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ABC9C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button - Fixed at top */}
      <View style={styles.backButtonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>Customize Profile</Text>
            <Text style={styles.levelBadge}>Level {userLevel}</Text>
          </View>
        </View>

        {/* Username Section */}
        <View style={styles.usernameSection}>
        <View style={styles.usernameCard}>
          <View style={styles.usernameInfo}>
            <Text style={styles.usernameLabel}>Username</Text>
            <Text style={styles.usernameValue}>{username || 'Not set'}</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={openUsernameModal}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Preview */}
      <View style={styles.previewSection}>
        <View style={styles.previewCard}>
          <View
            style={[
              styles.previewAvatar,
              {
                borderColor: selectedFrame ? getFrameStyle(selectedFrame).borderColor : '#000000',
                borderWidth: selectedFrame ? getFrameStyle(selectedFrame).borderWidth : 3,
              },
            ]}
          >
            {selectedIcon && getIconImage(selectedIcon.icon_url) ? (
              <Image
                source={getIconImage(selectedIcon.icon_url)}
                style={styles.previewAvatarImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.previewAvatarText}>
                {user?.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            )}
          </View>
          <Text style={styles.previewLabel}>
            {selectedFrame?.name || 'Default'} Frame
            {selectedIcon ? ` • ${selectedIcon.name}` : ''}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'icons' && styles.tabActive]}
            onPress={() => setActiveTab('icons')}
          >
            <Text style={[styles.tabText, activeTab === 'icons' && styles.tabTextActive]}>
              Icons
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'frames' && styles.tabActive]}
            onPress={() => setActiveTab('frames')}
          >
            <Text style={[styles.tabText, activeTab === 'frames' && styles.tabTextActive]}>
              Frames
            </Text>
          </TouchableOpacity>
        </View>
      </View>

        {/* Content */}
        {activeTab === 'icons' ? (
          <View style={styles.iconsGrid}>
            {icons.map((icon) => {
              const unlocked = isIconUnlocked(icon, userLevel, unlockedAchievementIds);
              const isSelected = selectedIconId === icon.id;
              const iconImage = getIconImage(icon.icon_url);

              return (
                <TouchableOpacity
                  key={icon.id}
                  style={[
                    styles.iconCard,
                    !unlocked && styles.iconCardLocked,
                    isSelected && styles.iconCardSelected,
                  ]}
                  onPress={() => handleSelectIcon(icon)}
                  disabled={!unlocked || saving}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconPreview, !unlocked && styles.iconPreviewLocked]}>
                    {unlocked && iconImage ? (
                      <Image
                        source={iconImage}
                        style={[styles.iconImage, !unlocked && styles.iconImageLocked]}
                        resizeMode="contain"
                      />
                    ) : !unlocked ? (
                      <Image
                        source={iconImages['padlock']}
                        style={styles.lockIconImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.iconPreviewText}>{icon.icon_url}</Text>
                    )}
                  </View>
                  <Text style={[styles.iconName, !unlocked && styles.textLocked]} numberOfLines={1}>
                    {unlocked ? icon.name : '???'}
                  </Text>
                  {!unlocked && (
                    <Text style={styles.unlockRequirement} numberOfLines={1}>
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
        ) : (
          <View style={styles.framesList}>
            {frames.map((frame) => {
              const unlocked = isFrameUnlocked(frame, userLevel);
              const isSelected = selectedFrameId === frame.id;
              const style = getFrameStyle(frame);

              return (
                <TouchableOpacity
                  key={frame.id}
                  style={[
                    styles.frameCard,
                    !unlocked && styles.frameCardLocked,
                    isSelected && styles.frameCardSelected,
                  ]}
                  onPress={() => handleSelectFrame(frame)}
                  disabled={!unlocked || saving}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.framePreview,
                      {
                        borderColor: unlocked ? style.borderColor : '#CCCCCC',
                        borderWidth: style.borderWidth,
                      },
                    ]}
                  >
                    {unlocked ? (
                      <Image
                        source={iconImages['profile']}
                        style={styles.framePreviewImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Image
                        source={iconImages['padlock']}
                        style={styles.lockIconImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>

                  <View style={styles.frameInfo}>
                    <Text style={[styles.frameName, !unlocked && styles.textLocked]}>
                      {frame.name}
                    </Text>
                    {!unlocked ? (
                      <Text style={styles.frameUnlockText}>
                        Unlocks at Level {frame.unlock_level}
                      </Text>
                    ) : (
                      <Text style={styles.frameUnlockedText}>
                        Unlocked
                      </Text>
                    )}
                  </View>

                  {isSelected && (
                    <View style={styles.frameSelectedBadge}>
                      <Text style={styles.selectedBadgeText}>✓</Text>
                    </View>
                  )}

                  {!unlocked && (
                    <View style={styles.frameLevelBadge}>
                      <Text style={styles.frameLevelText}>Lv.{frame.unlock_level}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      {/* Username Change Modal */}
      <Modal
        visible={showUsernameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUsernameModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Username</Text>
            <TextInput
              style={styles.usernameInput}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter new username"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {usernameError && (
              <Text style={styles.errorText}>{usernameError}</Text>
            )}
            <Text style={styles.usernameHint}>
              3-20 characters. Letters, numbers, and underscores only.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowUsernameModal(false)}
                disabled={savingUsername}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, savingUsername && styles.saveButtonDisabled]}
                onPress={handleSaveUsername}
                disabled={savingUsername}
              >
                {savingUsername ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerRight: {
    width: 80, // Balance the header
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  levelBadge: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1ABC9C',
    marginTop: 4,
  },
  previewSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  previewAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F2EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewAvatarImage: {
    width: 60,
    height: 60,
  },
  previewAvatarText: {
    fontSize: 40,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  previewLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#6B7280',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#1ABC9C',
  },
  tabText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  backButtonRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Icons Grid
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  iconCard: {
    width: '33.33%',
    padding: 6,
  },
  iconCardLocked: {},
  iconCardSelected: {},
  iconPreview: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: 8,
    minHeight: 80,
    justifyContent: 'center',
  },
  iconPreviewLocked: {
    backgroundColor: '#F0F0F0',
  },
  iconImage: {
    width: 48,
    height: 48,
  },
  iconImageLocked: {
    opacity: 0.3,
  },
  iconPreviewText: {
    fontSize: 32,
  },
  lockIconImage: {
    width: 28,
    height: 28,
  },
  iconName: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  textLocked: {
    color: '#9CA3AF',
  },
  unlockRequirement: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'DMSans_900Black',
  },
  // Frames List
  framesList: {
    gap: 12,
    paddingHorizontal: 16,
  },
  frameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  frameCardLocked: {
    backgroundColor: '#F0F0F0',
  },
  frameCardSelected: {
    borderColor: '#1ABC9C',
    borderWidth: 3,
  },
  framePreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F2EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  framePreviewImage: {
    width: 32,
    height: 32,
  },
  framePreviewText: {
    fontSize: 24,
  },
  frameInfo: {
    flex: 1,
  },
  frameName: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  frameUnlockText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  frameUnlockedText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#22C55E',
  },
  frameSelectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameLevelBadge: {
    backgroundColor: '#E8E8E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
  },
  frameLevelText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#6B7280',
  },
  savingOverlay: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#000000',
    gap: 8,
  },
  savingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  // Username Section
  usernameSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  usernameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  usernameInfo: {
    flex: 1,
  },
  usernameLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#6B7280',
    marginBottom: 2,
  },
  usernameValue: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  editButton: {
    backgroundColor: '#1ABC9C',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 20,
    textAlign: 'center',
  },
  usernameInput: {
    backgroundColor: '#F5F2EB',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#EF4444',
    marginBottom: 8,
  },
  usernameHint: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E8E8E8',
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
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1ABC9C',
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
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
});
