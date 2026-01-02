// Content Script - Tracks all user interactions on web pages
// This script runs on every page and captures various user interactions

(function() {
  'use strict';
  
  let isTrackingEnabled = false;
  let trackingConfig = {
    clicks: true,
    keystrokes: true,
    mouseMovements: true,
    pageViews: true,
    doubleClicks: true,
    rightClicks: true,
    mouseHovers: true,
    dragAndDrop: true,
    touchEvents: true,
    zoomEvents: true
  };
  
  // Throttle function for mouse movements to avoid excessive data
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // Initialize tracking state from storage
  async function initializeTracking() {
    try {
      const result = await chrome.storage.local.get(['trackingEnabled', 'trackingConfig', 'consentGiven']);
      
      if (result.consentGiven) {
        isTrackingEnabled = result.trackingEnabled !== false; // Default to true if consent given
        if (result.trackingConfig) {
          trackingConfig = { ...trackingConfig, ...result.trackingConfig };
        }
        
        if (isTrackingEnabled) {
          startTracking();
        }
      }
    } catch (error) {
      console.error('Failed to initialize tracking:', error);
    }
  }
  
  // Send interaction data to background script
  function sendInteraction(data) {
    if (!isTrackingEnabled) return;
    
    chrome.runtime.sendMessage({
      type: 'INTERACTION',
      data: {
        ...data,
        url: window.location.href,
        timestamp: Date.now(),
        pageTitle: document.title
      }
    }).catch(err => {
      // Silently handle errors (e.g., extension context invalidated)
      console.debug('Failed to send interaction:', err);
    });
  }
  
  // Track mouse clicks
  function trackClick(event) {
    if (!trackingConfig.clicks) return;
    
    const target = event.target;
    const data = {
      type: 'click',
      elementTag: target.tagName,
      elementId: target.id || null,
      elementClass: target.className || null,
      elementText: target.innerText?.substring(0, 100) || null,
      x: event.clientX,
      y: event.clientY,
      button: event.button
    };
    
    sendInteraction(data);
  }
  
  // Track keystrokes (with privacy in mind - not capturing actual keys)
  function trackKeypress(event) {
    if (!trackingConfig.keystrokes) return;
    
    const target = event.target;
    const data = {
      type: 'keypress',
      key: event.key.length === 1 ? '[CHAR]' : event.key, // Mask character keys for privacy
      code: event.code,
      elementTag: target.tagName,
      elementType: target.type || null,
      isInput: target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
    };
    
    sendInteraction(data);
  }
  
  // Track mouse movements (throttled to every 500ms)
  const trackMouseMove = throttle(function(event) {
    if (!trackingConfig.mouseMovements) return;
    
    const data = {
      type: 'mouse_move',
      x: event.clientX,
      y: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY
    };
    
    sendInteraction(data);
  }, 500);
  
  // Track page views
  function trackPageView() {
    if (!trackingConfig.pageViews) return;
    
    const data = {
      type: 'page_view',
      url: window.location.href,
      title: document.title,
      referrer: document.referrer || null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
    
    sendInteraction(data);
  }
  
  // Track scroll events (throttled)
  const trackScroll = throttle(function() {
    if (!trackingConfig.mouseMovements) return; // Using same config as mouse movements
    
    const data = {
      type: 'scroll',
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight
    };
    
    sendInteraction(data);
  }, 1000);
  
  // Track double clicks
  function trackDoubleClick(event) {
    if (!trackingConfig.doubleClicks) return;
    
    const target = event.target;
    const data = {
      type: 'double_click',
      elementTag: target.tagName,
      elementId: target.id || null,
      elementClass: target.className || null,
      elementText: target.innerText?.substring(0, 100) || null,
      x: event.clientX,
      y: event.clientY
    };
    
    sendInteraction(data);
  }
  
  // Track right clicks (context menu)
  function trackRightClick(event) {
    if (!trackingConfig.rightClicks) return;
    
    const target = event.target;
    const data = {
      type: 'right_click',
      elementTag: target.tagName,
      elementId: target.id || null,
      elementClass: target.className || null,
      elementText: target.innerText?.substring(0, 100) || null,
      x: event.clientX,
      y: event.clientY
    };
    
    sendInteraction(data);
  }
  
  // Track mouse down events
  function trackMouseDown(event) {
    if (!trackingConfig.clicks) return;
    
    const target = event.target;
    const data = {
      type: 'mouse_down',
      elementTag: target.tagName,
      elementId: target.id || null,
      button: event.button,
      x: event.clientX,
      y: event.clientY
    };
    
    sendInteraction(data);
  }
  
  // Track mouse up events
  function trackMouseUp(event) {
    if (!trackingConfig.clicks) return;
    
    const target = event.target;
    const data = {
      type: 'mouse_up',
      elementTag: target.tagName,
      elementId: target.id || null,
      button: event.button,
      x: event.clientX,
      y: event.clientY
    };
    
    sendInteraction(data);
  }
  
  // Track mouse enter/leave (throttled for hovers)
  const trackMouseEnter = throttle(function(event) {
    if (!trackingConfig.mouseHovers) return;
    
    const target = event.target;
    const data = {
      type: 'mouse_enter',
      elementTag: target.tagName,
      elementId: target.id || null,
      elementClass: target.className || null
    };
    
    sendInteraction(data);
  }, 200);
  
  const trackMouseLeave = throttle(function(event) {
    if (!trackingConfig.mouseHovers) return;
    
    const target = event.target;
    const data = {
      type: 'mouse_leave',
      elementTag: target.tagName,
      elementId: target.id || null
    };
    
    sendInteraction(data);
  }, 200);
  
  // Track drag and drop events
  function trackDragStart(event) {
    if (!trackingConfig.dragAndDrop) return;
    
    const target = event.target;
    const data = {
      type: 'drag_start',
      elementTag: target.tagName,
      elementId: target.id || null,
      elementClass: target.className || null,
      x: event.clientX,
      y: event.clientY
    };
    
    sendInteraction(data);
  }
  
  function trackDragEnd(event) {
    if (!trackingConfig.dragAndDrop) return;
    
    const target = event.target;
    const data = {
      type: 'drag_end',
      elementTag: target.tagName,
      elementId: target.id || null,
      x: event.clientX,
      y: event.clientY
    };
    
    sendInteraction(data);
  }
  
  function trackDragOver(event) {
    if (!trackingConfig.dragAndDrop) return;
    
    // Throttle this to avoid excessive events
    if (event.timeStamp - (trackDragOver.lastTime || 0) < 300) return;
    trackDragOver.lastTime = event.timeStamp;
    
    const data = {
      type: 'drag_over',
      x: event.clientX,
      y: event.clientY
    };
    
    sendInteraction(data);
  }
  
  function trackDrop(event) {
    if (!trackingConfig.dragAndDrop) return;
    
    const target = event.target;
    const data = {
      type: 'drop',
      elementTag: target.tagName,
      elementId: target.id || null,
      x: event.clientX,
      y: event.clientY,
      dataTransferTypes: Array.from(event.dataTransfer?.types || [])
    };
    
    sendInteraction(data);
  }
  
  // Track touch events
  function trackTouchStart(event) {
    if (!trackingConfig.touchEvents) return;
    
    const target = event.target;
    const touch = event.touches[0];
    const data = {
      type: 'touch_start',
      elementTag: target.tagName,
      elementId: target.id || null,
      elementClass: target.className || null,
      touchCount: event.touches.length,
      x: touch.clientX,
      y: touch.clientY
    };
    
    sendInteraction(data);
  }
  
  const trackTouchMove = throttle(function(event) {
    if (!trackingConfig.touchEvents) return;
    
    const touch = event.touches[0];
    const data = {
      type: 'touch_move',
      touchCount: event.touches.length,
      x: touch.clientX,
      y: touch.clientY
    };
    
    sendInteraction(data);
  }, 300);
  
  function trackTouchEnd(event) {
    if (!trackingConfig.touchEvents) return;
    
    const target = event.target;
    const data = {
      type: 'touch_end',
      elementTag: target.tagName,
      elementId: target.id || null,
      touchCount: event.changedTouches.length
    };
    
    sendInteraction(data);
  }
  
  function trackTouchCancel(event) {
    if (!trackingConfig.touchEvents) return;
    
    const data = {
      type: 'touch_cancel',
      touchCount: event.changedTouches.length
    };
    
    sendInteraction(data);
  }
  
  // Detect gestures (pinch, swipe)
  let touchStartData = null;
  
  function detectGestures(event) {
    if (!trackingConfig.touchEvents) return;
    
    if (event.type === 'touchstart') {
      touchStartData = {
        time: Date.now(),
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        touchCount: event.touches.length
      };
    } else if (event.type === 'touchend' && touchStartData) {
      const endTouch = event.changedTouches[0];
      const duration = Date.now() - touchStartData.time;
      const deltaX = endTouch.clientX - touchStartData.x;
      const deltaY = endTouch.clientY - touchStartData.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Detect swipe (fast movement)
      if (duration < 500 && distance > 50) {
        const direction = Math.abs(deltaX) > Math.abs(deltaY) 
          ? (deltaX > 0 ? 'right' : 'left')
          : (deltaY > 0 ? 'down' : 'up');
        
        sendInteraction({
          type: 'swipe',
          direction: direction,
          distance: Math.round(distance),
          duration: duration
        });
      }
      
      touchStartData = null;
    }
  }
  
  // Track pinch zoom
  let lastTouchDistance = null;
  let lastPinchTime = 0;
  
  function trackPinch(event) {
    if (!trackingConfig.touchEvents) return;
    
    // Reset if not exactly 2 touches
    if (event.touches.length !== 2) {
      lastTouchDistance = null;
      lastPinchTime = 0;
      return;
    }
    
    // Throttle pinch detection to avoid too many events (every 200ms)
    const now = Date.now();
    if (now - lastPinchTime < 200) {
      return;
    }
    
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    
    // Need a baseline distance before we can detect pinch
    if (lastTouchDistance === null) {
      lastTouchDistance = distance;
      return;
    }
    
    // Calculate scale and detect significant changes
    const scale = distance / lastTouchDistance;
    
    // Lower threshold for better sensitivity (5% change instead of 10%)
    if (Math.abs(scale - 1) > 0.05) {
      sendInteraction({
        type: 'pinch',
        scale: scale.toFixed(2),
        action: scale > 1 ? 'zoom_in' : 'zoom_out',
        initialDistance: Math.round(lastTouchDistance),
        currentDistance: Math.round(distance)
      });
      
      // Update baseline for next pinch detection
      lastTouchDistance = distance;
      lastPinchTime = now;
    }
  }
  
  // Track desktop zoom events
  let lastZoomLevel = window.devicePixelRatio || 1;
  let lastVisualViewportScale = window.visualViewport?.scale || 1;
  let lastZoomTime = 0;
  
  // Track browser zoom (Ctrl +/-, Ctrl + Mouse Wheel, or settings)
  function trackBrowserZoom() {
    if (!trackingConfig.zoomEvents) return;
    
    const now = Date.now();
    if (now - lastZoomTime < 500) return; // Throttle to 500ms
    
    const currentZoom = window.devicePixelRatio || 1;
    const visualViewportScale = window.visualViewport?.scale || 1;
    
    // Check if zoom level changed
    if (Math.abs(currentZoom - lastZoomLevel) > 0.01 || 
        Math.abs(visualViewportScale - lastVisualViewportScale) > 0.01) {
      
      const zoomChange = currentZoom / lastZoomLevel;
      const action = zoomChange > 1 ? 'zoom_in' : 'zoom_out';
      
      sendInteraction({
        type: 'browser_zoom',
        action: action,
        zoomLevel: currentZoom.toFixed(2),
        previousZoom: lastZoomLevel.toFixed(2),
        zoomChange: zoomChange.toFixed(2),
        visualViewportScale: visualViewportScale.toFixed(2),
        method: 'browser' // browser zoom via settings or keyboard
      });
      
      lastZoomLevel = currentZoom;
      lastVisualViewportScale = visualViewportScale;
      lastZoomTime = now;
    }
  }
  
  // Track mouse wheel zoom (Ctrl + Wheel)
  function trackWheelZoom(event) {
    if (!trackingConfig.zoomEvents) return;
    
    // Detect zoom: Ctrl key + wheel, or pinch gesture on trackpad
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault(); // Prevent default zoom to track it
      
      const now = Date.now();
      if (now - lastZoomTime < 300) return; // Throttle
      
      const direction = event.deltaY < 0 ? 'zoom_in' : 'zoom_out';
      const deltaY = Math.abs(event.deltaY);
      
      sendInteraction({
        type: 'wheel_zoom',
        action: direction,
        deltaY: Math.round(deltaY),
        method: event.ctrlKey ? 'ctrl_wheel' : 'trackpad_pinch',
        x: event.clientX,
        y: event.clientY
      });
      
      lastZoomTime = now;
      
      // Also check for actual zoom level change shortly after
      setTimeout(trackBrowserZoom, 100);
    }
  }
  
  // Track keyboard zoom (Ctrl/Cmd + Plus/Minus/0)
  function trackKeyboardZoom(event) {
    if (!trackingConfig.zoomEvents) return;
    
    // Detect Ctrl/Cmd + Plus, Minus, or 0
    if ((event.ctrlKey || event.metaKey) && 
        (event.key === '+' || event.key === '=' || 
         event.key === '-' || event.key === '_' || 
         event.key === '0')) {
      
      const now = Date.now();
      if (now - lastZoomTime < 300) return;
      
      let action = 'zoom_reset';
      if (event.key === '+' || event.key === '=') action = 'zoom_in';
      if (event.key === '-' || event.key === '_') action = 'zoom_out';
      
      sendInteraction({
        type: 'keyboard_zoom',
        action: action,
        key: event.key,
        method: 'keyboard_shortcut'
      });
      
      lastZoomTime = now;
      
      // Check actual zoom level change
      setTimeout(trackBrowserZoom, 100);
    }
  }
  
  // Visual Viewport API - tracks pinch-zoom on mobile and desktop
  function setupVisualViewportTracking() {
    if (!window.visualViewport || !trackingConfig.zoomEvents) return;
    
    const trackViewportResize = throttle(function() {
      if (!trackingConfig.zoomEvents) return;
      
      const scale = window.visualViewport.scale;
      
      if (Math.abs(scale - lastVisualViewportScale) > 0.05) {
        const action = scale > lastVisualViewportScale ? 'zoom_in' : 'zoom_out';
        
        sendInteraction({
          type: 'visual_viewport_zoom',
          action: action,
          scale: scale.toFixed(2),
          previousScale: lastVisualViewportScale.toFixed(2),
          viewportWidth: window.visualViewport.width,
          viewportHeight: window.visualViewport.height,
          method: 'visual_viewport'
        });
        
        lastVisualViewportScale = scale;
      }
    }, 500);
    
    window.visualViewport.addEventListener('resize', trackViewportResize);
  }
  
  // Start tracking all interactions
  function startTracking() {
    // Track page view on load
    trackPageView();
    
    // Basic interactions
    document.addEventListener('click', trackClick, true);
    document.addEventListener('keydown', trackKeypress, true);
    document.addEventListener('mousemove', trackMouseMove, true);
    window.addEventListener('scroll', trackScroll, true);
    
    // Mouse interactions
    document.addEventListener('dblclick', trackDoubleClick, true);
    document.addEventListener('contextmenu', trackRightClick, true);
    document.addEventListener('mousedown', trackMouseDown, true);
    document.addEventListener('mouseup', trackMouseUp, true);
    document.addEventListener('mouseenter', trackMouseEnter, true);
    document.addEventListener('mouseleave', trackMouseLeave, true);
    
    // Drag and drop
    document.addEventListener('dragstart', trackDragStart, true);
    document.addEventListener('dragend', trackDragEnd, true);
    document.addEventListener('dragover', trackDragOver, true);
    document.addEventListener('drop', trackDrop, true);
    
    // Touch events
    document.addEventListener('touchstart', trackTouchStart, true);
    document.addEventListener('touchmove', trackTouchMove, true);
    document.addEventListener('touchend', trackTouchEnd, true);
    document.addEventListener('touchcancel', trackTouchCancel, true);
    
    // Gesture detection
    document.addEventListener('touchstart', detectGestures, true);
    document.addEventListener('touchend', detectGestures, true);
    document.addEventListener('touchmove', trackPinch, true);
    
    // Zoom events (desktop and mobile)
    document.addEventListener('wheel', trackWheelZoom, { passive: false, capture: true });
    document.addEventListener('keydown', trackKeyboardZoom, true);
    window.addEventListener('resize', trackBrowserZoom);
    setupVisualViewportTracking();
    
    // Initial zoom level capture
    lastZoomLevel = window.devicePixelRatio || 1;
    lastVisualViewportScale = window.visualViewport?.scale || 1;
    
    console.log('User interaction tracking started (with extended events + zoom)');
  }
  
  // Stop tracking
  function stopTracking() {
    // Basic interactions
    document.removeEventListener('click', trackClick, true);
    document.removeEventListener('keydown', trackKeypress, true);
    document.removeEventListener('mousemove', trackMouseMove, true);
    window.removeEventListener('scroll', trackScroll, true);
    
    // Mouse interactions
    document.removeEventListener('dblclick', trackDoubleClick, true);
    document.removeEventListener('contextmenu', trackRightClick, true);
    document.removeEventListener('mousedown', trackMouseDown, true);
    document.removeEventListener('mouseup', trackMouseUp, true);
    document.removeEventListener('mouseenter', trackMouseEnter, true);
    document.removeEventListener('mouseleave', trackMouseLeave, true);
    
    // Drag and drop
    document.removeEventListener('dragstart', trackDragStart, true);
    document.removeEventListener('dragend', trackDragEnd, true);
    document.removeEventListener('dragover', trackDragOver, true);
    document.removeEventListener('drop', trackDrop, true);
    
    // Touch events
    document.removeEventListener('touchstart', trackTouchStart, true);
    document.removeEventListener('touchmove', trackTouchMove, true);
    document.removeEventListener('touchend', trackTouchEnd, true);
    document.removeEventListener('touchcancel', trackTouchCancel, true);
    
    // Gesture detection
    document.removeEventListener('touchstart', detectGestures, true);
    document.removeEventListener('touchend', detectGestures, true);
    document.removeEventListener('touchmove', trackPinch, true);
    
    // Zoom events
    document.removeEventListener('wheel', trackWheelZoom, true);
    document.removeEventListener('keydown', trackKeyboardZoom, true);
    window.removeEventListener('resize', trackBrowserZoom);
    
    console.log('User interaction tracking stopped');
  }
  
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_TRACKING') {
      isTrackingEnabled = message.enabled;
      
      if (isTrackingEnabled) {
        startTracking();
      } else {
        stopTracking();
      }
      
      sendResponse({ success: true });
    } else if (message.type === 'UPDATE_CONFIG') {
      trackingConfig = { ...trackingConfig, ...message.config };
      sendResponse({ success: true });
    }
    
    return true; // Keep message channel open for async response
  });
  
  // Initialize when script loads
  initializeTracking();
  
  // Track page unload and trigger sync
  window.addEventListener('beforeunload', function() {
    if (!isTrackingEnabled) return;
    
    // Track page unload event
    if (trackingConfig.pageViews) {
      const data = {
        type: 'page_unload',
        timeOnPage: Date.now() - (window.pageLoadTime || Date.now())
      };
      sendInteraction(data);
    }
    
    // Trigger sync to flush pending data to server
    chrome.runtime.sendMessage({ type: 'PAGE_UNLOAD_SYNC' }).catch(() => {
      // Ignore errors - page is closing anyway
    });
  });
  
  // Store page load time
  window.pageLoadTime = Date.now();
  
})();

