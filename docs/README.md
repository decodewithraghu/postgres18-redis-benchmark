# Improved Redis-PostgreSQL Stress Test

A benchmark comparing PostgreSQL 18 direct queries vs Redis-cached queries, demonstrating modern design patterns and best practices.

## 🎯 Features

- **Comprehensive Benchmarking**: Compare Redis cache-aside vs Direct PostgreSQL 18 performance
- **Design Patterns**: Singleton, Strategy, Factory, Builder, Decorator, Observer
- **Error Handling**: Custom error classes with detailed stack traces
- **Retry Logic**: Exponential backoff for transient failures
- **Performance Monitoring**: Real-time metrics and alerting
- **Circuit Breaker**: Prevents cascading failures
- **Connection Management**: Singleton pattern for efficient resource usage

## 🏗️ Architecture

### Design Patterns Applied

#### 1. **Singleton Pattern** - `DatabaseConnectionManager`
Ensures single instance of database connections throughout the application.

```javascript
const dbManager = require('./patterns/DatabaseConnectionManager');
await dbManager.initialize();
const pgPool = dbManager.getPgPool();
```

#### 2. **Strategy Pattern** - Query Execution Strategies
Swappable query strategies without changing client code.

- `RedisCacheStrategy` - Cache-aside pattern with Redis
- `DirectPostgreSQLStrategy` - Direct PostgreSQL queries
- `HybridStrategy` - Hot/cold data separation

```javascript
const strategy = new RedisCacheStrategy();
const data = await strategy.getCustomerDashboard(customerId);
```

#### 3. **Factory Pattern** - `QueryExecutorFactory`
Creates query executors based on configuration.

```javascript
const executor = QueryExecutorFactory.create('redis');
const executors = QueryExecutorFactory.createAll();
```

#### 4. **Builder Pattern** - SQL Query Builder
Fluent interface for building complex queries.

```javascript
const builder = new CustomerDashboardQueryBuilder();
const query = builder.buildForCustomer(123);
```

#### 5. **Decorator Pattern** - Query Decorators
Adds cross-cutting concerns without modifying core logic.

- `RetryDecorator` - Exponential backoff retry logic
- `LoggingDecorator` - Detailed execution logging
- `MetricsDecorator` - Performance metrics collection
- `TimeoutDecorator` - Query timeout protection
- `CircuitBreakerDecorator` - Cascading failure prevention

```javascript
let executor = new RedisCacheStrategy();
executor = new RetryDecorator(executor, 3);
executor = new MetricsDecorator(executor);
executor = new TimeoutDecorator(executor, 5000);
```

#### 6. **Observer Pattern** - `PerformanceMonitor`
Real-time monitoring and alerting.

```javascript
const monitor = new PerformanceMonitor();
monitor.subscribe(new ConsoleObserver());
monitor.subscribe(new MetricsAggregatorObserver());
```

## 📦 Installation

```bash
npm install
```

## 🚀 Usage

### Full Setup and Benchmark
```bash
npm start
```

### Setup Database Only
```bash
npm run setup
```

### Benchmark Only
```bash
npm run benchmark
```

### Clean Database
```bash
npm run clean
```

## ⚙️ Configuration

Create a `.env` file:

```env
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=benchmark_db
PG_USER=postgres
PG_PASSWORD=postgres
PG_POOL_SIZE=20

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Benchmark
NUM_CUSTOMERS=50000
ORDERS_PER_CUSTOMER=500
CONCURRENT_USERS=200
REQUESTS_PER_USER=10
REDIS_TTL=3000
```

## 📊 Example Output

```
╔══════════════════════════════════════════════════════════╗
║  PostgreSQL 18 vs Redis Performance Benchmark           ║
║  Proving: "Why I Deleted a Whole Cache Tier"            ║
╚══════════════════════════════════════════════════════════╝

TEST 1: WITH REDIS CACHE
  [██████████████████████████████████████████████████] 100%

Redis Cache:
  Total Time: 8245ms (8.25s)
  Requests: 2000
  Throughput: 242.67 req/s
  Latency:
    Average: 4.12ms
    p50: 3ms | p95: 8ms | p99: 15ms

TEST 2: DIRECT POSTGRESQL 18
  [██████████████████████████████████████████████████] 100%

Direct PostgreSQL 18:
  Total Time: 7189ms (7.19s)
  Requests: 2000
  Throughput: 278.23 req/s
  Latency:
    Average: 3.59ms
    p50: 3ms | p95: 6ms | p99: 11ms

🎯 KEY FINDING: PostgreSQL 18 has 2ms LOWER p95 latency
```

## 🔍 Code Quality Improvements

### Before
- ❌ Scattered database connections
- ❌ Duplicate query code
- ❌ No error recovery
- ❌ Hard to test
- ❌ Tight coupling

### After
- ✅ Centralized connection management
- ✅ Reusable query strategies
- ✅ Automatic retry with backoff
- ✅ Easy to mock and test
- ✅ Loose coupling via interfaces

## 🧪 Testing

The improved architecture makes testing much easier:

```javascript
// Mock strategy for testing
class MockStrategy extends QueryStrategy {
  async getCustomerDashboard(customerId) {
    return { customer: { id: customerId }, orders: [] };
  }
}

// Test with decorators
const strategy = new MockStrategy();
const executor = new MetricsDecorator(strategy);
```

## 📚 Key Learnings

1. **PostgreSQL 18 Optimizations**
   - Async I/O improvements
   - Skip scans for multicolumn indexes
   - Generated columns for derived data

2. **When to Use Redis**
   - Extremely hot data (high access frequency)
   - Session storage
   - Rate limiting

3. **When PostgreSQL 18 is Better**
   - Moderate access patterns
   - Complex queries
   - Transactional consistency needed

## 🛠️ Technology Stack

- **Node.js** - Runtime
- **PostgreSQL 18+** - Database
- **Redis 7+** - Cache
- **pg** - PostgreSQL client
- **ioredis** - Redis client
- **dotenv** - Configuration

## 📖 Resources

- [PostgreSQL 18 Release Notes](https://www.postgresql.org/docs/18/release-18.html)
- [Design Patterns in JavaScript](https://refactoring.guru/design-patterns)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 🤝 Contributing

Improvements welcome! Focus areas:
- Additional query strategies
- More decorators (rate limiting, caching, etc.)
- Better monitoring and observability
- Performance optimizations

## 📄 License

MIT
