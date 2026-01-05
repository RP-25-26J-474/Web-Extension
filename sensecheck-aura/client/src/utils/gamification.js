/**
 * AURA Academy Gamification System
 * 
 * Theme: Users are recruits at AURA Academy training to become certified AURA Agents.
 * Each assessment is a "trial" that earns XP, unlocks achievements, and determines rank.
 */

// Agent Ranks (XP thresholds)
export const AGENT_RANKS = [
  { id: 'recruit', name: 'Recruit', minXP: 0, icon: '🎯', color: '#6b7280' },
  { id: 'cadet', name: 'Cadet', minXP: 100, icon: '⚡', color: '#3b82f6' },
  { id: 'agent', name: 'Agent', minXP: 300, icon: '🛡️', color: '#8b5cf6' },
  { id: 'elite', name: 'Elite Agent', minXP: 500, icon: '🔥', color: '#f59e0b' },
  { id: 'legendary', name: 'Legendary', minXP: 750, icon: '👑', color: '#1FB854' },
];

// Achievements
export const ACHIEVEMENTS = {
  perfect_vision: {
    id: 'perfect_vision',
    name: 'Eagle Eye',
    description: 'Complete Color Blindness test without errors',
    icon: '👁️',
    xpBonus: 50,
    category: 'perception',
  },
  hawk_sight: {
    id: 'hawk_sight',
    name: 'Hawk Sight',
    description: 'Reach the smallest size in Visual Acuity',
    icon: '🦅',
    xpBonus: 75,
    category: 'perception',
  },
  sharpshooter: {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Achieve 90%+ accuracy in any round',
    icon: '🎯',
    xpBonus: 40,
    category: 'reaction',
  },
  combo_master: {
    id: 'combo_master',
    name: 'Combo Master',
    description: 'Reach a 10-hit combo streak',
    icon: '🔥',
    xpBonus: 50,
    category: 'reaction',
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    description: 'Score 100% on Literacy Quiz',
    icon: '📚',
    xpBonus: 100,
    category: 'knowledge',
  },
  completionist: {
    id: 'completionist',
    name: 'Completionist',
    description: 'Complete all four challenges',
    icon: '✅',
    xpBonus: 100,
    category: 'overall',
  },
};

// XP Rewards Configuration
export const XP_CONFIG = {
  colorBlindness: {
    baseCompletion: 50,
    perCorrectPlate: 15,
    perfectBonus: 50,
  },
  visualAcuity: {
    baseCompletion: 50,
    perCorrectAnswer: 10,
    perSizeLevel: 15,
    perfectBonus: 75,
  },
  motorSkills: {
    baseCompletion: 75,
    perBubbleHit: 5,
    comboMultiplier: 0.5,
    accuracyBonus: 50,
  },
  literacy: {
    baseCompletion: 50,
    perCorrectAnswer: 10,
    streakBonus: 5,
    perfectBonus: 100,
  },
};

// Star rating thresholds
export const STAR_THRESHOLDS = {
  one: 50,
  two: 75,
  three: 95,
};

/**
 * Calculate the current agent rank based on XP
 */
export const calculateRank = (totalXP) => {
  let currentRank = AGENT_RANKS[0];
  
  for (const rank of AGENT_RANKS) {
    if (totalXP >= rank.minXP) {
      currentRank = rank;
    } else {
      break;
    }
  }
  
  return currentRank;
};

/**
 * Calculate stars based on performance percentage
 */
export const calculateStars = (performancePercent) => {
  if (performancePercent >= STAR_THRESHOLDS.three) return 3;
  if (performancePercent >= STAR_THRESHOLDS.two) return 2;
  if (performancePercent >= STAR_THRESHOLDS.one) return 1;
  return 0;
};

/**
 * Calculate XP for Color Blindness Test
 */
export const calculateColorBlindnessXP = (results) => {
  const config = XP_CONFIG.colorBlindness;
  let xp = config.baseCompletion;
  let breakdown = [{ reason: 'Challenge Complete', xp: config.baseCompletion }];
  
  const correctPlates = results.plates?.filter(p => p.isCorrect)?.length || 0;
  const plateXP = correctPlates * config.perCorrectPlate;
  if (plateXP > 0) {
    xp += plateXP;
    breakdown.push({ reason: `${correctPlates} Correct Plates`, xp: plateXP });
  }
  
  if (correctPlates === results.plates?.length) {
    xp += config.perfectBonus;
    breakdown.push({ reason: 'Perfect Score!', xp: config.perfectBonus });
  }
  
  return { totalXP: xp, breakdown };
};

