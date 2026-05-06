/**
 * Comprehensive Global Interaction Tracking System with Aggregation
 * Tracks all user interactions across the entire application
 * Uses ML-ready GlobalInteractionBucket for efficient storage
 * 
 * NEW: 10-second aggregation windows with 30-second batch flushing
 * Page context uses GDPR-compliant URL sanitization.
 */

import auraIntegration from './auraIntegration';
import { sanitizePageContext } from './urlSanitizer';

class GlobalTracker {
  constructor() {
    this.sessionId = null;
    this.lastEventTime = {};
    this.throttleTimers = {};
    this.touchStartData = null;
    this.pointerStartData = {};
    this.isInitialized = false;
    
    // Batching for performance - larger batches, less frequent sends
    this.interactionBuffer = [];
    this.BATCH_SIZE = 50; // Increased from 10 to reduce request frequency
    this.BATCH_TIMEOUT = 10000; // 10 seconds (increased from 2s)
    this.batchTimer = null;
    this.isFlushing = false; // Prevent concurrent flushes
    this.MAX_BUFFER_SIZE = 500; // Prevent memory bloat
    
    // ===== NEW: Aggregation System =====
    this.aggregationEnabled = true;
    this.windowStartTime = null;
    this.windowDuration = 10000; // 10 seconds
    this.aggregationFlushInterval = 30000; // 30 seconds
    this.aggregationBatchQueue = [];
    this.batchIdCounter = 1;
    
    // Raw interaction tracking for current window
    this.clicks = [];
    this.mouseMoves = [];
    this.scrollEvents = [];
    this.zoomEvents = [];
    this.keystrokes = [];
    this.mouseDownEvents = [];
    this.samplingEventCount = 0;
  }

  initialize(sessionId) {
    if (this.isInitialized) return;
    
    this.sessionId = sessionId;
    this.setupEventListeners();
    this.trackPageView();
    // setupBatchFlushing removed – global interactions deprecated, aggregated batches only
    
    // Start aggregation system
    if (this.aggregationEnabled) {
      this.startAggregationSystem();
    }
    
    this.isInitialized = true;
    
    console.log('✅ Global tracking initialized with aggregation');
  }
  
  // ===== AGGREGATION SYSTEM =====
  
  /**
   * Start 10-second aggregation windows and 30-second batch flushing
   */
  startAggregationSystem() {
    this.startNewAggregationWindow();
    
    // Rotate window every 10 seconds
    setInterval(() => {
      this.startNewAggregationWindow();
    }, this.windowDuration);
    
    // Flush aggregated batches every 30 seconds
    setInterval(() => {
      this.flushAggregatedBatches();
    }, this.aggregationFlushInterval);
    
    console.log('📊 Aggregation system started: 10s windows, 30s flush');
  }
  
  /**
   * Start a new 10-second aggregation window
   */
  startNewAggregationWindow() {
    // Close previous window if exists
    if (this.windowStartTime) {
      this.closeAggregationWindow();
    }
    
    // Reset tracking arrays
    this.clicks = [];
    this.mouseMoves = [];
    this.scrollEvents = [];
    this.zoomEvents = [];
    this.keystrokes = [];
    this.mouseDownEvents = [];
    this.samplingEventCount = 0;
    
    // Start new window
    this.windowStartTime = Date.now();
  }
  
