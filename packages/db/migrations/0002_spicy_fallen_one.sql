CREATE TABLE "pending_changes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"table_name" text NOT NULL,
	"ipeds_unit_id" integer NOT NULL,
	"academic_year" integer NOT NULL,
	"residency_status" text,
	"field_changed" text NOT NULL,
	"old_value" numeric(12, 2),
	"new_value" numeric(12, 2) NOT NULL,
	"source_url" text,
	"confidence_score" numeric(3, 2),
	"explanation" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer" text,
	"rejection_reason" text,
	"detected_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "pending_changes_status_valid" CHECK ("pending_changes"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX "pending_changes_status_idx" ON "pending_changes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_changes_inst_idx" ON "pending_changes" USING btree ("ipeds_unit_id");