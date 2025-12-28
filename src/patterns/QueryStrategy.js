/**
 * Strategy Pattern - Query Execution Strategies
 * 
 * Defines different strategies for querying data (Redis-cached vs Direct PostgreSQL).
 * Allows runtime switching between caching strategies without changing client code.
 */

const dbManager = require('./DatabaseConnectionManager');
const config = require('../config');

/**
 * Abstract base class for query strategies
 */
class QueryStrategy {
  async execute(query, params) {
    throw new Error('execute() must be implemented by subclass');
  }

  async getCustomerDashboard(customerId) {
    throw new Error('getCustomerDashboard() must be implemented by subclass');
  }

  getName() {
    return this.constructor.name;
  }
}

/**
 * Redis Cache-Aside Strategy
 * Implements the cache-aside pattern with Redis
 */
class RedisCacheStrategy extends QueryStrategy {
  constructor() {
    super();
    this.redis = dbManager.getRedisClient();
    this.pgPool = dbManager.getPgPool();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  async getCustomerDashboard(customerId) {
    const cacheKey = `dashboard:${customerId}`;

    // Step 1: Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return JSON.parse(cached);
    }

    // Step 2: Cache miss - query database
    this.cacheMisses++;
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(
        this._getCustomerDashboardQuery(),
        [customerId]
      );

      const data = this._formatCustomerDashboard(result.rows);

      // Step 3: Write to cache
      await this.redis.setex(
        cacheKey,
        config.benchmark.redisTTL,
        JSON.stringify(data)
      );

      return data;
    } finally {
      client.release();
    }
  }

  _getCustomerDashboardQuery() {
    return `
      SELECT 
        c.id,
        c.name,
        c.email,
        o.id as order_id,
        o.total_cents,
        o.status,
        o.created_at
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.id = $1
        AND o.status IN ('pending', 'processing')
      ORDER BY o.created_at DESC
      LIMIT 10
    `;
  }

  _formatCustomerDashboard(rows) {
    if (rows.length === 0) {
      return { customer: null, orders: [] };
    }

    return {
      customer: {
        id: rows[0]?.id,
        name: rows[0]?.name,
        email: rows[0]?.email,
      },
      orders: rows.map((r) => ({
        id: r.order_id,
        total_cents: r.total_cents,
        status: r.status,
        created_at: r.created_at,
      })),
    };
  }

  async invalidateCache(customerId) {
    const cacheKey = `dashboard:${customerId}`;
    await this.redis.del(cacheKey);
  }

  async flushCache() {
    await this.redis.flushall();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? ((this.cacheHits / total) * 100).toFixed(2) : 0,
    };
  }

  getName() {
    return 'Redis Cache-Aside Strategy';
  }
}

/**
 * Direct PostgreSQL Strategy
 * Queries PostgreSQL directly, leveraging PG18 optimizations
 */
class DirectPostgreSQLStrategy extends QueryStrategy {
  constructor() {
    super();
    this.pgPool = dbManager.getPgPool();
  }

  async getCustomerDashboard(customerId) {
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(
        this._getCustomerDashboardQuery(),
        [customerId]
      );

      return this._formatCustomerDashboard(result.rows);
    } finally {
      client.release();
    }
  }

  _getCustomerDashboardQuery() {
    return `
      SELECT 
        c.id,
        c.name,
        c.email,
        o.id as order_id,
        o.total_cents,
        o.status,
        o.created_at
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.id = $1
        AND o.status IN ('pending', 'processing')
      ORDER BY o.created_at DESC
      LIMIT 10
    `;
  }

  _formatCustomerDashboard(rows) {
    if (rows.length === 0) {
      return { customer: null, orders: [] };
    }

    return {
      customer: {
        id: rows[0]?.id,
        name: rows[0]?.name,
        email: rows[0]?.email,
      },
      orders: rows.map((r) => ({
        id: r.order_id,
        total_cents: r.total_cents,
        status: r.status,
        created_at: r.created_at,
      })),
    };
  }

  getName() {
    return 'Direct PostgreSQL 18 Strategy';
  }
}

/**
 * Hybrid Strategy
 * Uses Redis for hot data, PostgreSQL for cold data
 */
class HybridStrategy extends QueryStrategy {
  constructor(hotDataThreshold = 100) {
    super();
    this.redis = dbManager.getRedisClient();
    this.pgPool = dbManager.getPgPool();
    this.hotDataThreshold = hotDataThreshold;
    this.accessCount = new Map();
  }

  async getCustomerDashboard(customerId) {
    // Track access frequency
    const count = (this.accessCount.get(customerId) || 0) + 1;
    this.accessCount.set(customerId, count);

    // Hot data - use Redis
    if (count >= this.hotDataThreshold) {
      return await this._getFromRedis(customerId);
    }

    // Cold data - use PostgreSQL directly
    return await this._getFromPostgres(customerId);
  }

  async _getFromRedis(customerId) {
    const cacheKey = `dashboard:${customerId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const data = await this._getFromPostgres(customerId);
    await this.redis.setex(
      cacheKey,
      config.benchmark.redisTTL,
      JSON.stringify(data)
    );

    return data;
  }

  async _getFromPostgres(customerId) {
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(
        this._getCustomerDashboardQuery(),
        [customerId]
      );

      return this._formatCustomerDashboard(result.rows);
    } finally {
      client.release();
    }
  }

  _getCustomerDashboardQuery() {
    return `
      SELECT 
        c.id,
        c.name,
        c.email,
        o.id as order_id,
        o.total_cents,
        o.status,
        o.created_at
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.id = $1
        AND o.status IN ('pending', 'processing')
      ORDER BY o.created_at DESC
      LIMIT 10
    `;
  }

  _formatCustomerDashboard(rows) {
    if (rows.length === 0) {
      return { customer: null, orders: [] };
    }

    return {
      customer: {
        id: rows[0]?.id,
        name: rows[0]?.name,
        email: rows[0]?.email,
      },
      orders: rows.map((r) => ({
        id: r.order_id,
        total_cents: r.total_cents,
        status: r.status,
        created_at: r.created_at,
      })),
    };
  }

  getName() {
    return 'Hybrid Strategy (Hot/Cold Data Separation)';
  }
}

module.exports = {
  QueryStrategy,
  RedisCacheStrategy,
  DirectPostgreSQLStrategy,
  HybridStrategy,
};
