/**
 * Interaction Aggregator
 * 
 * Aggregates raw interactions into 10-second windows with calculated metrics.
 * Batches aggregated data and flushes every 30 seconds.
 * 
 * Schema Output (per 10-second window):
 * {
 *   user_id: "u_001",
 *   batch_id: "b_keep",
 *   captured_at: "2025-10-06T11:25:00Z",
 *   page_context: {
 *     domain: "example.com",
 *     route: "/checkout",
 *     app_type: "web"
 *   },
 *   events_agg: {
 *     click_count: 24,
 *     misclick_rate: 0.08,
 *     avg_click_interval_ms: 430,
 *     avg_dwell_ms: 2100,
 *     rage_clicks: 0,
 *     zoom_events: 1,
 *     scroll_speed_px_s: 260
 *   },
 *   raw_samples_optional: [],
 *   _profiler: {
 *     sampling_hz: 30,
 *     input_lag_ms_est: 34
 *   }
 * }
 */

// Import API configuration (module version)
import { API_CONFIG } from './config.module.js';

class InteractionAggregator {
  constructor() {
    this.userId = null;
    this.currentWindow = null;
    this.batchQueue = [];
    this.windowStartTime = null;
    this.windowDuration = 10000; // 10 seconds
    this.flushInterval = 30000; // 30 seconds
    this.batchIdCounter = 1;
    
    // Raw interaction tracking for current window
    this.clicks = [];
    this.mouseMoves = [];
    this.scrollEvents = [];
    this.zoomEvents = [];
    this.keystrokes = [];
    this.mouseDownEvents = [];
    this.lastClickPosition = null;
    this.samplingStartTime = null;
    this.samplingEventCount = 0;
    
    // Start automatic window rotation and batch flushing
    this.startWindowTimer();
    this.startFlushTimer();
  }

  /**
   * Initialize aggregator with user ID
   */
  async initialize() {
    try {
      const result = await chrome.storage.local.get(['userId', 'authToken']);
      this.userId = result.userId || 'anonymous';
      
      // Start first window
      this.startNewWindow();
      
      console.log('✅ InteractionAggregator initialized');
    } catch (error) {
      console.error('Failed to initialize aggregator:', error);
    }
  }

  /**
   * Start a new 10-second aggregation window
   */
  startNewWindow() {
    // Close previous window if exists
    if (this.currentWindow) {
      this.closeCurrentWindow();
    }
    
    // Reset tracking arrays
    this.clicks = [];
    this.mouseMoves = [];
    this.scrollEvents = [];
    this.zoomEvents = [];
    this.keystrokes = [];
    this.mouseDownEvents = [];
    this.lastClickPosition = null;
    this.samplingStartTime = Date.now();
    this.samplingEventCount = 0;
    
    // Start new window
    this.windowStartTime = Date.now();
    
    console.log(`📊 Started new 10s aggregation window at ${new Date(this.windowStartTime).toISOString()}`);
  }

  /**
   * Close current window and add to batch queue
   */
  closeCurrentWindow() {
    if (!this.windowStartTime) return;
    
    const aggregatedData = this.calculateAggregates();
    
    if (aggregatedData) {
      this.batchQueue.push(aggregatedData);
      console.log(`📦 Window closed. Batch queue size: ${this.batchQueue.length}`);
    }
    
    this.windowStartTime = null;
  }

