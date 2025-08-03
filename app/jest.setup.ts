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
  return ({ children }: { children: ReactNode }) => children;
});

// Suppress deprecated act() warnings from ReactDOMTestUtils
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: `ReactDOMTestUtils.act` is deprecated')
  ) {
    return;
  }
  originalError(...args as any);
};