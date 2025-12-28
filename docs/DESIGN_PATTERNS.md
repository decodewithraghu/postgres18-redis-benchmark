# Design Patterns Applied - Detailed Documentation

## Overview

This document explains all design patterns applied to improve the Redis-PostgreSQL stress test codebase.

## Design Patterns Summary

| Pattern | Purpose | Implementation |
|---------|---------|----------------|
| **Singleton** | Single database connection instance | `DatabaseConnectionManager` |
| **Strategy** | Swappable query algorithms | `RedisCacheStrategy`, `DirectPostgreSQLStrategy` |
| **Factory** | Create query executors | `QueryExecutorFactory` |
| **Builder** | Construct complex SQL queries | `QueryBuilder`, `CustomerDashboardQueryBuilder` |
| **Decorator** | Add features without inheritance | `RetryDecorator`, `MetricsDecorator` |
| **Observer** | Monitor performance events | `PerformanceMonitor` |

---

## 1. Singleton Pattern

### Problem
- Multiple database connection instances waste resources
- Connection pool fragmentation
- Difficult to manage connection lifecycle

### Solution
`DatabaseConnectionManager` ensures only one instance of database connections exists.

### Implementation

```javascript
class DatabaseConnectionManager {
  constructor() {
    if (DatabaseConnectionManager.instance) {
      return DatabaseConnectionManager.instance;
    }
    this._pgPool = null;
    this._redisClient = null;
    DatabaseConnectionManager.instance = this;
  }
}

// Export singleton instance
module.exports = new DatabaseConnectionManager();
```

### Benefits
- ✅ Single connection pool instance
- ✅ Centralized connection management
- ✅ Easy health monitoring
- ✅ Proper resource cleanup

### Usage

```javascript
const dbManager = require('./patterns/DatabaseConnectionManager');

// Initialize once
await dbManager.initialize();

// Use anywhere
const pgPool = dbManager.getPgPool();
const redis = dbManager.getRedisClient();

// Cleanup
await dbManager.closeAll();
```

---

## 2. Strategy Pattern

### Problem
- Hard-coded query logic
- Cannot switch between Redis/PostgreSQL at runtime
- Difficult to test different approaches

### Solution
Define a family of algorithms (query strategies) and make them interchangeable.

### Implementation

```javascript
// Abstract base
class QueryStrategy {
  async getCustomerDashboard(customerId) {
    throw new Error('Must implement');
  }
}

// Concrete strategies
class RedisCacheStrategy extends QueryStrategy {
  async getCustomerDashboard(customerId) {
    // Check Redis → Query DB → Cache result
  }
}

class DirectPostgreSQLStrategy extends QueryStrategy {
  async getCustomerDashboard(customerId) {
    // Query PostgreSQL directly
  }
}
```

### Benefits
- ✅ Runtime strategy switching
- ✅ Easy to add new strategies
- ✅ Clean separation of concerns
- ✅ Testable in isolation

### Usage

```javascript
// Create strategies
const redisStrategy = new RedisCacheStrategy();
const pgStrategy = new DirectPostgreSQLStrategy();

// Switch at runtime
let currentStrategy = redisStrategy;
const data = await currentStrategy.getCustomerDashboard(123);

currentStrategy = pgStrategy; // Switch!
const data2 = await currentStrategy.getCustomerDashboard(123);
```

---

## 3. Factory Pattern

### Problem
- Complex object creation logic scattered throughout code
- Hard to maintain creation rules
- Violates Open/Closed Principle

### Solution
`QueryExecutorFactory` centralizes creation logic for query executors.

### Implementation

```javascript
class QueryExecutorFactory {
  static STRATEGIES = {
    REDIS: 'redis',
    POSTGRES: 'postgres',
    HYBRID: 'hybrid',
  };

  static create(strategyType, options = {}) {
    switch (strategyType) {
      case this.STRATEGIES.REDIS:
        return new RedisCacheStrategy();
      case this.STRATEGIES.POSTGRES:
        return new DirectPostgreSQLStrategy();
      case this.STRATEGIES.HYBRID:
        return new HybridStrategy(options.hotDataThreshold);
      default:
        throw new Error(`Unknown strategy: ${strategyType}`);
    }
  }

  static createAll(options = {}) {
    return {
      redis: this.create('redis', options),
      postgres: this.create('postgres', options),
      hybrid: this.create('hybrid', options),
    };
  }
}
```

### Benefits
- ✅ Centralized creation logic
- ✅ Easy to add new types
- ✅ Consistent object creation
- ✅ Better testability

### Usage

```javascript
// Create single strategy
const executor = QueryExecutorFactory.create('redis');

// Create with options
const hybrid = QueryExecutorFactory.create('hybrid', {
  hotDataThreshold: 100
});

// Create all strategies
const all = QueryExecutorFactory.createAll();
const { redis, postgres, hybrid } = all;
```

---

## 4. Builder Pattern

### Problem
- Complex SQL queries hard to construct
- String concatenation error-prone
- Parameters hard to manage
- Not reusable

### Solution
Fluent interface for building SQL queries step by step.

