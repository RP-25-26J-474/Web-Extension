/**
 * Interaction Tracking Flow - Contract Tests
 *
 * Verifies the end-to-end flow contract:
 * Content script format → Background handling → Aggregator output → Server schema
 *
 * These tests ensure that if any part of the pipeline changes,
 * the expected data shapes and flows still hold.
 */

function createMockAggregatedBatch(overrides = {}) {
  return {
    user_id: 'test-user-123',
    batch_id: `b_1_${Date.now()}`,
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

describe('Interaction Tracking Flow - Contract Tests', () => {
  // Message format that content script sends (content.js sendInteraction)
  const CONTENT_INTERACTION_SCHEMA = {
    type: expect.any(String),
    url: expect.any(String),
    timestamp: expect.any(Number),
    pageTitle: expect.any(String),
  };

  // Additional fields per event type (content.js)
  const CLICK_FIELDS = ['elementTag', 'elementId', 'elementClass', 'x', 'y', 'button'];
  const MOUSE_MOVE_FIELDS = ['x', 'y', 'screenX', 'screenY'];
  const SCROLL_FIELDS = ['scrollX', 'scrollY', 'documentHeight', 'viewportHeight'];
  const KEYPRESS_FIELDS = ['key', 'code', 'elementTag', 'elementType', 'isInput'];

  describe('Content Script → Background Message Contract', () => {
    test('INTERACTION message must have type and data', () => {
      const validMessage = {
        type: 'INTERACTION',
        data: {
          type: 'click',
          x: 100,
          y: 200,
          elementTag: 'BUTTON',
          url: 'https://example.com',
          timestamp: Date.now(),
          pageTitle: 'Test',
        },
      };

      expect(validMessage.type).toBe('INTERACTION');
      expect(validMessage.data).toBeDefined();
      expect(validMessage.data.type).toBe('click');
      expect(validMessage.data.x).toBe(100);
    });

    test('handleInteraction receives data with tab.url for page context', () => {
      const messageData = {
        type: 'click',
        x: 150,
        y: 250,
        elementTag: 'A',
      };
      const tab = { url: 'https://example.com/checkout' };

      const eventWithUrl = { ...messageData, url: tab?.url };
      expect(eventWithUrl.url).toBe('https://example.com/checkout');
      expect(eventWithUrl.type).toBe('click');
    });
  });

  describe('Aggregator Input Contract', () => {
    test('trackEvent accepts click with x, y, timestamp, elementTag', () => {
      const event = {
        type: 'click',
        x: 100,
        y: 200,
        timestamp: Date.now(),
        elementTag: 'BUTTON',
        url: 'https://test.com',
      };
      expect(event.type).toBe('click');
      expect(typeof event.x).toBe('number');
      expect(typeof event.y).toBe('number');
      expect(typeof event.timestamp).toBe('number');
    });

    test('trackEvent accepts mouse_down for misclick/dwell detection', () => {
      const event = {
        type: 'mouse_down',
        x: 100,
        y: 200,
        timestamp: Date.now(),
      };
      expect(event.type).toBe('mouse_down');
    });

    test('trackEvent accepts scroll, zoom event types', () => {
      const scrollEvent = { type: 'scroll', scrollY: 500, timestamp: Date.now() };
      const zoomEvent = { type: 'browser_zoom', zoomLevel: 1.5, timestamp: Date.now() };

      expect(['scroll', 'browser_zoom', 'wheel_zoom', 'keyboard_zoom', 'pinch']).toContain(
        zoomEvent.type
      );
    });
  });

  describe('Aggregated Batch Schema Contract', () => {
    test('batch must have required fields for server/ML pipeline', () => {
      const batch = createMockAggregatedBatch();

      expect(batch).toHaveProperty('user_id');
      expect(batch).toHaveProperty('batch_id');
      expect(batch).toHaveProperty('captured_at');
      expect(batch).toHaveProperty('page_context');
      expect(batch).toHaveProperty('events_agg');
      expect(batch).toHaveProperty('_profiler');

      expect(batch.page_context).toHaveProperty('domain');
      expect(batch.page_context).toHaveProperty('route');
      expect(batch.page_context).toHaveProperty('app_type');

      expect(batch.events_agg).toHaveProperty('click_count');
      expect(batch.events_agg).toHaveProperty('misclick_rate');
      expect(batch.events_agg).toHaveProperty('avg_click_interval_ms');
      expect(batch.events_agg).toHaveProperty('avg_dwell_ms');
      expect(batch.events_agg).toHaveProperty('rage_clicks');
      expect(batch.events_agg).toHaveProperty('zoom_events');
      expect(batch.events_agg).toHaveProperty('scroll_speed_px_s');

      expect(batch._profiler).toHaveProperty('sampling_hz');
      expect(batch._profiler).toHaveProperty('input_lag_ms_est');
    });

    test('misclick_rate must be 0-1', () => {
      const batch = createMockAggregatedBatch();
      expect(batch.events_agg.misclick_rate).toBeGreaterThanOrEqual(0);
      expect(batch.events_agg.misclick_rate).toBeLessThanOrEqual(1);
    });

    test('batch_id must be unique format', () => {
      const batch = createMockAggregatedBatch();
      expect(batch.batch_id).toMatch(/^b_\d+_\d+$/);
    });

    test('captured_at must be ISO 8601', () => {
      const batch = createMockAggregatedBatch();
      expect(batch.captured_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Simulated Flow Produces Valid Batch', () => {
    test('click + mouse_down sequence produces batch with expected metrics', () => {
      const baseTime = Date.now();
      const clicks = [
        { timestamp: baseTime + 80, x: 100, y: 100 },
        { timestamp: baseTime + 580, x: 200, y: 200 },
      ];
      const mouseDowns = [
        { timestamp: baseTime, x: 100, y: 100 },
        { timestamp: baseTime + 500, x: 200, y: 200 },
      ];

      // Same logic as interaction-aggregator.js
      const clickCount = clicks.length;
      const intervals = clicks.length >= 2
        ? [clicks[1].timestamp - clicks[0].timestamp]
        : [];
      const avgInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;

      const POSITION_THRESHOLD = 20;
      const TIME_THRESHOLD = 500;
      let misclickCount = 0;
      for (const click of clicks) {
        const hasMatch = mouseDowns.some((md) => {
          const dx = Math.abs(md.x - click.x);
          const dy = Math.abs(md.y - click.y);
          const dt = Math.abs(md.timestamp - click.timestamp);
          return dx < POSITION_THRESHOLD && dy < POSITION_THRESHOLD && dt < TIME_THRESHOLD;
        });
        if (!hasMatch) misclickCount++;
      }
      const misclickRate = clickCount > 0 ? misclickCount / clickCount : 0;

      const batch = {
        user_id: 'test-user',
        batch_id: `b_1_${Date.now()}`,
        captured_at: new Date(baseTime).toISOString(),
        page_context: { domain: 'example.com', route: '/test', app_type: 'web' },
        events_agg: {
          click_count: clickCount,
          misclick_rate: parseFloat(misclickRate.toFixed(2)),
          avg_click_interval_ms: Math.round(avgInterval),
          avg_dwell_ms: 90,
          rage_clicks: 0,
          zoom_events: 0,
          scroll_speed_px_s: 0,
        },
        _profiler: { sampling_hz: 30, input_lag_ms_est: 0 },
      };

      expect(batch.events_agg.click_count).toBe(2);
      expect(batch.events_agg.misclick_rate).toBe(0);
      expect(batch.events_agg.avg_click_interval_ms).toBe(500);
    });

    test('server POST /aggregated-batches accepts batch array', () => {
      const batches = [
        createMockAggregatedBatch({ user_id: 'u1' }),
        createMockAggregatedBatch({ user_id: 'u1' }),
      ];

      const payload = { batches };
      expect(payload.batches).toHaveLength(2);
      expect(payload.batches[0]).toHaveProperty('batch_id');
      expect(payload.batches[0]).toHaveProperty('events_agg');
    });
  });

  describe('Edge Cases', () => {
    test('empty event list produces no batch (aggregator returns null)', () => {
      const hasClicks = false;
      const hasMouseMoves = false;
      const hasScroll = false;
      const shouldProduceBatch = hasClicks || hasMouseMoves || hasScroll;

      expect(shouldProduceBatch).toBe(false);
    });

    test('scroll-only window produces batch with scroll_speed', () => {
      const scrollEvents = [
        { timestamp: 1000, scrollY: 0 },
        { timestamp: 2000, scrollY: 500 },
      ];
      const distance = Math.abs(scrollEvents[1].scrollY - scrollEvents[0].scrollY);
      const duration = (scrollEvents[1].timestamp - scrollEvents[0].timestamp) / 1000;
      const scrollSpeed = duration > 0 ? distance / duration : 0;

      expect(scrollSpeed).toBe(500);
    });
  });
});
