import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ML CSV Export Script
 * 
 * Generates a comprehensive CSV file for ML training from MongoDB data.
 * One row per session, with all motor skills features aggregated by round.
 */

// ============================================================================
// CSV HEADER DEFINITION
// ============================================================================

const CSV_HEADERS = [
  // Session identifiers
  'sessionId', 'userId',
  
  // Per-round configuration (speed in px/frame, spawnInterval in ms)
  'r1_speedPxPerFrame', 'r2_speedPxPerFrame', 'r3_speedPxPerFrame',
  'r1_spawnIntervalMs', 'r2_spawnIntervalMs', 'r3_spawnIntervalMs',
  
  // Device info
  'device_pointerPrimary', 'device_os', 'device_browser',
  'screen_width', 'screen_height', 'screen_dpr',
  'viewportWidth', 'viewportHeight',
  
  // Performance quality
  'perf_samplingHzTarget', 'perf_samplingHzEstimated', 
  'perf_avgFrameMs', 'perf_p95FrameMs', 
  'perf_droppedFrames', 'perf_inputLagMsEstimate',
  
  // Accessibility
  'highContrastMode', 'reducedMotionPreference',
  
  // Demographics
  'userInfo_ageBucket', 'userInfo_gender',
  
  // Round 1 metrics
  'r1_nTargets', 'r1_nHits', 'r1_nMisses', 'r1_hitRate',
  'r1_reactionTime_mean', 'r1_reactionTime_std', 'r1_reactionTime_median',
  'r1_movementTime_mean', 'r1_movementTime_std', 'r1_movementTime_median',
  'r1_interTap_mean', 'r1_interTap_std', 'r1_interTap_cv',
  'r1_errorDist_mean', 'r1_errorDist_std',
  'r1_pathLength_mean', 'r1_pathLength_std',
  'r1_straightness_mean', 'r1_straightness_std',
  'r1_meanSpeed_mean', 'r1_peakSpeed_mean', 'r1_speedVar_mean',
  'r1_meanAccel_mean', 'r1_peakAccel_mean',
  'r1_jerkRMS_mean', 'r1_jerkRMS_std',
  'r1_submovementCount_mean', 'r1_submovementCount_std',
  'r1_overshootCount_mean', 'r1_overshootCount_std',
  'r1_ID_mean', 'r1_throughput_mean', 'r1_throughput_std',
  
  // Round 2 metrics
  'r2_nTargets', 'r2_nHits', 'r2_nMisses', 'r2_hitRate',
  'r2_reactionTime_mean', 'r2_reactionTime_std', 'r2_reactionTime_median',
  'r2_movementTime_mean', 'r2_movementTime_std', 'r2_movementTime_median',
  'r2_interTap_mean', 'r2_interTap_std', 'r2_interTap_cv',
  'r2_errorDist_mean', 'r2_errorDist_std',
  'r2_pathLength_mean', 'r2_pathLength_std',
  'r2_straightness_mean', 'r2_straightness_std',
  'r2_meanSpeed_mean', 'r2_peakSpeed_mean', 'r2_speedVar_mean',
  'r2_meanAccel_mean', 'r2_peakAccel_mean',
  'r2_jerkRMS_mean', 'r2_jerkRMS_std',
  'r2_submovementCount_mean', 'r2_submovementCount_std',
  'r2_overshootCount_mean', 'r2_overshootCount_std',
  'r2_ID_mean', 'r2_throughput_mean', 'r2_throughput_std',
  
  // Round 3 metrics
  'r3_nTargets', 'r3_nHits', 'r3_nMisses', 'r3_hitRate',
  'r3_reactionTime_mean', 'r3_reactionTime_std', 'r3_reactionTime_median',
  'r3_movementTime_mean', 'r3_movementTime_std', 'r3_movementTime_median',
  'r3_interTap_mean', 'r3_interTap_std', 'r3_interTap_cv',
  'r3_errorDist_mean', 'r3_errorDist_std',
  'r3_pathLength_mean', 'r3_pathLength_std',
  'r3_straightness_mean', 'r3_straightness_std',
  'r3_meanSpeed_mean', 'r3_peakSpeed_mean', 'r3_speedVar_mean',
  'r3_meanAccel_mean', 'r3_peakAccel_mean',
  'r3_jerkRMS_mean', 'r3_jerkRMS_std',
  'r3_submovementCount_mean', 'r3_submovementCount_std',
  'r3_overshootCount_mean', 'r3_overshootCount_std',
  'r3_ID_mean', 'r3_throughput_mean', 'r3_throughput_std',
  
  // Delta metrics (cross-round changes)
  'delta_r2_minus_r1_hitRate', 'delta_r3_minus_r1_hitRate', 'delta_r3_minus_r2_hitRate',
  'delta_r2_minus_r1_reactionTime_mean', 'delta_r3_minus_r1_reactionTime_mean', 'delta_r3_minus_r2_reactionTime_mean',
  'delta_r2_minus_r1_movementTime_mean', 'delta_r3_minus_r1_movementTime_mean', 'delta_r3_minus_r2_movementTime_mean',
  'delta_r2_minus_r1_jerkRMS_mean', 'delta_r3_minus_r1_jerkRMS_mean', 'delta_r3_minus_r2_jerkRMS_mean',
  'delta_r2_minus_r1_throughput_mean', 'delta_r3_minus_r1_throughput_mean', 'delta_r3_minus_r2_throughput_mean',
];