  /**
   * Track raw interaction event
   */
  trackEvent(interactionData) {
    if (!this.windowStartTime) {
      this.startNewWindow();
    }
    
    this.samplingEventCount++;
    
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
      case 'wheel_zoom':
      case 'keyboard_zoom':
      case 'visual_viewport_zoom':
      case 'pinch':
        this.zoomEvents.push({
          timestamp,
          type: eventType,
          action: interactionData.action,
          zoomLevel: interactionData.zoomLevel,
        });
        break;
        
      case 'keypress':
        this.keystrokes.push({
          timestamp,
          key: interactionData.key,
        });
        break;
    }
  }

  /**
   * Calculate aggregated metrics for current window
   */
  calculateAggregates() {
    if (this.clicks.length === 0 && this.mouseMoves.length === 0 && this.scrollEvents.length === 0) {
      // No meaningful data in this window
      return null;
    }
    
    const captured_at = new Date(this.windowStartTime).toISOString();
    const windowDuration = (Date.now() - this.windowStartTime) / 1000; // in seconds
    
    // Click metrics
    const click_count = this.clicks.length;
    const click_intervals = this.calculateClickIntervals();
    const avg_click_interval_ms = click_intervals.length > 0
      ? click_intervals.reduce((a, b) => a + b, 0) / click_intervals.length
      : 0;
    
    // Misclick detection (clicks without corresponding mouse_down nearby)
    const misclick_count = this.detectMisclicks();
    const misclick_rate = click_count > 0 ? misclick_count / click_count : 0;
    
    // Rage click detection (3+ clicks in same area within 1 second)
    const rage_clicks = this.detectRageClicks();
    
    // Dwell time (time between mouse_down and click)
    const avg_dwell_ms = this.calculateAverageDwell();
    
    // Zoom events
    const zoom_events = this.zoomEvents.length;
    
    // Scroll speed
    const scroll_speed_px_s = this.calculateScrollSpeed();
    
    // Page context
    const page_context = {
      domain: window.location.hostname,
      route: window.location.pathname,
      app_type: 'web',
    };
    
    // Sampling profiler
    const sampling_hz = this.samplingEventCount / windowDuration;
    const input_lag_ms_est = this.estimateInputLag();
    
    // Generate batch ID
    const batch_id = `b_${this.batchIdCounter++}_${Date.now()}`;
    
    return {
      user_id: this.userId,
      batch_id,
      captured_at,
      page_context,
      events_agg: {
        click_count,
        misclick_rate: parseFloat(misclick_rate.toFixed(2)),
        avg_click_interval_ms: Math.round(avg_click_interval_ms),
        avg_dwell_ms: Math.round(avg_dwell_ms),
        rage_clicks,
        zoom_events,
        scroll_speed_px_s: Math.round(scroll_speed_px_s),
      },
      raw_samples_optional: [], // Can include raw data if needed for debugging
      _profiler: {
        sampling_hz: Math.round(sampling_hz),
        input_lag_ms_est: Math.round(input_lag_ms_est),
      },
    };
  }

  /**
   * Calculate intervals between consecutive clicks
   */
  calculateClickIntervals() {
    if (this.clicks.length < 2) return [];
    
    const intervals = [];
    for (let i = 1; i < this.clicks.length; i++) {
      intervals.push(this.clicks[i].timestamp - this.clicks[i - 1].timestamp);
    }
    return intervals;
  }

  /**
   * Detect misclicks (clicks without nearby mouse_down)
   */
  detectMisclicks() {
    let misclickCount = 0;
    const POSITION_THRESHOLD = 20; // pixels
    const TIME_THRESHOLD = 500; // ms
    
    for (const click of this.clicks) {
      // Find corresponding mouse_down event
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

  /**
   * Detect rage clicks (3+ clicks in same area within 1 second)
   */
  detectRageClicks() {
    let rageClickCount = 0;
    const POSITION_THRESHOLD = 30; // pixels
    const TIME_WINDOW = 1000; // 1 second
    
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
          i += 2; // Skip these clicks
        }
      }
    }
    
    return rageClickCount;
  }

  /**
   * Calculate average dwell time (mouse_down to click)
   */
  calculateAverageDwell() {
    if (this.clicks.length === 0 || this.mouseDownEvents.length === 0) return 0;
    
    const dwellTimes = [];
    const POSITION_THRESHOLD = 20;
    
    for (const click of this.clicks) {
      // Find nearest preceding mouse_down
      const matchingMouseDown = this.mouseDownEvents
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

  /**
   * Calculate scroll speed (pixels per second)
   */
  calculateScrollSpeed() {
    if (this.scrollEvents.length < 2) return 0;
    
    const firstScroll = this.scrollEvents[0];
    const lastScroll = this.scrollEvents[this.scrollEvents.length - 1];
    
    const distance = Math.abs(lastScroll.scrollY - firstScroll.scrollY);
    const duration = (lastScroll.timestamp - firstScroll.timestamp) / 1000; // seconds
    
    return duration > 0 ? distance / duration : 0;
  }

  /**
   * Estimate input lag based on event timing patterns
   */
  estimateInputLag() {
    // Simple heuristic: look at mouse_down to click delay
    if (this.clicks.length === 0 || this.mouseDownEvents.length === 0) return 0;
    
    const delays = [];
    const POSITION_THRESHOLD = 10;
    
    for (const click of this.clicks) {
      const matchingMouseDown = this.mouseDownEvents
        .filter(md => md.timestamp <= click.timestamp)
        .sort((a, b) => b.timestamp - a.timestamp)
        .find(md => {
          const dx = Math.abs(md.x - click.x);
          const dy = Math.abs(md.y - click.y);
          return dx < POSITION_THRESHOLD && dy < POSITION_THRESHOLD;
        });
      
      if (matchingMouseDown) {
        delays.push(click.timestamp - matchingMouseDown.timestamp);
      }
    }
    
    // Estimated input lag is the median delay
    if (delays.length > 0) {
      delays.sort((a, b) => a - b);
      const median = delays[Math.floor(delays.length / 2)];
      return Math.max(0, median - 100); // Subtract typical human reaction time
    }
    
    return 0;
  }

  /**
   * Start automatic window rotation (every 10 seconds)
   */
  startWindowTimer() {
    setInterval(() => {
      this.startNewWindow();
    }, this.windowDuration);
  }

  /**
   * Start automatic batch flushing (every 30 seconds)
   */
  startFlushTimer() {
    setInterval(async () => {
      await this.flushBatches();
    }, this.flushInterval);
  }

  /**
   * Flush batches to storage and prepare for server sync
   */
  async flushBatches() {
    if (this.batchQueue.length === 0) {
      console.log('⏭️ No batches to flush');
      return;
    }
    
    try {
      // Get existing batch queue from storage
      const result = await chrome.storage.local.get(['aggregatedBatches', 'authToken']);
      let storedBatches = result.aggregatedBatches || [];
      
      // Add current queue to stored batches
      storedBatches.push(...this.batchQueue);
      
      // Store batches locally
      await chrome.storage.local.set({ aggregatedBatches: storedBatches });
      
      console.log(`💾 Flushed ${this.batchQueue.length} batches to storage. Total stored: ${storedBatches.length}`);
      
      // Clear current queue
      this.batchQueue = [];
      
      // If authenticated, sync to server
      if (result.authToken) {
        await this.syncBatchesToServer();
      } else {
        console.log('⚠️ Not authenticated, batches stored locally only');
      }
      
    } catch (error) {
      console.error('❌ Failed to flush batches:', error);
    }
  }

  /**
   * Sync stored batches to server
   */
  async syncBatchesToServer() {
    try {
      const result = await chrome.storage.local.get(['aggregatedBatches', 'authToken']);
      const batches = result.aggregatedBatches || [];
      
      if (batches.length === 0) {
        console.log('⏭️ No aggregated batches to sync');
        return;
      }
      
      console.log(`📤 Syncing ${batches.length} aggregated batches to server...`);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/interactions/aggregated-batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.authToken}`,
        },
        body: JSON.stringify({ batches }),
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log(`✅ Synced ${responseData.count || batches.length} aggregated batches to server`);
        
        // Clear synced batches from storage
        await chrome.storage.local.set({ aggregatedBatches: [] });
      } else {
        const errorText = await response.text();
        console.error('❌ Server sync failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to sync batches to server:', error);
    }
  }

  /**
   * Export batches as JSON file (for debugging/analysis)
   */
  async exportBatchesToJSON() {
    try {
      const result = await chrome.storage.local.get(['aggregatedBatches']);
      const batches = result.aggregatedBatches || [];
      
      const jsonData = JSON.stringify(batches, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `interaction-batches-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      console.log('📥 Exported batches to JSON file');
    } catch (error) {
      console.error('Failed to export batches:', error);
    }
  }
}

// Export singleton instance
export const interactionAggregator = new InteractionAggregator();

// Auto-initialize on load
if (typeof chrome !== 'undefined' && chrome.storage) {
  interactionAggregator.initialize();
}

// Also export the class for testing
export { InteractionAggregator };

