import { Audio, AVPlaybackSource } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@ballrs_sound_enabled';

type SoundType = 'tick' | 'tickFast' | 'buzzer' | 'correct' | 'wrong';

// Sound file sources - loaded dynamically to handle missing files
function getSoundSource(name: SoundType): AVPlaybackSource | null {
  try {
    switch (name) {
      case 'tick':
        return require('../../assets/sounds/tick.mp3');
      case 'tickFast':
        return require('../../assets/sounds/tick-fast.mp3');
      case 'buzzer':
        return require('../../assets/sounds/buzzer.mp3');
      case 'correct':
        return require('../../assets/sounds/correct.mp3');
      case 'wrong':
        return require('../../assets/sounds/wrong.mp3');
      default:
        return null;
    }
  } catch {
    return null;
  }
}

class SoundService {
  private sounds: Map<SoundType, Audio.Sound> = new Map();
  private enabled: boolean = true;
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load sound preference
      const storedEnabled = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      this.enabled = storedEnabled !== 'false';

      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Preload all sounds
      await this.preloadSounds();
      this.initialized = true;
    } catch (error) {
      console.warn('Failed to initialize sound service:', error);
    }
  }

  private async preloadSounds(): Promise<void> {
    const soundNames: SoundType[] = ['tick', 'tickFast', 'buzzer', 'correct', 'wrong'];

    for (const name of soundNames) {
      try {
        const source = getSoundSource(name);
        if (source) {
          const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: false });
          this.sounds.set(name, sound);
        }
      } catch (error) {
        console.warn(`Failed to load sound: ${name}`, error);
      }
    }
  }

  async play(soundName: SoundType): Promise<void> {
    if (!this.enabled) return;

    try {
      const sound = this.sounds.get(soundName);
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      }
    } catch (error) {
      console.warn(`Failed to play sound: ${soundName}`, error);
    }
  }

  async playTick(isLastFiveSeconds: boolean = false): Promise<void> {
    await this.play(isLastFiveSeconds ? 'tickFast' : 'tick');
  }

  async playBuzzer(): Promise<void> {
    await this.play('buzzer');
  }

  async playCorrect(): Promise<void> {
    await this.play('correct');
  }

  async playWrong(): Promise<void> {
    await this.play('wrong');
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async cleanup(): Promise<void> {
    for (const sound of this.sounds.values()) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.sounds.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const soundService = new SoundService();