// ============================================================================
// STATISTICAL HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate mean of an array
 */
function mean(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Calculate standard deviation
 */
function std(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (valid.length < 2) return null;
  const m = mean(valid);
  if (m === null) return null;
  const variance = valid.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / valid.length;
  return Math.sqrt(variance);
}

/**
 * Calculate median
 */
function median(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

/**
 * Calculate coefficient of variation (std / mean)
 */
function cv(arr) {
  const m = mean(arr);
  const s = std(arr);
  if (m === null || s === null || m === 0) return null;
  return s / m;
}

// ============================================================================
// USER AGENT PARSING (for legacy sessions without device.* fields)
// ============================================================================

/**
 * Parse OS from user agent string
 */
function parseOS(userAgent) {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('windows nt 10')) return 'Windows 10/11';
  if (ua.includes('windows nt 6.3')) return 'Windows 8.1';
  if (ua.includes('windows nt 6.2')) return 'Windows 8';
  if (ua.includes('windows nt 6.1')) return 'Windows 7';
  if (ua.includes('windows')) return 'Windows';
  
  if (ua.includes('mac os x')) {
    const match = ua.match(/mac os x (\d+[._]\d+)/);
    if (match) return `macOS ${match[1].replace('_', '.')}`;
    return 'macOS';
  }
  
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  if (ua.includes('android')) {
    const match = ua.match(/android (\d+(\.\d+)?)/);
    if (match) return `Android ${match[1]}`;
    return 'Android';
  }
  
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('cros')) return 'ChromeOS';
  
  return 'unknown';
}

/**
 * Parse browser from user agent string
 */
function parseBrowser(userAgent) {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  // Order matters - check more specific patterns first
  if (ua.includes('edg/')) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return match ? `Edge ${match[1]}` : 'Edge';
  }
  
  if (ua.includes('opr/') || ua.includes('opera')) {
    const match = userAgent.match(/OPR\/(\d+)/i);
    return match ? `Opera ${match[1]}` : 'Opera';
  }
  
  if (ua.includes('chrome') && !ua.includes('chromium')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }
  
  if (ua.includes('safari') && !ua.includes('chrome')) {
    const match = userAgent.match(/Version\/(\d+)/);
    return match ? `Safari ${match[1]}` : 'Safari';
  }
  
  if (ua.includes('firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/i);
    return match ? `Firefox ${match[1]}` : 'Firefox';
  }
  
  if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer';
  
  return 'unknown';
}

