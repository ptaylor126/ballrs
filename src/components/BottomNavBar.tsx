import React from 'react';
import {
  View,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../lib/theme';
import { AnimatedNavIcon } from './AnimatedComponents';
import { soundService } from '../lib/soundService';

const ACCENT_COLOR = '#1ABC9C';
const BADGE_COLOR = '#F2C94C'; // Yellow for notification badges

export type TabName = 'home' | 'duels' | 'leagues' | 'friends';

interface Props {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  duelsBadgeCount?: number;
  friendsBadgeCount?: number; // Pending friend requests count
  leaguesBadgeCount?: number; // Pending league invites count
}

// Icon images for each tab (using same icon for both states, active state uses filled background)
const tabIcons: Record<TabName, any> = {
  home: require('../../assets/images/icon-home.png'),
  duels: require('../../assets/images/icon-duel.png'),
  leagues: require('../../assets/images/icon-leagues.png'),
  friends: require('../../assets/images/icon-friends.png'),
};

const tabs: { name: TabName }[] = [
  { name: 'home' },
  { name: 'duels' },
  { name: 'leagues' },
  { name: 'friends' },
];

export default function BottomNavBar({ activeTab, onTabPress, duelsBadgeCount = 0, friendsBadgeCount = 0, leaguesBadgeCount = 0 }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      {/* Android shadow */}
      {Platform.OS === 'android' && <View style={styles.androidShadow} />}
      <View style={styles.navContent}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.name;
          const showDuelsBadge = tab.name === 'duels' && duelsBadgeCount > 0;
          const showFriendsBadge = tab.name === 'friends' && friendsBadgeCount > 0;
          const showLeaguesBadge = tab.name === 'leagues' && leaguesBadgeCount > 0;

          return (
            <AnimatedNavIcon
              key={tab.name}
              style={styles.tab}
              onPress={() => {
                soundService.playNavClick();
                onTabPress(tab.name);
              }}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                <Image
                  source={tabIcons[tab.name]}
                  style={[styles.icon, { tintColor: isActive ? '#FFFFFF' : '#1A1A1A' }]}
                  resizeMode="contain"
                  accessible={false}
                />
                {showDuelsBadge && (
                  <View style={styles.badge}>
                    <Svg width={10} height={10} viewBox="0 0 10 10">
                      <Circle cx={5} cy={5} r={5} fill={BADGE_COLOR} />
                    </Svg>
                  </View>
                )}
                {showFriendsBadge && (
                  <View style={styles.badge}>
                    <Svg width={10} height={10} viewBox="0 0 10 10">
                      <Circle cx={5} cy={5} r={5} fill={BADGE_COLOR} />
                    </Svg>
                  </View>
                )}
                {showLeaguesBadge && (
                  <View style={styles.badge}>
                    <Svg width={10} height={10} viewBox="0 0 10 10">
                      <Circle cx={5} cy={5} r={5} fill={BADGE_COLOR} />
                    </Svg>
                  </View>
                )}
              </View>
            </AnimatedNavIcon>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    position: 'relative',
    marginTop: 8,
  },
  androidShadow: {
    position: 'absolute',
    top: 2,
    left: 26,
    right: 22,
    height: 72,
    backgroundColor: '#000000',
    borderRadius: 32,
  },
  navContent: {
    flexDirection: 'row',
    height: 72,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 32,
    paddingVertical: 16,
    paddingHorizontal: 24,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconContainerActive: {
    backgroundColor: ACCENT_COLOR,
    borderRadius: 16,
  },
  icon: {
    width: 24,
    height: 24,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
});
