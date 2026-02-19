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

function mean(arr) {
  const valid = arr.filter(v => v != null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function std(arr) {
  const valid = arr.filter(v => v != null && !Number.isNaN(v));
  if (valid.length < 2) return null;
  const m = mean(valid);
  if (m === null) return null;
  const variance = valid.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / valid.length;
  return Math.sqrt(variance);
}

function median(arr) {
  const valid = arr.filter(v => v != null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function cv(arr) {
  const m = mean(arr);
  const s = std(arr);
  if (m === null || s === null || m === 0) return null;
  return s / m;
}

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

function parseBrowser(userAgent) {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
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

function detectPointerType(session) {
  const deviceType = session?.deviceType?.toLowerCase() || '';
  const ua = session?.userAgent?.toLowerCase() || '';
  
  if (deviceType === 'mobile' || deviceType === 'tablet') return 'touch';
  if (/mobile|tablet|ipad|android|iphone/i.test(ua)) return 'touch';
  
  return 'mouse';
}

function computeAgeBucket(age) {
  if (!age || age < 18) return 'unknown';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  if (age <= 64) return '55-64';
  return '65+';
}

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

function computeRoundMetrics(attempts, roundNum) {
  const prefix = `r${roundNum}_`;
  const roundAttempts = attempts.filter(a => a.round === roundNum);
  
  if (roundAttempts.length === 0) {
    return createEmptyRoundMetrics(prefix);
  }
  
  const hits = roundAttempts.filter(a => a.click?.hit === true);
  const misses = roundAttempts.filter(a => a.click?.hit === false);
  
  const reactionTimes = roundAttempts.map(a => a.timing?.reactionTimeMs).filter(v => v != null);
  const movementTimes = hits.map(a => a.timing?.movementTimeMs).filter(v => v != null);
  const interTaps = roundAttempts.map(a => a.timing?.interTapMs).filter(v => v != null);
  
  const errorDists = hits.map(a => a.spatial?.errorDistNorm).filter(v => v != null);
  const pathLengths = hits.map(a => a.spatial?.pathLengthNorm).filter(v => v != null);
  const straightness = hits.map(a => a.spatial?.straightness).filter(v => v != null);
  
  const meanSpeeds = hits.map(a => a.kinematics?.meanSpeed).filter(v => v != null);
  const peakSpeeds = hits.map(a => a.kinematics?.peakSpeed).filter(v => v != null);
  const speedVars = hits.map(a => a.kinematics?.speedVar).filter(v => v != null);
  const meanAccels = hits.map(a => a.kinematics?.meanAccel).filter(v => v != null);
  const peakAccels = hits.map(a => a.kinematics?.peakAccel).filter(v => v != null);
  const jerkRMSs = hits.map(a => a.kinematics?.jerkRMS).filter(v => v != null);
  const submovements = hits.map(a => a.kinematics?.submovementCount).filter(v => v != null);
  const overshoots = hits.map(a => a.kinematics?.overshootCount).filter(v => v != null);
  
  const IDs = hits.map(a => a.fitts?.ID).filter(v => v != null);
  const throughputs = hits.map(a => a.fitts?.throughput).filter(v => v != null);
  
  return {
    [`${prefix}nTargets`]: roundAttempts.length,
    [`${prefix}nHits`]: hits.length,
    [`${prefix}nMisses`]: misses.length,
    [`${prefix}hitRate`]: roundAttempts.length > 0 ? hits.length / roundAttempts.length : null,
    
    [`${prefix}reactionTime_mean`]: mean(reactionTimes),
    [`${prefix}reactionTime_std`]: std(reactionTimes),
    [`${prefix}reactionTime_median`]: median(reactionTimes),
    
    [`${prefix}movementTime_mean`]: mean(movementTimes),
    [`${prefix}movementTime_std`]: std(movementTimes),
    [`${prefix}movementTime_median`]: median(movementTimes),
    
    [`${prefix}interTap_mean`]: mean(interTaps),
    [`${prefix}interTap_std`]: std(interTaps),
    [`${prefix}interTap_cv`]: cv(interTaps),
    
    [`${prefix}errorDist_mean`]: mean(errorDists),
    [`${prefix}errorDist_std`]: std(errorDists),
    
    [`${prefix}pathLength_mean`]: mean(pathLengths),
    [`${prefix}pathLength_std`]: std(pathLengths),
    
    [`${prefix}straightness_mean`]: mean(straightness),
    [`${prefix}straightness_std`]: std(straightness),
    
    [`${prefix}meanSpeed_mean`]: mean(meanSpeeds),
    [`${prefix}peakSpeed_mean`]: mean(peakSpeeds),
    [`${prefix}speedVar_mean`]: mean(speedVars),
    
    [`${prefix}meanAccel_mean`]: mean(meanAccels),
    [`${prefix}peakAccel_mean`]: mean(peakAccels),
    
    [`${prefix}jerkRMS_mean`]: mean(jerkRMSs),
    [`${prefix}jerkRMS_std`]: std(jerkRMSs),
    
    [`${prefix}submovementCount_mean`]: mean(submovements),
    [`${prefix}submovementCount_std`]: std(submovements),
    
    [`${prefix}overshootCount_mean`]: mean(overshoots),
    [`${prefix}overshootCount_std`]: std(overshoots),
    
    [`${prefix}ID_mean`]: mean(IDs),
    [`${prefix}throughput_mean`]: mean(throughputs),
    [`${prefix}throughput_std`]: std(throughputs),
  };
}

function computeDeltaMetrics(r1, r2, r3) {
  const delta = (a, b) => {
    if (a == null || b == null) return null;
    return b - a;
  };
  
  return {
    delta_r2_minus_r1_hitRate: delta(r1.r1_hitRate, r2.r2_hitRate),
    delta_r3_minus_r1_hitRate: delta(r1.r1_hitRate, r3.r3_hitRate),
    delta_r3_minus_r2_hitRate: delta(r2.r2_hitRate, r3.r3_hitRate),
    
    delta_r2_minus_r1_reactionTime_mean: delta(r1.r1_reactionTime_mean, r2.r2_reactionTime_mean),
    delta_r3_minus_r1_reactionTime_mean: delta(r1.r1_reactionTime_mean, r3.r3_reactionTime_mean),
    delta_r3_minus_r2_reactionTime_mean: delta(r2.r2_reactionTime_mean, r3.r3_reactionTime_mean),
    
    delta_r2_minus_r1_movementTime_mean: delta(r1.r1_movementTime_mean, r2.r2_movementTime_mean),
    delta_r3_minus_r1_movementTime_mean: delta(r1.r1_movementTime_mean, r3.r3_movementTime_mean),
    delta_r3_minus_r2_movementTime_mean: delta(r2.r2_movementTime_mean, r3.r3_movementTime_mean),
    
    delta_r2_minus_r1_jerkRMS_mean: delta(r1.r1_jerkRMS_mean, r2.r2_jerkRMS_mean),
    delta_r3_minus_r1_jerkRMS_mean: delta(r1.r1_jerkRMS_mean, r3.r3_jerkRMS_mean),
    delta_r3_minus_r2_jerkRMS_mean: delta(r2.r2_jerkRMS_mean, r3.r3_jerkRMS_mean),
    
    delta_r2_minus_r1_throughput_mean: delta(r1.r1_throughput_mean, r2.r2_throughput_mean),
    delta_r3_minus_r1_throughput_mean: delta(r1.r1_throughput_mean, r3.r3_throughput_mean),
    delta_r3_minus_r2_throughput_mean: delta(r2.r2_throughput_mean, r3.r3_throughput_mean),
  };
}

function buildMotorFeatureRow({ session, user, attempts }) {
  const row = {};
  const sessionId = session?.sessionId || session?.session_id || session?._id || session?.userId || '';
  const userId = session?.userId || session?.user_id || user?._id || '';
  
  row.sessionId = String(sessionId || '');
  row.userId = String(userId || '');
  
  row.r1_speedPxPerFrame = 1.5;
  row.r2_speedPxPerFrame = 2.5;
  row.r3_speedPxPerFrame = 3.5;
  row.r1_spawnIntervalMs = 1200;
  row.r2_spawnIntervalMs = 900;
  row.r3_spawnIntervalMs = 700;
  
  const device = session?.device || {};
  const screen = session?.screen || {};
  const userAgent = device.userAgent || session?.userAgent || '';
  
  row.device_pointerPrimary = device.pointerPrimary || detectPointerType(session);
  row.device_os = device.os || parseOS(userAgent);
  row.device_browser = device.browser || parseBrowser(userAgent);
  row.screen_width = screen.width ?? session?.screenResolution?.width ?? null;
  row.screen_height = screen.height ?? session?.screenResolution?.height ?? null;
  row.screen_dpr = screen.dpr ?? session?.devicePixelRatio ?? null;
  row.viewportWidth = session?.viewportWidth ?? null;
  row.viewportHeight = session?.viewportHeight ?? null;
  
  const perf = session?.perf || {};
  row.perf_samplingHzTarget = perf.samplingHzTarget ?? 60;
  row.perf_samplingHzEstimated = perf.samplingHzEstimated ?? null;
  row.perf_avgFrameMs = perf.avgFrameMs ?? null;
  row.perf_p95FrameMs = perf.p95FrameMs ?? null;
  row.perf_droppedFrames = perf.droppedFrames ?? null;
  row.perf_inputLagMsEstimate = perf.inputLagMsEstimate ?? null;
  
  row.highContrastMode = session?.highContrastMode ?? null;
  row.reducedMotionPreference = session?.reducedMotionPreference ?? null;
  
  const ageBucket = session?.userInfo?.ageBucket || computeAgeBucket(user?.age || session?.userInfo?.age);
  row.userInfo_ageBucket = ageBucket || null;
  row.userInfo_gender = user?.gender || session?.userInfo?.gender || null;
  
  const allAttempts = attempts || session?._attempts || [];
  const r1Metrics = computeRoundMetrics(allAttempts, 1);
  const r2Metrics = computeRoundMetrics(allAttempts, 2);
  const r3Metrics = computeRoundMetrics(allAttempts, 3);
  
  Object.assign(row, r1Metrics, r2Metrics, r3Metrics);
  Object.assign(row, computeDeltaMetrics(r1Metrics, r2Metrics, r3Metrics));
  
  return row;
}

module.exports = {
  CSV_HEADERS,
  buildMotorFeatureRow,
  computeRoundMetrics,
  computeDeltaMetrics,
  computeAgeBucket,
};
