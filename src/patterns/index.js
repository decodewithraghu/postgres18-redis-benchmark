/**
 * Pattern Index - Centralized Export
 * 
 * Provides easy access to all design patterns.
 */

const DatabaseConnectionManager = require('./DatabaseConnectionManager');
const QueryExecutorFactory = require('./QueryExecutorFactory');
const {
  QueryStrategy,
  RedisCacheStrategy,
  DirectPostgreSQLStrategy,
  HybridStrategy,
} = require('./QueryStrategy');
const {
  QueryBuilder,
  CustomerDashboardQueryBuilder,
  OrderQueryBuilder,
} = require('./QueryBuilder');
const {
  RetryDecorator,
  LoggingDecorator,
  MetricsDecorator,
  TimeoutDecorator,
  CircuitBreakerDecorator,
} = require('./QueryDecorators');
const {
  PerformanceMonitor,
  ConsoleObserver,
  FileLoggerObserver,
  MetricsAggregatorObserver,
} = require('./PerformanceMonitor');
const Errors = require('./Errors');

module.exports = {
  // Singleton
  DatabaseConnectionManager,

  // Factory
  QueryExecutorFactory,

  // Strategy
  QueryStrategy,
  RedisCacheStrategy,
  DirectPostgreSQLStrategy,
  HybridStrategy,

  // Builder
  QueryBuilder,
  CustomerDashboardQueryBuilder,
  OrderQueryBuilder,

  // Decorator
  RetryDecorator,
  LoggingDecorator,
  MetricsDecorator,
  TimeoutDecorator,
  CircuitBreakerDecorator,

  // Observer
  PerformanceMonitor,
  ConsoleObserver,
  FileLoggerObserver,
  MetricsAggregatorObserver,

  // Errors
  Errors,
};
