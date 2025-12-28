# Architecture Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                        │
│                     (benchmark.improved.js)                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PATTERN LAYER                               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Factory    │  │   Builder    │  │   Observer   │         │
│  │  (Create)    │  │  (Construct) │  │  (Monitor)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │            DECORATOR CHAIN                        │          │
│  │  Retry → Timeout → Metrics → CircuitBreaker      │          │
│  └──────────────────────────────────────────────────┘          │
│                      │                                           │
│                      ▼                                           │
│  ┌──────────────────────────────────────────────────┐          │
│  │            STRATEGY PATTERN                       │          │
│  │  ┌──────┐  ┌──────────┐  ┌────────┐             │          │
│  │  │Redis │  │PostgreSQL│  │ Hybrid │             │          │
│  │  └──────┘  └──────────┘  └────────┘             │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONNECTION LAYER                              │
│                      (Singleton)                                 │
│                                                                  │
│  ┌────────────────────┐     ┌────────────────────┐            │
│  │  PostgreSQL Pool   │     │   Redis Client     │            │
│  │  (Max: 20)         │     │   (Persistent)     │            │
│  └────────────────────┘     └────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                             │
│                                                                  │
│  ┌────────────────────┐     ┌────────────────────┐            │
│  │  PostgreSQL 18+    │     │     Redis 7+       │            │
│  │  (localhost:5432)  │     │  (localhost:6379)  │            │
│  └────────────────────┘     └────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Pattern Interaction Flow

```
1. APPLICATION STARTS
   │
   ├─→ DatabaseConnectionManager.initialize()  [Singleton]
   │   └─→ Creates PostgreSQL Pool + Redis Client
   │
   ├─→ QueryExecutorFactory.create('postgres')  [Factory]
   │   └─→ Returns DirectPostgreSQLStrategy
   │
   ├─→ Wrap with Decorators  [Decorator]
   │   ├─→ RetryDecorator(strategy, 3)
   │   ├─→ TimeoutDecorator(retry, 5000)
   │   └─→ MetricsDecorator(timeout)
   │
   └─→ Setup PerformanceMonitor  [Observer]
       ├─→ monitor.subscribe(ConsoleObserver)
       └─→ monitor.subscribe(MetricsAggregator)

2. QUERY EXECUTION
   │
   User calls: executor.getCustomerDashboard(123)
   │
   ├─→ MetricsDecorator
   │   ├─→ Start timer
   │   ├─→ Call wrapped executor
   │   └─→ Record metrics
   │
   ├─→ TimeoutDecorator
   │   ├─→ Create timeout promise (5000ms)
   │   ├─→ Race with actual query
   │   └─→ Throw TimeoutError if exceeded
   │
   ├─→ RetryDecorator
   │   ├─→ Try query
   │   ├─→ If fails, wait with exponential backoff
   │   ├─→ Retry up to 3 times
   │   └─→ Throw if all attempts fail
   │
   └─→ Strategy (Redis/PostgreSQL/Hybrid)
       ├─→ Get connection from Singleton
       ├─→ Execute query
       ├─→ Return result
       └─→ Release connection

3. MONITORING
   │
   ├─→ PerformanceMonitor.recordQuery()
   │   └─→ Notify all observers
   │       ├─→ ConsoleObserver: Log to console
   │       ├─→ FileObserver: Write to file
   │       └─→ MetricsAggregator: Update stats
   │
   └─→ Check for alerts
       ├─→ Slow query? → Alert
       ├─→ Error? → Alert
       └─→ Circuit breaker open? → Alert
```

## Decorator Stack Visualization

```
                    User Code
                       │
                       ▼
        ┌──────────────────────────────┐
        │     MetricsDecorator         │
        │  • Start timer               │
        │  • Count requests            │
        │  • Calculate latency         │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │     TimeoutDecorator         │
        │  • Set 5000ms timeout        │
        │  • Race with query           │
        │  • Cancel if exceeded        │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │     RetryDecorator           │
        │  • Try query                 │
        │  • Catch errors              │
        │  • Exponential backoff       │
        │  • Retry up to 3 times       │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   CircuitBreakerDecorator    │
        │  • Check state (OPEN/CLOSED) │
        │  • Count failures            │
        │  • Open circuit if threshold │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    Base Strategy             │
        │  (Redis/PostgreSQL/Hybrid)   │
        │  • Execute actual query      │
        │  • Return result             │
        └──────────────────────────────┘
```

## Strategy Pattern Class Diagram

```
                    ┌─────────────────┐
                    │ QueryStrategy   │
                    │   (Abstract)    │
                    ├─────────────────┤
                    │ + execute()     │
                    │ + getDashboard()│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐ ┌──────────────┐ ┌──────────┐
    │   Redis     │ │  PostgreSQL  │ │  Hybrid  │
    │ Cache       │ │   Direct     │ │ Strategy │
    │ Strategy    │ │  Strategy    │ │          │
    ├─────────────┤ ├──────────────┤ ├──────────┤
    │• Check cache│ │• Query PG    │ │• Hot     │
    │• Query DB   │ │  directly    │ │  data:   │
    │• Cache      │ │• Use indexes │ │  Redis   │
    │  result     │ │• Skip scans  │ │• Cold    │
    │• Track hits │ │              │ │  data: PG│
    └─────────────┘ └──────────────┘ └──────────┘
```

