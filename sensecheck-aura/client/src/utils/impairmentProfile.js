/**
 * Impairment Profile Builder
 * Builds profile matching EXACT research schema
 * 
 * NOTE: For AURA integration, this saves to the AURA backend.
 * Uses userId instead of sessionId.
 */

import auraIntegration from './auraIntegration';

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
  
  console.log('📊 Building impairment profile with:');
  console.log('  - Color Blindness:', colorBlindness);
  console.log('  - Visual Acuity:', visualAcuity);
  console.log('  - Motor Skills:', motorSkills);
  console.log('  - Knowledge Quiz:', knowledgeQuiz);
  
  // Vision loss from visual acuity (0.0 = no loss, 1.0 = total loss)
  const visionLoss = visualAcuity?.visionLoss ?? 0;
  
  // Color blindness from color vision score (inverted: 1.0 score = 0.0 blindness)
  const colorBlindnessProb = colorBlindness?.colorVisionScore != null
    ? parseFloat((1 - colorBlindness.colorVisionScore).toFixed(2))
    : 0;
  
  // Inaccurate click from miss rate
  const totalAttempts = motorSkills 
    ? (motorSkills.totalHits || 0) + (motorSkills.totalMisses || 0)
    : 0;
  const hitRate = totalAttempts > 0 
    ? (motorSkills.totalHits || 0) / totalAttempts
    : 1;
  const inaccurateClick = parseFloat((1 - hitRate).toFixed(2));
  
  // Literacy score as decimal (0.0 - 1.0)
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
      await auraIntegration.completeOnboarding();
      console.log('✅ Profile saved to AURA backend');
    } catch (error) {
      console.error('Failed to save to AURA backend:', error);
    }
  }
  
  return profile;
};

export default { buildImpairmentProfile, buildAndSaveImpairmentProfile };

