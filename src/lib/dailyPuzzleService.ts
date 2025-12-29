import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sport } from './theme';

interface GameState {
  date: string;
  mysteryPlayerId: number;
  currentClueIndex: number;
  wrongGuesses: number;
  solved: boolean;
  pointsEarned: number;
  gaveUp?: boolean;
}

const getStorageKey = (sport: string) => `ballrs_clue_puzzle_state_${sport}`;

function getTodayString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Check if a specific sport's daily puzzle has been completed today
 * Returns true if the puzzle was solved OR if the user gave up (done for today)
 */
export async function isDailyPuzzleCompletedToday(sport: Sport): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(getStorageKey(sport));
    if (!stored) return false;

    const state: GameState = JSON.parse(stored);
    const today = getTodayString();

    // Completed means either solved or gave up (done for today either way)
    return state.date === today && (state.solved === true || state.gaveUp === true);
  } catch (error) {
    console.error(`Error checking daily puzzle status for ${sport}:`, error);
    return false;
  }
}

/**
 * Check completion status for all sports
 * Returns a Set of sports that have been completed today
 */
export async function getCompletedSportsToday(): Promise<Set<Sport>> {
  const sports: Sport[] = ['nba', 'pl', 'nfl', 'mlb'];
  const completed = new Set<Sport>();

  await Promise.all(
    sports.map(async (sport) => {
      const isCompleted = await isDailyPuzzleCompletedToday(sport);
      if (isCompleted) {
        completed.add(sport);
      }
    })
  );

  return completed;
}