### Implementation

```javascript
class QueryBuilder {
  select(...columns) {
    this._select.push(...columns);
    return this;
  }

  from(table) {
    this._from = table;
    return this;
  }

  where(condition, ...params) {
    // Process condition and parameters
    return this;
  }

  orderBy(column, direction = 'ASC') {
    this._orderBy.push(`${column} ${direction}`);
    return this;
  }

  build() {
    // Construct final query
    return {
      text: '...',
      values: [...]
    };
  }
}
```

### Benefits
- ✅ Readable query construction
- ✅ Parameter management
- ✅ Reusable query templates
- ✅ Type-safe building

### Usage

```javascript
const builder = new CustomerDashboardQueryBuilder();

// Fluent interface
const query = builder
  .select('c.id', 'c.name', 'c.email')
  .from('customers c')
  .leftJoin('orders o', 'o.customer_id = c.id')
  .where('c.id = ?', 123)
  .orderBy('o.created_at', 'DESC')
  .limit(10)
  .build();

// Execute
const result = await pgPool.query(query.text, query.values);
```

---

## 5. Decorator Pattern

### Problem
- Want to add features (retry, logging, metrics) without modifying core classes
- Inheritance creates rigid hierarchies
- Cannot combine features flexibly

### Solution
Wrap objects with decorators that add functionality.

### Implementation

```javascript
class QueryExecutorDecorator {
  constructor(executor) {
    this.executor = executor;
  }

  async getCustomerDashboard(customerId) {
    return await this.executor.getCustomerDashboard(customerId);
  }
}

class RetryDecorator extends QueryExecutorDecorator {
  constructor(executor, maxRetries = 3) {
    super(executor);
    this.maxRetries = maxRetries;
  }

  async getCustomerDashboard(customerId) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.executor.getCustomerDashboard(customerId);
      } catch (error) {
        if (attempt === this.maxRetries) throw error;
        await this._sleep(100 * Math.pow(2, attempt));
      }
    }
  }
}
```

### Benefits
- ✅ Add features dynamically
- ✅ Stack decorators (compose)
- ✅ No modification to base class
- ✅ Single Responsibility Principle

### Available Decorators

1. **RetryDecorator** - Exponential backoff retry
2. **LoggingDecorator** - Detailed execution logging
3. **MetricsDecorator** - Performance metrics collection
4. **TimeoutDecorator** - Query timeout protection
5. **CircuitBreakerDecorator** - Prevent cascading failures

### Usage

```javascript
// Start with base strategy
let executor = new DirectPostgreSQLStrategy();

// Stack decorators
executor = new RetryDecorator(executor, 3);
executor = new MetricsDecorator(executor);
executor = new TimeoutDecorator(executor, 5000);
executor = new LoggingDecorator(executor);

// Use as normal
const data = await executor.getCustomerDashboard(123);

// Access decorator features
const metrics = executor.getMetrics(); // From MetricsDecorator
```

---

## 6. Observer Pattern

### Problem
- Need to monitor performance across multiple components
- Hard-coded logging scattered everywhere
- Cannot add new monitoring without code changes

### Solution
`PerformanceMonitor` notifies observers of query events.

### Implementation

```javascript
class PerformanceMonitor {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    this.observers.push(observer);
  }

  notify(event) {
    for (const observer of this.observers) {
      observer.update(event);
    }
  }

  recordQuery(queryInfo) {
    this.notify({
      type: 'QUERY_EXECUTED',
      data: queryInfo
    });
  }
}

class ConsoleObserver {
  update(event) {
    if (event.type === 'ALERT') {
      console.warn(`⚠️ ${event.data.message}`);
    }
  }
}
```

### Benefits
- ✅ Loose coupling
- ✅ Multiple observers
- ✅ Easy to add new monitoring
- ✅ Real-time notifications

### Available Observers

1. **ConsoleObserver** - Console logging
2. **FileLoggerObserver** - File-based logging
3. **MetricsAggregatorObserver** - Aggregate metrics by strategy

### Usage

```javascript
// Create monitor
const monitor = new PerformanceMonitor();

// Subscribe observers
monitor.subscribe(new ConsoleObserver());
monitor.subscribe(new FileLoggerObserver('./logs/queries.log'));
const metricsObserver = new MetricsAggregatorObserver();
monitor.subscribe(metricsObserver);

// Record events
monitor.recordQuery({
  strategy: 'PostgreSQL',
  customerId: 123,
  duration: 45,
  success: true
});

// Get aggregated metrics
const metrics = metricsObserver.getMetrics();
console.log(metrics);
```

---

## Pattern Interactions

### How Patterns Work Together

```
┌─────────────────────────────────────────────────────────┐
│                    APPLICATION                           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              QueryExecutorFactory (Factory)              │
│  Creates appropriate strategy with decorators            │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│           RetryDecorator (Decorator)                     │
│           ↓                                              │
│           MetricsDecorator (Decorator)                   │
│           ↓                                              │
│           TimeoutDecorator (Decorator)                   │
│           ↓                                              │
│           RedisCacheStrategy (Strategy)                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│       DatabaseConnectionManager (Singleton)              │
│  Provides connection pool and Redis client               │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│         PerformanceMonitor (Observer)                    │
│  Notifies all observers of query events                  │
└─────────────────────────────────────────────────────────┘
```

