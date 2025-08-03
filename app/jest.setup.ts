import 'dotenv/config';
import '@testing-library/jest-dom';

jest.setTimeout(30000); // Set a global timeout of 30 seconds

jest.setTimeout(30000); // Set a global timeout of 30 seconds
jest.setTimeout(30000); // Set a global timeout of 30 seconds
import { ReactNode } from 'react';
import { TextEncoder, TextDecoder } from 'util';
import 'whatwg-fetch'; // Polyfill for fetch API

// Polyfill TextEncoder/TextDecoder for Elasticsearch client in tests
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Polyfill TextEncoder/TextDecoder for Elasticsearch client in tests
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Polyfill ReadableStream for Elasticsearch client (undici)
import { ReadableStream } from 'stream/web';
global.ReadableStream = ReadableStream as any;

// Setup DOM environment for React 18 createRoot
// Remove any conflicting containers before each test
beforeEach(() => {
  // Clear any existing content in document.body
  document.body.innerHTML = '';
  // Create a fresh container element
  const div = document.createElement('div');
  div.id = 'test-container';
  document.body.appendChild(div);
});

afterEach(() => {
  // Clean up after each test
  document.body.innerHTML = '';
});

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
  }),
}));

jest.mock('next/link', () => {
  const React = require('react');
  return ({ children, href, className, suppressHydrationWarning, ...props }: { 
    children: ReactNode; 
    href: string; 
    className?: string;
    suppressHydrationWarning?: boolean;
    [key: string]: any;
  }) => React.createElement('a', { href, className, ...props }, children);
});

// Mock ClientOnly to always render children immediately in tests
jest.mock('@/components/ClientOnly', () => {
  return ({ children }: { children: any }) => children;
});

// Suppress deprecated act() warnings from ReactDOMTestUtils
const originalError = console.error;
const originalLog = console.log;
const originalWarn = console.warn;

console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: `ReactDOMTestUtils.act` is deprecated')
  ) {
    return;
  }
  // Ignore useErrorHandler test console.error calls
  if (
    typeof args[0] === 'string' &&
    (args[0] === 'Unknown: String error message' ||
     args[0] === 'Unknown: Test error' ||
     args[0] === 'Unknown: Async error' ||
     args[0] === 'Unknown: Handler error' ||
     args[0] === 'Unknown: Async handler error')
  ) {
    return;
  }
  // Ignore React act() warnings from async hooks in tests
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: An update to') &&
    args[0].includes('inside a test was not wrapped in act(...)')
  ) {
    return;
  }
  // Ignore HLS related warnings in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('HLS is not supported in this browser') ||
     args[0].includes('HLS error:') ||
     args[0].includes('HLS manifest parsed'))
  ) {
    return;
  }
  
  // Ignore expected test errors (these are intentional for testing error handling)
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Failed to fetch IVOD data') ||
     args[0].includes('Database status API returned error') ||
     args[0].includes('HTTP error! status: 404') ||
     args[0].includes('Network error') ||
     args[0].includes('TestComponent:') ||
     args[0].includes('Test error'))
  ) {
    // 可選：顯示簡化的測試說明而不是錯誤
    // console.log(`🧪 [TEST] Expected error handled: ${args[0].substring(0, 50)}...`);
    return;
  }
  
  originalError(...args as any);
};

console.log = (...args) => {
  // Ignore HLS related log messages in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('HLS manifest parsed') ||
     args[0].includes('HLS is') ||
     args[0].includes('HLS error'))
  ) {
    return;
  }
  originalLog(...args as any);
};

console.warn = (...args) => {
  // Ignore HLS related warning messages in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('HLS is not supported') ||
     args[0].includes('HLS error:') ||
     args[0].includes('HLS manifest'))
  ) {
    return;
  }
  originalWarn(...args as any);
};