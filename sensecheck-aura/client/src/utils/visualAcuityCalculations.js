/**
 * Visual Acuity Calculation Utilities
 * Based on standard optometric formulas
 * 
 * IMPORTANT: All calculations assume 50cm viewing distance (arm's length)
 * This is the standard for near vision testing on screens.
 */

// Standard viewing distance for screen-based vision test (arm's length)
export const STANDARD_VIEWING_DISTANCE_CM = 50;

/**
 * Calculate visual acuity based on resolved size vs 20/20 threshold
 * This is the PRIMARY method for screen-based vision testing
 * 
 * @param {number} resolvedSize - Smallest size the user could resolve (pixels)
 * @param {number} twentyTwentyThreshold - 20/20 threshold for this screen (pixels)
 * @returns {object} Visual acuity metrics
 */
export const calculateVisualAcuityFromThreshold = (resolvedSize, twentyTwentyThreshold) => {
  if (!resolvedSize || resolvedSize <= 0) {
    return {
      visualAcuityDecimal: 0,
      visionLoss: 1.0,
      snellenDenominator: 400,
      snellenEstimate: '20/400',
    };
  }
  
  if (!twentyTwentyThreshold || twentyTwentyThreshold <= 0) {
    twentyTwentyThreshold = 12; // Fallback default
  }
  
  // Visual acuity = threshold / resolvedSize
  // If resolved = threshold (e.g., 12px), acuity = 1.0 (20/20)
  // If resolved = 2x threshold (e.g., 24px), acuity = 0.5 (20/40) - worse vision
  // If resolved = 0.5x threshold (e.g., 6px), acuity = 2.0 (20/10) - better vision
  const visualAcuityDecimal = Math.round((twentyTwentyThreshold / resolvedSize) * 100) / 100;
  
  // Snellen denominator: 20 / acuity
  // acuity 1.0 = 20/20, acuity 0.5 = 20/40
  const snellenDenominator = Math.round(20 / Math.max(0.05, visualAcuityDecimal));
  const clampedDenominator = Math.max(10, Math.min(400, snellenDenominator));
  
  // Vision loss: how much worse than 20/20
  // acuity >= 1.0 = no loss (0.0)
  // acuity 0.5 = 50% loss (0.5)
  const visionLoss = visualAcuityDecimal >= 1.0 
    ? 0.0 
    : Math.round(Math.max(0, Math.min(1, 1 - visualAcuityDecimal)) * 100) / 100;
  
  return {
    visualAcuityDecimal: Math.min(2.0, visualAcuityDecimal), // Cap at 2.0 (20/10)
    visionLoss,
    snellenDenominator: clampedDenominator,
    snellenEstimate: `20/${clampedDenominator}`,
  };
};

/**
 * Get vision category based on WHO/ICD-11 classification
 * @param {number} visualAcuityDecimal - Visual acuity decimal
 * @returns {object} Vision category with name and description
 */
export const getVisionCategory = (visualAcuityDecimal) => {
  if (visualAcuityDecimal >= 1.0) {
    return {
      category: 'normal',
      name: 'Normal Vision',
      snellenRange: '20/20 or better',
      description: 'No visual impairment'
    };
  } else if (visualAcuityDecimal >= 0.5) {
    return {
      category: 'mild',
      name: 'Mild Vision Loss',
      snellenRange: '20/25 to 20/40',
      description: 'Mild visual impairment - may need corrective lenses'
    };
  } else if (visualAcuityDecimal >= 0.3) {
    return {
      category: 'moderate',
      name: 'Moderate Vision Loss',
      snellenRange: '20/50 to 20/70',
      description: 'Moderate visual impairment'
    };
  } else if (visualAcuityDecimal >= 0.1) {
    return {
      category: 'severe',
      name: 'Severe Vision Loss',
      snellenRange: '20/100 to 20/200',
      description: 'Severe visual impairment'
    };
  } else {
    return {
      category: 'profound',
      name: 'Profound Vision Loss',
      snellenRange: 'Worse than 20/200',
      description: 'Profound visual impairment - legal blindness threshold'
    };
  }
};