/**
 * Detect pointer type from device info (for legacy sessions)
 * 
 * NOTE: Browsers cannot distinguish mouse vs touchpad - both are fine pointers.
 * We default to 'mouse' for all desktop/laptop devices.
 * 
 * - 'mouse' = fine pointer device (mouse, touchpad, trackball)
 * - 'touch' = coarse pointer (touchscreen on mobile/tablet)
 */
function detectPointerType(session) {
  const deviceType = session.deviceType?.toLowerCase() || '';
  const ua = session.userAgent?.toLowerCase() || '';
  
  // Check device type first
  if (deviceType === 'mobile' || deviceType === 'tablet') return 'touch';
  
  // Check user agent for mobile indicators
  if (/mobile|tablet|ipad|android|iphone/i.test(ua)) return 'touch';
  
  // All desktop/laptop devices use fine pointers (mouse or touchpad)
  // We can't reliably distinguish between them, so use 'mouse' as the category
  return 'mouse';
}

/**
 * Compute age bucket from age
 */
function computeAgeBucket(age) {
  if (!age || age < 18) return 'unknown';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  if (age <= 64) return '55-64';
  return '65+';
}

// ============================================================================
// ROUND FEATURE EXTRACTION
// ============================================================================

/**
 * Compute all round-level metrics from attempts
 */
function computeRoundMetrics(attempts, roundNum) {
  const prefix = `r${roundNum}_`;
  
  // Filter attempts for this round
  const roundAttempts = attempts.filter(a => a.round === roundNum);
  
  if (roundAttempts.length === 0) {
    return createEmptyRoundMetrics(prefix);
  }
  
  // Separate hits and misses
  const hits = roundAttempts.filter(a => a.click?.hit === true);
  const misses = roundAttempts.filter(a => a.click?.hit === false);
  
  // Extract raw values for aggregation
  const reactionTimes = roundAttempts.map(a => a.timing?.reactionTimeMs).filter(v => v != null);
  const movementTimes = hits.map(a => a.timing?.movementTimeMs).filter(v => v != null);
  const interTaps = roundAttempts.map(a => a.timing?.interTapMs).filter(v => v != null);
  
  // Spatial (from hits only for accuracy metrics)
  const errorDists = hits.map(a => a.spatial?.errorDistNorm).filter(v => v != null);
  const pathLengths = hits.map(a => a.spatial?.pathLengthNorm).filter(v => v != null);
  const straightness = hits.map(a => a.spatial?.straightness).filter(v => v != null);
  
  // Kinematics (from hits)
  const meanSpeeds = hits.map(a => a.kinematics?.meanSpeed).filter(v => v != null);
  const peakSpeeds = hits.map(a => a.kinematics?.peakSpeed).filter(v => v != null);
  const speedVars = hits.map(a => a.kinematics?.speedVar).filter(v => v != null);
  const meanAccels = hits.map(a => a.kinematics?.meanAccel).filter(v => v != null);
  const peakAccels = hits.map(a => a.kinematics?.peakAccel).filter(v => v != null);
  const jerkRMSs = hits.map(a => a.kinematics?.jerkRMS).filter(v => v != null);
  const submovements = hits.map(a => a.kinematics?.submovementCount).filter(v => v != null);
  const overshoots = hits.map(a => a.kinematics?.overshootCount).filter(v => v != null);
  
  // Fitts (from hits)
  const IDs = hits.map(a => a.fitts?.ID).filter(v => v != null);
  const throughputs = hits.map(a => a.fitts?.throughput).filter(v => v != null);
  
  return {
    // Counts
    [`${prefix}nTargets`]: roundAttempts.length,
    [`${prefix}nHits`]: hits.length,
    [`${prefix}nMisses`]: misses.length,
    [`${prefix}hitRate`]: roundAttempts.length > 0 ? hits.length / roundAttempts.length : null,
    
    // Reaction time
    [`${prefix}reactionTime_mean`]: mean(reactionTimes),
    [`${prefix}reactionTime_std`]: std(reactionTimes),
    [`${prefix}reactionTime_median`]: median(reactionTimes),
    
    // Movement time
    [`${prefix}movementTime_mean`]: mean(movementTimes),
    [`${prefix}movementTime_std`]: std(movementTimes),
    [`${prefix}movementTime_median`]: median(movementTimes),
    
    // Inter-tap
    [`${prefix}interTap_mean`]: mean(interTaps),
    [`${prefix}interTap_std`]: std(interTaps),
    [`${prefix}interTap_cv`]: cv(interTaps),
    
    // Error distance
    [`${prefix}errorDist_mean`]: mean(errorDists),
    [`${prefix}errorDist_std`]: std(errorDists),
    
    // Path length
    [`${prefix}pathLength_mean`]: mean(pathLengths),
    [`${prefix}pathLength_std`]: std(pathLengths),
    
    // Straightness
    [`${prefix}straightness_mean`]: mean(straightness),
    [`${prefix}straightness_std`]: std(straightness),
    
    // Speed metrics
    [`${prefix}meanSpeed_mean`]: mean(meanSpeeds),
    [`${prefix}peakSpeed_mean`]: mean(peakSpeeds),
    [`${prefix}speedVar_mean`]: mean(speedVars),
    
    // Acceleration
    [`${prefix}meanAccel_mean`]: mean(meanAccels),
    [`${prefix}peakAccel_mean`]: mean(peakAccels),
    
    // Jerk
    [`${prefix}jerkRMS_mean`]: mean(jerkRMSs),
    [`${prefix}jerkRMS_std`]: std(jerkRMSs),
    
    // Submovements
    [`${prefix}submovementCount_mean`]: mean(submovements),
    [`${prefix}submovementCount_std`]: std(submovements),
    
    // Overshoots
    [`${prefix}overshootCount_mean`]: mean(overshoots),
    [`${prefix}overshootCount_std`]: std(overshoots),
    
    // Fitts
    [`${prefix}ID_mean`]: mean(IDs),
    [`${prefix}throughput_mean`]: mean(throughputs),
    [`${prefix}throughput_std`]: std(throughputs),
  };
}

