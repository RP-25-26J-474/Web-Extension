// Jest setup file - runs before each test file

// Polyfill for TextEncoder/TextDecoder (needed for some dependencies)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Chrome extension API
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    onSuspend: {
      addListener: jest.fn(),
    },
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    remove: jest.fn(),
    onRemoved: {
      addListener: jest.fn(),
    },
  },
};

// Note: Don't override window or document here - let jsdom handle it
// Tests can mock specific properties as needed
