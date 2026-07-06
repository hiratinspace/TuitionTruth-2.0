CREATE TABLE "analytics_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"institution_id" integer NOT NULL,
	"residency_status" "residency_status" NOT NULL,
	"latest_year" integer,
	"latest_sticker" numeric(12, 2),
	"latest_net" numeric(12, 2),
	"discount_rate" numeric(9, 6),
	"cagr_5yr" numeric(9, 6),
	"cagr_10yr" numeric(9, 6),
	"yoy_rate" numeric(9, 6),
	"projection_year" integer,
	"projection_value" numeric(12, 2),
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_snapshots_inst_residency_key" UNIQUE("institution_id","residency_status"),
	CONSTRAINT "analytics_snapshots_latest_year_range" CHECK ("analytics_snapshots"."latest_year" is null or "analytics_snapshots"."latest_year" between 1990 and 2100)
);
--> statement-breakpoint
CREATE TABLE "segment_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"sector" "sector",
	"institution_type" "institution_type",
	"state" varchar(2),
	"residency_status" "residency_status" NOT NULL,
	"institution_count" integer NOT NULL,
	"mean_sticker" numeric(12, 2) NOT NULL,
	"median_sticker" numeric(12, 2) NOT NULL,
	"min_sticker" numeric(12, 2) NOT NULL,
	"max_sticker" numeric(12, 2) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segment_snapshots_cohort_key" UNIQUE NULLS NOT DISTINCT("sector","institution_type","state","residency_status"),
	CONSTRAINT "segment_snapshots_count_positive" CHECK ("segment_snapshots"."institution_count" > 0),
	CONSTRAINT "segment_snapshots_sticker_ordering" CHECK ("segment_snapshots"."min_sticker" <= "segment_snapshots"."median_sticker" and "segment_snapshots"."median_sticker" <= "segment_snapshots"."max_sticker")
);
--> statement-breakpoint
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_snapshots_sticker_idx" ON "analytics_snapshots" USING btree ("latest_sticker");--> statement-breakpoint
CREATE INDEX "segment_snapshots_lookup_idx" ON "segment_snapshots" USING btree ("residency_status","state");