/**
 * Create empty metrics for a round with no data
 */
function createEmptyRoundMetrics(prefix) {
  const metrics = {};
  
  const suffixes = [
    'nTargets', 'nHits', 'nMisses', 'hitRate',
    'reactionTime_mean', 'reactionTime_std', 'reactionTime_median',
    'movementTime_mean', 'movementTime_std', 'movementTime_median',
    'interTap_mean', 'interTap_std', 'interTap_cv',
    'errorDist_mean', 'errorDist_std',
    'pathLength_mean', 'pathLength_std',
    'straightness_mean', 'straightness_std',
    'meanSpeed_mean', 'peakSpeed_mean', 'speedVar_mean',
    'meanAccel_mean', 'peakAccel_mean',
    'jerkRMS_mean', 'jerkRMS_std',
    'submovementCount_mean', 'submovementCount_std',
    'overshootCount_mean', 'overshootCount_std',
    'ID_mean', 'throughput_mean', 'throughput_std',
  ];
  
  suffixes.forEach(suffix => {
    metrics[`${prefix}${suffix}`] = null;
  });
  
  return metrics;
}

// ============================================================================
// DELTA FEATURE COMPUTATION
// ============================================================================

/**
 * Compute cross-round delta metrics
 */
function computeDeltaMetrics(r1, r2, r3) {
  const delta = (a, b) => {
    if (a == null || b == null) return null;
    return b - a;
  };
  
  return {
    // Hit rate deltas
    delta_r2_minus_r1_hitRate: delta(r1.r1_hitRate, r2.r2_hitRate),
    delta_r3_minus_r1_hitRate: delta(r1.r1_hitRate, r3.r3_hitRate),
    delta_r3_minus_r2_hitRate: delta(r2.r2_hitRate, r3.r3_hitRate),
    
    // Reaction time deltas
    delta_r2_minus_r1_reactionTime_mean: delta(r1.r1_reactionTime_mean, r2.r2_reactionTime_mean),
    delta_r3_minus_r1_reactionTime_mean: delta(r1.r1_reactionTime_mean, r3.r3_reactionTime_mean),
    delta_r3_minus_r2_reactionTime_mean: delta(r2.r2_reactionTime_mean, r3.r3_reactionTime_mean),
    
    // Movement time deltas
    delta_r2_minus_r1_movementTime_mean: delta(r1.r1_movementTime_mean, r2.r2_movementTime_mean),
    delta_r3_minus_r1_movementTime_mean: delta(r1.r1_movementTime_mean, r3.r3_movementTime_mean),
    delta_r3_minus_r2_movementTime_mean: delta(r2.r2_movementTime_mean, r3.r3_movementTime_mean),
    
    // Jerk RMS deltas
    delta_r2_minus_r1_jerkRMS_mean: delta(r1.r1_jerkRMS_mean, r2.r2_jerkRMS_mean),
    delta_r3_minus_r1_jerkRMS_mean: delta(r1.r1_jerkRMS_mean, r3.r3_jerkRMS_mean),
    delta_r3_minus_r2_jerkRMS_mean: delta(r2.r2_jerkRMS_mean, r3.r3_jerkRMS_mean),
    
    // Throughput deltas
    delta_r2_minus_r1_throughput_mean: delta(r1.r1_throughput_mean, r2.r2_throughput_mean),
    delta_r3_minus_r1_throughput_mean: delta(r1.r1_throughput_mean, r3.r3_throughput_mean),
    delta_r3_minus_r2_throughput_mean: delta(r2.r2_throughput_mean, r3.r3_throughput_mean),
  };
}

