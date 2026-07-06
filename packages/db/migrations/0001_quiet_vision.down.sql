-- Reversible companion for 0001_quiet_vision.sql (Phase 1 quality bar).
-- Drops the view, audit triggers/functions, and domain tables in FK-safe order.
-- migration_health (from 0000) is intentionally left in place.
DROP VIEW IF EXISTS total_mandatory_cost;
DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
DROP TRIGGER IF EXISTS tuition_rates_audit ON tuition_rates;
DROP TRIGGER IF EXISTS fees_breakdown_audit ON fees_breakdown;
DROP TRIGGER IF EXISTS net_price_data_audit ON net_price_data;
DROP FUNCTION IF EXISTS audit_row_change();
DROP FUNCTION IF EXISTS audit_log_reject_mutation();
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS net_price_data;
DROP TABLE IF EXISTS fees_breakdown;
DROP TABLE IF EXISTS tuition_rates;
DROP TABLE IF EXISTS institutions;
DROP TYPE IF EXISTS source_type;
DROP TYPE IF EXISTS fee_type;
DROP TYPE IF EXISTS residency_status;
DROP TYPE IF EXISTS institution_type;
DROP TYPE IF EXISTS sector;
