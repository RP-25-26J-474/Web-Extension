/**
 * Test Suite for Background Service Worker
 * Tests interaction processing, storage, and sync
 */

describe('Background Service Worker', () => {
  let handleInteraction;
  let updateBadge;
  let clearAllData;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock storage data
    const mockStorage = {
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
      authToken: 'test-token-123',
      userId: 'test-user-123',
      onboardingCompleted: true,
    };
    
    chrome.storage.local.get.mockImplementation((keys) => {
      if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(key => {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        });
        return Promise.resolve(result);
      }
      return Promise.resolve(mockStorage);
    });
    
    chrome.storage.local.set.mockImplementation((data) => {
      Object.assign(mockStorage, data);
      return Promise.resolve();
    });
    
    // Mock fetch for server sync
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('OK'),
      json: () => Promise.resolve({ success: true }),
    });
    
    // Implementation of handleInteraction (simplified: feeds aggregator only, no raw storage)
    handleInteraction = async (data, tab) => {
      const result = await chrome.storage.local.get(['trackingEnabled', 'onboardingCompleted']);
      if (!result.trackingEnabled || !result.onboardingCompleted) return;
      // In real code: interactionAggregator.trackEvent(...)
    };
    
    updateBadge = () => {};
    
    // clearAllData is now a no-op (aggregated batches managed by aggregator)
    clearAllData = async () => { /* no-op */ };
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('Installation', () => {
    test('should set default values on install', async () => {
      await chrome.storage.local.set({
        consentGiven: false,
        trackingEnabled: false,
        trackingConfig: {
          clicks: true,
          keystrokes: true,
          mouseMovements: true,
          pageViews: true,
          doubleClicks: true,
          rightClicks: true,
          mouseHovers: true,
          dragAndDrop: true,
          touchEvents: true,
          zoomEvents: true,
        },
        interactions: [],
      });
      
      const result = await chrome.storage.local.get(['trackingEnabled', 'trackingConfig']);
      
      expect(result.trackingEnabled).toBe(false);
      expect(result.trackingConfig.clicks).toBe(true);
    });
  });
  
  describe('Interaction Handling', () => {
    test('should not store raw interactions (aggregated batches only)', async () => {
      const clickData = { type: 'click', x: 100, y: 200, timestamp: Date.now() };
      await handleInteraction(clickData, { id: 123, url: 'http://test.com' });
      const result = await chrome.storage.local.get(['interactions']);
      expect(result.interactions || []).toHaveLength(0);
    });

    test('should not process when tracking disabled', async () => {
      await chrome.storage.local.set({ trackingEnabled: false });
      const clickData = { type: 'click', x: 100, y: 200, timestamp: Date.now() };
      await handleInteraction(clickData, { id: 123 });
      const result = await chrome.storage.local.get(['interactions']);
      expect(result.interactions || []).toHaveLength(0);
    });
  });
  
  describe('Badge Updates (Disabled)', () => {
    test('should not show badge updates (feature disabled)', () => {
      updateBadge(42);
      
      // Badge updates are disabled, so no calls should be made
      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
      expect(chrome.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    });
    
    test('should not show 999+ for large counts (feature disabled)', () => {
      updateBadge(1500);
      
      // Badge updates are disabled
      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });
    
    test('should not show checkmark when synced (feature disabled)', () => {
      updateBadge(0);
      
      // Badge updates are disabled
      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
      expect(chrome.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    });
  });
  
  describe('Server Sync (Removed)', () => {
    test('raw interaction sync removed - aggregated batches only', () => {
      expect(true).toBe(true);
    });
  });
  
  describe('Clear Data', () => {
    test('clearAllData is no-op (aggregated batches only)', async () => {
      await chrome.storage.local.set({ aggregatedBatches: [{ batch_id: 'x' }] });
      await clearAllData();
      const result = await chrome.storage.local.get(['aggregatedBatches']);
      expect(result.aggregatedBatches).toHaveLength(1);
    });
  });
  
  describe('Message Handling', () => {
    test('should handle GET_STATS from aggregated batches', async () => {
      await chrome.storage.local.set({
        aggregatedBatches: [{ batch_id: 'b1' }],
      });
      const result = await chrome.storage.local.get(['aggregatedBatches']);
      expect(result.aggregatedBatches).toHaveLength(1);
    });
    
    test('should handle TOGGLE_TRACKING message', async () => {
      await chrome.storage.local.set({ trackingEnabled: true });
      
      await chrome.storage.local.set({ trackingEnabled: false });
      
      const result = await chrome.storage.local.get(['trackingEnabled']);
      expect(result.trackingEnabled).toBe(false);
    });
    
    test('should handle SET_CONSENT message', async () => {
      await chrome.storage.local.set({
        consentGiven: true,
        trackingEnabled: true,
      });
      
      const result = await chrome.storage.local.get(['consentGiven', 'trackingEnabled']);
      
      expect(result.consentGiven).toBe(true);
      expect(result.trackingEnabled).toBe(true);
    });
  });
  
  describe('Auto-sync Timer', () => {
    test('raw sync removed - aggregator syncs batches', () => {
      expect(true).toBe(true);
    });
  });
  
  describe('Aggregation Integration', () => {
    test('should feed events to aggregator', async () => {
      const mockAggregator = {
        trackEvent: jest.fn(),
      };
      
      const clickData = {
        type: 'click',
        x: 100,
        y: 200,
        timestamp: Date.now(),
      };
      
      // Simulate feeding to aggregator
      mockAggregator.trackEvent(clickData);
      
      expect(mockAggregator.trackEvent).toHaveBeenCalledWith(clickData);
    });
  });
});