// ============================================================================
// SESSION ROW BUILDER
// ============================================================================

/**
 * Build a complete CSV row for a session
 */
async function buildSessionRow(session) {
  const row = {};
  
  // 1. Session identifiers
  row.sessionId = session.sessionId;
  row.userId = session.userId || '';
  
  // Per-round game config (hardcoded from BUBBLE_PATTERNS in MotorSkillsGame.jsx)
  // Speed is in pixels per animation frame (at ~60fps)
  // SpawnInterval is in milliseconds between bubble spawns
  row.r1_speedPxPerFrame = 1.5;
  row.r2_speedPxPerFrame = 2.5;
  row.r3_speedPxPerFrame = 3.5;
  row.r1_spawnIntervalMs = 1200;
  row.r2_spawnIntervalMs = 900;
  row.r3_spawnIntervalMs = 700;
  
  // 3. Device info (with fallback parsing for legacy sessions)
  row.device_pointerPrimary = session.device?.pointerPrimary || detectPointerType(session);
  row.device_os = session.device?.os || parseOS(session.userAgent);
  row.device_browser = session.device?.browser || parseBrowser(session.userAgent);
  row.screen_width = session.screen?.width || session.screenResolution?.width || '';
  row.screen_height = session.screen?.height || session.screenResolution?.height || '';
  row.screen_dpr = session.screen?.dpr || session.devicePixelRatio || '';
  row.viewportWidth = session.viewportWidth || '';
  row.viewportHeight = session.viewportHeight || '';
  
  // 4. Performance quality (default values for sessions without perf data)
  // Note: perf.* fields are not currently collected by the client
  // These provide sensible defaults based on typical browser behavior
  row.perf_samplingHzTarget = session.perf?.samplingHzTarget || 60;  // Default target is 60Hz
  row.perf_samplingHzEstimated = session.perf?.samplingHzEstimated || '';
  row.perf_avgFrameMs = session.perf?.avgFrameMs || '';
  row.perf_p95FrameMs = session.perf?.p95FrameMs || '';
  row.perf_droppedFrames = session.perf?.droppedFrames || '';
  row.perf_inputLagMsEstimate = session.perf?.inputLagMsEstimate || '';
  
  // 5. Accessibility
  row.highContrastMode = session.highContrastMode != null ? session.highContrastMode : '';
  row.reducedMotionPreference = session.reducedMotionPreference != null ? session.reducedMotionPreference : '';
  
  // 6. Demographics (with fallback ageBucket computation)
  const ageBucket = session.userInfo?.ageBucket || computeAgeBucket(session.userInfo?.age);
  row.userInfo_ageBucket = ageBucket;
  row.userInfo_gender = session.userInfo?.gender || '';
  
  // 7. Get all attempts for this session
  const allAttempts = session._attempts || [];
  
  // 8. Compute round metrics
  const r1Metrics = computeRoundMetrics(allAttempts, 1);
  const r2Metrics = computeRoundMetrics(allAttempts, 2);
  const r3Metrics = computeRoundMetrics(allAttempts, 3);
  
  // Merge round metrics into row
  Object.assign(row, r1Metrics, r2Metrics, r3Metrics);
  
  // 9. Compute delta metrics
  const deltaMetrics = computeDeltaMetrics(r1Metrics, r2Metrics, r3Metrics);
  Object.assign(row, deltaMetrics);
  
  return row;
}

