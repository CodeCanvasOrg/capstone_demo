import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

/**
 * Resolve the PostgreSQL connection from either a single connection
 * string (DB_URL, or TEST_DB_URL in tests) or the discrete DB_* fields.
 */
function pgConnection() {
  const url = app.inTest ? (env.get('TEST_DB_URL') ?? env.get('DB_URL')) : env.get('DB_URL')
  if (url) {
    return { connectionString: url }
  }

  const host = env.get('DB_HOST')
  const user = env.get('DB_USER')
  const database = env.get('DB_DATABASE')
  if (!host || !user || !database) {
    throw new Error(
      'Database is not configured: set DB_URL, or DB_HOST, DB_USER and DB_DATABASE (plus optional DB_PORT and DB_PASSWORD)'
    )
  }

  return {
    host,
    port: env.get('DB_PORT', 5432),
    user,
    password: env.get('DB_PASSWORD'),
    database,
  }
}

const dbConfig = defineConfig({
  /**
   * Default connection used for all queries.
   */
  connection: 'pg',

  connections: {
    /**
     * SQLite connection (default).
     */
    // sqlite: {
    //   client: 'better-sqlite3',

    //   connection: {
    //     /**
    //      * Database file location.
    //      */
    //     filename: app.tmpPath('db.sqlite3'),
    //   },

    //   /**
    //    * Required by Knex for SQLite defaults.
    //    */
    //   useNullAsDefault: true,

    //   migrations: {
    //     /**
    //      * Sort migration files naturally by filename.
    //      */
    //     naturalSort: true,

    //     /**
    //      * Paths containing migration files.
    //      */
    //     paths: ['database/migrations'],
    //   },
    // },

    /**
     * PostgreSQL connection.
     * Install package to switch: npm install pg
     */
    pg: {
      client: 'pg',
      connection: pgConnection(),
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      debug: app.inDev,
    },

    /**
     * MySQL / MariaDB connection.
     * Install package to switch: npm install mysql2
     */
    // mysql: {
    //   client: 'mysql2',
    //   connection: {
    //     host: env.get('DB_HOST'),
    //     port: env.get('DB_PORT'),
    //     user: env.get('DB_USER'),
    //     password: env.get('DB_PASSWORD'),
    //     database: env.get('DB_DATABASE'),
    //   },
    //   migrations: {
    //     naturalSort: true,
    //     paths: ['database/migrations'],
    //   },
    //   debug: app.inDev,
    // },

    /**
     * Microsoft SQL Server connection.
     * Install package to switch: npm install tedious
     */
    // mssql: {
    //   client: 'mssql',
    //   connection: {
    //     server: env.get('DB_HOST'),
    //     port: env.get('DB_PORT'),
    //     user: env.get('DB_USER'),
    //     password: env.get('DB_PASSWORD'),
    //     database: env.get('DB_DATABASE'),
    //   },
    //   migrations: {
    //     naturalSort: true,
    //     paths: ['database/migrations'],
    //   },
    //   debug: app.inDev,
    // },

    /**
     * libSQL (Turso) connection.
     * Install package to switch: npm install @libsql/client
     */
    // libsql: {
    //   client: 'libsql',
    //   connection: {
    //     url: env.get('LIBSQL_URL'),
    //     authToken: env.get('LIBSQL_AUTH_TOKEN'),
    //   },
    //   useNullAsDefault: true,
    //   migrations: {
    //     naturalSort: true,
    //     paths: ['database/migrations'],
    //   },
    //   debug: app.inDev,
    // },
  },
})

export default dbConfig
