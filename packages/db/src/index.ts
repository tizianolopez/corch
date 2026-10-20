import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

export * from './schema/index'

/**
 * Crea una instancia de base de datos Drizzle ORM conectada a PostgreSQL / Supabase.
 *
 * @param connectionString - URI de conexión a PostgreSQL
 * @returns Instancia de cliente Drizzle tipado con el esquema de Corchetes
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}

export type DbClient = ReturnType<typeof createDb>
