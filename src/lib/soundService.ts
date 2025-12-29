import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@ballrs_sound_enabled';

type SoundType = 'tick' | 'tickFast' | 'buzzer' | 'correct' | 'wrong';

// Sound service - currently disabled due to audio file issues
// To re-enable: replace sound files with working .mp3 files and restore Audio implementation

class SoundService {
  private enabled: boolean = false; // Disabled by default until sound files are fixed
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load sound preference
      const storedEnabled = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      // Default to true if not set
      this.enabled = storedEnabled !== 'false';
      this.initialized = true;
    } catch (error) {
      this.enabled = true; // Default to enabled
      this.initialized = true;
    }
  }

  async play(soundName: SoundType): Promise<void> {
    // Sounds disabled - no-op
  }

  async playTick(isLastFiveSeconds: boolean = false): Promise<void> {
    // Sounds disabled - no-op
  }

  async playBuzzer(): Promise<void> {
    // Sounds disabled - no-op
  }

  async playCorrect(): Promise<void> {
    // Sounds disabled - no-op
  }

  async playWrong(): Promise<void> {
    // Sounds disabled - no-op
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async cleanup(): Promise<void> {
    // No-op - nothing to clean up
    this.initialized = false;
  }
}

// Singleton instance
export const soundService = new SoundService();

// Helper function for convenience (used by components like XPEarnedModal)
export async function playSound(soundName: SoundType): Promise<void> {
  return soundService.play(soundName);
}
