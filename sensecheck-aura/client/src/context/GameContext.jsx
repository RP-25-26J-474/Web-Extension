import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import useStore from '../state/store';
import auraIntegration from '../utils/auraIntegration';

// Challenge phases in order
export const CHALLENGE_ORDER = [
  'intro',
  'color-blindness',
  'visual-acuity', 
  'motor-skills',
  'knowledge-quiz',
  'profile-complete'
];

// Skills unlocked by completing challenges (gamified names)
export const PROFILE_TRAITS = {
  'color-blindness': {
    id: 'perception',
    name: 'Pattern Vision',
    icon: '🎨',
    description: 'Master of hidden patterns'
  },
  'visual-acuity': {
    id: 'clarity',
    name: 'Eagle Eye',
    icon: '🦅',
    description: 'Sharp focus and precision'
  },
  'motor-skills': {
    id: 'reflexes',
    name: 'Lightning Reflexes',
    icon: '⚡',
    description: 'Quick reactions under pressure'
  },
  'knowledge-quiz': {
    id: 'literacy',
    name: 'Tech Guru',
    icon: '🧠',
    description: 'Digital wisdom unlocked'
  }
};

const initialState = {
  // User identifier (from AURA extension registration - no sessionId needed)
  userId: null,
  
  // Current phase
  currentPhase: 'intro',
  
  // Overall progress
  completedChallenges: [],
  
  // Real-time stats
  stats: {
    totalScore: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    averageResponseTime: 0,
    responseTimes: [],
  },
  
  // Profile traits earned
  unlockedTraits: [],
  
  // Challenge-specific results
  challengeResults: {
    colorBlindness: null,
    visualAcuity: null,
    motorSkills: null,
    knowledgeQuiz: null,
  },
  
  // Challenge-specific progress (for resuming mid-challenge)
  challengeProgress: {
    colorBlindness: { currentPlate: 0, plates: [] },
    visualAcuity: { currentLevel: 1, distanceConfirmed: false, lastCorrectLevel: 1, attempts: [] },
    motorSkills: { currentRound: 1, totalStats: { hits: 0, misses: 0, bestStreak: 0 } },
    knowledgeQuiz: { currentQuestion: 0, responses: [] },
  },
  
  // Game timing
  startTime: null,
  phaseStartTime: null,
  
  // UI states
  showingTransition: false,
  transitionMessage: '',
  isPaused: false,
};

// Action types
const ACTIONS = {
  SET_USER_ID: 'SET_USER_ID',
  START_GAME: 'START_GAME',
  SET_PHASE: 'SET_PHASE',
  COMPLETE_CHALLENGE: 'COMPLETE_CHALLENGE',
  UPDATE_STATS: 'UPDATE_STATS',
  INCREMENT_STREAK: 'INCREMENT_STREAK',
  BREAK_STREAK: 'BREAK_STREAK',
  UNLOCK_TRAIT: 'UNLOCK_TRAIT',
  SHOW_TRANSITION: 'SHOW_TRANSITION',
  HIDE_TRANSITION: 'HIDE_TRANSITION',
  SAVE_CHALLENGE_RESULT: 'SAVE_CHALLENGE_RESULT',
  ADD_RESPONSE_TIME: 'ADD_RESPONSE_TIME',
  PAUSE_GAME: 'PAUSE_GAME',
  RESUME_GAME: 'RESUME_GAME',
  LOAD_SAVED_STATE: 'LOAD_SAVED_STATE',
  UPDATE_CHALLENGE_PROGRESS: 'UPDATE_CHALLENGE_PROGRESS',
};

function gameReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_USER_ID:
      return {
        ...state,
        userId: action.payload,
      };
      
    case ACTIONS.START_GAME:
      return {
        ...state,
        startTime: Date.now(),
        phaseStartTime: Date.now(),
        currentPhase: 'color-blindness',
      };
      
    case ACTIONS.SET_PHASE:
      return {
        ...state,
        currentPhase: action.payload,
        phaseStartTime: Date.now(),
      };
      
    case ACTIONS.COMPLETE_CHALLENGE: {
      const completedChallenges = [...state.completedChallenges, action.payload];
      return {
        ...state,
        completedChallenges,
      };
    }
    
    case ACTIONS.UPDATE_STATS:
      return {
        ...state,
        stats: {
          ...state.stats,
          ...action.payload,
        },
      };
      
    case ACTIONS.INCREMENT_STREAK: {
      const newStreak = state.stats.currentStreak + 1;
      return {
        ...state,
        stats: {
          ...state.stats,
          currentStreak: newStreak,
          maxStreak: Math.max(state.stats.maxStreak, newStreak),
          totalCorrect: state.stats.totalCorrect + 1,
          totalAttempts: state.stats.totalAttempts + 1,
        },
      };
    }
    
    case ACTIONS.BREAK_STREAK:
      return {
        ...state,
        stats: {
          ...state.stats,
          currentStreak: 0,
          totalAttempts: state.stats.totalAttempts + 1,
        },
      };
      
    case ACTIONS.UNLOCK_TRAIT:
      return {
        ...state,
        unlockedTraits: [...state.unlockedTraits, action.payload],
      };
      
    case ACTIONS.SHOW_TRANSITION:
      return {
        ...state,
        showingTransition: true,
        transitionMessage: action.payload,
      };
      
    case ACTIONS.HIDE_TRANSITION:
      return {
        ...state,
        showingTransition: false,
        transitionMessage: '',
      };
      
    case ACTIONS.SAVE_CHALLENGE_RESULT:
      return {
        ...state,
        challengeResults: {
          ...state.challengeResults,
          [action.payload.challenge]: action.payload.result,
        },
      };
      
    case ACTIONS.ADD_RESPONSE_TIME: {
      const responseTimes = [...state.stats.responseTimes, action.payload];
      const averageResponseTime = Math.round(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      );
      return {
        ...state,
        stats: {
          ...state.stats,
          responseTimes,
          averageResponseTime,
        },
      };
    }
    
    case ACTIONS.PAUSE_GAME:
      return { ...state, isPaused: true };
      
    case ACTIONS.RESUME_GAME:
      return { ...state, isPaused: false };
      
    case ACTIONS.LOAD_SAVED_STATE:
      return { ...state, ...action.payload };
    
    case ACTIONS.UPDATE_CHALLENGE_PROGRESS: {
      const { challenge, progress } = action.payload;
      return {
        ...state,
        challengeProgress: {
          ...state.challengeProgress,
          [challenge]: {
            ...state.challengeProgress[challenge],
            ...progress,
          },
        },
      };
    }
      
    default:
      return state;
  }
}

