/**
 * Singleton Pattern - Database Connection Manager
 * 
 * Ensures only one instance of database connections exists throughout the application.
 * Provides centralized management of PostgreSQL and Redis connections.
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const config = require('../config');

class DatabaseConnectionManager {
  constructor() {
    if (DatabaseConnectionManager.instance) {
      return DatabaseConnectionManager.instance;
    }

    this._pgPool = null;
    this._redisClient = null;
    this._isInitialized = false;
    
    DatabaseConnectionManager.instance = this;
  }

  /**
   * Initialize database connections
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    try {
      // Initialize PostgreSQL pool
      this._pgPool = new Pool({
        ...config.pg,
        // Connection pool event handlers
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Handle pool errors
      this._pgPool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err);
      });

      // Initialize Redis client
      this._redisClient = new Redis({
        ...config.redis,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      });

      // Handle Redis errors
      this._redisClient.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      this._isInitialized = true;
      console.log('✓ Database connections initialized');
    } catch (error) {
      console.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  /**
   * Get PostgreSQL pool instance
   */
  getPgPool() {
    if (!this._isInitialized) {
      throw new Error('DatabaseConnectionManager not initialized. Call initialize() first.');
    }
    return this._pgPool;
  }

  /**
   * Get Redis client instance
   */
  getRedisClient() {
    if (!this._isInitialized) {
      throw new Error('DatabaseConnectionManager not initialized. Call initialize() first.');
    }
    return this._redisClient;
  }

  /**
   * Get connection health status
   */
  async getHealthStatus() {
    const status = {
      postgres: false,
      redis: false,
    };

    try {
      const pgClient = await this._pgPool.connect();
      await pgClient.query('SELECT 1');
      pgClient.release();
      status.postgres = true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error.message);
    }

    try {
      await this._redisClient.ping();
      status.redis = true;
    } catch (error) {
      console.error('Redis health check failed:', error.message);
    }

    return status;
  }

  /**
   * Close all connections gracefully
   */
  async closeAll() {
    const promises = [];

    if (this._pgPool) {
      promises.push(
        this._pgPool.end().catch((err) => {
          console.error('Error closing PostgreSQL pool:', err);
        })
      );
    }

    if (this._redisClient) {
      promises.push(
        this._redisClient.quit().catch((err) => {
          console.error('Error closing Redis client:', err);
        })
      );
    }

    await Promise.all(promises);
    this._isInitialized = false;
    console.log('✓ All database connections closed');
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    if (!this._pgPool) {
      return null;
    }

    return {
      total: this._pgPool.totalCount,
      idle: this._pgPool.idleCount,
      waiting: this._pgPool.waitingCount,
    };
  }
}

// Export singleton instance
module.exports = new DatabaseConnectionManager();
