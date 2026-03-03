/**
 * Test Suite for Interaction Aggregation System
 * 
 * Run this in Node.js to verify the aggregation logic works correctly.
 * 
 * Usage:
 *   node test-aggregation.js
 */

// Mock data generator
function generateMockClicks(count, timeRange, area) {
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

function generateRageClicks() {
  const clicks = [];
  const startTime = Date.now();
  const x = 100;
  const y = 200;
  
  // 3 clicks in same spot within 1 second
  clicks.push({ timestamp: startTime, x, y });
  clicks.push({ timestamp: startTime + 300, x: x + 5, y: y + 5 });
  clicks.push({ timestamp: startTime + 600, x: x + 10, y: y + 10 });
  
  return clicks;
}

function generateMouseDowns(clicks) {
  return clicks.map(click => ({
    timestamp: click.timestamp - 50, // Mouse down 50ms before click
    x: click.x + Math.random() * 10 - 5,
    y: click.y + Math.random() * 10 - 5,
  }));
}

// Aggregation functions (copied from aggregator)
function calculateClickIntervals(clicks) {
  if (clicks.length < 2) return [];
  const intervals = [];
  for (let i = 1; i < clicks.length; i++) {
    intervals.push(clicks[i].timestamp - clicks[i - 1].timestamp);
  }
  return intervals;
}

function detectMisclicks(clicks, mouseDownEvents) {
  let misclickCount = 0;
  const POSITION_THRESHOLD = 20;
  const TIME_THRESHOLD = 500;
  
  for (const click of clicks) {
    const hasMatchingMouseDown = mouseDownEvents.some(md => {
      const dx = Math.abs(md.x - click.x);
      const dy = Math.abs(md.y - click.y);
      const dt = Math.abs(md.timestamp - click.timestamp);
      return dx < POSITION_THRESHOLD && dy < POSITION_THRESHOLD && dt < TIME_THRESHOLD;
    });
    
    if (!hasMatchingMouseDown) {
      misclickCount++;
    }
  }
  
  return misclickCount;
}

function detectRageClicks(clicks) {
  let rageClickCount = 0;
  const POSITION_THRESHOLD = 30;
  const TIME_WINDOW = 1000;
  
  for (let i = 0; i < clicks.length - 2; i++) {
    const click1 = clicks[i];
    const click2 = clicks[i + 1];
    const click3 = clicks[i + 2];
    
    const dt12 = click2.timestamp - click1.timestamp;
    const dt23 = click3.timestamp - click2.timestamp;
    
    if (dt12 + dt23 <= TIME_WINDOW) {
      const dx12 = Math.abs(click2.x - click1.x);
      const dy12 = Math.abs(click2.y - click1.y);
      const dx23 = Math.abs(click3.x - click2.x);
      const dy23 = Math.abs(click3.y - click2.y);
      
      if (dx12 < POSITION_THRESHOLD && dy12 < POSITION_THRESHOLD &&
          dx23 < POSITION_THRESHOLD && dy23 < POSITION_THRESHOLD) {
        rageClickCount++;
        i += 2;
      }
    }
  }
  
  return rageClickCount;
}

function calculateAverageDwell(clicks, mouseDownEvents) {
  if (clicks.length === 0 || mouseDownEvents.length === 0) return 0;
  
  const dwellTimes = [];
  const POSITION_THRESHOLD = 20;
  
  for (const click of clicks) {
    const matchingMouseDown = mouseDownEvents
      .filter(md => md.timestamp <= click.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)
      .find(md => {
        const dx = Math.abs(md.x - click.x);
        const dy = Math.abs(md.y - click.y);
        return dx < POSITION_THRESHOLD && dy < POSITION_THRESHOLD;
      });
    
    if (matchingMouseDown) {
      dwellTimes.push(click.timestamp - matchingMouseDown.timestamp);
    }
  }
  
  return dwellTimes.length > 0
    ? dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length
    : 0;
}

// Test cases
function runTests() {
  console.log('🧪 Running Aggregation Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Click Intervals
  console.log('Test 1: Click Intervals');
  const testClicks1 = [
    { timestamp: 1000, x: 0, y: 0 },
    { timestamp: 1500, x: 0, y: 0 },
    { timestamp: 2000, x: 0, y: 0 },
  ];
  const intervals = calculateClickIntervals(testClicks1);
  const expectedIntervals = [500, 500];
  const test1Pass = JSON.stringify(intervals) === JSON.stringify(expectedIntervals);
  console.log(`  Expected: ${expectedIntervals}`);
  console.log(`  Got:      ${intervals}`);
  console.log(`  Result:   ${test1Pass ? '✅ PASS' : '❌ FAIL'}\n`);
  test1Pass ? passed++ : failed++;
  
  // Test 2: Rage Click Detection
  console.log('Test 2: Rage Click Detection');
  const rageClicks = generateRageClicks();
  const rageCount = detectRageClicks(rageClicks);
  const test2Pass = rageCount === 1;
  console.log(`  Expected: 1 rage click`);
  console.log(`  Got:      ${rageCount} rage click(s)`);
  console.log(`  Result:   ${test2Pass ? '✅ PASS' : '❌ FAIL'}\n`);
  test2Pass ? passed++ : failed++;
  
  // Test 3: Misclick Detection (all clicks have matching mouse_down)
  console.log('Test 3: Misclick Detection (Perfect Clicks)');
  const perfectClicks = generateMockClicks(5, 1000, { x: 0, y: 0, width: 500, height: 500 });
  const perfectMouseDowns = generateMouseDowns(perfectClicks);
  const misclicks1 = detectMisclicks(perfectClicks, perfectMouseDowns);
  const test3Pass = misclicks1 === 0;
  console.log(`  Expected: 0 misclicks`);
  console.log(`  Got:      ${misclicks1} misclicks`);
  console.log(`  Result:   ${test3Pass ? '✅ PASS' : '❌ FAIL'}\n`);
  test3Pass ? passed++ : failed++;
  
  // Test 4: Misclick Detection (no mouse_down events)
  console.log('Test 4: Misclick Detection (All Misclicks)');
  const misclicks2 = detectMisclicks(perfectClicks, []);
  const test4Pass = misclicks2 === perfectClicks.length;
  console.log(`  Expected: ${perfectClicks.length} misclicks`);
  console.log(`  Got:      ${misclicks2} misclicks`);
  console.log(`  Result:   ${test4Pass ? '✅ PASS' : '❌ FAIL'}\n`);
  test4Pass ? passed++ : failed++;
  
  // Test 5: Average Dwell Time
  console.log('Test 5: Average Dwell Time');
  const dwellClicks = [
    { timestamp: 1100, x: 100, y: 100 },
    { timestamp: 2100, x: 200, y: 200 },
  ];
  const dwellMouseDowns = [
    { timestamp: 1000, x: 100, y: 100 }, // 100ms before click
    { timestamp: 2000, x: 200, y: 200 }, // 100ms before click
  ];
  const avgDwell = calculateAverageDwell(dwellClicks, dwellMouseDowns);
  const test5Pass = Math.abs(avgDwell - 100) < 1;
  console.log(`  Expected: ~100ms`);
  console.log(`  Got:      ${Math.round(avgDwell)}ms`);
  console.log(`  Result:   ${test5Pass ? '✅ PASS' : '❌ FAIL'}\n`);
  test5Pass ? passed++ : failed++;
  
  // Test 6: Full Aggregation
  console.log('Test 6: Full Aggregation Batch');
  const fullTestClicks = generateMockClicks(24, 10000, { x: 0, y: 0, width: 1000, height: 1000 });
  const fullTestMouseDowns = generateMouseDowns(fullTestClicks);
  
  const batch = {
    user_id: 'test_user',
    batch_id: 'b_test_123',
    captured_at: new Date().toISOString(),
    page_context: {
      domain: 'test.com',
      route: '/test',
      app_type: 'web',
    },
    events_agg: {
      click_count: fullTestClicks.length,
      misclick_rate: detectMisclicks(fullTestClicks, fullTestMouseDowns) / fullTestClicks.length,
      avg_click_interval_ms: Math.round(
        calculateClickIntervals(fullTestClicks).reduce((a, b) => a + b, 0) / 
        calculateClickIntervals(fullTestClicks).length
      ),
      avg_dwell_ms: Math.round(calculateAverageDwell(fullTestClicks, fullTestMouseDowns)),
      rage_clicks: detectRageClicks(fullTestClicks),
      zoom_events: 0,
      scroll_speed_px_s: 0,
    },
    raw_samples_optional: [],
    _profiler: {
      sampling_hz: 30,
      input_lag_ms_est: 0,
    },
  };
  
  const test6Pass = 
    batch.events_agg.click_count === 24 &&
    batch.events_agg.misclick_rate >= 0 &&
    batch.events_agg.misclick_rate <= 1 &&
    batch.events_agg.avg_click_interval_ms > 0;
  
  console.log('  Generated batch:');
  console.log(`    - click_count: ${batch.events_agg.click_count}`);
  console.log(`    - misclick_rate: ${batch.events_agg.misclick_rate.toFixed(2)}`);
  console.log(`    - avg_click_interval_ms: ${batch.events_agg.avg_click_interval_ms}`);
  console.log(`    - avg_dwell_ms: ${batch.events_agg.avg_dwell_ms}`);
  console.log(`    - rage_clicks: ${batch.events_agg.rage_clicks}`);
  console.log(`  Result:   ${test6Pass ? '✅ PASS' : '❌ FAIL'}\n`);
  test6Pass ? passed++ : failed++;
  
  // Summary
  console.log('═══════════════════════════════════════');
  console.log(`📊 Test Results: ${passed}/${passed + failed} passed`);
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log(`❌ ${failed} test(s) failed`);
  }
  console.log('═══════════════════════════════════════\n');
  
  // Example batch output
  console.log('📦 Example Aggregated Batch (JSON):');
  console.log(JSON.stringify(batch, null, 2));
}

// Run tests
runTests();