  /**
   * Close current aggregation window and add to batch queue
   */
  closeAggregationWindow() {
    if (!this.windowStartTime) return;
    
    const aggregatedData = this.calculateAggregates();
    
    if (aggregatedData) {
      this.aggregationBatchQueue.push(aggregatedData);
      console.log(`📦 Aggregation window closed. Queue size: ${this.aggregationBatchQueue.length}`);
    }
    
    this.windowStartTime = null;
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
    
    // Misclick detection
    const misclick_count = this.detectMisclicks();
    const misclick_rate = click_count > 0 ? misclick_count / click_count : 0;
    
    // Rage click detection
    const rage_clicks = this.detectRageClicks();
    
    // Dwell time
    const avg_dwell_ms = this.calculateAverageDwell();
    
    // Zoom events
    const zoom_events = this.zoomEvents.length;
    
    // Scroll speed
    const scroll_speed_px_s = this.calculateScrollSpeed();
    
    // Page context (GDPR-compliant: sanitized domain + route)
    const page_context = sanitizePageContext(
      typeof window !== 'undefined' ? window.location.href : '',
      'web'
    );
    
    // Sampling profiler
    const sampling_hz = windowDuration > 0 ? this.samplingEventCount / windowDuration : 0;
    const input_lag_ms_est = this.estimateInputLag();
    
    // Generate batch ID
    const batch_id = `b_${this.batchIdCounter++}_${Date.now()}`;
    
    return {
      user_id: this.sessionId || 'unknown',
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
      raw_samples_optional: [],
      _profiler: {
        sampling_hz: Math.round(sampling_hz),
        input_lag_ms_est: Math.round(input_lag_ms_est),
      },
    };
  }
  
  // Aggregation helper methods
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
  
