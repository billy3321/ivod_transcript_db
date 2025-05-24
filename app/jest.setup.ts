import dotenv from 'dotenv';
dotenv.config();
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
import '@testing-library/jest-dom';
import { ReactNode } from 'react';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for Elasticsearch client in tests
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Polyfill ReadableStream for Elasticsearch client (undici)
import { ReadableStream } from 'stream/web';
global.ReadableStream = ReadableStream as any;

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