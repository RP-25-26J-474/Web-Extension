/**
 * Color Blindness Analysis Utilities
 * Based on Ishihara plate interpretation
 */

// Ishihara plate definitions
export const ISHIHARA_PLATES = [
  {
    plateId: 1,
    imageName: 'ishihara_1.jpg',
    normalAnswer: '12',
    colorBlindAnswer: '12',
    description: 'Control plate - both normal and color blind can see 12',
  },
  {
    plateId: 2,
    imageName: 'ishihara_3.jpg',
    normalAnswer: '6',
    colorBlindAnswer: '5',
    description: 'Normal sees 6, red/green deficiency sees 5',
  },
  {
    plateId: 3,
    imageName: 'ishihara_11.jpg',
    normalAnswer: '6',
    colorBlindAnswer: 'nothing',
    description: 'Normal sees 6, red/green deficiency sees nothing',
  },
  {
    plateId: 4,
    imageName: 'ishihara_19.jpg',
    normalAnswer: 'nothing',
    colorBlindAnswer: '2',
    description: 'Normal sees nothing, red/green deficiency sees 2',
  },
];

/**
 * Analyze color blindness test results
 * @param {Array} plates - Array of plate response objects
 * @returns {object} Analysis results
 */
export const analyzeColorBlindness = (plates) => {
  if (!plates || plates.length === 0) {
    return {
      colorVisionScore: 0,
      diagnosis: 'Inconclusive',
      details: 'No test data available',
    };
  }

  let normalVisionCount = 0;
  let colorBlindCount = 0;
  let totalResponseTime = 0;

  plates.forEach((plate, index) => {
    const definition = ISHIHARA_PLATES[index];
    if (!definition) return;

    const userAnswer = String(plate.userAnswer).toLowerCase().trim();
    const normalAnswer = String(definition.normalAnswer).toLowerCase();
    const colorBlindAnswer = String(definition.colorBlindAnswer).toLowerCase();

    // Check which pattern the answer matches
    if (userAnswer === normalAnswer) {
      normalVisionCount++;
    } else if (userAnswer === colorBlindAnswer) {
      colorBlindCount++;
    }

    totalResponseTime += plate.responseTime || 0;
  });

  // Calculate score (0-100)
  const totalPlates = plates.length;
  const colorVisionScore = Math.round((normalVisionCount / totalPlates) * 100);
  console.log('totalPlates', totalPlates);
  console.log('colorVisionScore', colorVisionScore);
  console.log('normalVisionCount', normalVisionCount);
  console.log('colorBlindCount', colorBlindCount);
  console.log('totalResponseTime', totalResponseTime);

  // Determine diagnosis
  let diagnosis = 'Inconclusive';
  
  if (colorVisionScore >= 75) {
    diagnosis = 'Normal';
  } else if (colorBlindCount >= 2) {
    diagnosis = 'Suspected Red-Green Deficiency';
  }

  return {
    colorVisionScore,
    diagnosis,
    normalVisionCount,
    colorBlindCount,
    totalPlates,
    averageResponseTime: Math.round(totalResponseTime / totalPlates),
    details: `Answered ${normalVisionCount} plates correctly as normal vision, ${colorBlindCount} as color blind pattern.`,
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

