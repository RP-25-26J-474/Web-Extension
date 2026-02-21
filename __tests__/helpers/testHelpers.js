/**
 * Test Helpers and Utilities
 * Shared functions for test suites
 */

/**
 * Generate mock click events
 * @param {number} count - Number of clicks to generate
 * @param {number} timeRange - Time range in ms
 * @param {object} area - Click area {x, y, width, height}
 * @returns {Array} Array of mock click events
 */
export function generateMockClicks(count, timeRange, area) {
  const clicks = [];
  const startTime = Date.now();
  
  for (let i = 0; i < count; i++) {
    clicks.push({
      timestamp: startTime + Math.random() * timeRange,
      x: area.x + Math.random() * area.width,
      y: area.y + Math.random() * area.height,
    });
  }
  
  return clicks.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Generate rage click pattern (3+ clicks in same area)
 * @returns {Array} Array of rage click events
 */
export function generateRageClicks() {
  const clicks = [];
  const startTime = Date.now();
  const x = 100;
  const y = 200;
  
  clicks.push({ timestamp: startTime, x, y });
  clicks.push({ timestamp: startTime + 300, x: x + 5, y: y + 5 });
  clicks.push({ timestamp: startTime + 600, x: x + 10, y: y + 10 });
  
  return clicks;
}

/**
 * Generate mouse down events matching clicks
 * @param {Array} clicks - Array of click events
 * @param {number} offset - Time offset before click (default 50ms)
 * @returns {Array} Array of mouse down events
 */
export function generateMouseDowns(clicks, offset = 50) {
  return clicks.map(click => ({
    timestamp: click.timestamp - offset,
    x: click.x + (Math.random() * 10 - 5),
    y: click.y + (Math.random() * 10 - 5),
  }));
}

/**
 * Generate mock pointer trace samples
 * @param {number} count - Number of samples
 * @param {object} start - Start position {x, y}
 * @param {object} end - End position {x, y}
 * @param {number} duration - Duration in ms
 * @returns {Array} Array of pointer samples
 */
export function generatePointerTrace(count, start, end, duration) {
  const samples = [];
  
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0 to 1
    samples.push({
      tms: t * duration,
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    });
  }
  
  return samples;
}

/**
 * Create mock storage for Chrome extension tests
 * @returns {object} Mock storage object
 */
export function createMockStorage() {
  const storage = {
    interactions: [],
    stats: {
      totalInteractions: 0,
      clicks: 0,
      keystrokes: 0,
      mouseMovements: 0,
      pageViews: 0,
      doubleClicks: 0,
      rightClicks: 0,
      mouseHovers: 0,
      dragAndDrop: 0,
      touchEvents: 0,
      zoomEvents: 0,
    },
    trackingEnabled: true,
    authToken: null,
    userId: null,
  };
  
  return {
    data: storage,
    get: jest.fn((keys) => {
      if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(key => {
          if (storage[key] !== undefined) {
            result[key] = storage[key];
          }
        });
        return Promise.resolve(result);
      }
      return Promise.resolve(storage);
    }),
    set: jest.fn((data) => {
      Object.assign(storage, data);
      return Promise.resolve();
    }),
    remove: jest.fn((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => delete storage[key]);
      return Promise.resolve();
    }),
  };
}

/**
 * Create mock fetch response
 * @param {boolean} ok - Response ok status
 * @param {object} data - Response data
 * @returns {object} Mock fetch response
 */
export function createMockFetchResponse(ok = true, data = {}) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait (default 0)
 * @returns {Promise}
 */
