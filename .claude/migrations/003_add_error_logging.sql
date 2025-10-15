-- Migration: Add error logging table
-- Created: 2025-10-15
-- Purpose: Track errors from agents and commands for debugging and monitoring

CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Context
    feature_id INTEGER,
    section_id INTEGER,
    agent_name TEXT,
    command_name TEXT,

    -- Error details
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'error', 'warning')),
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    context TEXT, -- JSON string with additional context

    -- Timing
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Relationships
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_severity ON error_log(severity);
CREATE INDEX IF NOT EXISTS idx_error_log_feature_id ON error_log(feature_id);
CREATE INDEX IF NOT EXISTS idx_error_log_section_id ON error_log(section_id);

-- View for easy error monitoring
CREATE VIEW IF NOT EXISTS recent_errors AS
SELECT
    el.id,
    el.severity,
    el.error_type,
    el.error_message,
    el.agent_name,
    el.command_name,
    f.name as feature_name,
    s.name as section_name,
    el.created_at
FROM error_log el
LEFT JOIN features f ON el.feature_id = f.id
LEFT JOIN sections s ON el.section_id = s.id
ORDER BY el.created_at DESC
LIMIT 50;
