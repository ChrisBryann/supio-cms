import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN "brochure_id" uuid;
  ALTER TABLE "products" ADD CONSTRAINT "products_brochure_id_media_id_fk" FOREIGN KEY ("brochure_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "products_brochure_idx" ON "products" USING btree ("brochure_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" DROP CONSTRAINT "products_brochure_id_media_id_fk";
  
  DROP INDEX "products_brochure_idx";
  ALTER TABLE "products" DROP COLUMN "brochure_id";`)
}
