ALTER TABLE "countries" DROP CONSTRAINT "countries_name_unique";--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "countries_name_lower_unique" ON "countries" USING btree (lower("name"));