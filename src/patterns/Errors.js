/**
 * Custom Error Classes
 * 
 * Provides specific error types for better error handling and debugging.
 */

class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;
    this.timestamp = new Date();
    
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

class ConnectionError extends DatabaseError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'ConnectionError';
  }
}

class QueryError extends DatabaseError {
  constructor(message, query = null, originalError = null) {
    super(message, originalError);
    this.name = 'QueryError';
    this.query = query;
  }
}

class CacheError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'CacheError';
    this.originalError = originalError;
    this.timestamp = new Date();
  }
}

class TimeoutError extends Error {
  constructor(message, operation = null) {
    super(message);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timestamp = new Date();
  }
}

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

module.exports = {
  DatabaseError,
  ConnectionError,
  QueryError,
  CacheError,
  TimeoutError,
  ValidationError,
};