/**
 * Calculate XP for Visual Acuity Test
 */
export const calculateVisualAcuityXP = (results) => {
  const config = XP_CONFIG.visualAcuity;
  let xp = config.baseCompletion;
  let breakdown = [{ reason: 'Challenge Complete', xp: config.baseCompletion }];
  
  const correctAttempts = results.attempts?.filter(a => a.isCorrect)?.length || 0;
  const answerXP = correctAttempts * config.perCorrectAnswer;
  if (answerXP > 0) {
    xp += answerXP;
    breakdown.push({ reason: `${correctAttempts} Correct`, xp: answerXP });
  }
  
  const finalSize = results.finalResolvedSize || 80;
  const sizeLevels = Math.floor((80 - finalSize) / 10);
  const sizeXP = sizeLevels * config.perSizeLevel;
  if (sizeXP > 0) {
    xp += sizeXP;
    breakdown.push({ reason: `Reached ${finalSize}px`, xp: sizeXP });
  }
  
  if (finalSize <= 20) {
    xp += config.perfectBonus;
    breakdown.push({ reason: 'Maximum Acuity!', xp: config.perfectBonus });
  }
  
  return { totalXP: xp, breakdown };
};

/**
 * Calculate XP for Motor Skills Game
 */
export const calculateMotorSkillsXP = (totalStats) => {
  const config = XP_CONFIG.motorSkills;
  let xp = config.baseCompletion;
  let breakdown = [{ reason: 'All Rounds Complete', xp: config.baseCompletion }];
  
  const totalHits = totalStats.totalHits || totalStats.hits || 0;
  const hitXP = totalHits * config.perBubbleHit;
  if (hitXP > 0) {
    xp += hitXP;
    breakdown.push({ reason: `${totalHits} Bubbles Popped`, xp: hitXP });
  }
  
  const maxCombo = totalStats.maxCombo || totalStats.bestStreak || 0;
  const comboXP = Math.floor(maxCombo * config.comboMultiplier * 10);
  if (comboXP > 0) {
    xp += comboXP;
    breakdown.push({ reason: `Max Combo: ${maxCombo}x`, xp: comboXP });
  }
  
  const accuracy = totalStats.accuracy || 0;
  if (accuracy >= 90) {
    xp += config.accuracyBonus;
    breakdown.push({ reason: 'Sharpshooter (90%+)', xp: config.accuracyBonus });
  }
  
  return { totalXP: xp, breakdown };
};

/**
 * Calculate XP for Literacy Quiz
 */
export const calculateLiteracyXP = (results) => {
  const config = XP_CONFIG.literacy;
  let xp = config.baseCompletion;
  let breakdown = [{ reason: 'Quiz Complete', xp: config.baseCompletion }];
  
  const correctAnswers = results.responses?.filter(r => r.isCorrect)?.length || 0;
  const answerXP = correctAnswers * config.perCorrectAnswer;
  if (answerXP > 0) {
    xp += answerXP;
    breakdown.push({ reason: `${correctAnswers} Correct Answers`, xp: answerXP });
  }
  
  const totalQuestions = results.responses?.length || 0;
  if (correctAnswers === totalQuestions && totalQuestions > 0) {
    xp += config.perfectBonus;
    breakdown.push({ reason: 'Perfect Score!', xp: config.perfectBonus });
  }
  
  return { totalXP: xp, breakdown };
};

/**
 * Calculate chamber performance score (0-100)
 */
export const calculateChamberScore = (chamberType, results) => {
  switch (chamberType) {
    case 'colorBlindness': {
      const correct = results.plates?.filter(p => p.isCorrect)?.length || 0;
      const total = results.plates?.length || 1;
      return Math.round((correct / total) * 100);
    }
    case 'visualAcuity': {
      const finalSize = results.finalResolvedSize || 80;
      const progress = (80 - finalSize) / 60;
      return Math.round(progress * 100);
    }
    case 'motorSkills': {
      return Math.round(results.accuracy || 0);
    }
    case 'literacy': {
      const correct = results.responses?.filter(r => r.isCorrect)?.length || 0;
      const total = results.responses?.length || 1;
      return Math.round((correct / total) * 100);
    }
    default:
      return 0;
  }
};

