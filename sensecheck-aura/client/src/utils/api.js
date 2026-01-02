import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== BUCKET-BASED INTERACTION LOGGING ====================
// New unified API using MongoDB bucket pattern for better performance

/**
 * Log a single interaction to bucket (global or motor)
 * @param {string} sessionId - Session ID
 * @param {string} interactionType - 'global' or 'motor'
 * @param {object} interactionData - The interaction data
 */
export const logInteractionToBucket = async (sessionId, interactionType, interactionData) => {
  try {
    const response = await api.post('/interactions/log', {
      sessionId,
      interactionType,
      ...interactionData,
    });
    return response.data;
  } catch (error) {
    console.error(`Error logging ${interactionType} interaction to bucket:`, error);
    throw error;
  }
};

/**
 * Log multiple interactions in batch to bucket (global or motor)
 * @param {string} sessionId - Session ID
 * @param {string} interactionType - 'global' or 'motor'
 * @param {array} interactions - Array of interaction objects
 */
export const logInteractionBatchToBucket = async (sessionId, interactionType, interactions) => {
  try {
    const response = await api.post('/interactions/batch', {
      sessionId,
      interactionType,
      interactions,
    });
    return response.data;
  } catch (error) {
    console.error(`Error logging ${interactionType} batch to bucket:`, error);
    throw error;
  }
};

/**
 * Get all interactions for a session
 * @param {string} sessionId - Session ID
 * @param {string} type - Optional: 'global' or 'motor' to filter
 */
export const getSessionInteractions = async (sessionId, type = null) => {
  try {
    const url = type 
      ? `/interactions/session/${sessionId}?type=${type}`
      : `/interactions/session/${sessionId}`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching session interactions:', error);
    throw error;
  }
};

/**
 * Get interaction statistics for a session
 * @param {string} sessionId - Session ID
 */
export const getSessionInteractionStats = async (sessionId) => {
  try {
    const response = await api.get(`/interactions/session/${sessionId}/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching session interaction stats:', error);
    throw error;
  }
};

/**
 * Get bucket information for a session
 * @param {string} sessionId - Session ID
 * @param {string} type - Optional: 'global' or 'motor' to filter
 */
export const getSessionBuckets = async (sessionId, type = null) => {
  try {
    const url = type 
      ? `/interactions/session/${sessionId}/buckets?type=${type}`
      : `/interactions/session/${sessionId}/buckets`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching session buckets:', error);
    throw error;
  }
};

// ==================== LEGACY APIS (for backwards compatibility) ====================
// These can be removed once all clients are updated to use bucket-based APIs

export const logInteraction = async (interactionData) => {
  try {
    const response = await api.post('/logs/interaction', interactionData);
    return response.data;
  } catch (error) {
    console.error('Error logging interaction:', error);
    throw error;
  }
};

export const logInteractionBatch = async (interactions) => {
  try {
    const response = await api.post('/logs/batch', { interactions });
    return response.data;
  } catch (error) {
    console.error('Error logging interaction batch:', error);
    throw error;
  }
};

export const logMotorSkillsInteraction = async (interactionData) => {
  try {
    const response = await api.post('/motor-skills/interaction', interactionData);
    return response.data;
  } catch (error) {
    console.error('Error logging motor skills interaction:', error);
    throw error;
  }
};

export const logMotorSkillsBatch = async (interactions) => {
  try {
    const response = await api.post('/motor-skills/batch', { interactions });
    return response.data;
  } catch (error) {
    console.error('Error logging motor skills batch:', error);
    throw error;
  }
};

// Session Management
export const createSession = async (sessionData) => {
  try {
    const response = await api.post('/results/session', sessionData);
    return response.data;
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

// Update session with performance metrics
export const updateSessionPerformance = async (sessionId, perfMetrics) => {
  try {
    const response = await api.patch('/results/session/performance', {
      sessionId,
      perf: perfMetrics,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating session performance:', error);
    throw error;
  }
};

// Vision Results
export const saveVisionResults = async (resultsData) => {
  try {
    const response = await api.post('/results/vision', resultsData);
    return response.data;
  } catch (error) {
    console.error('Error saving vision results:', error);
    throw error;
  }
};

// Literacy Results
export const saveLiteracyResults = async (resultsData) => {
  try {
    const response = await api.post('/results/literacy', resultsData);
    return response.data;
  } catch (error) {
    console.error('Error saving literacy results:', error);
    throw error;
  }
};

// Get Session Results
export const getSessionResults = async (sessionId) => {
  try {
    const response = await api.get(`/results/session/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching session results:', error);
    throw error;
  }
};

// Update Session Module Completion
export const updateModuleCompletion = async (sessionId, moduleName) => {
  try {
    const response = await api.post('/results/module-complete', {
      sessionId,
      moduleName,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating module completion:', error);
    throw error;
  }
};

// ==================== ML-READY MOTOR SKILLS APIs ====================

/**
 * Log pointer trace samples (for ML training)
 * @param {string} sessionId - Session ID
 * @param {array} samples - Array of pointer samples [{round, tms, x, y, ...}]
 */
export const logPointerSamples = async (sessionId, samples) => {
  try {
    const response = await api.post('/motor/trace', {
      sessionId,
      samples,
    });
    return response.data;
  } catch (error) {
    console.error('Error logging pointer samples:', error);
    throw error;
  }
};

/**
 * Log motor attempts (for ML training)
 * @param {string} sessionId - Session ID
 * @param {array} attempts - Array of attempt objects with features
 */
export const logMotorAttempts = async (sessionId, attempts) => {
  try {
    const response = await api.post('/motor/attempts', {
      sessionId,
      attempts,
    });
    return response.data;
  } catch (error) {
    console.error('Error logging motor attempts:', error);
    throw error;
  }
};

/**
 * Compute round summary
 * @param {string} sessionId - Session ID
 * @param {string} participantId - Participant ID
 * @param {number} round - Round number (1-3)
 */
export const computeRoundSummary = async (sessionId, participantId, round) => {
  try {
    const response = await api.post('/motor/summary/round', {
      sessionId,
      participantId,
      round,
    });
    return response.data;
  } catch (error) {
    console.error('Error computing round summary:', error);
    throw error;
  }
};

/**
 * Compute session summary
 * @param {string} sessionId - Session ID
 * @param {string} participantId - Participant ID
 */
export const computeSessionSummary = async (sessionId, participantId) => {
  try {
    const response = await api.post('/motor/summary/session', {
      sessionId,
      participantId,
    });
    return response.data;
  } catch (error) {
    console.error('Error computing session summary:', error);
    throw error;
  }
};

/**
 * Log global interactions (for ML training)
 * @param {string} sessionId - Session ID
 * @param {array} interactions - Array of global interaction objects
 */
export const logGlobalInteractions = async (sessionId, interactions) => {
  try {
    const response = await api.post('/global/interactions', {
      sessionId,
      interactions,
    });
    return response.data;
  } catch (error) {
    console.error('Error logging global interactions:', error);
    throw error;
  }
};

export default api;

