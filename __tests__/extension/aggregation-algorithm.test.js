/**
 * Jest Test Suite - Aggregation Algorithm Validation
 * Based on the original test-aggregation.js
 * Tests the core aggregation logic with Jest framework
 */

describe('Aggregation Algorithm Tests', () => {
  // Helper functions from original test
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
    
    clicks.push({ timestamp: startTime, x, y });
    clicks.push({ timestamp: startTime + 300, x: x + 5, y: y + 5 });
    clicks.push({ timestamp: startTime + 600, x: x + 10, y: y + 10 });
    
    return clicks;
  }
  
  function generateMouseDowns(clicks) {
    return clicks.map(click => ({
      timestamp: click.timestamp - 50,
      x: click.x + Math.random() * 10 - 5,
      y: click.y + Math.random() * 10 - 5,
    }));
  }
  
  // Aggregation functions
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
  
  describe('Test 1: Click Intervals', () => {
    test('should calculate correct intervals between clicks', () => {
      const testClicks = [
        { timestamp: 1000, x: 0, y: 0 },
        { timestamp: 1500, x: 0, y: 0 },
        { timestamp: 2000, x: 0, y: 0 },
      ];
      
      const intervals = calculateClickIntervals(testClicks);
      const expectedIntervals = [500, 500];
      
      expect(intervals).toEqual(expectedIntervals);
    });
  });
  
  describe('Test 2: Rage Click Detection', () => {
    test('should detect rage clicks correctly', () => {
      const rageClicks = generateRageClicks();
      const rageCount = detectRageClicks(rageClicks);
      
      expect(rageCount).toBe(1);
    });
  });
  
  describe('Test 3: Misclick Detection (Perfect Clicks)', () => {
    test('should not detect misclicks when all clicks have matching mouse_down', () => {
      const perfectClicks = generateMockClicks(5, 1000, { x: 0, y: 0, width: 500, height: 500 });
      const perfectMouseDowns = generateMouseDowns(perfectClicks);
      const misclicks = detectMisclicks(perfectClicks, perfectMouseDowns);
      
      expect(misclicks).toBe(0);
    });
  });
  
  describe('Test 4: Misclick Detection (All Misclicks)', () => {
    test('should detect all clicks as misclicks when no mouse_down events', () => {
      const perfectClicks = generateMockClicks(5, 1000, { x: 0, y: 0, width: 500, height: 500 });
      const misclicks = detectMisclicks(perfectClicks, []);
      
      expect(misclicks).toBe(perfectClicks.length);
    });
  });
  
  describe('Test 5: Average Dwell Time', () => {
    test('should calculate correct average dwell time', () => {
      const dwellClicks = [
        { timestamp: 1100, x: 100, y: 100 },
        { timestamp: 2100, x: 200, y: 200 },
      ];
      
      const dwellMouseDowns = [
        { timestamp: 1000, x: 100, y: 100 },
        { timestamp: 2000, x: 200, y: 200 },
      ];
      
      const avgDwell = calculateAverageDwell(dwellClicks, dwellMouseDowns);
      
      expect(Math.abs(avgDwell - 100)).toBeLessThan(1);
    });
  });
  
  describe('Test 6: Full Aggregation Batch', () => {
    test('should generate valid aggregation batch', () => {
      const fullTestClicks = generateMockClicks(24, 10000, { x: 0, y: 0, width: 1000, height: 1000 });
      const fullTestMouseDowns = generateMouseDowns(fullTestClicks);
      
      const intervals = calculateClickIntervals(fullTestClicks);
      const avgInterval = intervals.length > 0 
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;
      
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
          avg_click_interval_ms: Math.round(avgInterval),
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
      
      // Validate batch structure
      expect(batch.events_agg.click_count).toBe(24);
      expect(batch.events_agg.misclick_rate).toBeGreaterThanOrEqual(0);
      expect(batch.events_agg.misclick_rate).toBeLessThanOrEqual(1);
      expect(batch.events_agg.avg_click_interval_ms).toBeGreaterThan(0);
      
      // Validate batch schema
      expect(batch).toHaveProperty('user_id');
      expect(batch).toHaveProperty('batch_id');
      expect(batch).toHaveProperty('captured_at');
      expect(batch).toHaveProperty('page_context');
      expect(batch).toHaveProperty('events_agg');
      expect(batch).toHaveProperty('_profiler');
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle empty click array', () => {
      const intervals = calculateClickIntervals([]);
      expect(intervals).toEqual([]);
    });
    
    test('should handle single click', () => {
      const intervals = calculateClickIntervals([{ timestamp: 1000, x: 0, y: 0 }]);
      expect(intervals).toEqual([]);
    });
    
    test('should handle no mouse down events', () => {
      const clicks = [{ timestamp: 1000, x: 100, y: 100 }];
      const misclicks = detectMisclicks(clicks, []);
      expect(misclicks).toBe(1);
    });
    
    test('should handle rage clicks with insufficient clicks', () => {
      const clicks = [
        { timestamp: 1000, x: 100, y: 100 },
        { timestamp: 1300, x: 105, y: 105 },
      ];
      const rageCount = detectRageClicks(clicks);
      expect(rageCount).toBe(0);
    });
  });
  
  describe('Performance Tests', () => {
    test('should handle large click datasets efficiently', () => {
      const startTime = Date.now();
      
      const largeClickSet = generateMockClicks(1000, 100000, { x: 0, y: 0, width: 1920, height: 1080 });
      const largeMouseDownSet = generateMouseDowns(largeClickSet);
      
      calculateClickIntervals(largeClickSet);
      detectMisclicks(largeClickSet, largeMouseDownSet);
      detectRageClicks(largeClickSet);
      calculateAverageDwell(largeClickSet, largeMouseDownSet);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should process 1000 clicks in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
  
  describe('Statistical Validation', () => {
    test('should produce consistent misclick rates', () => {
      const runs = 10;
      const misclickRates = [];
      
      for (let i = 0; i < runs; i++) {
        const clicks = generateMockClicks(20, 5000, { x: 0, y: 0, width: 1000, height: 1000 });
        const mouseDowns = generateMouseDowns(clicks);
        const misclicks = detectMisclicks(clicks, mouseDowns);
        misclickRates.push(misclicks / clicks.length);
      }
      
      // All runs should have low misclick rate (perfect mouse downs)
      const avgMisclickRate = misclickRates.reduce((a, b) => a + b, 0) / runs;
      expect(avgMisclickRate).toBeLessThan(0.2); // Less than 20% misclicks
    });
  });
});



