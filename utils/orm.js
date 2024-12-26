class Model {
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
  }

  // Create a new record
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => "?").join(",");

    const query = `INSERT INTO ${this.tableName} (${keys.join(
      ","
    )}) VALUES (${placeholders})`;

    return new Promise((resolve, reject) => {
      this.db.run(query, values, function (err) {
        if (err) reject(err);
        resolve({ id: this.lastID, ...data });
      });
    });
  }

  // Find one record by id
  async findById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM ${this.tableName} WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
  }

  // Find records by criteria
  async find(criteria = {}) {
    const keys = Object.keys(criteria);
    const values = Object.values(criteria);
    const where = keys.length
      ? `WHERE ${keys.map((key) => `${key} = ?`).join(" AND ")}`
      : "";

    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM ${this.tableName} ${where}`,
        values,
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });
  }

  // Update a record
  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const set = keys.map((key) => `${key} = ?`).join(",");

    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE ${this.tableName} SET ${set} WHERE id = ?`,
        [...values, id],
        function (err) {
          if (err) reject(err);
          resolve({ id, ...data });
        }
      );
    });
  }

  // Delete a record
  async delete(id) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM ${this.tableName} WHERE id = ?`,
        [id],
        function (err) {
          if (err) reject(err);
          resolve({ id });
        }
      );
    });
  }

  // Create a table with schema
  async createTable(schema) {
    const columns = Object.entries(schema)
      .map(([key, type]) => `${key} ${type}`)
      .join(", ");

    return new Promise((resolve, reject) => {
      this.db.run(
        `CREATE TABLE IF NOT EXISTS ${this.tableName} (${columns})`,
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  }

  // List all tables, except sqlite_sequence
  async listTables() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        (err, rows) => {
          if (err) reject(err);
          resolve(rows.map((row) => row.name));
        }
      );
    });
  }
}

module.exports = { Model };