  calculateAverageDwell() {
    if (this.clicks.length === 0 || this.mouseDownEvents.length === 0) return 0;
    
    const dwellTimes = [];
    const POSITION_THRESHOLD = 20;
    
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
        dwellTimes.push(click.timestamp - matchingMouseDown.timestamp);
      }
    }
    
    return dwellTimes.length > 0
      ? dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length
      : 0;
  }
  
  calculateScrollSpeed() {
    if (this.scrollEvents.length < 2) return 0;
    
    const firstScroll = this.scrollEvents[0];
    const lastScroll = this.scrollEvents[this.scrollEvents.length - 1];
    
    const distance = Math.abs(lastScroll.scrollY - firstScroll.scrollY);
    const duration = (lastScroll.timestamp - firstScroll.timestamp) / 1000;
    
    return duration > 0 ? distance / duration : 0;
  }
  
  estimateInputLag() {
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
    
    if (delays.length > 0) {
      delays.sort((a, b) => a - b);
      const median = delays[Math.floor(delays.length / 2)];
      return Math.max(0, median - 100);
    }
    
    return 0;
  }
  
  /**
   * Flush aggregated batches to server
   */
  async flushAggregatedBatches() {
    if (this.aggregationBatchQueue.length === 0) {
      return;
    }
    
    // ONLY send data in AURA mode (when properly authenticated)
    if (!auraIntegration.isEnabled()) {
      this.aggregationBatchQueue = [];
      return;
    }
    
    const batches = [...this.aggregationBatchQueue];
    this.aggregationBatchQueue = [];
    
    try {
      const token = auraIntegration.getToken();
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/interactions/aggregated-batches`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ batches }),
      });
      
      if (response.ok) {
        console.log(`✅ Flushed ${batches.length} aggregated batches to server`);
      } else {
        console.error('❌ Failed to flush aggregated batches:', await response.text());
      }
    } catch (error) {
      console.error('❌ Error flushing aggregated batches:', error);
    }
  }
  
  /**
   * Track event for aggregation (called internally)
   */
  trackEventForAggregation(eventType, data) {
    if (!this.aggregationEnabled || !this.windowStartTime) return;
    
    this.samplingEventCount++;
    const timestamp = Date.now();
    
    switch (eventType) {
      case 'click':
        this.clicks.push({
          timestamp,
          x: data.coordinates?.x || 0,
          y: data.coordinates?.y || 0,
        });
        break;
        
      case 'mouse_down':
        this.mouseDownEvents.push({
          timestamp,
          x: data.coordinates?.x || 0,
          y: data.coordinates?.y || 0,
        });
        break;
        
      case 'mouse_move':
        this.mouseMoves.push({
          timestamp,
          x: data.coordinates?.x || 0,
          y: data.coordinates?.y || 0,
        });
        break;
        
      case 'scroll':
        this.scrollEvents.push({
          timestamp,
          scrollY: data.scrollPosition?.y || 0,
        });
        break;
        
      default:
        // Other events aren't tracked for aggregation
        break;
    }
  }
  
  // ===== END AGGREGATION SYSTEM =====
  
  // Setup automatic batch flushing
  setupBatchFlushing() {
    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flushBatch(true); // Synchronous flush
    });
    
    // Periodic flush
    setInterval(() => {
      this.flushBatch();
    }, 10000); // Every 10 seconds
  }

  // Helper: Create interaction data structure
  createInteractionData(eventType, data = {}) {
    if (!this.sessionId) {
      console.warn('⚠️ GlobalTracker: sessionId not set, interaction will be skipped');
      return null;
    }
    
    // Track for aggregation
    if (this.aggregationEnabled) {
      this.trackEventForAggregation(eventType, data);
    }
    
    return {
      sessionId: this.sessionId,
      module: 'global',
      eventType,
      timestamp: new Date(),
      ...data,
    };
  }

  // Helper: Add interaction to buffer (no-op – global interactions removed, aggregated only)
  addToBuffer(data) {
    if (!data) return;
    // No-op: global interactions deprecated
  }

  // Helper: Flush batch (no-op – global interactions removed)
  async flushBatch(synchronous = false) {
    this.interactionBuffer = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // Helper: Log to backend (adds to buffer)
  async logToBackend(data) {
    try {
      this.addToBuffer(data);
    } catch (error) {
      console.error('Tracking error:', error);
    }
  }

  // Helper: Throttle function
  throttle(key, func, delay) {
    const now = Date.now();
    if (!this.lastEventTime[key] || now - this.lastEventTime[key] >= delay) {
      this.lastEventTime[key] = now;
      func();
    }
  }

  // Helper: Get element data (GDPR: only tag – no id, class, text to avoid PII)
  getElementData(element) {
    if (!element) return {};
    return {
      tag: element.tagName?.toLowerCase(),
    };
  }

  // ===== BASIC MOUSE INTERACTIONS =====

  setupMouseEvents() {
    // 1. Click
    document.addEventListener('click', (e) => {
      this.logToBackend(this.createInteractionData('click', {
        coordinates: { x: e.clientX, y: e.clientY },
        screen: { x: e.screenX, y: e.screenY },
        button: e.button,
        target: this.getElementData(e.target),
      }));
    }, true);

    // 2. Mouse Down
    document.addEventListener('mousedown', (e) => {
      this.logToBackend(this.createInteractionData('mouse_down', {
        coordinates: { x: e.clientX, y: e.clientY },
        button: e.button,
        target: this.getElementData(e.target),
      }));
    }, true);

    // 3. Mouse Up
    document.addEventListener('mouseup', (e) => {
      this.logToBackend(this.createInteractionData('mouse_up', {
        coordinates: { x: e.clientX, y: e.clientY },
        button: e.button,
        target: this.getElementData(e.target),
      }));
    }, true);

    // 4. Mouse Move (throttled 500ms)
    document.addEventListener('mousemove', (e) => {
      this.throttle('mousemove', () => {
        this.logToBackend(this.createInteractionData('mouse_move', {
          coordinates: { x: e.clientX, y: e.clientY },
          screen: { x: e.screenX, y: e.screenY },
          movement: { x: e.movementX, y: e.movementY },
        }));
      }, 500);
    });

    // 5. Scroll (throttled 1000ms)
    document.addEventListener('scroll', () => {
      this.throttle('scroll', () => {
        this.logToBackend(this.createInteractionData('scroll', {
          scrollPosition: {
            x: window.pageXOffset || document.documentElement.scrollLeft,
            y: window.pageYOffset || document.documentElement.scrollTop,
          },
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
        }));
      }, 1000);
    }, true);
  }

  // ===== ADVANCED MOUSE INTERACTIONS =====

  setupAdvancedMouseEvents() {
    // 6. Double Click
    document.addEventListener('dblclick', (e) => {
      this.logToBackend(this.createInteractionData('double_click', {
        coordinates: { x: e.clientX, y: e.clientY },
        target: this.getElementData(e.target),
      }));
    }, true);

    // 7. Right Click
    document.addEventListener('contextmenu', (e) => {
      this.logToBackend(this.createInteractionData('right_click', {
        coordinates: { x: e.clientX, y: e.clientY },
        target: this.getElementData(e.target),
      }));
    }, true);

    // 8. Mouse Enter (throttled 200ms)
    document.addEventListener('mouseenter', (e) => {
      const targetId = e.target.id || e.target.tagName;
      this.throttle(`mouseenter_${targetId}`, () => {
        this.logToBackend(this.createInteractionData('mouse_enter', {
          target: this.getElementData(e.target),
        }));
      }, 200);
    }, true);

    // 9. Mouse Leave (throttled 200ms)
    document.addEventListener('mouseleave', (e) => {
      const targetId = e.target.id || e.target.tagName;
      this.throttle(`mouseleave_${targetId}`, () => {
        this.logToBackend(this.createInteractionData('mouse_leave', {
          target: this.getElementData(e.target),
        }));
      }, 200);
    }, true);
  }

  // ===== KEYBOARD INTERACTIONS =====

  setupKeyboardEvents() {
    // 10. Keypress (GDPR: mask code for character keys – e.code would reveal KeyA, Digit1)
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
      const isChar = e.key.length === 1;
      
      this.logToBackend(this.createInteractionData('keypress', {
        key: isChar ? '[CHAR]' : e.key,
        code: isChar ? null : e.code,
        target: { tag: target.tagName?.toLowerCase(), isInput },
        modifiers: {
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
        },
      }));
    });
  }

  // ===== FORM INTERACTIONS =====

  setupFormEvents() {
    // 11. Form Submission
    document.addEventListener('submit', (e) => {
      const form = e.target;
      const fields = form.querySelectorAll('input, textarea, select');
      
      this.logToBackend(this.createInteractionData('form_submission', {
        form: {
          id: form.id,
          action: form.action,
          method: form.method,
          fieldCount: fields.length,
        },
      }));
    }, true);
  }

  // ===== TOUCH INTERACTIONS =====

  setupTouchEvents() {
    // 16. Touch Start
    document.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.touchStartData = {
        time: Date.now(),
        x: touch.clientX,
        y: touch.clientY,
        touchCount: e.touches.length,
      };

      this.logToBackend(this.createInteractionData('touch_start', {
        coordinates: { x: touch.clientX, y: touch.clientY },
        touchCount: e.touches.length,
        target: this.getElementData(e.target),
        touches: Array.from(e.touches).map(t => ({
          identifier: t.identifier,
          x: t.clientX,
          y: t.clientY,
          force: t.force,
          radiusX: t.radiusX,
          radiusY: t.radiusY,
        })),
      }));
    }, { passive: true });

    // 17. Touch Move (throttled 300ms)
    document.addEventListener('touchmove', (e) => {
      this.throttle('touchmove', () => {
        const touch = e.touches[0];
        this.logToBackend(this.createInteractionData('touch_move', {
          coordinates: { x: touch.clientX, y: touch.clientY },
          touchCount: e.touches.length,
          touches: Array.from(e.touches).map(t => ({
            identifier: t.identifier,
            x: t.clientX,
            y: t.clientY,
            force: t.force,
          })),
        }));
      }, 300);
    }, { passive: true });

    // 18. Touch End
    document.addEventListener('touchend', (e) => {
      const touch = e.changedTouches[0];
      const now = Date.now();
      const duration = this.touchStartData ? now - this.touchStartData.time : 0;
      
      this.logToBackend(this.createInteractionData('touch_end', {
        coordinates: { x: touch.clientX, y: touch.clientY },
        touchCount: e.touches.length,
        duration,
        target: this.getElementData(e.target),
      }));

      // Detect swipe
      if (this.touchStartData && duration < 500) {
        const dx = touch.clientX - this.touchStartData.x;
        const dy = touch.clientY - this.touchStartData.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 50) {
          let direction = '';
          if (Math.abs(dx) > Math.abs(dy)) {
            direction = dx > 0 ? 'right' : 'left';
          } else {
            direction = dy > 0 ? 'down' : 'up';
          }
          
          // 20. Swipe
          this.logToBackend(this.createInteractionData('swipe', {
            direction,
            distance: Math.round(distance),
            duration,
            velocity: (distance / duration * 1000).toFixed(2),
          }));
        }
      }

      this.touchStartData = null;
    }, { passive: true });

    // 19. Touch Cancel
    document.addEventListener('touchcancel', (e) => {
      this.logToBackend(this.createInteractionData('touch_cancel', {
        touchCount: e.touches.length,
      }));
      this.touchStartData = null;
    }, { passive: true });
  }

  // ===== POINTER INTERACTIONS =====

  setupPointerEvents() {
    if (!window.PointerEvent) return; // Skip if not supported

    // 22. Pointer Down
    document.addEventListener('pointerdown', (e) => {
      this.pointerStartData[e.pointerId] = {
        time: Date.now(),
        x: e.clientX,
        y: e.clientY,
      };

      this.logToBackend(this.createInteractionData('pointer_down', {
        coordinates: { x: e.clientX, y: e.clientY },
        pointerType: e.pointerType,
        pointerId: e.pointerId,
        pressure: e.pressure,
        width: e.width,
        height: e.height,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        target: this.getElementData(e.target),
      }));
    }, true);

    // 23. Pointer Up
    document.addEventListener('pointerup', (e) => {
      const startData = this.pointerStartData[e.pointerId];
      const duration = startData ? Date.now() - startData.time : 0;

      this.logToBackend(this.createInteractionData('pointer_up', {
        coordinates: { x: e.clientX, y: e.clientY },
        pointerType: e.pointerType,
        pointerId: e.pointerId,
        duration,
        target: this.getElementData(e.target),
      }));

      delete this.pointerStartData[e.pointerId];
    }, true);

    // 24. Pointer Move (throttled 500ms)
    document.addEventListener('pointermove', (e) => {
      this.throttle(`pointermove_${e.pointerId}`, () => {
        this.logToBackend(this.createInteractionData('pointer_move', {
          coordinates: { x: e.clientX, y: e.clientY },
          pointerType: e.pointerType,
          pressure: e.pressure,
          movement: { x: e.movementX, y: e.movementY },
        }));
      }, 500);
    });

    // 25. Pointer Cancel
    document.addEventListener('pointercancel', (e) => {
      this.logToBackend(this.createInteractionData('pointer_cancel', {
        pointerType: e.pointerType,
        pointerId: e.pointerId,
      }));
      delete this.pointerStartData[e.pointerId];
    }, true);
  }

  // ===== PAGE NAVIGATION =====

  // 31. Page View
  trackPageView() {
    const pageLoadTime = performance.timing 
      ? performance.timing.loadEventEnd - performance.timing.navigationStart 
      : 0;

    this.logToBackend(this.createInteractionData('page_view', {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      pageLoadTime,
    }));
  }

  // 32. Page Unload
  setupPageUnloadTracking() {
    const pageStartTime = Date.now();
    
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Date.now() - pageStartTime;
      
      // Close aggregation window before unload
      if (this.aggregationEnabled && this.windowStartTime) {
        this.closeAggregationWindow();
        
        // Try to flush aggregated batches synchronously
        if (this.aggregationBatchQueue.length > 0 && auraIntegration.getToken()) {
          const batches = [...this.aggregationBatchQueue];
          const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/interactions/aggregated-batches`;
          const blob = new Blob([JSON.stringify({ batches })], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
      }
      // page_unload to global interactions removed – aggregated batches only
    });
  }

  // ===== SETUP ALL LISTENERS =====

  setupEventListeners() {
    this.setupMouseEvents();
    this.setupAdvancedMouseEvents();
    this.setupKeyboardEvents();
    this.setupFormEvents();
    this.setupTouchEvents();
    this.setupPointerEvents();
    this.setupPageUnloadTracking();
  }
}

// Export singleton instance
const globalTracker = new GlobalTracker();
export default globalTracker;
