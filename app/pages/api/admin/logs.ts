import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import {
  withErrorHandler,
  createErrorResponse,
} from '@/lib/api-middleware';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: any;
}

async function adminLogsHandler(req: NextApiRequest, res: NextApiResponse) {
  // Bearer token auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !isValidAuth(authHeader)) {
    throw createErrorResponse('Unauthorized', 401);
  }

  const { method } = req;
  const logDirectory = process.env.LOG_PATH || 'logs';
  const resolvedLogDir = path.resolve(logDirectory);

  if (method === 'GET') {
    const { file, lines = '100' } = req.query;

    if (file && typeof file === 'string') {
      // 讀特定 log 檔案
      const logFilePath = path.join(logDirectory, file);
      const resolvedPath = path.resolve(logFilePath);
      if (!resolvedPath.startsWith(resolvedLogDir + path.sep) && resolvedPath !== resolvedLogDir) {
        throw createErrorResponse('Access denied', 403);
      }

      if (!fs.existsSync(logFilePath)) {
        throw createErrorResponse('Log file not found', 404);
      }

      const logContent = fs.readFileSync(logFilePath, 'utf8');
      const logLines = logContent.split('\n').filter(line => line.trim());
      const numLines = parseInt(lines as string, 10) || 100;
      const recentLines = logLines.slice(-numLines);

      const entries: LogEntry[] = recentLines.map(line => {
        const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \[(\w+)\] (.+)$/);
        if (match) {
          const [, timestamp, level, message] = match;
          return { timestamp, level, message };
        }
        return {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: line,
        };
      });

      res.status(200).json({ entries, totalLines: logLines.length });
      return;
    }

    // 列出所有 log 檔案
    if (!fs.existsSync(logDirectory)) {
      res.status(200).json({ files: [] });
      return;
    }

    const files = fs.readdirSync(logDirectory)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const filePath = path.join(logDirectory, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          path: f,
        };
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    res.status(200).json({ files });
    return;
  }

  if (method === 'DELETE') {
    const { file } = req.body || {};

    if (!file || typeof file !== 'string') {
      throw createErrorResponse('File name required', 400);
    }

    const logFilePath = path.join(logDirectory, file);
    const resolvedPath = path.resolve(logFilePath);
    if (!resolvedPath.startsWith(resolvedLogDir + path.sep) && resolvedPath !== resolvedLogDir) {
      throw createErrorResponse('Access denied', 403);
    }

    if (!fs.existsSync(logFilePath)) {
      throw createErrorResponse('File not found', 404);
    }

    fs.unlinkSync(logFilePath);
    logger.info('Log file deleted via admin interface', {
      component: 'admin',
      action: 'delete_log_file',
      metadata: { fileName: file },
    });
    res.status(200).json({ success: true });
    return;
  }

  throw createErrorResponse('Method not allowed', 405);
}

function isValidAuth(authHeader: string): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    console.warn('ADMIN_TOKEN not set - admin access disabled');
    return false;
  }

  const a = Buffer.from(token);
  const b = Buffer.from(adminToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default withErrorHandler(adminLogsHandler);
