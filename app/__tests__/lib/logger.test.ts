import { Logger, LogLevel } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import { NextApiRequest } from 'next';

// Mock fs
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Logger', () => {
  let logger: Logger;
  let testLogDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    testLogDir = '/test/logs';
    
    // Setup fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation();
    mockFs.appendFileSync.mockImplementation();
    mockFs.statSync.mockReturnValue({
      size: 1000,
      mtime: new Date(),
    } as any);
    mockFs.readdirSync.mockReturnValue([]);
    
    logger = new Logger({
      logToFile: true,
      logToConsole: false,
      logLevel: 'info',
      logDirectory: testLogDir,
    });
  });

  describe('initialization', () => {
    it('should create log directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      new Logger({
        logToFile: true,
        logDirectory: testLogDir,
      });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(testLogDir, { recursive: true });
    });

    it('should not create directory if logToFile is false', () => {
      new Logger({
        logToFile: false,
        logDirectory: testLogDir,
      });

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('logging levels', () => {
    it('should log error messages', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const testLogger = new Logger({
        logToConsole: true,
        logToFile: false,
        logLevel: 'error',
      });

      testLogger.error('Test error message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Test error message')
      );
      
      consoleSpy.mockRestore();
    });

    it('should respect log level filtering', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      const testLogger = new Logger({
        logToConsole: true,
        logToFile: false,
        logLevel: 'error', // Only error level
      });

      testLogger.info('This should not be logged');

      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should log all levels when set to debug', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
      
      const testLogger = new Logger({
        logToConsole: true,
        logToFile: false,
        logLevel: 'debug',
      });

      testLogger.error('Error message');
      testLogger.warn('Warning message');
      testLogger.info('Info message');
      testLogger.debug('Debug message');

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalled();
      
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe('file logging', () => {
    it('should write to file when logToFile is true', () => {
      logger.info('Test message');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('app_'),
        expect.stringContaining('[INFO] Test message'),
        'utf8'
      );
    });

    it('should include context in log format', () => {
      const context = {
        method: 'GET',
        url: '/api/test',
        userId: '12345',
      };

      logger.error('Test error', context);

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/GET \/api\/test.*userId=12345/s),
        'utf8'
      );
    });

    it('should handle file write errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFs.appendFileSync.mockImplementation(() => {
        throw new Error('File write error');
      });

      logger.info('Test message');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to write to log file:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('API-specific logging methods', () => {
    it('should log API errors with request context', () => {
      const mockReq = {
        method: 'POST',
        url: '/api/search',
        headers: {
          'user-agent': 'test-agent',
        },
        socket: {
          remoteAddress: '127.0.0.1',
        },
      } as unknown as NextApiRequest;

      const error = new Error('API error');
      logger.logApiError(error, mockReq, { customData: 'test' });

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/API Error.*POST \/api\/search.*customData/s),
        'utf8'
      );
    });

    it('should log database errors with operation context', () => {
      const error = new Error('Database connection failed');
      logger.logDatabaseError(error, 'search', { query: 'test query' });

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/Database Error.*database_search.*test query/s),
        'utf8'
      );
    });

    it('should log search errors with query context', () => {
      const error = new Error('Search failed');
      logger.logSearchError(error, 'test query', 'elasticsearch', { index: 'test' });

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/Search Error.*test query.*elasticsearch/s),
        'utf8'
      );
    });
  });

  describe('log rotation', () => {
    it('should rotate log file when it exceeds max size', () => {
      mockFs.statSync.mockReturnValue({
        size: 11 * 1024 * 1024, // 11MB, exceeds 10MB limit
        mtime: new Date(),
      } as any);
      
      mockFs.readdirSync.mockReturnValue(['app_2024-01-01.log']);
      mockFs.renameSync.mockImplementation();
      mockFs.unlinkSync.mockImplementation();

      logger.info('Test message');

      expect(mockFs.renameSync).toHaveBeenCalled();
    });

    it('should clean up old log files', () => {
      // Mock scenario with 7 log files (exceeds maxFiles: 5)
      const oldFiles = [
        'app_2024-01-01.log',
        'app_2024-01-02.log',
        'app_2024-01-03.log',
        'app_2024-01-04.log',
        'app_2024-01-05.log',
        'app_2024-01-06.log',
        'app_2024-01-07.log',
      ];

      mockFs.readdirSync.mockReturnValue(oldFiles);
      mockFs.statSync
        .mockReturnValueOnce({ size: 11 * 1024 * 1024, mtime: new Date('2024-01-07') } as any)
        .mockReturnValue({ size: 1000, mtime: new Date('2024-01-01') } as any);
      
      mockFs.renameSync.mockImplementation();
      mockFs.unlinkSync.mockImplementation();

      logger.info('Test message');

      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2); // Should remove 2 oldest files
    });
  });

  describe('format log entry', () => {
    it('should format log entry with all context fields', () => {
      const testLogger = new Logger({
        logToConsole: true,
        logToFile: false,
      });
      
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      testLogger.info('Test message', {
        method: 'POST',
        url: '/api/test',
        component: 'TestComponent',
        action: 'test_action',
        ip: '192.168.1.1',
        userId: 'user123',
        error: 'Error details',
        stack: 'Error stack trace',
        metadata: { key: 'value' },
      });

      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[INFO] Test message');
      expect(loggedMessage).toContain('POST /api/test');
      expect(loggedMessage).toContain('component=TestComponent');
      expect(loggedMessage).toContain('action=test_action');
      expect(loggedMessage).toContain('ip=192.168.1.1');
      expect(loggedMessage).toContain('userId=user123');
      expect(loggedMessage).toContain('Error: Error details');
      expect(loggedMessage).toContain('Stack: Error stack trace');
      expect(loggedMessage).toContain('Metadata:');

      consoleSpy.mockRestore();
    });
  });
});