/**
 * Calculate visual angle in degrees
 * @param {number} objectSize - Size of the object in pixels
 * @param {number} viewingDistance - Distance from screen in cm
 * @param {number} pixelsPerCm - Pixels per cm (calculated from screen DPI)
 * @returns {number} Visual angle in degrees
 */
export const calculateVisualAngle = (objectSize, viewingDistance = 50, pixelsPerCm = 37.8) => {
  // Convert pixels to cm
  const objectSizeCm = objectSize / pixelsPerCm;
  
  // Calculate visual angle in radians
  const angleRadians = 2 * Math.atan(objectSizeCm / (2 * viewingDistance));
  
  // Convert to degrees
  const angleDegrees = angleRadians * (180 / Math.PI);
  
  return angleDegrees;
};

/**
 * Calculate Minimum Angle of Resolution (MAR)
 * @param {number} visualAngle - Visual angle in degrees
 * @returns {number} MAR in arc minutes
 */
export const calculateMAR = (visualAngle) => {
  // Convert degrees to arc minutes (1 degree = 60 arc minutes)
  return visualAngle * 60;
};

/**
 * Calculate Snellen denominator from MAR
 * @param {number} mar - Minimum Angle of Resolution in arc minutes
 * @returns {number} Snellen denominator
 */
export const calculateSnellenDenominator = (mar) => {
  // Standard: 20/20 vision = 1 arc minute
  // Denominator = 20 * MAR
  return Math.round(20 * mar);
};

/**
 * Convert Snellen denominator to Snellen notation
 * @param {number} denominator - Snellen denominator
 * @returns {string} Snellen notation (e.g., "20/40")
 */
export const getSnellenNotation = (denominator) => {
  // Clamp to reasonable values
  const clampedDenominator = Math.max(10, Math.min(400, denominator));
  return `20/${clampedDenominator}`;
};

/**
 * Calculate all visual acuity metrics
 * @param {number} objectSize - Size in pixels
 * @param {number} viewingDistance - Distance in cm (default 50cm)
 * @param {number} screenPPI - Screen pixels per inch (default 96)
 * @returns {object} Object containing all metrics
 */
export const calculateVisualAcuityMetrics = (
  objectSize, 
  viewingDistance = 50, 
  screenPPI = 96
) => {
  // Calculate pixels per cm from PPI
  const pixelsPerCm = screenPPI / 2.54;
  
  // Calculate visual angle
  const visualAngle = calculateVisualAngle(objectSize, viewingDistance, pixelsPerCm);
  
  // Calculate MAR
  const mar = calculateMAR(visualAngle);
  
  // Calculate Snellen denominator
  const snellenDenominator = calculateSnellenDenominator(mar);
  
  // Get Snellen notation
  const snellenEstimate = getSnellenNotation(snellenDenominator);
  
  return {
    objectSize,
    viewingDistance,
    visualAngle: visualAngle.toFixed(4),
    mar: mar.toFixed(2),
    snellenDenominator,
    snellenEstimate,
  };
};

/**
 * Estimate screen PPI if not provided
 * @param {number} screenWidth - Screen width in pixels
 * @param {number} screenHeight - Screen height in pixels
 * @returns {number} Estimated PPI
 */
export const estimateScreenPPI = (screenWidth, screenHeight) => {
  // Assume standard desktop monitor diagonal of 24 inches
  // This is a rough estimate; for accurate results, users should measure
  const diagonalPixels = Math.sqrt(screenWidth ** 2 + screenHeight ** 2);
  const assumedDiagonalInches = 24;
  return Math.round(diagonalPixels / assumedDiagonalInches);
};

/**
 * Get viewing distance prompt
 * @returns {number} Viewing distance in cm (can be enhanced to prompt user)
 */
export const getViewingDistance = () => {
  // Default comfortable viewing distance for desktop
  // Could be enhanced to detect device type or prompt user
  return 50; // cm
};