---

## Before vs After Comparison

### Before (Original Code)

```javascript
// ❌ Direct database connections scattered
const pgPool = new Pool(config.pg);
const redis = new Redis(config.redis);

// ❌ Hardcoded query logic
async function getCustomerDashboardWithRedis(customerId) {
  const cached = await redis.get(`dashboard:${customerId}`);
  if (cached) return JSON.parse(cached);
  
  const client = await pgPool.connect();
  const result = await client.query('...', [customerId]);
  client.release();
  
  await redis.setex('...', 3000, JSON.stringify(data));
  return data;
}

// ❌ No error handling or retry
// ❌ No metrics collection
// ❌ Hard to test
```

### After (With Patterns)

```javascript
// ✅ Singleton connection management
await DatabaseConnectionManager.initialize();

// ✅ Factory creates strategy
let executor = QueryExecutorFactory.create('redis');

// ✅ Decorators add features
executor = new RetryDecorator(executor, 3);
executor = new MetricsDecorator(executor);
executor = new TimeoutDecorator(executor, 5000);

// ✅ Observer monitors performance
const monitor = new PerformanceMonitor();
monitor.subscribe(new ConsoleObserver());

// ✅ Clean execution
const data = await executor.getCustomerDashboard(123);

// ✅ Easy to test, extend, maintain
```

---

## Best Practices

### 1. Use Singleton for Shared Resources
```javascript
// ✅ Good
const dbManager = DatabaseConnectionManager;
await dbManager.initialize();

// ❌ Bad
const pool1 = new Pool(config);
const pool2 = new Pool(config); // Duplicate!
```

### 2. Prefer Composition over Inheritance
```javascript
// ✅ Good - Compose with decorators
let executor = new BaseStrategy();
executor = new RetryDecorator(executor);
executor = new MetricsDecorator(executor);

// ❌ Bad - Deep inheritance
class RetryMetricsStrategy extends RetryStrategy extends MetricsStrategy
```

### 3. Keep Strategies Focused
```javascript
// ✅ Good - Single responsibility
class RedisCacheStrategy {
  async getCustomerDashboard(customerId) {
    // Only caching logic
  }
}

// ❌ Bad - Multiple responsibilities
class RedisCacheStrategyWithRetryAndLogging {
  // Too many concerns!
}
```

### 4. Use Builders for Complex Objects
```javascript
// ✅ Good
const query = new CustomerDashboardQueryBuilder()
  .buildForCustomer(123);

// ❌ Bad
const query = `SELECT ... WHERE id = ${id}`; // SQL injection!
```

---

## Testing Benefits

### Easy Mocking with Patterns

```javascript
// Mock strategy for testing
class MockStrategy extends QueryStrategy {
  async getCustomerDashboard(customerId) {
    return { customer: { id: customerId }, orders: [] };
  }
}

// Test with decorators
describe('RetryDecorator', () => {
  it('should retry on failure', async () => {
    const mock = new MockStrategy();
    const executor = new RetryDecorator(mock, 3);
    
    // Test retry logic
  });
});

// Test with observer
describe('PerformanceMonitor', () => {
  it('should notify observers', () => {
    const monitor = new PerformanceMonitor();
    const spy = jest.fn();
    monitor.subscribe({ update: spy });
    
    monitor.recordQuery({ /* ... */ });
    expect(spy).toHaveBeenCalled();
  });
});
```

---

## Performance Impact

### Overhead Analysis

| Pattern | Overhead | Impact |
|---------|----------|--------|
| Singleton | ~0ms | Negligible - one-time init |
| Strategy | ~0ms | Just method call |
| Factory | ~0ms | Object creation |
| Builder | ~0.1ms | Query string building |
| Decorator | ~0.1-0.5ms | Per decorator layer |
| Observer | ~0.05ms | Per notification |

**Total overhead: < 1ms per query**

Benefits far outweigh minimal overhead:
- Better maintainability
- Easier debugging
- Automatic retry & error handling
- Performance monitoring

---

## Conclusion

These design patterns transform the codebase from:

**Before:**
- Procedural, hard to extend
- No error recovery
- Difficult to test
- Tight coupling

**After:**
- Object-oriented, SOLID principles
- Automatic retry and resilience
- Easy to test and mock
- Loose coupling, high cohesion

The investment in patterns pays off through:
1. **Maintainability** - Easy to understand and modify
2. **Extensibility** - Add features without breaking existing code
3. **Testability** - Mock and test in isolation
4. **Reliability** - Built-in error handling and monitoring
5. **Performance** - Optimized connection management

---

## Further Reading

- [Design Patterns: Elements of Reusable Object-Oriented Software](https://en.wikipedia.org/wiki/Design_Patterns)
- [Refactoring Guru - Design Patterns](https://refactoring.guru/design-patterns)
- [JavaScript Design Patterns](https://www.patterns.dev/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