// ============================================================================
// DATABASE HELPERS (NO MODEL IMPORTS)
// ============================================================================

function buildUserIdQuery(userId) {
  const candidates = [userId];
  if (typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId)) {
    candidates.push(new ObjectId(userId));
  }
  return {
    $or: [
      { userId: { $in: candidates } },
      { user_id: { $in: candidates } },
    ],
  };
}

function buildSessionIdQuery(sessionId) {
  return {
    $or: [
      { sessionId: sessionId },
      { session_id: sessionId },
    ],
  };
}

async function loadAttemptsForSession(db, session) {
  const collection = db.collection('motorattemptbuckets');
  const sessionId = session.sessionId || session.session_id || '';
  const userId = session.userId || session.user_id || '';

  let buckets = [];
  if (sessionId) {
    buckets = await collection.find(buildSessionIdQuery(sessionId)).sort({ bucketNumber: 1 }).toArray();
  }

  if (buckets.length === 0 && userId) {
    buckets = await collection.find(buildUserIdQuery(userId)).sort({ bucketNumber: 1 }).toArray();
  }

  return buckets.flatMap(bucket => bucket.attempts || []);
}

// ============================================================================
// CSV FORMATTING
// ============================================================================

/**
 * Escape a CSV value
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format a row for CSV output
 */
function formatRow(row, headers) {
  return headers.map(header => {
    const value = row[header];
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      // Format numbers with reasonable precision
      if (Number.isInteger(value)) return String(value);
      return value.toFixed(6);
    }
    return escapeCSV(value);
  }).join(',');
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

