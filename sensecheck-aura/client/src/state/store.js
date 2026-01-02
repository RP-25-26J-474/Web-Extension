import { create } from 'zustand';
import { getSessionResults, updateModuleCompletion } from '../utils/api';
import auraIntegration from '../utils/auraIntegration';

// Generate or retrieve session ID (only used in standalone mode)
const generateUUID = () => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
};

const getSessionId = () => {
  // In AURA mode, use userId as sessionId
  if (auraIntegration.isEnabled()) {
    return auraIntegration.getUserId();
  }
  
  // Standalone mode: use local sessionStorage
  let sessionId = sessionStorage.getItem('sensecheck_session_id');
  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem('sensecheck_session_id', sessionId);
  }
  return sessionId;
};

const useStore = create((set, get) => ({
  // Session
  sessionId: getSessionId(),
  sessionStartTime: Date.now(),
  
  // Current module
  currentModule: null,
  moduleStartTime: null,
  
  // Completed modules
  completedModules: [],
  
  // Vision Test Data
  colorBlindnessResults: {
    plates: [],
    currentPlate: 0,
    completed: false,
  },
  visualAcuityResults: {
    attempts: [],
    currentSize: 80,
    completed: false,
  },
  
  // Motor Skills Data (interaction tracking only)
  motorSkillsData: {
    currentRound: 1,
    totalRounds: 3,
    interactions: [],
    completed: false,
  },
  
  // Literacy Test Data
  literacyResults: {
    responses: [],
    currentQuestion: 0,
    completed: false,
  },
  
  // Actions
  setCurrentModule: (module) => set({
    currentModule: module,
    moduleStartTime: Date.now(),
  }),
  
  completeModule: async (moduleName) => {
    const state = get();
    const sessionId = state.sessionId;
    
    // Check if module is already completed to prevent duplicates
    const alreadyCompleted = state.completedModules.some(
      (m) => m.moduleName === moduleName || m.name === moduleName
    );
    
    if (alreadyCompleted) {
      console.log(`ℹ️ Module ${moduleName} already completed, skipping`);
      return;
    }
    
    // Update local state FIRST (ensures UI updates even if backend fails)
    set((state) => ({
      completedModules: [...state.completedModules, {
        moduleName, // Use moduleName to match backend
        name: moduleName, // Keep for backwards compatibility
        completedAt: Date.now(),
      }],
      currentModule: null,
    }));
    
    console.log('✅ Local state updated. Completed modules:', get().completedModules);
    
    // Save to backend (non-blocking, errors logged but don't break flow)
    try {
      console.log(`🎉 Saving module completion to backend: ${moduleName} for session: ${sessionId}`);
      const response = await updateModuleCompletion(sessionId, moduleName);
      console.log('✅ Module completion saved to backend:', response);
    } catch (error) {
      console.error('❌ Failed to save module completion to backend:', error);
      // Don't throw - local state is already updated, continue with the flow
    }
  },
  
  // Load session data from backend
  loadSessionData: async () => {
    const state = get();
    const sessionId = state.sessionId;
    
    console.log(`🔄 Loading session data for: ${sessionId}`);
    
    try {
      const response = await getSessionResults(sessionId);
      if (response.success && response.data.session) {
        const session = response.data.session;
        
        console.log('✅ Session loaded:', {
          completedModules: session.completedModules,
          userInfo: session.userInfo,
        });
        
        // Update completed modules from backend
        set({
          completedModules: session.completedModules || [],
        });
        
        return session;
      }
    } catch (error) {
      // Session might not exist yet, that's okay
      if (error.response?.status === 404) {
        console.log('ℹ️ No existing session found, starting fresh');
      } else {
        console.error('❌ Error loading session:', error);
      }
    }
    return null;
  },
  
  // Color Blindness Actions
  recordColorBlindnessResponse: (plateData) => set((state) => ({
    colorBlindnessResults: {
      ...state.colorBlindnessResults,
      plates: [...state.colorBlindnessResults.plates, plateData],
      currentPlate: state.colorBlindnessResults.currentPlate + 1,
    },
  })),
  
  completeColorBlindnessTest: () => set((state) => ({
    colorBlindnessResults: {
      ...state.colorBlindnessResults,
      completed: true,
    },
  })),
  
  // Visual Acuity Actions
  recordVisualAcuityAttempt: (attemptData) => set((state) => ({
    visualAcuityResults: {
      ...state.visualAcuityResults,
      attempts: [...state.visualAcuityResults.attempts, attemptData],
    },
  })),
  
  setVisualAcuitySize: (size) => set((state) => ({
    visualAcuityResults: {
      ...state.visualAcuityResults,
      currentSize: size,
    },
  })),
  
  completeVisualAcuityTest: () => set((state) => ({
    visualAcuityResults: {
      ...state.visualAcuityResults,
      completed: true,
    },
  })),
  
  // Motor Skills Actions
  addMotorInteraction: (interactionData) => set((state) => ({
    motorSkillsData: {
      ...state.motorSkillsData,
      interactions: [...state.motorSkillsData.interactions, interactionData],
    },
  })),
  
  setMotorRound: (round) => set((state) => ({
    motorSkillsData: {
      ...state.motorSkillsData,
      currentRound: round,
    },
  })),
  
  completeMotorSkillsTest: () => set((state) => ({
    motorSkillsData: {
      ...state.motorSkillsData,
      completed: true,
    },
  })),
  
  // Literacy Actions
  recordLiteracyResponse: (responseData) => set((state) => ({
    literacyResults: {
      ...state.literacyResults,
      responses: [...state.literacyResults.responses, responseData],
      currentQuestion: state.literacyResults.currentQuestion + 1,
    },
  })),
  
  completeLiteracyTest: () => set((state) => ({
    literacyResults: {
      ...state.literacyResults,
      completed: true,
    },
  })),
  
  // Check if a specific module is completed
  isModuleCompleted: (moduleName) => {
    const state = get();
    return state.completedModules.some((m) => m.moduleName === moduleName || m.name === moduleName);
  },
  
  // Check if all modules are completed
  isAllModulesCompleted: () => {
    const state = get();
    const requiredModules = ['perception', 'reaction', 'knowledge'];
    return requiredModules.every(moduleName => 
      state.completedModules.some((m) => m.moduleName === moduleName || m.name === moduleName)
    );
  },
  
  // Reset (for testing)
  resetStore: () => set({
    currentModule: null,
    completedModules: [],
    colorBlindnessResults: { plates: [], currentPlate: 0, completed: false },
    visualAcuityResults: { attempts: [], currentSize: 80, completed: false },
    motorSkillsData: { currentRound: 1, totalRounds: 3, interactions: [], completed: false },
    literacyResults: { responses: [], currentQuestion: 0, completed: false },
  }),
}));

export default useStore;

