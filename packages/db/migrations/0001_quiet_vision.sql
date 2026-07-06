CREATE TYPE "public"."fee_type" AS ENUM('mandatory_fee', 'room', 'board', 'books', 'other');--> statement-breakpoint
CREATE TYPE "public"."institution_type" AS ENUM('two_year', 'four_year');--> statement-breakpoint
CREATE TYPE "public"."residency_status" AS ENUM('in_state', 'out_of_state');--> statement-breakpoint
CREATE TYPE "public"."sector" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('api', 'scrape', 'manual');--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ipeds_unit_id" integer NOT NULL,
	"opeid" varchar(8),
	"name" text NOT NULL,
	"city" text,
	"state" varchar(2) NOT NULL,
	"sector" "sector" NOT NULL,
	"institution_type" "institution_type" NOT NULL,
	"website_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuition_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"institution_id" integer NOT NULL,
	"academic_year" integer NOT NULL,
	"residency_status" "residency_status" NOT NULL,
	"tuition_amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"effective_date" date,
	"source_type" "source_type" NOT NULL,
	"source_url" text,
	"confidence_score" numeric(3, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tuition_rates_inst_year_residency_key" UNIQUE("institution_id","academic_year","residency_status"),
	CONSTRAINT "tuition_amount_positive" CHECK ("tuition_rates"."tuition_amount" > 0),
	CONSTRAINT "tuition_academic_year_range" CHECK ("tuition_rates"."academic_year" between 1990 and 2100),
	CONSTRAINT "tuition_confidence_range" CHECK ("tuition_rates"."confidence_score" is null or ("tuition_rates"."confidence_score" >= 0 and "tuition_rates"."confidence_score" <= 1))
);
--> statement-breakpoint
CREATE TABLE "fees_breakdown" (
	"id" serial PRIMARY KEY NOT NULL,
	"institution_id" integer NOT NULL,
	"academic_year" integer NOT NULL,
	"fee_type" "fee_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"effective_date" date,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fees_inst_year_type_key" UNIQUE("institution_id","academic_year","fee_type"),
	CONSTRAINT "fee_amount_non_negative" CHECK ("fees_breakdown"."amount" >= 0),
	CONSTRAINT "fee_academic_year_range" CHECK ("fees_breakdown"."academic_year" between 1990 and 2100)
);
--> statement-breakpoint
CREATE TABLE "net_price_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"institution_id" integer NOT NULL,
	"academic_year" integer NOT NULL,
	"income_bracket" text,
	"average_aid_amount" numeric(12, 2),
	"net_price_amount" numeric(12, 2),
	"data_source" text,
	"effective_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "net_price_inst_year_bracket_key" UNIQUE NULLS NOT DISTINCT("institution_id","academic_year","income_bracket"),
	CONSTRAINT "net_price_amounts_non_negative" CHECK (("net_price_data"."average_aid_amount" is null or "net_price_data"."average_aid_amount" >= 0) and ("net_price_data"."net_price_amount" is null or "net_price_data"."net_price_amount" >= 0)),
	CONSTRAINT "net_price_academic_year_range" CHECK ("net_price_data"."academic_year" between 1990 and 2100)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"field_changed" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by" text DEFAULT 'system' NOT NULL,
	"source_url" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_changed_by_valid" CHECK ("audit_log"."changed_by" in ('system', 'scraper', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "tuition_rates" ADD CONSTRAINT "tuition_rates_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees_breakdown" ADD CONSTRAINT "fees_breakdown_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_price_data" ADD CONSTRAINT "net_price_data_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_ipeds_unit_id_key" ON "institutions" USING btree ("ipeds_unit_id");--> statement-breakpoint
CREATE INDEX "institutions_state_idx" ON "institutions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "institutions_segment_idx" ON "institutions" USING btree ("sector","institution_type","state");--> statement-breakpoint
CREATE INDEX "tuition_rates_inst_year_idx" ON "tuition_rates" USING btree ("institution_id","academic_year");--> statement-breakpoint
CREATE INDEX "fees_inst_year_idx" ON "fees_breakdown" USING btree ("institution_id","academic_year");--> statement-breakpoint
CREATE INDEX "net_price_inst_year_idx" ON "net_price_data" USING btree ("institution_id","academic_year");--> statement-breakpoint
CREATE INDEX "audit_log_table_record_idx" ON "audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "audit_log_changed_at_idx" ON "audit_log" USING btree ("changed_at");--> statement-breakpoint
-- ── Audit trail (TUIT-7): one audit_log row per changed field, on every write ──
CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger AS $$
DECLARE
  old_j jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  new_j jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  rec_id text := COALESCE(new_j->>'id', old_j->>'id');
  actor text := COALESCE(current_setting('app.actor', true), 'system');
  k text;
BEGIN
  FOR k IN
    SELECT key FROM (
      SELECT jsonb_object_keys(old_j) AS key
      UNION
      SELECT jsonb_object_keys(new_j) AS key
    ) keys
  LOOP
    IF (old_j->>k) IS DISTINCT FROM (new_j->>k) THEN
      INSERT INTO audit_log (table_name, record_id, field_changed, old_value, new_value, changed_by, source_url)
      VALUES (
        TG_TABLE_NAME, rec_id, k, old_j->>k, new_j->>k,
        CASE WHEN actor IN ('system','scraper','manual') THEN actor ELSE 'system' END,
        COALESCE(new_j->>'source_url', old_j->>'source_url')
      );
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER tuition_rates_audit AFTER INSERT OR UPDATE OR DELETE ON tuition_rates FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
CREATE TRIGGER fees_breakdown_audit AFTER INSERT OR UPDATE OR DELETE ON fees_breakdown FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
CREATE TRIGGER net_price_data_audit AFTER INSERT OR UPDATE OR DELETE ON net_price_data FOR EACH ROW EXECUTE FUNCTION audit_row_change();--> statement-breakpoint
-- ── Immutability (TUIT-7 AC #3): audit_log is append-only for every role ──
CREATE OR REPLACE FUNCTION audit_log_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM PUBLIC;--> statement-breakpoint
-- ── total_mandatory_cost view (TUIT-5 AC #4): tuition + mandatory fees per inst/year/residency ──
CREATE VIEW total_mandatory_cost AS
SELECT
  t.institution_id,
  t.academic_year,
  t.residency_status,
  t.tuition_amount,
  COALESCE(f.mandatory_fees, 0) AS mandatory_fees,
  t.tuition_amount + COALESCE(f.mandatory_fees, 0) AS total_mandatory_cost
FROM tuition_rates t
LEFT JOIN (
  SELECT institution_id, academic_year, SUM(amount) AS mandatory_fees
  FROM fees_breakdown
  WHERE fee_type = 'mandatory_fee'
  GROUP BY institution_id, academic_year
) f ON f.institution_id = t.institution_id AND f.academic_year = t.academic_year;