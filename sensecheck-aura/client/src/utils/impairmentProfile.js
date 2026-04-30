/**
 * Impairment Profile Builder
 * Builds profile matching EXACT research schema
 * 
 * NOTE: For AURA integration, this saves to the AURA backend.
 * Uses userId instead of sessionId.
 */

import auraIntegration from './auraIntegration';

const AURA_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const AURA_ONBOARDING_API_URL = `${AURA_API_BASE_URL}/onboarding`;

/**
 * Build impairment profile from assessment results
 * Output matches exact research schema - no extra fields
 * 
 * @param {object} params
 * @param {string} params.userId - User identifier (from AURA registration)
 * @param {object} params.challengeResults - Results from GameContext
 * @param {object} params.stats - Stats from GameContext
 * @param {object} params.deviceInfo - Device information
 * @returns {object} Impairment profile matching research schema
 */
export const buildImpairmentProfile = ({
  userId,
  challengeResults,
  stats,
  deviceInfo,
}) => {
  // Challenge results use hyphenated keys from completeChallenge()
  const colorBlindness = challengeResults?.['color-blindness'] || challengeResults?.colorBlindness;
  const visualAcuity = challengeResults?.['visual-acuity'] || challengeResults?.visualAcuity;
  const motorSkills = challengeResults?.['motor-skills'] || challengeResults?.motorSkills;
  const knowledgeQuiz = challengeResults?.['knowledge-quiz'] || challengeResults?.knowledgeQuiz;

  // Vision loss from visual acuity (0.0 = no loss, 1.0 = total loss)
  // Stored directly as impairment level - higher = more impaired
  // Override to 1.0 if user failed ALL Ishihara plates (wrong for both normal and color-blind)
  // AND failed the first level of visual acuity (could not read even the largest letters)
  const failedAllIshihara = (colorBlindness?.normalVisionCount === 0 && colorBlindness?.colorBlindCount === 0)
    && (colorBlindness?.totalPlates ?? 0) > 0;
  const failedFirstAcuityLevel = visualAcuity?.finalLevel === 1
    && Array.isArray(visualAcuity?.attempts)
    && visualAcuity.attempts.filter(a => a.level === 1).every(a => !a.isCorrect);
  const severeVisionImpairment = failedAllIshihara && failedFirstAcuityLevel;
  const visionLoss = severeVisionImpairment ? 1.0 : (visualAcuity?.visionLoss ?? 0);

  // Color blindness impairment level (0-1)
  // Uses colorBlindnessScore = colorBlindCount / totalPlates (not 1 - colorVisionScore)
  // Higher = more color blind. Only actual color-blind pattern answers count.
  const colorBlindnessProb = colorBlindness?.colorBlindnessScore != null
    ? parseFloat(Number(colorBlindness.colorBlindnessScore).toFixed(2))
    : 0;

  // Inaccurate click from miss rate (0-1, higher = more impaired)
  const totalAttempts = motorSkills
    ? (motorSkills.totalHits || 0) + (motorSkills.totalMisses || 0)
    : 0;
  const hitRate = totalAttempts > 0
    ? (motorSkills.totalHits || 0) / totalAttempts
    : 1;
  const inaccurateClick = parseFloat((1 - hitRate).toFixed(2));

  // Literacy score as decimal (0.0 - 1.0) - higher = better literacy (not impairment)
  // Matches D:\New\sensecheck: use score if available, else correctAnswers/totalQuestions
  const literacyScore = typeof knowledgeQuiz?.score === 'number'
    ? knowledgeQuiz.score
    : knowledgeQuiz?.correctAnswers != null && knowledgeQuiz?.totalQuestions
      ? knowledgeQuiz.correctAnswers / knowledgeQuiz.totalQuestions
      : 0;
  
  // Average reaction time
  const avgReactionMs = Math.round(stats?.averageResponseTime || 0);
  
  // Build EXACT schema match
  return {
    user_id: userId,
    captured_at: new Date().toISOString(),
    impairment_probs: {
      vision: {
        vision_loss: parseFloat(visionLoss.toFixed(2)),
        color_blindness: colorBlindnessProb,
      },
      motor: {
        inaccurate_click: inaccurateClick,
      },
      literacy: parseFloat(literacyScore.toFixed(2)),
    },
    onboarding_metrics: {
      avg_reaction_ms: avgReactionMs,
      hit_rate: parseFloat(hitRate.toFixed(2)),
    },
    device_context: {
      os: deviceInfo?.os || 'unknown',
      browser: deviceInfo?.browser || 'unknown',
      screen_w: deviceInfo?.screenWidth || window.screen.width,
      screen_h: deviceInfo?.screenHeight || window.screen.height,
      dpr: deviceInfo?.devicePixelRatio || window.devicePixelRatio || 1,
    },
  };
};

/**
 * Build and save impairment profile to server
 */
export const buildAndSaveImpairmentProfile = async (params) => {
  const profile = buildImpairmentProfile(params);
  
  console.log('📊 Impairment Profile:', profile);
  
  // Save to AURA backend if enabled
  if (auraIntegration.isEnabled()) {
    try {
      // Save the profile data first
      const token = auraIntegration.getToken();
      const auraAPI = AURA_ONBOARDING_API_URL;
      
      const response = await fetch(`${auraAPI}/impairment-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save profile' }));
        throw new Error(error.error || 'Failed to save profile');
      }
      
      const result = await response.json();
      console.log('✅ Impairment profile saved to server:', result);
      
      // Then complete onboarding
      await auraIntegration.completeOnboarding();
      console.log('✅ Onboarding completed');
      
    } catch (error) {
      console.error('Failed to save impairment profile to AURA backend:', error);
      throw error;
    }
  }
  
  return profile;
};

export default { buildImpairmentProfile, buildAndSaveImpairmentProfile };

