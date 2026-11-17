import type { PostgresAdapterArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { uniqueIndex } from '@payloadcms/db-postgres/drizzle/pg-core'

type PostgresSchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number]

/**
 * Database-level guarantee: at most ONE active purchase per customer + seminar.
 * The beforeChange hook gives the friendly admin error; this index also stops two
 * simultaneous saves from both getting through. Revoked purchases are not limited.
 */
export const purchasesActiveUniqueIndex: PostgresSchemaHook = ({ schema, extendTable }) => {
  extendTable({
    table: schema.tables.purchases,
    extraConfig: (table) => ({
      purchases_active_customer_seminar_unique: uniqueIndex('purchases_active_customer_seminar_unique')
        .on(table.customer, table.seminar)
        .where(sql`${table.status} = 'active'`),
    }),
  })
  return schema
}