export function waitFor(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock aggregated batch
 * @param {object} overrides - Override default values
 * @returns {object} Mock aggregated batch
 */
export function createMockAggregatedBatch(overrides = {}) {
  return {
    user_id: 'test-user-123',
    batch_id: `b_${Date.now()}`,
    captured_at: new Date().toISOString(),
    page_context: {
      domain: 'test.com',
      route: '/page',
      app_type: 'web',
    },
    events_agg: {
      click_count: 10,
      misclick_rate: 0.05,
      avg_click_interval_ms: 500,
      avg_dwell_ms: 100,
      rage_clicks: 0,
      zoom_events: 1,
      scroll_speed_px_s: 200,
    },
    raw_samples_optional: [],
    _profiler: {
      sampling_hz: 30,
      input_lag_ms_est: 50,
    },
    ...overrides,
  };
}

/**
 * Create mock motor attempt data
 * @param {object} overrides - Override default values
 * @returns {object} Mock motor attempt
 */
export function createMockMotorAttempt(overrides = {}) {
  return {
    spawnTms: 0,
    clickTms: 500,
    hit: true,
    target: { x: 0.5, y: 0.5, radius: 0.05 },
    timing: {
      reactionTimeMs: 500,
      movementTimeMs: 400,
      interTapMs: null,
    },
    spatial: {
      errorDistNorm: 0.1,
      pathLengthNorm: 0.6,
      straightness: 0.85,
    },
    kinematics: {
      meanSpeed: 0.5,
      peakSpeed: 0.8,
      jerkRMS: 0.3,
      submovementCount: 1,
      overshootCount: 0,
    },
    fitts: {
      D: 0.5,
      W: 0.1,
      ID: 3.5,
      throughput: 17.5,
    },
    ...overrides,
  };
}

/**
 * Assert array approximately equal (for floating point comparisons)
 * @param {Array} actual - Actual array
 * @param {Array} expected - Expected array
 * @param {number} precision - Number of decimal places (default 2)
 */
export function expectArrayApproximatelyEqual(actual, expected, precision = 2) {
  expect(actual).toHaveLength(expected.length);
  
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index], precision);
  });
}

/**
 * Mock Chrome extension API
 * @returns {object} Mock chrome object
 */
export function createMockChromeAPI() {
  return {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
      },
    },
    runtime: {
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
      onMessage: {
        addListener: jest.fn(),
      },
      onInstalled: {
        addListener: jest.fn(),
      },
    },
    action: {
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn(),
    },
    tabs: {
      query: jest.fn().mockResolvedValue([]),
      sendMessage: jest.fn(),
      remove: jest.fn(),
      onRemoved: {
        addListener: jest.fn(),
      },
    },
  };
}

/**
 * Setup common test environment
 */
export function setupTestEnvironment() {
  // Mock timers
  jest.useFakeTimers();
  
  // Mock chrome API
  global.chrome = createMockChromeAPI();
  
  // Mock fetch
  global.fetch = jest.fn().mockResolvedValue(createMockFetchResponse());
  
  // Mock window properties
  global.window = {
    ...global.window,
    location: {
      href: 'http://test.com/page',
      hostname: 'test.com',
      pathname: '/page',
    },
    devicePixelRatio: 1,
    scrollY: 0,
  };
  
  return {
    cleanup: () => {
      jest.useRealTimers();
      jest.clearAllMocks();
    },
  };
}

/**
 * Calculate basic statistics for an array
 * @param {Array} values - Numeric array
 * @returns {object} Statistics object
 */
export function calculateStats(values) {
  if (!values || values.length === 0) {
    return { mean: 0, min: 0, max: 0, std: 0 };
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  const variance = values.reduce((sum, val) => {
    return sum + Math.pow(val - mean, 2);
  }, 0) / values.length;
  
  const std = Math.sqrt(variance);
  
  return { mean, min, max, std };
}

export default {
  generateMockClicks,
  generateRageClicks,
  generateMouseDowns,
  generatePointerTrace,
  createMockStorage,
  createMockFetchResponse,
  waitFor,
  createMockAggregatedBatch,
  createMockMotorAttempt,
  expectArrayApproximatelyEqual,
  createMockChromeAPI,
  setupTestEnvironment,
  calculateStats,
};