// Create context
const GameContext = createContext(null);

// Storage key
const STORAGE_KEY = 'aura_game_state';

// Provider component
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const storeActions = useStore();
  
  // Load userId from AURA integration on mount
  useEffect(() => {
    // Get userId from AURA integration (comes from URL params or sessionStorage)
    const userId = auraIntegration.getUserId();
    if (userId && !state.userId) {
      dispatch({ type: ACTIONS.SET_USER_ID, payload: userId });
    }
  }, [state.userId]);
  
  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedState = JSON.parse(saved);
        // Only restore if game was actually started
        if (parsedState.startTime && parsedState.currentPhase !== 'intro') {
          dispatch({ type: ACTIONS.LOAD_SAVED_STATE, payload: parsedState });
        }
      }
    } catch (e) {
      console.error('Failed to load game state:', e);
    }
  }, []);
  
  // Save state on changes
  useEffect(() => {
    if (state.startTime) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          userId: state.userId,
          currentPhase: state.currentPhase,
          completedChallenges: state.completedChallenges,
          stats: state.stats,
          unlockedTraits: state.unlockedTraits,
          challengeResults: state.challengeResults,
          challengeProgress: state.challengeProgress,
          startTime: state.startTime,
        }));
      } catch (e) {
        console.error('Failed to save game state:', e);
      }
    }
  }, [state]);
  
  // Actions
  const setUserId = useCallback((userId) => {
    dispatch({ type: ACTIONS.SET_USER_ID, payload: userId });
  }, []);
  
  const startGame = useCallback(() => {
    dispatch({ type: ACTIONS.START_GAME });
  }, []);
  
  const goToPhase = useCallback((phase) => {
    dispatch({ type: ACTIONS.SET_PHASE, payload: phase });
  }, []);
  
  const completeChallenge = useCallback(async (challengeId, results) => {
    // Save result
    dispatch({ 
      type: ACTIONS.SAVE_CHALLENGE_RESULT, 
      payload: { challenge: challengeId, result: results } 
    });
    
    // Mark challenge complete
    dispatch({ type: ACTIONS.COMPLETE_CHALLENGE, payload: challengeId });
    
    // Unlock trait
    const trait = PROFILE_TRAITS[challengeId];
    if (trait) {
      dispatch({ type: ACTIONS.UNLOCK_TRAIT, payload: trait });
    }
    
    // Show transition
    const traitName = trait?.name || 'Challenge';
    dispatch({ 
      type: ACTIONS.SHOW_TRANSITION, 
      payload: `${traitName} Unlocked!` 
    });
    
    // Wait for transition animation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    dispatch({ type: ACTIONS.HIDE_TRANSITION });
    
    // Move to next phase
    const currentIndex = CHALLENGE_ORDER.indexOf(challengeId);
    if (currentIndex < CHALLENGE_ORDER.length - 1) {
      const nextPhase = CHALLENGE_ORDER[currentIndex + 1];
      dispatch({ type: ACTIONS.SET_PHASE, payload: nextPhase });
    }
  }, []);
  
  const recordCorrectAnswer = useCallback((responseTime) => {
    dispatch({ type: ACTIONS.INCREMENT_STREAK });
    if (responseTime) {
      dispatch({ type: ACTIONS.ADD_RESPONSE_TIME, payload: responseTime });
    }
  }, []);
  
  const recordIncorrectAnswer = useCallback((responseTime) => {
    dispatch({ type: ACTIONS.BREAK_STREAK });
    if (responseTime) {
      dispatch({ type: ACTIONS.ADD_RESPONSE_TIME, payload: responseTime });
    }
  }, []);
  
  const updateStats = useCallback((newStats) => {
    dispatch({ type: ACTIONS.UPDATE_STATS, payload: newStats });
  }, []);
  
  const updateChallengeProgress = useCallback((challenge, progress) => {
    dispatch({ 
      type: ACTIONS.UPDATE_CHALLENGE_PROGRESS, 
      payload: { challenge, progress } 
    });
  }, []);
  
  const resetGame = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);
  
  // Computed values
  const progress = {
    current: state.completedChallenges.length,
    total: 4, // 4 challenges
    percentage: Math.round((state.completedChallenges.length / 4) * 100),
  };
  
  const elapsedTime = state.startTime ? Date.now() - state.startTime : 0;
  
  const value = {
    state,
    progress,
    elapsedTime,
    
    // Actions
    setUserId,
    startGame,
    goToPhase,
    completeChallenge,
    recordCorrectAnswer,
    recordIncorrectAnswer,
    updateStats,
    updateChallengeProgress,
    resetGame,
    
    // Store actions for data persistence
    storeActions,
  };
  
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// Hook for consuming context
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export default GameContext;

