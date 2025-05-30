import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

interface LogFile {
  name: string;
  size: number;
  lastModified: string;
  path: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Basic authentication check (you might want to implement proper auth)
  const authHeader = req.headers.authorization;
  if (!authHeader || !isValidAuth(authHeader)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { method } = req;
  const logDirectory = process.env.LOG_PATH || 'logs';

  try {
    if (method === 'GET') {
      const { file, lines = '100' } = req.query;

      if (file && typeof file === 'string') {
        // Read specific log file
        const logFilePath = path.join(logDirectory, file);
        
        // Security check: ensure file is within log directory
        const resolvedPath = path.resolve(logFilePath);
        const resolvedLogDir = path.resolve(logDirectory);
        if (!resolvedPath.startsWith(resolvedLogDir)) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        if (!fs.existsSync(logFilePath)) {
          res.status(404).json({ error: 'Log file not found' });
          return;
        }

        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const logLines = logContent.split('\n').filter(line => line.trim());
        
        // Return last N lines
        const numLines = parseInt(lines as string, 10) || 100;
        const recentLines = logLines.slice(-numLines);
        
        // Parse log entries
        const entries: LogEntry[] = recentLines.map(line => {
          try {
            // Try to parse structured log format
            const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \[(\w+)\] (.+)$/);
            if (match) {
              const [, timestamp, level, message] = match;
              return { timestamp, level, message };
            }
            
            // Fallback for non-structured logs
            return {
              timestamp: new Date().toISOString(),
              level: 'info',
              message: line
            };
          } catch {
            return {
              timestamp: new Date().toISOString(),
              level: 'info',
              message: line
            };
          }
        });

        res.status(200).json({ entries, totalLines: logLines.length });
      } else {
        // List available log files
        if (!fs.existsSync(logDirectory)) {
          res.status(200).json({ files: [] });
          return;
        }

        const files = fs.readdirSync(logDirectory)
          .filter(file => file.endsWith('.log'))
          .map(file => {
            const filePath = path.join(logDirectory, file);
            const stats = fs.statSync(filePath);
            return {
              name: file,
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
              path: file
            };
          })
          .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

        res.status(200).json({ files });
      }
    } else if (method === 'DELETE') {
      const { file } = req.body;
      
      if (!file || typeof file !== 'string') {
        res.status(400).json({ error: 'File name required' });
        return;
      }

      const logFilePath = path.join(logDirectory, file);
      
      // Security check
      const resolvedPath = path.resolve(logFilePath);
      const resolvedLogDir = path.resolve(logDirectory);
      if (!resolvedPath.startsWith(resolvedLogDir)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (fs.existsSync(logFilePath)) {
        fs.unlinkSync(logFilePath);
        logger.info('Log file deleted via admin interface', {
          component: 'admin',
          action: 'delete_log_file',
          fileName: file
        });
        res.status(200).json({ success: true });
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    logger.logApiError(error, req, { endpoint: 'admin/logs' });
    res.status(500).json({ error: 'Internal server error' });
  }
}

function isValidAuth(authHeader: string): boolean {
  // Simple basic auth check - you should implement proper authentication
  const token = authHeader.replace('Bearer ', '');
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!adminToken) {
    console.warn('ADMIN_TOKEN not set - admin access disabled');
    return false;
  }
  
  return token === adminToken;
}