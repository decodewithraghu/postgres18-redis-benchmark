# 🚀 Quick Start Guide

Get started with the improved Redis-PostgreSQL benchmark in 5 minutes!

---

## 📋 Prerequisites

- Node.js 16+ installed
- PostgreSQL 18+ running on localhost:5432
- Redis 7+ running on localhost:6379

---

## ⚡ Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Create `.env` file:
```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=benchmark_db
PG_USER=postgres
PG_PASSWORD=postgres

REDIS_HOST=localhost
REDIS_PORT=6379

NUM_CUSTOMERS=50000
ORDERS_PER_CUSTOMER=500
CONCURRENT_USERS=200
REQUESTS_PER_USER=10
```

### 3. Run Original Benchmark
```bash
npm start
```

### 4. Run Improved Benchmark (with Design Patterns)
```bash
node benchmark.improved.js
```

### 5. Explore Examples
```bash
node examples.js
```

---

## 📖 What's Different?

### Original Code
```javascript
// benchmark.js - Simple and direct
const Redis = require('ioredis');
const { Pool } = require('pg');

const redis = new Redis();
const pgPool = new Pool(config.pg);

async function query(id) {
  const cached = await redis.get(`key:${id}`);
  if (cached) return JSON.parse(cached);
  
  const result = await pgPool.query('SELECT ...', [id]);
  await redis.set(`key:${id}`, JSON.stringify(result));
  return result;
}
```

### Improved Code
```javascript
// benchmark.improved.js - With Design Patterns
const { 
  DatabaseConnectionManager,    // Singleton
  QueryExecutorFactory,          // Factory
  RetryDecorator,                // Decorator
  MetricsDecorator,              // Decorator
  PerformanceMonitor             // Observer
} = require('./patterns');

// Initialize singleton
await DatabaseConnectionManager.initialize();

// Create strategy with factory
let executor = QueryExecutorFactory.create('postgres');

// Add features with decorators
executor = new RetryDecorator(executor, 3);
executor = new MetricsDecorator(executor);

// Setup monitoring with observer
const monitor = new PerformanceMonitor();
monitor.subscribe(new ConsoleObserver());

// Execute with automatic retry, metrics, monitoring
const result = await executor.getCustomerDashboard(123);
const metrics = executor.getMetrics();
```

---

## 🎯 Key Features

### 1. **Singleton Pattern** - Connection Management
```javascript
// ONE connection pool for entire application
const dbManager = DatabaseConnectionManager;
await dbManager.initialize();

// Health check
const health = await dbManager.getHealthStatus();
console.log(health); // { postgres: true, redis: true }

// Pool stats
const stats = dbManager.getPoolStats();
console.log(stats); // { total: 5, idle: 3, waiting: 0 }
```

### 2. **Strategy Pattern** - Swappable Algorithms
```javascript
// Choose strategy at runtime
const strategies = {
  redis: QueryExecutorFactory.create('redis'),
  postgres: QueryExecutorFactory.create('postgres'),
  hybrid: QueryExecutorFactory.create('hybrid')
};

// Switch strategies
let executor = strategies.redis;
await executor.getCustomerDashboard(123); // Uses Redis

executor = strategies.postgres;
await executor.getCustomerDashboard(123); // Uses PostgreSQL
```

### 3. **Decorator Pattern** - Add Features
```javascript
// Start with base
let executor = new DirectPostgreSQLStrategy();

// Stack decorators
executor = new RetryDecorator(executor, 3);        // Add retry
executor = new TimeoutDecorator(executor, 5000);   // Add timeout
executor = new MetricsDecorator(executor);         // Add metrics

// All features automatically applied!
const result = await executor.getCustomerDashboard(123);
```

### 4. **Factory Pattern** - Easy Creation
```javascript
// Create executor with one line
const executor = QueryExecutorFactory.create('postgres');

// Create all types
const all = QueryExecutorFactory.createAll();
// { redis: ..., postgres: ..., hybrid: ... }
```

### 5. **Observer Pattern** - Real-time Monitoring
```javascript
const monitor = new PerformanceMonitor();

// Add observers
monitor.subscribe(new ConsoleObserver());          // Log to console
monitor.subscribe(new FileLoggerObserver('log')); // Write to file
const metrics = new MetricsAggregatorObserver();
monitor.subscribe(metrics);                        // Aggregate metrics

// Automatic notifications
monitor.recordQuery({
  strategy: 'PostgreSQL',
  duration: 45,
  success: true
});

// Get aggregated metrics
console.log(metrics.getMetrics());
```

### 6. **Builder Pattern** - Query Construction
```javascript
const builder = new CustomerDashboardQueryBuilder();

// Fluent interface
const query = builder
  .select('id', 'name', 'email')
  .from('customers')
  .where('id = ?', 123)
  .orderBy('created_at', 'DESC')
  .limit(10)
  .getQuery();

// Returns: { text: "SELECT ... FROM ...", values: [123] }
```

---

## 🎓 Learning Path

### Beginner - Run the Examples
```bash
node examples.js
```

Explore 9 complete examples:
1. Basic Usage
2. Factory Pattern
3. Decorator Pattern
4. Observer Pattern
5. Builder Pattern
6. Strategy Pattern
7. Complete Stack
8. Error Handling
9. Cache Management

### Intermediate - Read the Documentation
1. `README.improved.md` - Overview and features
2. `DESIGN_PATTERNS.md` - Detailed pattern explanations
3. `ARCHITECTURE.md` - Visual diagrams

### Advanced - Extend the Code
Create your own:
- Custom strategy (e.g., write-through cache)
- New decorator (e.g., rate limiting)
- Custom observer (e.g., metrics to Prometheus)
- Complex query builder

---

## 📊 Compare Performance

