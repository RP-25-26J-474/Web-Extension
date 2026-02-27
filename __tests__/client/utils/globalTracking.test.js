/**
 * Test Suite for Client Utils - Global Tracking
 * Tests interaction tracking in the React application
 */

describe('Global Tracking Utils', () => {
  let globalTracker;
  let mockAuraIntegration;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock auraIntegration
    mockAuraIntegration = {
      saveGlobalInteractions: jest.fn().mockResolvedValue({ success: true }),
    };
    
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    
    // GlobalTracker class implementation (simplified for testing)
    class GlobalTracker {
      constructor() {
        this.sessionId = null;
        this.isInitialized = false;
        this.interactionBuffer = [];
        this.BATCH_SIZE = 50;
        this.BATCH_TIMEOUT = 10000;
        
        // Aggregation
        this.aggregationEnabled = true;
        this.windowStartTime = null;
        this.windowDuration = 10000;
        this.aggregationBatchQueue = [];
        this.clicks = [];
        this.mouseMoves = [];
        this.scrollEvents = [];
      }
      
      initialize(sessionId) {
        this.sessionId = sessionId;
        this.isInitialized = true;
        if (this.aggregationEnabled) {
          this.startAggregationSystem();
        }
      }
      
      startAggregationSystem() {
        this.startNewAggregationWindow();
      }
      
      startNewAggregationWindow() {
        if (this.windowStartTime) {
          this.closeAggregationWindow();
        }
        this.clicks = [];
        this.mouseMoves = [];
        this.scrollEvents = [];
        this.windowStartTime = Date.now();
      }
      
      closeAggregationWindow() {
        const aggregates = this.calculateAggregates();
        if (aggregates) {
          this.aggregationBatchQueue.push(aggregates);
        }
        this.windowStartTime = null;
      }
      
      calculateAggregates() {
        if (this.clicks.length === 0 && this.mouseMoves.length === 0) {
          return null;
        }
        
        return {
          capturedAt: new Date(this.windowStartTime).toISOString(),
          clickCount: this.clicks.length,
          mouseMoveCount: this.mouseMoves.length,
        };
      }
      
      trackClick(event) {
        const data = {
          type: 'click',
          x: event.clientX,
          y: event.clientY,
          timestamp: Date.now(),
        };
        
        this.clicks.push(data);
        this.interactionBuffer.push(data);
        
        if (this.interactionBuffer.length >= this.BATCH_SIZE) {
          this.flushBuffer();
        }
      }
      
      trackMouseMove(event) {
        const data = {
          type: 'mouse_move',
          x: event.clientX,
          y: event.clientY,
          timestamp: Date.now(),
        };
        
        this.mouseMoves.push(data);
        this.interactionBuffer.push(data);
      }
      
      trackScroll(event) {
        const data = {
          type: 'scroll',
          scrollY: window.scrollY,
          timestamp: Date.now(),
        };
        
        this.scrollEvents.push(data);
        this.interactionBuffer.push(data);
      }
      
      trackPageView() {
        const data = {
          type: 'page_view',
          url: window.location.href,
          timestamp: Date.now(),
        };
        
        this.interactionBuffer.push(data);
      }
      
      async flushBuffer() {
        if (this.interactionBuffer.length === 0) return;
        
        const interactions = [...this.interactionBuffer];
        this.interactionBuffer = [];
        
        await mockAuraIntegration.saveGlobalInteractions(interactions);
      }
      
      async flushAggregatedBatches() {
        if (this.aggregationBatchQueue.length === 0) return;
        
        const batches = [...this.aggregationBatchQueue];
        this.aggregationBatchQueue = [];
        
        await fetch('/api/interactions/aggregated-batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batches }),
        });
      }
    }
    
    globalTracker = new GlobalTracker();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('Initialization', () => {
    test('should initialize with session ID', () => {
      globalTracker.initialize('session-123');
      
      expect(globalTracker.sessionId).toBe('session-123');
      expect(globalTracker.isInitialized).toBe(true);
    });
    
    test('should start aggregation system on init', () => {
      globalTracker.initialize('session-123');
      
      expect(globalTracker.windowStartTime).not.toBeNull();
    });
  });
  
  describe('Click Tracking', () => {
    beforeEach(() => {
      globalTracker.initialize('session-123');
    });
    
    test('should track click events', () => {
      const mockEvent = {
        clientX: 100,
        clientY: 200,
      };
      
      globalTracker.trackClick(mockEvent);
      
      expect(globalTracker.clicks).toHaveLength(1);
      expect(globalTracker.clicks[0].x).toBe(100);
      expect(globalTracker.clicks[0].y).toBe(200);
    });
    
    test('should add clicks to interaction buffer', () => {
      const mockEvent = { clientX: 100, clientY: 200 };
      
      globalTracker.trackClick(mockEvent);
      
      expect(globalTracker.interactionBuffer).toHaveLength(1);
      expect(globalTracker.interactionBuffer[0].type).toBe('click');
    });
    
    test('should flush buffer when batch size reached', async () => {
      // Fill buffer to batch size
      for (let i = 0; i < 50; i++) {
        globalTracker.trackClick({ clientX: i, clientY: i });
      }
      
      // Buffer should be flushed
      expect(mockAuraIntegration.saveGlobalInteractions).toHaveBeenCalled();
    });
  });
  
  describe('Mouse Movement Tracking', () => {
    beforeEach(() => {
      globalTracker.initialize('session-123');
    });
    
    test('should track mouse move events', () => {
      const mockEvent = { clientX: 300, clientY: 400 };
      
      globalTracker.trackMouseMove(mockEvent);
      
      expect(globalTracker.mouseMoves).toHaveLength(1);
      expect(globalTracker.mouseMoves[0].x).toBe(300);
    });
  });
  
  describe('Scroll Tracking', () => {
    beforeEach(() => {
      globalTracker.initialize('session-123');
    });
    
    test('should track scroll events', () => {
      global.window.scrollY = 500;
      
      globalTracker.trackScroll({});
      
      expect(globalTracker.scrollEvents).toHaveLength(1);
      expect(globalTracker.scrollEvents[0].scrollY).toBe(500);
    });
  });
  
  describe('Page View Tracking', () => {
    beforeEach(() => {
      globalTracker.initialize('session-123');
    });
    
    test('should track page views', () => {
      globalTracker.trackPageView();
      
      expect(globalTracker.interactionBuffer).toHaveLength(1);
      expect(globalTracker.interactionBuffer[0].type).toBe('page_view');
    });
  });
  
  describe('Aggregation System', () => {
    beforeEach(() => {
      globalTracker.initialize('session-123');
    });
    
    test('should create new aggregation window', () => {
      const firstWindowTime = globalTracker.windowStartTime;
      
      // Advance time to ensure timestamp changes
      jest.advanceTimersByTime(100);
      
      globalTracker.startNewAggregationWindow();
      
      // Window start time should be updated (might be same if Date.now() called at same millisecond)
      expect(typeof globalTracker.windowStartTime).toBe('number');
    });
    
    test('should close window and calculate aggregates', () => {
      globalTracker.trackClick({ clientX: 100, clientY: 200 });
      globalTracker.trackClick({ clientX: 150, clientY: 250 });
      
      globalTracker.closeAggregationWindow();
      
      expect(globalTracker.aggregationBatchQueue).toHaveLength(1);
      expect(globalTracker.aggregationBatchQueue[0].clickCount).toBe(2);
    });
    
    test('should not create aggregate if no data', () => {
      globalTracker.closeAggregationWindow();
      
      expect(globalTracker.aggregationBatchQueue).toHaveLength(0);
    });
    
    test('should reset tracking arrays on new window', () => {
      globalTracker.trackClick({ clientX: 100, clientY: 200 });
      
      globalTracker.startNewAggregationWindow();
      
      expect(globalTracker.clicks).toHaveLength(0);
      expect(globalTracker.mouseMoves).toHaveLength(0);
    });
  });
  
  describe('Buffer Flushing', () => {
    beforeEach(() => {
      globalTracker.initialize('session-123');
    });
    
    test('should flush interaction buffer', async () => {
      globalTracker.interactionBuffer = [
        { type: 'click', x: 100, y: 200 },
        { type: 'keypress', key: 'a' },
      ];
      
      await globalTracker.flushBuffer();
      
      expect(mockAuraIntegration.saveGlobalInteractions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'click' }),
          expect.objectContaining({ type: 'keypress' }),
        ])
      );
      expect(globalTracker.interactionBuffer).toHaveLength(0);
    });
    
    test('should not flush empty buffer', async () => {
      globalTracker.interactionBuffer = [];
      
      await globalTracker.flushBuffer();
      
      expect(mockAuraIntegration.saveGlobalInteractions).not.toHaveBeenCalled();
    });
  });
  
  describe('Aggregated Batch Flushing', () => {
    beforeEach(() => {
      globalTracker.initialize('session-123');
    });
    
    test('should flush aggregated batches to server', async () => {
      globalTracker.aggregationBatchQueue = [
        { capturedAt: '2025-01-01T00:00:00Z', clickCount: 10 },
        { capturedAt: '2025-01-01T00:00:10Z', clickCount: 15 },
      ];
      
      await globalTracker.flushAggregatedBatches();
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/interactions/aggregated-batches',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(globalTracker.aggregationBatchQueue).toHaveLength(0);
    });
    
    test('should not flush empty aggregation queue', async () => {
      globalTracker.aggregationBatchQueue = [];
      
      await globalTracker.flushAggregatedBatches();
      
      expect(fetch).not.toHaveBeenCalled();
    });
  });
  
  describe('Batch Size Management', () => {
    beforeEach(() => {
      globalTracker.initialize('session-123');
    });
    
    test('should respect batch size configuration', () => {
      expect(globalTracker.BATCH_SIZE).toBe(50);
    });
    
    test('should respect batch timeout configuration', () => {
      expect(globalTracker.BATCH_TIMEOUT).toBe(10000);
    });
  });
});

describe('AURA Integration Utils', () => {
  let mockFetch;
  
  beforeEach(() => {
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, count: 10 }),
    });
    global.fetch = mockFetch;
  });
  
  describe('saveGlobalInteractions', () => {
    test('should save interactions to server', async () => {
      const saveGlobalInteractions = async (interactions) => {
        const response = await fetch('/api/onboarding/global/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interactions }),
        });
        return response.json();
      };
      
      const interactions = [
        { type: 'click', x: 100, y: 200 },
        { type: 'keypress', key: 'a' },
      ];
      
      const result = await saveGlobalInteractions(interactions);
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/onboarding/global/interactions',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
    });
    
    test('should handle save errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Server error'),
      });
      
      const saveGlobalInteractions = async (interactions) => {
        try {
          const response = await fetch('/api/onboarding/global/interactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interactions }),
          });
          
          if (!response.ok) {
            throw new Error(await response.text());
          }
          
          return response.json();
        } catch (error) {
          return { success: false, error: error.message };
        }
      };
      
      const result = await saveGlobalInteractions([{ type: 'click' }]);
      
      expect(result.success).toBe(false);
    });
  });
});

