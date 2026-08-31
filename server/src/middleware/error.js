import { ConstraintError, HttpError } from '../lib/errors.js';

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found.' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ConstraintError) {
    res.status(409).json({
      error: err.message,
      violations: err.violations,
      suggestions: err.suggestions,
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...err.extra });
    return;
  }
  if (err.name === 'ZodError') {
    res.status(400).json({ error: 'Invalid input.', details: err.issues });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
}

export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
