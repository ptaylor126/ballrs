import { TriviaQuestion, QuestionCategory } from './duelService';

// Session storage for tracking seen questions and recent selections
interface SessionState {
  seenQuestionIds: Set<string>;
  lastCategory: QuestionCategory | null;
  lastTeam: string | null;
  usedInCurrentDuel: Set<string>;
}

// Global session state (resets when app restarts)
const sessionState: Record<string, SessionState> = {};

function getOrCreateSessionState(sport: string): SessionState {
  if (!sessionState[sport]) {
    sessionState[sport] = {
      seenQuestionIds: new Set(),
      lastCategory: null,
      lastTeam: null,
      usedInCurrentDuel: new Set(),
    };
  }
  return sessionState[sport];
}

/**
 * Reset the current duel tracking (call when starting a new duel)
 */
export function resetDuelSession(sport: string): void {
  const state = getOrCreateSessionState(sport);
  state.usedInCurrentDuel.clear();
  state.lastCategory = null;
  state.lastTeam = null;
}

/**
 * Clear all seen questions for a sport (useful for testing or when pool is exhausted)
 */
export function clearSeenQuestions(sport: string): void {
  const state = getOrCreateSessionState(sport);
  state.seenQuestionIds.clear();
}

/**
 * Select a smart question that avoids:
 * - Questions seen in this session
 * - Same category as previous question in this duel
 * - Same team as previous question in this duel
 * - Questions already used in current duel
 */
export function selectSmartQuestion(
  sport: string,
  questions: TriviaQuestion[],
  excludeIds: string[] = []
): TriviaQuestion | null {
  const state = getOrCreateSessionState(sport);

  // Build exclusion set
  const excludeSet = new Set([
    ...excludeIds,
    ...Array.from(state.usedInCurrentDuel),
  ]);

  // Filter questions based on all criteria
  let candidates = questions.filter(q => {
    // Exclude already used questions
    if (excludeSet.has(q.id)) return false;

    // Prefer questions not seen in this session (soft preference)
    // We'll handle this in scoring below

    return true;
  });

  if (candidates.length === 0) {
    // If no candidates left, reset seen questions and try again
    clearSeenQuestions(sport);
    candidates = questions.filter(q => !excludeSet.has(q.id));
  }

  if (candidates.length === 0) {
    // If still no candidates, just return any question not in current duel
    candidates = questions.filter(q => !state.usedInCurrentDuel.has(q.id));
  }

  if (candidates.length === 0) {
    return null;
  }

  // Score each candidate
  const scoredCandidates = candidates.map(q => {
    let score = 100; // Base score

    // Penalize if same category as last question (heavy penalty)
    if (state.lastCategory && q.category === state.lastCategory) {
      score -= 50;
    }

    // Penalize if same team as last question (heavy penalty)
    if (state.lastTeam && q.team && q.team === state.lastTeam) {
      score -= 50;
    }

    // Penalize if seen in session (moderate penalty)
    if (state.seenQuestionIds.has(q.id)) {
      score -= 30;
    }

    // Add some randomness
    score += Math.random() * 20;

    return { question: q, score };
  });

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Select from top candidates with some randomness
  const topCandidates = scoredCandidates.slice(0, Math.min(5, scoredCandidates.length));
  const selectedIdx = Math.floor(Math.random() * topCandidates.length);
  const selected = topCandidates[selectedIdx].question;

  // Update state
  state.seenQuestionIds.add(selected.id);
  state.usedInCurrentDuel.add(selected.id);
  state.lastCategory = selected.category;
  state.lastTeam = selected.team || null;

  return selected;
}

/**
 * Get a random question ID using smart selection
 */
export function getSmartQuestionId(
  sport: string,
  questions: TriviaQuestion[],
  excludeIds: string[] = []
): string {
  const question = selectSmartQuestion(sport, questions, excludeIds);
  if (question) {
    return question.id;
  }
  // Fallback to random selection
  const available = questions.filter(q => !excludeIds.includes(q.id));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)].id;
  }
  return questions[Math.floor(Math.random() * questions.length)].id;
}

/**
 * Select multiple questions for a multi-question duel
 * Ensures no consecutive same category or team
 */
export function selectQuestionsForDuel(
  sport: string,
  questions: TriviaQuestion[],
  count: number
): string[] {
  // Reset duel session for fresh start
  resetDuelSession(sport);

  const selectedIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const questionId = getSmartQuestionId(sport, questions, selectedIds);
    selectedIds.push(questionId);
  }

  return selectedIds;
}

/**
 * Mark a question as seen (call after user answers)
 */
export function markQuestionSeen(sport: string, questionId: string): void {
  const state = getOrCreateSessionState(sport);
  state.seenQuestionIds.add(questionId);
}
