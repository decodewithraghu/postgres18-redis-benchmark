/**
 * Builder Pattern - SQL Query Builder
 * 
 * Provides a fluent interface for building complex SQL queries.
 * Makes query construction more readable and maintainable.
 */

class QueryBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this._select = [];
    this._from = '';
    this._joins = [];
    this._where = [];
    this._orderBy = [];
    this._limit = null;
    this._offset = null;
    this._params = [];
    this._paramIndex = 1;
    return this;
  }

  select(...columns) {
    this._select.push(...columns);
    return this;
  }

  from(table) {
    this._from = table;
    return this;
  }

  leftJoin(table, condition) {
    this._joins.push({ type: 'LEFT JOIN', table, condition });
    return this;
  }

  innerJoin(table, condition) {
    this._joins.push({ type: 'INNER JOIN', table, condition });
    return this;
  }

  where(condition, ...params) {
    const processedCondition = this._processCondition(condition, params);
    this._where.push(processedCondition);
    return this;
  }

  andWhere(condition, ...params) {
    return this.where(condition, ...params);
  }

  orWhere(condition, ...params) {
    if (this._where.length > 0) {
      const lastCondition = this._where.pop();
      const processedCondition = this._processCondition(condition, params);
      this._where.push(`(${lastCondition} OR ${processedCondition})`);
    } else {
      const processedCondition = this._processCondition(condition, params);
      this._where.push(processedCondition);
    }
    return this;
  }

  whereIn(column, values) {
    if (values.length === 0) {
      return this;
    }

    const placeholders = values.map(() => {
      const placeholder = `$${this._paramIndex++}`;
      return placeholder;
    });

    this._params.push(...values);
    this._where.push(`${column} IN (${placeholders.join(', ')})`);
    return this;
  }

  orderBy(column, direction = 'ASC') {
    this._orderBy.push(`${column} ${direction.toUpperCase()}`);
    return this;
  }

  limit(limit) {
    this._limit = limit;
    return this;
  }

  offset(offset) {
    this._offset = offset;
    return this;
  }

  _processCondition(condition, params) {
    let processedCondition = condition;
    
    // Replace ? placeholders with $n
    for (const param of params) {
      processedCondition = processedCondition.replace('?', `$${this._paramIndex++}`);
      this._params.push(param);
    }

    return processedCondition;
  }

  build() {
    const parts = [];

    // SELECT
    if (this._select.length === 0) {
      parts.push('SELECT *');
    } else {
      parts.push(`SELECT ${this._select.join(', ')}`);
    }

    // FROM
    if (!this._from) {
      throw new Error('FROM clause is required');
    }
    parts.push(`FROM ${this._from}`);

    // JOINS
    for (const join of this._joins) {
      parts.push(`${join.type} ${join.table} ON ${join.condition}`);
    }

    // WHERE
    if (this._where.length > 0) {
      parts.push(`WHERE ${this._where.join(' AND ')}`);
    }

    // ORDER BY
    if (this._orderBy.length > 0) {
      parts.push(`ORDER BY ${this._orderBy.join(', ')}`);
    }

    // LIMIT
    if (this._limit !== null) {
      parts.push(`LIMIT ${this._limit}`);
    }

    // OFFSET
    if (this._offset !== null) {
      parts.push(`OFFSET ${this._offset}`);
    }

    return {
      text: parts.join('\n'),
      values: this._params,
    };
  }

  getQuery() {
    const result = this.build();
    this.reset();
    return result;
  }
}

/**
 * Specialized builder for customer dashboard queries
 */
class CustomerDashboardQueryBuilder extends QueryBuilder {
  buildForCustomer(customerId) {
    return this
      .select(
        'c.id',
        'c.name',
        'c.email',
        'o.id as order_id',
        'o.total_cents',
        'o.status',
        'o.created_at'
      )
      .from('customers c')
      .leftJoin('orders o', 'o.customer_id = c.id')
      .where('c.id = ?', customerId)
      .whereIn('o.status', ['pending', 'processing'])
      .orderBy('o.created_at', 'DESC')
      .limit(10)
      .getQuery();
  }
}

/**
 * Specialized builder for order queries
 */
class OrderQueryBuilder extends QueryBuilder {
  buildForCustomerOrders(customerId, limit = 20) {
    return this
      .select(
        'id',
        'amount_cents',
        'tax_rate',
        'total_cents',
        'status',
        'created_at'
      )
      .from('orders')
      .where('customer_id = ?', customerId)
      .orderBy('created_at', 'DESC')
      .limit(limit)
      .getQuery();
  }

  buildForStatusReport(statuses = ['pending', 'processing']) {
    return this
      .select(
        'status',
        'COUNT(*) as count',
        'SUM(total_cents) as total_amount',
        'AVG(total_cents) as avg_amount'
      )
      .from('orders')
      .whereIn('status', statuses)
      .build();
  }
}

module.exports = {
  QueryBuilder,
  CustomerDashboardQueryBuilder,
  OrderQueryBuilder,
};
