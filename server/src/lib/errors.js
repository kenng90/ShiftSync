export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export class ConstraintError extends HttpError {
  constructor(violations, suggestions = []) {
    const first = violations[0];
    super(409, first?.message || 'Assignment violates a scheduling rule', {
      violations,
      suggestions,
    });
    this.violations = violations;
    this.suggestions = suggestions;
  }
}
