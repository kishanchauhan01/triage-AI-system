import express from 'express';
import cors from 'cors';
import { rawBodyTruncator } from './src/ingestion/ingest.middleware.js';
import { triageIngestController } from './src/ingestion/ingest.controller.js';

const app = express();

// Apply CORS middleware
app.use(cors());


// Security Headers Middleware
app.use((req, res, next) => {
  // Enforce X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Restrict allowed HTTP methods to safe list
  const allowedMethods = ['GET', 'POST'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).send('Method Not Allowed');
  }

  next();
});

// Configure health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Configure ingestion route using rawBodyTruncator middleware
app.post('/triage', rawBodyTruncator, triageIngestController);

// Custom Error Handler for Express
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  
  // Always return the standard fallback object so downstream never breaks
  return res.status(200).json({
    category: 'other',
    priority: 'P3',
    summary: `System fallback: Unhandled server exception: ${err.message}`,
    suggested_action: 'Route to human reviewer.',
    needs_human: true,
    confidence: 0.0
  });
});

export default app;
