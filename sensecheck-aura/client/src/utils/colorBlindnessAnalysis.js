/**
 * Color Blindness Analysis Utilities
 * Based on Ishihara plate interpretation
 */

// Ishihara plate definitions
export const ISHIHARA_PLATES = [
  {
    plateId: 1,
    imageName: 'Ishihara_1.jpg',
    normalAnswer: '12',
    colorBlindAnswer: '12',
    description: 'Control plate - both normal and color blind can see 12',
  },
  {
    plateId: 2,
    imageName: 'Ishihara_3.jpg',
    normalAnswer: '6',
    colorBlindAnswer: '5',
    description: 'Normal sees 6, red/green deficiency sees 5',
  },
  {
    plateId: 3,
    imageName: 'Ishihara_11.jpg',
    normalAnswer: '6',
    colorBlindAnswer: 'nothing',
    description: 'Normal sees 6, red/green deficiency sees nothing',
  },
  {
    plateId: 4,
    imageName: 'Ishihara_19.jpg',
    normalAnswer: 'nothing',
    colorBlindAnswer: '2',
    description: 'Normal sees nothing, red/green deficiency sees 2',
  },
];

const CONTROL_PLATE_ID = 1;
const MIN_COLOR_BLIND_MATCHES = 2;
const COLOR_BLIND_RATIO_THRESHOLD = 0.75;

const normalizeAnswer = (answer) => String(answer ?? '').toLowerCase().trim();

const getPlateDefinition = (plate, index) => {
  if (plate?.plateId != null) {
    const byId = ISHIHARA_PLATES.find(candidate => candidate.plateId === Number(plate.plateId));
    if (byId) {
      return byId;
    }
  }

  return ISHIHARA_PLATES[index] || null;
};

export const summarizeColorBlindnessResponses = (plates) => {
  const summary = {
    controlPlateCorrect: false,
    normalVisionCount: 0,
    colorBlindCount: 0,
    anomalyCount: 0,
    diagnosticPlateCount: 0,
    totalResponseTime: 0,
  };

  if (!Array.isArray(plates) || plates.length === 0) {
    return summary;
  }

  plates.forEach((plate, index) => {
    const definition = getPlateDefinition(plate, index);
    if (!definition) return;

    const userAnswer = normalizeAnswer(plate.userAnswer);
    const normalAnswer = normalizeAnswer(definition.normalAnswer);
    const colorBlindAnswer = normalizeAnswer(definition.colorBlindAnswer);
    const isControlPlate = definition.plateId === CONTROL_PLATE_ID;

    if (isControlPlate) {
      summary.controlPlateCorrect = userAnswer === normalAnswer;
    } else {
      summary.diagnosticPlateCount += 1;

      if (userAnswer === normalAnswer) {
        summary.normalVisionCount += 1;
      } else if (userAnswer === colorBlindAnswer) {
        summary.colorBlindCount += 1;
      } else {
        summary.anomalyCount += 1;
      }
    }

    summary.totalResponseTime += plate.responseTime || 0;
  });

  return summary;
};

export const getBinaryColorBlindnessScore = (summary) => {
  if (!summary?.controlPlateCorrect || !summary?.diagnosticPlateCount) {
    return 0;
  }

  const colorBlindRatio = summary.colorBlindCount / summary.diagnosticPlateCount;
  return (
    summary.colorBlindCount >= MIN_COLOR_BLIND_MATCHES
    || colorBlindRatio > COLOR_BLIND_RATIO_THRESHOLD
  ) ? 1 : 0;
};

/**
 * Analyze color blindness test results
 * @param {Array} plates - Array of plate response objects
 * @returns {object} Analysis results
 */
export const analyzeColorBlindness = (plates) => {
  if (!plates || plates.length === 0) {
    return {
      colorVisionScore: 0,
      colorBlindnessScore: 0,
      diagnosis: 'Inconclusive',
      details: 'No test data available',
    };
  }

  const summary = summarizeColorBlindnessResponses(plates);
  const {
    controlPlateCorrect,
    normalVisionCount,
    colorBlindCount,
    anomalyCount,
    diagnosticPlateCount,
    totalResponseTime,
  } = summary;

  const colorVisionScore = diagnosticPlateCount > 0
    ? Math.round((normalVisionCount / diagnosticPlateCount) * 100)
    : 0;
  const colorBlindnessScore = getBinaryColorBlindnessScore(summary);

  // Determine diagnosis
  let diagnosis = 'Inconclusive';
  if (!controlPlateCorrect) {
    diagnosis = 'Inconclusive';
  } else if (colorBlindnessScore === 1) {
    diagnosis = 'Suspected Red-Green Deficiency';
  } else if (anomalyCount === 0) {
    diagnosis = 'Normal';
  }

  return {
    colorVisionScore,
    colorBlindnessScore,
    diagnosis,
    normalVisionCount,
    colorBlindCount,
    anomalyCount,
    controlPlateCorrect,
    totalPlates: plates.length,
    diagnosticPlateCount,
    averageResponseTime: plates.length > 0 ? Math.round(totalResponseTime / plates.length) : 0,
    details: controlPlateCorrect
      ? `Control plate passed. Diagnostic plates: ${normalVisionCount} normal, ${colorBlindCount} color-blind pattern, ${anomalyCount} anomalous. Binary score: ${colorBlindnessScore}.`
      : `Control plate failed. Diagnostic plates: ${normalVisionCount} normal, ${colorBlindCount} color-blind pattern, ${anomalyCount} anomalous. Binary score forced to 0.`,
  };
};

/**
 * Check if an answer is correct for normal vision
 * @param {number} plateId - Plate identifier
 * @param {string} userAnswer - User's answer
 * @returns {boolean} True if correct for normal vision
 */
export const isNormalVisionAnswer = (plateId, userAnswer) => {
  const plate = ISHIHARA_PLATES.find(p => p.plateId === plateId);
  if (!plate) return false;
  
  return String(userAnswer).toLowerCase().trim() === String(plate.normalAnswer).toLowerCase();
};

/**
 * Check if an answer matches color blind pattern
 * @param {number} plateId - Plate identifier
 * @param {string} userAnswer - User's answer
 * @returns {boolean} True if matches color blind pattern
 */
export const isColorBlindAnswer = (plateId, userAnswer) => {
  const plate = ISHIHARA_PLATES.find(p => p.plateId === plateId);
  if (!plate) return false;
  
  return String(userAnswer).toLowerCase().trim() === String(plate.colorBlindAnswer).toLowerCase();
};