### Original vs Improved

```bash
# Run original
node benchmark.js

# Output:
# Redis Cache: p95=8ms, Throughput=242 req/s
# PostgreSQL: p95=6ms, Throughput=278 req/s
```

```bash
# Run improved
node benchmark.improved.js

# Output:
# Same performance PLUS:
# ✓ Automatic retry on failure
# ✓ Circuit breaker protection
# ✓ Real-time metrics
# ✓ Connection health monitoring
# ✓ Performance alerts
```

---

## 🔍 Inspect the Code

### Pattern Files
```bash
ls patterns/
# DatabaseConnectionManager.js  - Singleton
# QueryStrategy.js              - Strategy (3 strategies)
# QueryExecutorFactory.js       - Factory
# QueryBuilder.js               - Builder
# QueryDecorators.js            - 5 decorators
# PerformanceMonitor.js         - Observer + 3 observers
# Errors.js                     - Custom error classes
# index.js                      - Unified exports
```

### Test Files
```bash
ls
# examples.js           - 9 working examples
# DESIGN_PATTERNS.md    - Pattern documentation
# ARCHITECTURE.md       - Visual diagrams
```

---

## 🎯 Common Use Cases

### Use Case 1: Test Different Strategies
```javascript
const strategies = ['redis', 'postgres', 'hybrid'];

for (const type of strategies) {
  const executor = QueryExecutorFactory.create(type);
  const result = await executor.getCustomerDashboard(123);
  console.log(`${type}:`, result);
}
```

### Use Case 2: Production-Ready Executor
```javascript
// Create executor with all production features
let executor = QueryExecutorFactory.create('postgres');
executor = new RetryDecorator(executor, 3);          // Retry 3 times
executor = new TimeoutDecorator(executor, 5000);     // 5s timeout
executor = new CircuitBreakerDecorator(executor, 5); // Break after 5 fails
executor = new MetricsDecorator(executor);           // Collect metrics

// Now safe for production
const result = await executor.getCustomerDashboard(123);
```

### Use Case 3: Monitor Performance
```javascript
const monitor = new PerformanceMonitor();
monitor.subscribe(new ConsoleObserver());

// Execute queries
for (let i = 0; i < 100; i++) {
  const start = Date.now();
  await executor.getCustomerDashboard(i);
  monitor.recordQuery({
    strategy: 'PostgreSQL',
    duration: Date.now() - start,
    success: true
  });
}

// Get summary
const summary = monitor.getSummary();
console.log('p95 latency:', summary.p95, 'ms');
```

---

## 🐛 Troubleshooting

### Issue: Connection Refused
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:** Start PostgreSQL
```bash
# Windows
net start postgresql-x64-18

# macOS/Linux
sudo systemctl start postgresql
```

### Issue: Redis Connection Failed
```bash
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:** Start Redis
```bash
# Windows
redis-server.exe

# macOS
brew services start redis

# Linux
sudo systemctl start redis
```

### Issue: Database Not Found
```bash
Error: database "benchmark_db" does not exist
```

**Solution:** Create database
```bash
psql -U postgres
CREATE DATABASE benchmark_db;
\q
```

---

## 📚 Next Steps

1. ✅ Run `npm start` - See original benchmark
2. ✅ Run `node benchmark.js` - See improvements
3. ✅ Run `node examples.js` - Learn patterns
4. ✅ Read `DESIGN_PATTERNS.md` - Understand patterns
5. ✅ Read `ARCHITECTURE.md` - See diagrams
6. ✅ Extend with your own patterns!

---

## 💡 Tips

### Tip 1: Start Small
Don't try to use all patterns at once. Start with:
1. Singleton for connections
2. Strategy for different approaches
3. Add decorators as needed

### Tip 2: Read Examples First
The `examples.js` file has 9 complete examples showing each pattern.

### Tip 3: Use TypeScript (Optional)
Add type definitions for better IDE support:
```bash
npm install --save-dev @types/node @types/pg @types/ioredis
```

### Tip 4: Test in Isolation
Each pattern can be tested independently:
```javascript
// Test strategy
const strategy = new RedisCacheStrategy();
const result = await strategy.getCustomerDashboard(123);

// Test decorator
const decorated = new RetryDecorator(strategy, 3);
const result2 = await decorated.getCustomerDashboard(123);
```

---

## 🎉 You're Ready!

You now have a production-ready, maintainable, and extensible codebase with:

✅ **Singleton** - Connection management
✅ **Strategy** - Swappable algorithms
✅ **Factory** - Easy object creation
✅ **Builder** - Query construction
✅ **Decorator** - Feature composition
✅ **Observer** - Real-time monitoring

**Happy coding! 🚀**

---

## 📞 Quick Reference

```javascript
// Complete example - copy and run
const {
  DatabaseConnectionManager,
  QueryExecutorFactory,
  RetryDecorator,
  MetricsDecorator,
  PerformanceMonitor,
  ConsoleObserver
} = require('./patterns');

async function main() {
  // 1. Initialize
  await DatabaseConnectionManager.initialize();
  
  // 2. Create executor
  let executor = QueryExecutorFactory.create('postgres');
  executor = new RetryDecorator(executor, 3);
  executor = new MetricsDecorator(executor);
  
  // 3. Setup monitoring
  const monitor = new PerformanceMonitor();
  monitor.subscribe(new ConsoleObserver());
  
  // 4. Execute
  const result = await executor.getCustomerDashboard(123);
  console.log(result);
  
  // 5. Get metrics
  const metrics = executor.getMetrics();
  console.log('Metrics:', metrics);
  
  // 6. Cleanup
  await DatabaseConnectionManager.closeAll();
}

main().catch(console.error);
```

Save this as `quickstart.js` and run: `node quickstart.js`