## Observer Pattern Sequence

```
┌──────────┐      ┌───────────────┐     ┌──────────┐
│ Executor │      │  Performance  │     │ Observer │
│          │      │   Monitor     │     │          │
└────┬─────┘      └───────┬───────┘     └────┬─────┘
     │                    │                   │
     │  recordQuery()     │                   │
     ├───────────────────>│                   │
     │                    │                   │
     │                    │  notify(event)    │
     │                    ├──────────────────>│
     │                    │                   │
     │                    │                   │ update(event)
     │                    │                   ├─────────────┐
     │                    │                   │             │
     │                    │                   │<────────────┘
     │                    │                   │
     │                    │                   │ Log/Alert
     │                    │                   ├─────────────>
     │                    │                   │
```

## Query Builder Flow

```
new CustomerDashboardQueryBuilder()
    │
    ├─→ .select('c.id', 'c.name', 'c.email')
    │   └─→ Internal: _select = ['c.id', 'c.name', ...]
    │
    ├─→ .from('customers c')
    │   └─→ Internal: _from = 'customers c'
    │
    ├─→ .leftJoin('orders o', 'o.customer_id = c.id')
    │   └─→ Internal: _joins.push({...})
    │
    ├─→ .where('c.id = ?', 123)
    │   └─→ Internal: _where.push('c.id = $1')
    │              _params.push(123)
    │
    ├─→ .whereIn('o.status', ['pending', 'processing'])
    │   └─→ Internal: _where.push('o.status IN ($2, $3)')
    │              _params.push('pending', 'processing')
    │
    ├─→ .orderBy('o.created_at', 'DESC')
    │   └─→ Internal: _orderBy.push('o.created_at DESC')
    │
    ├─→ .limit(10)
    │   └─→ Internal: _limit = 10
    │
    └─→ .getQuery()
        └─→ Returns: {
              text: "SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT ...",
              values: [123, 'pending', 'processing']
            }
```

## Factory Pattern Decision Tree

```
QueryExecutorFactory.create(type, options)
    │
    ├─→ type === 'redis'
    │   └─→ return new RedisCacheStrategy()
    │
    ├─→ type === 'postgres'
    │   └─→ return new DirectPostgreSQLStrategy()
    │
    ├─→ type === 'hybrid'
    │   └─→ return new HybridStrategy(options.hotDataThreshold)
    │
    └─→ else
        └─→ throw Error('Unknown strategy')
```

## Complete Request Flow

```
User Request: "Get customer 123 dashboard"
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. Application Layer                    │
│    benchmark.improved.js                │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 2. Factory Pattern                      │
│    Create executor based on config      │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 3. Decorator Stack                      │
│    Metrics → Timeout → Retry            │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 4. Strategy Pattern                     │
│    Execute Redis/PG/Hybrid strategy     │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 5. Singleton Connection Manager         │
│    Get connection from pool             │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 6. Database Query                       │
│    Execute SQL / Redis command          │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 7. Observer Pattern                     │
│    Notify all observers of result       │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 8. Return Result                        │
│    Send data back to user               │
└─────────────────────────────────────────┘
```

## Error Handling Flow

```
Error Occurs
    │
    ▼
┌─────────────────────┐
│ Is ValidationError? │
├─────────────────────┤
│ YES: Don't retry    │
│  │                  │
│  └─→ Throw error    │
│                     │
│ NO: Continue        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Retry Decorator     │
├─────────────────────┤
│ Attempt 1: Fail     │
│ Wait 100ms          │
│ Attempt 2: Fail     │
│ Wait 200ms          │
│ Attempt 3: Fail     │
│ Wait 400ms          │
│ Max retries reached │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Circuit Breaker     │
├─────────────────────┤
│ Failure count++     │
│ Count >= threshold? │
│  YES: Open circuit  │
│  NO: Continue       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Performance Monitor │
├─────────────────────┤
│ Record failure      │
│ Notify observers    │
│ Raise alert         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Return Error        │
│ to Application      │
└─────────────────────┘
```

## Connection Pool Management

```
┌────────────────────────────────────────────────┐
│        DatabaseConnectionManager               │
│              (Singleton)                       │
├────────────────────────────────────────────────┤
│                                                │
│  PostgreSQL Pool                               │
│  ┌──────────────────────────────────────────┐ │
│  │ [Conn1] [Conn2] [Conn3] ... [Conn20]    │ │
│  │   ↑       ↑       ↑                      │ │
│  │ Active   Idle    Idle                    │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Redis Client                                  │
│  ┌──────────────────────────────────────────┐ │
│  │ [Single Persistent Connection]          │ │
│  │         ↑                                │ │
│  │      Active                              │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Health Monitoring                             │
│  ┌──────────────────────────────────────────┐ │
│  │ PostgreSQL: ✓ (ping every 30s)          │ │
│  │ Redis:      ✓ (ping every 30s)          │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

---

These diagrams illustrate the complete architecture and flow of the improved application using design patterns.
