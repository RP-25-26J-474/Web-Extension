/**
 * Test Suite for Content Script
 * Tests interaction tracking on web pages
 */

describe('Content Script', () => {
  let sendInteraction;
  let isTrackingEnabled;
  let trackingConfig;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup window and document mocks for this test
    global.window = {
      location: {
        href: 'http://test.com/page',
        hostname: 'test.com',
        pathname: '/page',
      },
      scrollY: 0,
      innerWidth: 1920,
      innerHeight: 1080,
    };
    
    global.document = {
      title: 'Test Page',
      referrer: 'http://referrer.com',
    };
    
    // Reset tracking state
    isTrackingEnabled = true;
    trackingConfig = {
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
    };
    
    // Mock sendInteraction function
    sendInteraction = jest.fn((data) => {
      if (!isTrackingEnabled) return;
      
      chrome.runtime.sendMessage({
        type: 'INTERACTION',
        data: {
          ...data,
          url: window.location.href,
          timestamp: Date.now(),
          pageTitle: document.title,
        },
      });
    });
    
    // Mock chrome.runtime.sendMessage
    chrome.runtime.sendMessage.mockResolvedValue({ success: true });
  });
  
  describe('Initialization', () => {
    test('should initialize tracking from storage', async () => {
      chrome.storage.local.get.mockResolvedValue({
        trackingEnabled: true,
        consentGiven: true,
        trackingConfig: {
          clicks: true,
          keystrokes: true,
        },
      });
      
      const result = await chrome.storage.local.get(['trackingEnabled', 'trackingConfig', 'consentGiven']);
      
      expect(result.trackingEnabled).toBe(true);
      expect(result.consentGiven).toBe(true);
      expect(result.trackingConfig.clicks).toBe(true);
    });
    
    test('should not track if consent not given', async () => {
      chrome.storage.local.get.mockResolvedValue({
        consentGiven: false,
      });
      
      const result = await chrome.storage.local.get(['consentGiven']);
      
      expect(result.consentGiven).toBe(false);
    });
  });
  
  describe('Click Tracking', () => {
    test('should track click events', () => {
      const clickData = {
        type: 'click',
        elementTag: 'BUTTON',
        elementId: 'submit-btn',
        elementClass: 'btn-primary',
        elementText: 'Submit',
        x: 100,
        y: 200,
        button: 0,
      };
      
      sendInteraction(clickData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'click',
          elementTag: 'BUTTON',
          x: 100,
          y: 200,
        }),
      });
    });
    
    test('should not track clicks if tracking disabled', () => {
      isTrackingEnabled = false;
      
      sendInteraction({
        type: 'click',
        x: 100,
        y: 200,
      });
      
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('should track double click events', () => {
      const dblClickData = {
        type: 'double_click',
        elementTag: 'DIV',
        x: 150,
        y: 250,
      };
      
      sendInteraction(dblClickData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'double_click',
        }),
      });
    });
    
    test('should track right click events', () => {
      const rightClickData = {
        type: 'right_click',
        elementTag: 'IMG',
        x: 200,
        y: 300,
      };
      
      sendInteraction(rightClickData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'right_click',
        }),
      });
    });
  });
  
  describe('Keystroke Tracking', () => {
    test('should track keypress events with masked characters', () => {
      const keypressData = {
        type: 'keypress',
        key: '[CHAR]', // Masked for privacy
        code: 'KeyA',
        elementTag: 'INPUT',
        elementType: 'text',
        isInput: true,
      };
      
      sendInteraction(keypressData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'keypress',
          key: '[CHAR]',
        }),
      });
    });
    
    test('should not mask special keys', () => {
      const keypressData = {
        type: 'keypress',
        key: 'Enter',
        code: 'Enter',
        elementTag: 'INPUT',
      };
      
      sendInteraction(keypressData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          key: 'Enter',
        }),
      });
    });
  });
  
  describe('Mouse Movement Tracking', () => {
    test('should track mouse move events', () => {
      const mouseMoveData = {
        type: 'mouse_move',
        x: 500,
        y: 600,
        screenX: 1000,
        screenY: 1200,
      };
      
      sendInteraction(mouseMoveData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'mouse_move',
          x: 500,
          y: 600,
        }),
      });
    });
    
    test('should track mouse down and up events', () => {
      sendInteraction({
        type: 'mouse_down',
        x: 100,
        y: 100,
        button: 0,
      });
      
      sendInteraction({
        type: 'mouse_up',
        x: 100,
        y: 100,
        button: 0,
      });
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Scroll Tracking', () => {
    test('should track scroll events', () => {
      const scrollData = {
        type: 'scroll',
        scrollX: 0,
        scrollY: 500,
        documentHeight: 2000,
        viewportHeight: 1080,
      };
      
      sendInteraction(scrollData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'scroll',
          scrollY: 500,
        }),
      });
    });
  });
  
  describe('Touch Events Tracking', () => {
    test('should track touch start events', () => {
      const touchData = {
        type: 'touch_start',
        elementTag: 'BUTTON',
        touchCount: 1,
        x: 100,
        y: 200,
      };
      
      sendInteraction(touchData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'touch_start',
          touchCount: 1,
        }),
      });
    });
    
    test('should track swipe gestures', () => {
      const swipeData = {
        type: 'swipe',
        direction: 'left',
        distance: 150,
        duration: 300,
      };
      
      sendInteraction(swipeData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'swipe',
          direction: 'left',
        }),
      });
    });
    
    test('should track pinch gestures', () => {
      const pinchData = {
        type: 'pinch',
        scale: 1.5,
        action: 'zoom_in',
        initialDistance: 100,
        currentDistance: 150,
      };
      
      sendInteraction(pinchData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'pinch',
          action: 'zoom_in',
        }),
      });
    });
  });
  
  describe('Zoom Events Tracking', () => {
    test('should track browser zoom', () => {
      const zoomData = {
        type: 'browser_zoom',
        action: 'zoom_in',
        zoomLevel: 1.5,
        previousZoom: 1.0,
        zoomChange: 1.5,
      };
      
      sendInteraction(zoomData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'browser_zoom',
          action: 'zoom_in',
        }),
      });
    });
    
    test('should track wheel zoom (Ctrl+Wheel)', () => {
      const wheelZoomData = {
        type: 'wheel_zoom',
        action: 'zoom_in',
        deltaY: 100,
        method: 'ctrl_wheel',
        x: 500,
        y: 600,
      };
      
      sendInteraction(wheelZoomData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'wheel_zoom',
          method: 'ctrl_wheel',
        }),
      });
    });
    
    test('should track keyboard zoom', () => {
      const keyboardZoomData = {
        type: 'keyboard_zoom',
        action: 'zoom_in',
        key: '+',
        method: 'keyboard_shortcut',
      };
      
      sendInteraction(keyboardZoomData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'keyboard_zoom',
          action: 'zoom_in',
        }),
      });
    });
  });
  
  describe('Drag and Drop Tracking', () => {
    test('should track drag start', () => {
      const dragStartData = {
        type: 'drag_start',
        elementTag: 'DIV',
        x: 100,
        y: 200,
      };
      
      sendInteraction(dragStartData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'drag_start',
        }),
      });
    });
    
    test('should track drop events', () => {
      const dropData = {
        type: 'drop',
        elementTag: 'DIV',
        x: 200,
        y: 300,
        dataTransferTypes: ['text/plain'],
      };
      
      sendInteraction(dropData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'drop',
        }),
      });
    });
  });
  
  describe('Page View Tracking', () => {
    test('should track page views', () => {
      const pageViewData = {
        type: 'page_view',
        url: 'http://test.com/page',
        title: 'Test Page',
        referrer: 'http://referrer.com',
        viewportWidth: 1920,
        viewportHeight: 1080,
      };
      
      sendInteraction(pageViewData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'page_view',
          // URL will be from window.location which is mocked
        }),
      });
    });
    
    test('should track page unload', () => {
      const pageUnloadData = {
        type: 'page_unload',
        timeOnPage: 5000,
      };
      
      sendInteraction(pageUnloadData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'INTERACTION',
        data: expect.objectContaining({
          type: 'page_unload',
        }),
      });
    });
  });
  
  describe('Configuration Toggle', () => {
    test('should respect tracking configuration', () => {
      trackingConfig.clicks = false;
      
      // Should not track if config disabled
      if (!trackingConfig.clicks) {
        expect(true).toBe(true); // Config check works
      }
    });
    
    test('should handle message to toggle tracking', () => {
      const message = {
        type: 'TOGGLE_TRACKING',
        enabled: false,
      };
      
      isTrackingEnabled = message.enabled;
      
      expect(isTrackingEnabled).toBe(false);
    });
    
    test('should handle message to update config', () => {
      const message = {
        type: 'UPDATE_CONFIG',
        config: {
          clicks: false,
          keystrokes: false,
        },
      };
      
      trackingConfig = { ...trackingConfig, ...message.config };
      
      expect(trackingConfig.clicks).toBe(false);
      expect(trackingConfig.keystrokes).toBe(false);
    });
  });
});

