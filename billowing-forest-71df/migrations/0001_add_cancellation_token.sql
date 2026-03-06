-- Migration: add cancellation_token to event_signups
ALTER TABLE event_signups ADD COLUMN cancellation_token TEXT;
