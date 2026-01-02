/**
 * Visual Acuity Calculation Utilities
 * Based on standard optometric formulas
 */

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

