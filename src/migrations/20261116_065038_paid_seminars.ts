import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_purchases_status" AS ENUM('active', 'revoked');
  CREATE TABLE "customers" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"watermark_code" varchar,
  	"avatar_url" varchar,
  	"google_sub" varchar,
  	"yahoo_sub" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "seminars" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"published" boolean DEFAULT false,
  	"description" jsonb,
  	"speaker" varchar,
  	"seminar_date" timestamp(3) with time zone,
  	"duration" varchar,
  	"thumbnail_id" uuid,
  	"price_label" varchar,
  	"purchase_url" varchar,
  	"mux_playback_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "purchases" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar,
  	"customer_id" uuid NOT NULL,
  	"customer_email" varchar,
  	"seminar_id" uuid NOT NULL,
  	"status" "enum_purchases_status" DEFAULT 'active' NOT NULL,
  	"payment_reference" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customers_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seminars_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "purchases_id" uuid;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "customers_id" uuid;
  ALTER TABLE "seminars" ADD CONSTRAINT "seminars_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "purchases" ADD CONSTRAINT "purchases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "purchases" ADD CONSTRAINT "purchases_seminar_id_seminars_id_fk" FOREIGN KEY ("seminar_id") REFERENCES "public"."seminars"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE UNIQUE INDEX "customers_watermark_code_idx" ON "customers" USING btree ("watermark_code");
  CREATE UNIQUE INDEX "customers_google_sub_idx" ON "customers" USING btree ("google_sub");
  CREATE UNIQUE INDEX "customers_yahoo_sub_idx" ON "customers" USING btree ("yahoo_sub");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "seminars_title_idx" ON "seminars" USING btree ("title");
  CREATE UNIQUE INDEX "seminars_slug_idx" ON "seminars" USING btree ("slug");
  CREATE INDEX "seminars_thumbnail_idx" ON "seminars" USING btree ("thumbnail_id");
  CREATE INDEX "seminars_updated_at_idx" ON "seminars" USING btree ("updated_at");
  CREATE INDEX "seminars_created_at_idx" ON "seminars" USING btree ("created_at");
  CREATE INDEX "purchases_customer_idx" ON "purchases" USING btree ("customer_id");
  CREATE INDEX "purchases_customer_email_idx" ON "purchases" USING btree ("customer_email");
  CREATE INDEX "purchases_seminar_idx" ON "purchases" USING btree ("seminar_id");
  CREATE INDEX "purchases_status_idx" ON "purchases" USING btree ("status");
  CREATE INDEX "purchases_payment_reference_idx" ON "purchases" USING btree ("payment_reference");
  CREATE INDEX "purchases_updated_at_idx" ON "purchases" USING btree ("updated_at");
  CREATE INDEX "purchases_created_at_idx" ON "purchases" USING btree ("created_at");
  CREATE UNIQUE INDEX "purchases_active_customer_seminar_unique" ON "purchases" USING btree ("customer_id","seminar_id") WHERE "purchases"."status" = 'active';
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seminars_fk" FOREIGN KEY ("seminars_id") REFERENCES "public"."seminars"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_purchases_fk" FOREIGN KEY ("purchases_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_seminars_id_idx" ON "payload_locked_documents_rels" USING btree ("seminars_id");
  CREATE INDEX "payload_locked_documents_rels_purchases_id_idx" ON "payload_locked_documents_rels" USING btree ("purchases_id");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "seminars" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "purchases" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "seminars" CASCADE;
  DROP TABLE "purchases" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_customers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_seminars_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_purchases_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT IF EXISTS "payload_preferences_rels_customers_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_customers_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_seminars_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_purchases_id_idx";
  DROP INDEX IF EXISTS "payload_preferences_rels_customers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "customers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "seminars_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "purchases_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "customers_id";
  DROP TYPE "public"."enum_purchases_status";`)
}