async function exportMLCSV() {
  let client;
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(process.env.PROD_MONGO_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    // Get all sessions with motor data
    console.log('📋 Fetching sessions...');
    const db = client.db();
    const sessions = await db.collection('sessions').find({}).sort({ createdAt: -1 }).toArray();
    console.log(`   Found ${sessions.length} sessions\n`);
    
    if (sessions.length === 0) {
      console.log('❌ No sessions found in database');
      return;
    }
    
    // Filter sessions that have motor attempt data
    console.log('🔍 Filtering sessions with motor data...');
    const sessionsWithMotorData = [];
    
    for (const session of sessions) {
      const attempts = await loadAttemptsForSession(db, session);
      const totalAttempts = attempts.length;
      
      if (totalAttempts > 0) {
        sessionsWithMotorData.push({ ...session, _attempts: attempts });
      }
    }
    
    console.log(`   Found ${sessionsWithMotorData.length} sessions with motor data\n`);
    
    if (sessionsWithMotorData.length === 0) {
      console.log('❌ No sessions with motor data found');
      return;
    }
    
    // Build CSV rows
    console.log('📊 Building CSV rows...');
    const csvRows = [];
    
    for (let i = 0; i < sessionsWithMotorData.length; i++) {
      const session = sessionsWithMotorData[i];
      process.stdout.write(`   Processing session ${i + 1}/${sessionsWithMotorData.length}: ${session.sessionId}\r`);
      
      try {
        const row = await buildSessionRow(session);
        csvRows.push(row);
      } catch (err) {
        console.error(`\n⚠️ Error processing session ${session.sessionId}:`, err.message);
      }
    }
    
    console.log(`\n✅ Processed ${csvRows.length} sessions\n`);
    
    // Generate CSV content
    console.log('📝 Generating CSV...');
    const csvContent = [
      CSV_HEADERS.join(','),
      ...csvRows.map(row => formatRow(row, CSV_HEADERS))
    ].join('\n');
    
    // Write to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputPath = path.join(__dirname, `ml-export-${timestamp}.csv`);
    
    fs.writeFileSync(outputPath, csvContent, 'utf8');
    
    console.log(`✅ CSV exported successfully!`);
    console.log(`📁 Output: ${outputPath}`);
    console.log(`📊 Rows: ${csvRows.length}`);
    console.log(`📋 Columns: ${CSV_HEADERS.length}`);
    
    // Print summary statistics
    console.log('\n📈 EXPORT SUMMARY:');
    console.log('='.repeat(60));
    
    // Count sessions by round completion
    const completionStats = { r1: 0, r2: 0, r3: 0 };
    csvRows.forEach(row => {
      if (row.r1_nTargets > 0) completionStats.r1++;
      if (row.r2_nTargets > 0) completionStats.r2++;
      if (row.r3_nTargets > 0) completionStats.r3++;
    });
    
    console.log(`   Sessions with Round 1 data: ${completionStats.r1}`);
    console.log(`   Sessions with Round 2 data: ${completionStats.r2}`);
    console.log(`   Sessions with Round 3 data: ${completionStats.r3}`);
    
    // Average hit rates
    const avgHitRates = {
      r1: mean(csvRows.map(r => r.r1_hitRate)),
      r2: mean(csvRows.map(r => r.r2_hitRate)),
      r3: mean(csvRows.map(r => r.r3_hitRate)),
    };
    
    if (avgHitRates.r1 !== null) {
      console.log(`\n   Average Hit Rates:`);
      console.log(`      Round 1: ${(avgHitRates.r1 * 100).toFixed(1)}%`);
      console.log(`      Round 2: ${(avgHitRates.r2 * 100).toFixed(1)}%`);
      console.log(`      Round 3: ${(avgHitRates.r3 * 100).toFixed(1)}%`);
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    console.error(error.stack);
  } finally {
    if (client) {
      await client.close();
    }
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// ============================================================================
// CLI SUPPORT
// ============================================================================

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
ML CSV Export Script
====================

Generates a comprehensive CSV file for ML training from MongoDB motor skills data.

Usage:
  node export-ml-csv.js [options]

Options:
  --help, -h     Show this help message

Output:
  Creates a timestamped CSV file in the server directory:
  ml-export-YYYY-MM-DDTHH-MM-SS.csv

CSV Structure:
  - One row per session
  - ${CSV_HEADERS.length} columns total
  - Session metadata + game config + device info
  - Per-round metrics (r1_, r2_, r3_)
  - Delta metrics (cross-round changes)

Environment:
  Requires PROD_MONGO_URI in .env file
`);
  process.exit(0);
}

// Run export
exportMLCSV();

