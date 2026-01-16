import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

const SOUND_ENABLED_KEY = '@ballrs_sound_enabled';

type SoundType = 'tick' | 'tickFast' | 'buzzer' | 'correct' | 'wrong' | 'buttonClick' | 'buttonClick2' | 'tickTock' | 'whistle' | 'xp' | 'levelUp' | 'triviaCorrect' | 'triviaWrong' | 'dailyCorrect' | 'countdownWhistle';

// Only include sound files that actually exist and have content
// Other sounds can be added here once proper .mp3 files are provided
const soundFiles: Partial<Record<SoundType, any>> = {
  buttonClick: require('../../assets/sounds/button-click.mp3'),
  buttonClick2: require('../../assets/sounds/button-click-2.mp3'),
  tickTock: require('../../assets/sounds/tick-tock.wav'),
  whistle: require('../../assets/sounds/whistle.m4a'),
  countdownWhistle: require('../../assets/sounds/3-count-and-whistle.wav'),
  xp: require('../../assets/sounds/xp.mp3'),
  levelUp: require('../../assets/sounds/level-up.m4a'),
  triviaCorrect: require('../../assets/sounds/trivia-correct.mp3'),
  triviaWrong: require('../../assets/sounds/trivia-wrong.mp3'),
  dailyCorrect: require('../../assets/sounds/daily-player-guess-correct.mp3'),
  // Add more sounds here as they become available:
  // tick: require('../../assets/sounds/tick.mp3'),
  // tickFast: require('../../assets/sounds/tick-fast.mp3'),
  // buzzer: require('../../assets/sounds/buzzer.mp3'),
  // correct: require('../../assets/sounds/correct.mp3'),
  // wrong: require('../../assets/sounds/wrong.mp3'),
};

class SoundService {
  private enabled: boolean = true;
  private initialized: boolean = false;
  private sounds: Map<SoundType, Audio.Sound> = new Map();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Load sound preference
      const storedEnabled = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      this.enabled = storedEnabled !== 'false';
      this.initialized = true;
    } catch (error) {
      console.warn('[SoundService] Failed to initialize:', error);
      this.enabled = true;
      this.initialized = true;
    }
  }

  private async loadSound(soundName: SoundType): Promise<Audio.Sound | null> {
    try {
      // Check if already loaded
      const existing = this.sounds.get(soundName);
      if (existing) {
        return existing;
      }

      const soundFile = soundFiles[soundName];
      if (!soundFile) {
        // Sound file not available yet - silently skip
        return null;
      }

      const { sound } = await Audio.Sound.createAsync(soundFile);
      this.sounds.set(soundName, sound);
      return sound;
    } catch (error) {
      console.warn(`[SoundService] Failed to load sound ${soundName}:`, error);
      return null;
    }
  }

  async play(soundName: SoundType): Promise<void> {
    if (!this.enabled) return;

    try {
      const sound = await this.loadSound(soundName);
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      }
    } catch (error) {
      console.warn(`[SoundService] Failed to play ${soundName}:`, error);
    }
  }

  async playButtonClick(): Promise<void> {
    return this.play('buttonClick');
  }

  async playNavClick(): Promise<void> {
    return this.play('buttonClick2');
  }

  async playTick(isLastFiveSeconds: boolean = false): Promise<void> {
    return this.play(isLastFiveSeconds ? 'tickFast' : 'tick');
  }

  async playBuzzer(): Promise<void> {
    return this.play('buzzer');
  }

  async playCorrect(): Promise<void> {
    return this.play('correct');
  }

  async playWrong(): Promise<void> {
    return this.play('wrong');
  }

  async playTickTock(): Promise<void> {
    return this.play('tickTock');
  }

  async playWhistle(): Promise<void> {
    return this.play('whistle');
  }

  async playCountdownWhistle(): Promise<void> {
    return this.play('countdownWhistle');
  }

  async playXP(): Promise<void> {
    return this.play('xp');
  }

  async playLevelUp(): Promise<void> {
    return this.play('levelUp');
  }

  async playTriviaCorrect(): Promise<void> {
    return this.play('triviaCorrect');
  }

  async playTriviaWrong(): Promise<void> {
    return this.play('triviaWrong');
  }

  async playDailyCorrect(): Promise<void> {
    return this.play('dailyCorrect');
  }

  // Start a sound looping
  async startLooping(soundName: SoundType): Promise<void> {
    if (!this.enabled) return;

    try {
      const sound = await this.loadSound(soundName);
      if (sound) {
        await sound.setIsLoopingAsync(true);
        await sound.setPositionAsync(0);
        await sound.playAsync();
      }
    } catch (error) {
      console.warn(`[SoundService] Failed to start looping ${soundName}:`, error);
    }
  }

  // Stop a specific sound
  async stopSound(soundName: SoundType): Promise<void> {
    try {
      const sound = this.sounds.get(soundName);
      if (sound) {
        await sound.stopAsync();
        await sound.setIsLoopingAsync(false);
      }
    } catch (error) {
      console.warn(`[SoundService] Failed to stop ${soundName}:`, error);
    }
  }

  // Start tick-tock looping
  async startTickTock(): Promise<void> {
    return this.startLooping('tickTock');
  }

  // Stop tick-tock
  async stopTickTock(): Promise<void> {
    return this.stopSound('tickTock');
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async cleanup(): Promise<void> {
    // Unload all sounds
    for (const [, sound] of this.sounds) {
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

// Helper function for convenience
export async function playSound(soundName: SoundType): Promise<void> {
  return soundService.play(soundName);
}
