import React from 'react';
import {
  View,
  StyleSheet,
  Image,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../lib/theme';
import { AnimatedNavIcon } from './AnimatedComponents';

const ACCENT_COLOR = '#1ABC9C';

export type TabName = 'home' | 'duels' | 'leagues' | 'profile';

interface Props {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  duelsBadgeCount?: number;
}

// Icon images for each tab (using same icon for both states, active state uses filled background)
const tabIcons = {
  home: require('../../assets/images/icon-home.png'),
  duels: require('../../assets/images/icon-duel.png'),
  leagues: require('../../assets/images/icon-leagues.png'),
  profile: require('../../assets/images/icon-profile.png'),
};

const tabs: { name: TabName }[] = [
  { name: 'home' },
  { name: 'duels' },
  { name: 'leagues' },
  { name: 'profile' },
];

export default function BottomNavBar({ activeTab, onTabPress, duelsBadgeCount = 0 }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.navContent}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.name;
          const showBadge = tab.name === 'duels' && duelsBadgeCount > 0;

          return (
            <AnimatedNavIcon
              key={tab.name}
              style={styles.tab}
              onPress={() => onTabPress(tab.name)}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                <Image
                  source={tabIcons[tab.name]}
                  style={[styles.icon, { tintColor: isActive ? '#FFFFFF' : '#1A1A1A' }]}
                  resizeMode="contain"
                  accessible={false}
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Svg width={10} height={10} viewBox="0 0 10 10">
                      <Circle cx={5} cy={5} r={5} fill={ACCENT_COLOR} />
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
    paddingBottom: 24,
    paddingHorizontal: 24,
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
    elevation: 2,
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
