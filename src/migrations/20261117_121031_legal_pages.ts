import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_legal_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__legal_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "legal_pages_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "legal_pages_blocks_subheading" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "legal_pages_blocks_table_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "legal_pages_blocks_table_rows_cells" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "legal_pages_blocks_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "legal_pages_blocks_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "legal_pages_blocks_contact_card" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "legal_pages_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"anchor" varchar
  );
  
  CREATE TABLE "legal_pages" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"last_updated" timestamp(3) with time zone,
  	"meta_description" varchar,
  	"intro" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_legal_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "legal_pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"legal_pages_id" uuid
  );
  
  CREATE TABLE "_legal_pages_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_legal_pages_v_blocks_subheading" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_legal_pages_v_blocks_table_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_legal_pages_v_blocks_table_rows_cells" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_legal_pages_v_blocks_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_legal_pages_v_blocks_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_legal_pages_v_blocks_contact_card" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_legal_pages_v_version_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"heading" varchar,
  	"anchor" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_legal_pages_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_last_updated" timestamp(3) with time zone,
  	"version_meta_description" varchar,
  	"version_intro" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__legal_pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_legal_pages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"legal_pages_id" uuid
  );
  
  CREATE TABLE "company_info" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"legal_name" varchar DEFAULT 'PT SUPIO COSMETICS INDONESIA' NOT NULL,
  	"brand_name" varchar DEFAULT 'SCI Aesthetics',
  	"address" varchar DEFAULT 'Ciputra World Office Unit 1003, Jl. Mayjen Sungkono No.87 Lantai 10, Gn. Sari, Kec. Dukuhpakis, Surabaya, Jawa Timur 60224' NOT NULL,
  	"whatsapp_url" varchar DEFAULT 'https://wa.me/62881082511298/' NOT NULL,
  	"whatsapp_label" varchar DEFAULT 'hubungi kami melalui WhatsApp resmi' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_pages_id" uuid;
  ALTER TABLE "legal_pages_blocks_text" ADD CONSTRAINT "legal_pages_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_blocks_subheading" ADD CONSTRAINT "legal_pages_blocks_subheading_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_blocks_table_columns" ADD CONSTRAINT "legal_pages_blocks_table_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_blocks_table_rows_cells" ADD CONSTRAINT "legal_pages_blocks_table_rows_cells_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages_blocks_table_rows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_blocks_table_rows" ADD CONSTRAINT "legal_pages_blocks_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_blocks_table" ADD CONSTRAINT "legal_pages_blocks_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_blocks_contact_card" ADD CONSTRAINT "legal_pages_blocks_contact_card_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_sections" ADD CONSTRAINT "legal_pages_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_rels" ADD CONSTRAINT "legal_pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_rels" ADD CONSTRAINT "legal_pages_rels_legal_pages_fk" FOREIGN KEY ("legal_pages_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_blocks_text" ADD CONSTRAINT "_legal_pages_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_blocks_subheading" ADD CONSTRAINT "_legal_pages_v_blocks_subheading_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_blocks_table_columns" ADD CONSTRAINT "_legal_pages_v_blocks_table_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_blocks_table_rows_cells" ADD CONSTRAINT "_legal_pages_v_blocks_table_rows_cells_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v_blocks_table_rows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_blocks_table_rows" ADD CONSTRAINT "_legal_pages_v_blocks_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_blocks_table" ADD CONSTRAINT "_legal_pages_v_blocks_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_blocks_contact_card" ADD CONSTRAINT "_legal_pages_v_blocks_contact_card_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_version_sections" ADD CONSTRAINT "_legal_pages_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v" ADD CONSTRAINT "_legal_pages_v_parent_id_legal_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_rels" ADD CONSTRAINT "_legal_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_legal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_rels" ADD CONSTRAINT "_legal_pages_v_rels_legal_pages_fk" FOREIGN KEY ("legal_pages_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "legal_pages_blocks_text_order_idx" ON "legal_pages_blocks_text" USING btree ("_order");
  CREATE INDEX "legal_pages_blocks_text_parent_id_idx" ON "legal_pages_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "legal_pages_blocks_text_path_idx" ON "legal_pages_blocks_text" USING btree ("_path");
  CREATE INDEX "legal_pages_blocks_subheading_order_idx" ON "legal_pages_blocks_subheading" USING btree ("_order");
  CREATE INDEX "legal_pages_blocks_subheading_parent_id_idx" ON "legal_pages_blocks_subheading" USING btree ("_parent_id");
  CREATE INDEX "legal_pages_blocks_subheading_path_idx" ON "legal_pages_blocks_subheading" USING btree ("_path");
  CREATE INDEX "legal_pages_blocks_table_columns_order_idx" ON "legal_pages_blocks_table_columns" USING btree ("_order");
  CREATE INDEX "legal_pages_blocks_table_columns_parent_id_idx" ON "legal_pages_blocks_table_columns" USING btree ("_parent_id");
  CREATE INDEX "legal_pages_blocks_table_rows_cells_order_idx" ON "legal_pages_blocks_table_rows_cells" USING btree ("_order");
  CREATE INDEX "legal_pages_blocks_table_rows_cells_parent_id_idx" ON "legal_pages_blocks_table_rows_cells" USING btree ("_parent_id");
  CREATE INDEX "legal_pages_blocks_table_rows_order_idx" ON "legal_pages_blocks_table_rows" USING btree ("_order");
  CREATE INDEX "legal_pages_blocks_table_rows_parent_id_idx" ON "legal_pages_blocks_table_rows" USING btree ("_parent_id");
  CREATE INDEX "legal_pages_blocks_table_order_idx" ON "legal_pages_blocks_table" USING btree ("_order");
  CREATE INDEX "legal_pages_blocks_table_parent_id_idx" ON "legal_pages_blocks_table" USING btree ("_parent_id");
  CREATE INDEX "legal_pages_blocks_table_path_idx" ON "legal_pages_blocks_table" USING btree ("_path");
  CREATE INDEX "legal_pages_blocks_contact_card_order_idx" ON "legal_pages_blocks_contact_card" USING btree ("_order");
  CREATE INDEX "legal_pages_blocks_contact_card_parent_id_idx" ON "legal_pages_blocks_contact_card" USING btree ("_parent_id");
  CREATE INDEX "legal_pages_blocks_contact_card_path_idx" ON "legal_pages_blocks_contact_card" USING btree ("_path");
  CREATE INDEX "legal_pages_sections_order_idx" ON "legal_pages_sections" USING btree ("_order");
  CREATE INDEX "legal_pages_sections_parent_id_idx" ON "legal_pages_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "legal_pages_slug_idx" ON "legal_pages" USING btree ("slug");
  CREATE INDEX "legal_pages_updated_at_idx" ON "legal_pages" USING btree ("updated_at");
  CREATE INDEX "legal_pages_created_at_idx" ON "legal_pages" USING btree ("created_at");
  CREATE INDEX "legal_pages__status_idx" ON "legal_pages" USING btree ("_status");
  CREATE INDEX "legal_pages_rels_order_idx" ON "legal_pages_rels" USING btree ("order");
  CREATE INDEX "legal_pages_rels_parent_idx" ON "legal_pages_rels" USING btree ("parent_id");
  CREATE INDEX "legal_pages_rels_path_idx" ON "legal_pages_rels" USING btree ("path");
  CREATE INDEX "legal_pages_rels_legal_pages_id_idx" ON "legal_pages_rels" USING btree ("legal_pages_id");
  CREATE INDEX "_legal_pages_v_blocks_text_order_idx" ON "_legal_pages_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_blocks_text_parent_id_idx" ON "_legal_pages_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_blocks_text_path_idx" ON "_legal_pages_v_blocks_text" USING btree ("_path");
  CREATE INDEX "_legal_pages_v_blocks_subheading_order_idx" ON "_legal_pages_v_blocks_subheading" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_blocks_subheading_parent_id_idx" ON "_legal_pages_v_blocks_subheading" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_blocks_subheading_path_idx" ON "_legal_pages_v_blocks_subheading" USING btree ("_path");
  CREATE INDEX "_legal_pages_v_blocks_table_columns_order_idx" ON "_legal_pages_v_blocks_table_columns" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_blocks_table_columns_parent_id_idx" ON "_legal_pages_v_blocks_table_columns" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_blocks_table_rows_cells_order_idx" ON "_legal_pages_v_blocks_table_rows_cells" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_blocks_table_rows_cells_parent_id_idx" ON "_legal_pages_v_blocks_table_rows_cells" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_blocks_table_rows_order_idx" ON "_legal_pages_v_blocks_table_rows" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_blocks_table_rows_parent_id_idx" ON "_legal_pages_v_blocks_table_rows" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_blocks_table_order_idx" ON "_legal_pages_v_blocks_table" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_blocks_table_parent_id_idx" ON "_legal_pages_v_blocks_table" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_blocks_table_path_idx" ON "_legal_pages_v_blocks_table" USING btree ("_path");
  CREATE INDEX "_legal_pages_v_blocks_contact_card_order_idx" ON "_legal_pages_v_blocks_contact_card" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_blocks_contact_card_parent_id_idx" ON "_legal_pages_v_blocks_contact_card" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_blocks_contact_card_path_idx" ON "_legal_pages_v_blocks_contact_card" USING btree ("_path");
  CREATE INDEX "_legal_pages_v_version_sections_order_idx" ON "_legal_pages_v_version_sections" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_version_sections_parent_id_idx" ON "_legal_pages_v_version_sections" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_parent_idx" ON "_legal_pages_v" USING btree ("parent_id");
  CREATE INDEX "_legal_pages_v_version_version_slug_idx" ON "_legal_pages_v" USING btree ("version_slug");
  CREATE INDEX "_legal_pages_v_version_version_updated_at_idx" ON "_legal_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_legal_pages_v_version_version_created_at_idx" ON "_legal_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_legal_pages_v_version_version__status_idx" ON "_legal_pages_v" USING btree ("version__status");
  CREATE INDEX "_legal_pages_v_created_at_idx" ON "_legal_pages_v" USING btree ("created_at");
  CREATE INDEX "_legal_pages_v_updated_at_idx" ON "_legal_pages_v" USING btree ("updated_at");
  CREATE INDEX "_legal_pages_v_latest_idx" ON "_legal_pages_v" USING btree ("latest");
  CREATE INDEX "_legal_pages_v_rels_order_idx" ON "_legal_pages_v_rels" USING btree ("order");
  CREATE INDEX "_legal_pages_v_rels_parent_idx" ON "_legal_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_legal_pages_v_rels_path_idx" ON "_legal_pages_v_rels" USING btree ("path");
  CREATE INDEX "_legal_pages_v_rels_legal_pages_id_idx" ON "_legal_pages_v_rels" USING btree ("legal_pages_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_pages_fk" FOREIGN KEY ("legal_pages_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_legal_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_pages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "legal_pages_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages_blocks_subheading" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages_blocks_table_columns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages_blocks_table_rows_cells" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages_blocks_table_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages_blocks_table" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages_blocks_contact_card" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_pages_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_blocks_subheading" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_blocks_table_columns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_blocks_table_rows_cells" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_blocks_table_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_blocks_table" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_blocks_contact_card" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_version_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_legal_pages_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "company_info" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "legal_pages_blocks_text" CASCADE;
  DROP TABLE "legal_pages_blocks_subheading" CASCADE;
  DROP TABLE "legal_pages_blocks_table_columns" CASCADE;
  DROP TABLE "legal_pages_blocks_table_rows_cells" CASCADE;
  DROP TABLE "legal_pages_blocks_table_rows" CASCADE;
  DROP TABLE "legal_pages_blocks_table" CASCADE;
  DROP TABLE "legal_pages_blocks_contact_card" CASCADE;
  DROP TABLE "legal_pages_sections" CASCADE;
  DROP TABLE "legal_pages" CASCADE;
  DROP TABLE "legal_pages_rels" CASCADE;
  DROP TABLE "_legal_pages_v_blocks_text" CASCADE;
  DROP TABLE "_legal_pages_v_blocks_subheading" CASCADE;
  DROP TABLE "_legal_pages_v_blocks_table_columns" CASCADE;
  DROP TABLE "_legal_pages_v_blocks_table_rows_cells" CASCADE;
  DROP TABLE "_legal_pages_v_blocks_table_rows" CASCADE;
  DROP TABLE "_legal_pages_v_blocks_table" CASCADE;
  DROP TABLE "_legal_pages_v_blocks_contact_card" CASCADE;
  DROP TABLE "_legal_pages_v_version_sections" CASCADE;
  DROP TABLE "_legal_pages_v" CASCADE;
  DROP TABLE "_legal_pages_v_rels" CASCADE;
  DROP TABLE "company_info" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_legal_pages_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_legal_pages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "legal_pages_id";
  DROP TYPE "public"."enum_legal_pages_status";
  DROP TYPE "public"."enum__legal_pages_v_version_status";`)
}
