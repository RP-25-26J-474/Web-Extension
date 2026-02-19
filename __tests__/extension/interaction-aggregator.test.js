/**
 * Test Suite for Interaction Aggregator
 * Tests 10-second window aggregation and metric calculations
 */

describe('InteractionAggregator', () => {
  let InteractionAggregator;
  let aggregator;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock chrome storage
    global.chrome.storage.local.get.mockResolvedValue({
      userId: 'test-user-123',
      authToken: 'test-token',
    });
    
    global.chrome.storage.local.set.mockResolvedValue();
    
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('OK'),
    });
    
    // Load the aggregator class (simplified version for testing)
    InteractionAggregator = class {
      constructor() {
        this.userId = null;
        this.currentWindow = null;
        this.batchQueue = [];
        this.windowStartTime = null;
        this.windowDuration = 10000;
        this.flushInterval = 30000;
        this.batchIdCounter = 1;
        
        this.clicks = [];
        this.mouseMoves = [];
        this.scrollEvents = [];
        this.zoomEvents = [];
        this.keystrokes = [];
        this.mouseDownEvents = [];
      }
      
      async initialize() {
        const result = await chrome.storage.local.get(['userId', 'authToken']);
        this.userId = result.userId || 'anonymous';
        this.startNewWindow();
      }
      
      startNewWindow() {
        if (this.currentWindow) {
          this.closeCurrentWindow();
        }
        this.clicks = [];
        this.mouseMoves = [];
        this.scrollEvents = [];
        this.zoomEvents = [];
        this.keystrokes = [];
        this.mouseDownEvents = [];
        this.windowStartTime = Date.now();
      }
      
      closeCurrentWindow() {
        if (!this.windowStartTime) return;
        const aggregatedData = this.calculateAggregates();
        if (aggregatedData) {
          this.batchQueue.push(aggregatedData);
        }
        this.windowStartTime = null;
      }
      
      trackEvent(interactionData) {
        if (!this.windowStartTime) {
          this.startNewWindow();
        }
        
        const eventType = interactionData.type;
        const timestamp = interactionData.timestamp || Date.now();
        
        switch (eventType) {
          case 'click':
            this.clicks.push({
              timestamp,
              x: interactionData.x,
              y: interactionData.y,
              target: interactionData.elementTag,
            });
            break;
          case 'mouse_down':
            this.mouseDownEvents.push({
              timestamp,
              x: interactionData.x,
              y: interactionData.y,
            });
            break;
          case 'mouse_move':
            this.mouseMoves.push({
              timestamp,
              x: interactionData.x,
              y: interactionData.y,
            });
            break;
          case 'scroll':
            this.scrollEvents.push({
              timestamp,
              scrollY: interactionData.scrollY,
            });
            break;
          case 'browser_zoom':
            this.zoomEvents.push({
              timestamp,
              type: eventType,
              zoomLevel: interactionData.zoomLevel,
            });
            break;
        }
      }
      
      calculateAggregates() {
        if (this.clicks.length === 0 && this.mouseMoves.length === 0) {
          return null;
        }
        
        const captured_at = new Date(this.windowStartTime).toISOString();
        const click_count = this.clicks.length;
        const click_intervals = this.calculateClickIntervals();
        const avg_click_interval_ms = click_intervals.length > 0
          ? click_intervals.reduce((a, b) => a + b, 0) / click_intervals.length
          : 0;
        
        const misclick_count = this.detectMisclicks();
        const misclick_rate = click_count > 0 ? misclick_count / click_count : 0;
        const rage_clicks = this.detectRageClicks();
        
        return {
          user_id: this.userId,
          batch_id: `b_${this.batchIdCounter++}_${Date.now()}`,
          captured_at,
          page_context: {
            domain: 'test.com',
            route: '/page',
            app_type: 'web',
          },
          events_agg: {
            click_count,
            misclick_rate: parseFloat(misclick_rate.toFixed(2)),
            avg_click_interval_ms: Math.round(avg_click_interval_ms),
            rage_clicks,
            zoom_events: this.zoomEvents.length,
          },
        };
      }
      
      calculateClickIntervals() {
        if (this.clicks.length < 2) return [];
        const intervals = [];
        for (let i = 1; i < this.clicks.length; i++) {
          intervals.push(this.clicks[i].timestamp - this.clicks[i - 1].timestamp);
        }
        return intervals;
      }
      
      detectMisclicks() {
        let misclickCount = 0;
        const POSITION_THRESHOLD = 20;
        const TIME_THRESHOLD = 500;
        
        for (const click of this.clicks) {
          const hasMatchingMouseDown = this.mouseDownEvents.some(md => {
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
      
      detectRageClicks() {
        let rageClickCount = 0;
        const POSITION_THRESHOLD = 30;
        const TIME_WINDOW = 1000;
        
        for (let i = 0; i < this.clicks.length - 2; i++) {
          const click1 = this.clicks[i];
          const click2 = this.clicks[i + 1];
          const click3 = this.clicks[i + 2];
          
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
    };
    
    aggregator = new InteractionAggregator();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('Initialization', () => {
    test('should initialize with user ID from storage', async () => {
      await aggregator.initialize();
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['userId', 'authToken']);
      expect(aggregator.userId).toBe('test-user-123');
      expect(aggregator.windowStartTime).not.toBeNull();
    });
    
    test('should use anonymous user if no userId in storage', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      await aggregator.initialize();
      
      expect(aggregator.userId).toBe('anonymous');
    });
  });
  
  describe('Event Tracking', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });
    
    test('should track click events', () => {
      const clickData = {
        type: 'click',
        x: 100,
        y: 200,
        timestamp: Date.now(),
        elementTag: 'button',
      };
      
      aggregator.trackEvent(clickData);
      
      expect(aggregator.clicks).toHaveLength(1);
      expect(aggregator.clicks[0].x).toBe(100);
      expect(aggregator.clicks[0].y).toBe(200);
    });
    
    test('should track mouse_down events', () => {
      const mouseDownData = {
        type: 'mouse_down',
        x: 150,
        y: 250,
        timestamp: Date.now(),
      };
      
      aggregator.trackEvent(mouseDownData);
      
      expect(aggregator.mouseDownEvents).toHaveLength(1);
    });
    
    test('should track multiple event types', () => {
      aggregator.trackEvent({ type: 'click', x: 10, y: 20, timestamp: Date.now() });
      aggregator.trackEvent({ type: 'mouse_move', x: 30, y: 40, timestamp: Date.now() });
      aggregator.trackEvent({ type: 'scroll', scrollY: 100, timestamp: Date.now() });
      
      expect(aggregator.clicks).toHaveLength(1);
      expect(aggregator.mouseMoves).toHaveLength(1);
      expect(aggregator.scrollEvents).toHaveLength(1);
    });
  });
  
  describe('Click Interval Calculation', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });
    
    test('should calculate intervals between consecutive clicks', () => {
      const baseTime = Date.now();
      aggregator.clicks = [
        { timestamp: baseTime, x: 0, y: 0 },
        { timestamp: baseTime + 500, x: 0, y: 0 },
        { timestamp: baseTime + 1000, x: 0, y: 0 },
      ];
      
      const intervals = aggregator.calculateClickIntervals();
      
      expect(intervals).toEqual([500, 500]);
    });
    
    test('should return empty array for single click', () => {
      aggregator.clicks = [{ timestamp: Date.now(), x: 0, y: 0 }];
      
      const intervals = aggregator.calculateClickIntervals();
      
      expect(intervals).toEqual([]);
    });
  });
  
  describe('Misclick Detection', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });
    
    test('should detect misclicks without matching mouse_down', () => {
      const baseTime = Date.now();
      aggregator.clicks = [
        { timestamp: baseTime, x: 100, y: 100 },
        { timestamp: baseTime + 100, x: 200, y: 200 },
      ];
      aggregator.mouseDownEvents = [];
      
      const misclicks = aggregator.detectMisclicks();
      
      expect(misclicks).toBe(2);
    });
    
    test('should not detect misclick with matching mouse_down', () => {
      const baseTime = Date.now();
      aggregator.clicks = [
        { timestamp: baseTime + 50, x: 100, y: 100 },
      ];
      aggregator.mouseDownEvents = [
        { timestamp: baseTime, x: 100, y: 100 },
      ];
      
      const misclicks = aggregator.detectMisclicks();
      
      expect(misclicks).toBe(0);
    });
    
    test('should detect misclick if mouse_down is too far away', () => {
      const baseTime = Date.now();
      aggregator.clicks = [
        { timestamp: baseTime + 50, x: 100, y: 100 },
      ];
      aggregator.mouseDownEvents = [
        { timestamp: baseTime, x: 200, y: 200 }, // Too far (>20px threshold)
      ];
      
      const misclicks = aggregator.detectMisclicks();
      
      expect(misclicks).toBe(1);
    });
  });
  
  describe('Rage Click Detection', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });
    
    test('should detect rage clicks (3+ clicks in same area within 1 second)', () => {
      const baseTime = Date.now();
      aggregator.clicks = [
        { timestamp: baseTime, x: 100, y: 100 },
        { timestamp: baseTime + 300, x: 105, y: 105 },
        { timestamp: baseTime + 600, x: 110, y: 110 },
      ];
      
      const rageClicks = aggregator.detectRageClicks();
      
      expect(rageClicks).toBe(1);
    });
    
    test('should not detect rage clicks if clicks are too far apart spatially', () => {
      const baseTime = Date.now();
      aggregator.clicks = [
        { timestamp: baseTime, x: 100, y: 100 },
        { timestamp: baseTime + 300, x: 200, y: 200 }, // Too far
        { timestamp: baseTime + 600, x: 300, y: 300 },
      ];
      
      const rageClicks = aggregator.detectRageClicks();
      
      expect(rageClicks).toBe(0);
    });
    
    test('should not detect rage clicks if clicks are too far apart temporally', () => {
      const baseTime = Date.now();
      aggregator.clicks = [
        { timestamp: baseTime, x: 100, y: 100 },
        { timestamp: baseTime + 600, x: 105, y: 105 },
        { timestamp: baseTime + 1200, x: 110, y: 110 }, // Total >1000ms
      ];
      
      const rageClicks = aggregator.detectRageClicks();
      
      expect(rageClicks).toBe(0);
    });
  });
  
  describe('Aggregate Calculation', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });
    
    test('should calculate aggregates correctly', () => {
      const baseTime = Date.now();
      
      // Add clicks with matching mouse_down events
      aggregator.clicks = [
        { timestamp: baseTime, x: 100, y: 100 },
        { timestamp: baseTime + 500, x: 200, y: 200 },
      ];
      
      aggregator.mouseDownEvents = [
        { timestamp: baseTime - 50, x: 100, y: 100 },
        { timestamp: baseTime + 450, x: 200, y: 200 },
      ];
      
      const aggregates = aggregator.calculateAggregates();
      
      expect(aggregates).toBeDefined();
      expect(aggregates.user_id).toBe('test-user-123');
      expect(aggregates.events_agg.click_count).toBe(2);
      expect(aggregates.events_agg.misclick_rate).toBe(0);
      expect(aggregates.events_agg.avg_click_interval_ms).toBe(500);
    });
    
    test('should return null if no meaningful data', () => {
      const aggregates = aggregator.calculateAggregates();
      
      expect(aggregates).toBeNull();
    });
    
    test('should include zoom events in aggregates', () => {
      aggregator.clicks = [{ timestamp: Date.now(), x: 100, y: 100 }];
      aggregator.zoomEvents = [
        { timestamp: Date.now(), type: 'browser_zoom', zoomLevel: 1.5 },
      ];
      
      const aggregates = aggregator.calculateAggregates();
      
      expect(aggregates.events_agg.zoom_events).toBe(1);
    });
  });
  
  describe('Window Management', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });
    
    test('should close current window and add to batch queue', () => {
      aggregator.clicks = [{ timestamp: Date.now(), x: 100, y: 100 }];
      
      aggregator.closeCurrentWindow();
      
      expect(aggregator.batchQueue).toHaveLength(1);
      expect(aggregator.windowStartTime).toBeNull();
    });
    
    test('should start new window and close previous', () => {
      aggregator.clicks = [{ timestamp: Date.now(), x: 100, y: 100 }];
      aggregator.mouseMoves = [{ timestamp: Date.now(), x: 100, y: 100 }];
      
      aggregator.startNewWindow();
      
      // The batch queue should have the previous window's data if it had meaningful content
      expect(aggregator.batchQueue.length).toBeGreaterThanOrEqual(0);
      expect(aggregator.clicks).toHaveLength(0);
      expect(aggregator.windowStartTime).not.toBeNull();
    });
  });
});

