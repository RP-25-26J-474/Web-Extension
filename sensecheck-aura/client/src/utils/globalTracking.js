/**
 * Comprehensive Global Interaction Tracking System
 * Tracks all user interactions across the entire application
 * Uses ML-ready GlobalInteractionBucket for efficient storage
 */

import { logGlobalInteractions } from './api';

class GlobalTracker {
  constructor() {
    this.sessionId = null;
    this.lastEventTime = {};
    this.throttleTimers = {};
    this.touchStartData = null;
    this.pointerStartData = {};
    this.isInitialized = false;
    
    // Batching for performance
    this.interactionBuffer = [];
    this.BATCH_SIZE = 10;
    this.BATCH_TIMEOUT = 2000; // 2 seconds
    this.batchTimer = null;
  }

  initialize(sessionId) {
    if (this.isInitialized) return;
    
    this.sessionId = sessionId;
    this.setupEventListeners();
    this.trackPageView();
    this.setupBatchFlushing();
    this.isInitialized = true;
    
    console.log('✅ Global tracking initialized with bucket pattern');
  }
  
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
    
    return {
      sessionId: this.sessionId,
      module: 'global',
      eventType,
      timestamp: new Date(),
      ...data,
    };
  }

  // Helper: Add interaction to buffer
  addToBuffer(data) {
    // Skip if data is null (no sessionId)
    if (!data) return;
    
    this.interactionBuffer.push(data);
    
    // Auto-flush if buffer is full
    if (this.interactionBuffer.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else {
      // Reset batch timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.BATCH_TIMEOUT);
    }
  }

  // Helper: Flush batch to backend
  async flushBatch(synchronous = false) {
    if (this.interactionBuffer.length === 0) return;
    
    // Skip if no sessionId
    if (!this.sessionId) {
      console.warn('⚠️ GlobalTracker: Cannot flush batch, sessionId not set');
      this.interactionBuffer = []; // Clear invalid buffer
      return;
    }
    
    const batch = [...this.interactionBuffer];
    this.interactionBuffer = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    try {
      if (synchronous) {
        // Use sendBeacon for synchronous unload
        const blob = new Blob([JSON.stringify({
          sessionId: this.sessionId,
          interactions: batch,
        })], { type: 'application/json' });
        
        navigator.sendBeacon(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/global/interactions`,
          blob
        );
      } else {
        // Async batch - Use ML-ready endpoint
        await logGlobalInteractions(this.sessionId, batch);
        console.log(`📦 Flushed ${batch.length} global interactions (ML-ready)`);
      }
    } catch (error) {
      console.error('Error flushing interaction batch:', error);
      // Re-add to buffer on error
      this.interactionBuffer.unshift(...batch);
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

  // Helper: Get element data
  getElementData(element) {
    if (!element) return {};
    return {
      tag: element.tagName?.toLowerCase(),
      id: element.id || null,
      class: element.className || null,
      text: element.innerText?.substring(0, 100) || null,
      type: element.type || null,
      name: element.name || null,
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
    // 10. Keypress
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
      
      // Mask character keys for privacy
      const key = e.key.length === 1 ? '[CHAR]' : e.key;
      
      this.logToBackend(this.createInteractionData('keypress', {
        key,
        code: e.code,
        target: {
          tag: target.tagName?.toLowerCase(),
          type: target.type,
          isInput,
        },
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
      
      // Use sendBeacon for reliable delivery during unload
      const data = this.createInteractionData('page_unload', {
        timeOnPage,
        url: window.location.href,
      });
      
      navigator.sendBeacon('/api/logs/interaction', JSON.stringify(data));
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

