import type { NextApiRequest, NextApiResponse } from 'next';
import { logger, LogLevel, LogEntry } from '@/lib/logger';

interface LogRequest {
  level: LogLevel;
  message: string;
  context?: LogEntry['context'];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests for logging
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { level, message, context }: LogRequest = req.body;

    // Validate required fields
    if (!level || !message) {
      res.status(400).json({ error: 'Missing required fields: level and message' });
      return;
    }

    // Validate log level
    if (!['error', 'warn', 'info', 'debug'].includes(level)) {
      res.status(400).json({ error: 'Invalid log level' });
      return;
    }

    // Add request metadata to context
    const enrichedContext = {
      ...context,
      ip: logger['getClientIP'](req),
      userAgent: req.headers['user-agent'],
      metadata: {
        ...(context?.metadata || {}),
        timestamp: new Date().toISOString(),
      }
    };

    // Log the message using the appropriate level
    switch (level) {
      case 'error':
        logger.error(message, enrichedContext);
        break;
      case 'warn':
        logger.warn(message, enrichedContext);
        break;
      case 'info':
        logger.info(message, enrichedContext);
        break;
      case 'debug':
        logger.debug(message, enrichedContext);
        break;
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.logApiError(error, req, { endpoint: 'logs' });
    res.status(500).json({ error: 'Internal server error' });
  }
}