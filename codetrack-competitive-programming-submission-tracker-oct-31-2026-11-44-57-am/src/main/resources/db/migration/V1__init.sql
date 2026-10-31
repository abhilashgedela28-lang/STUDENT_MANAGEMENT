-- V1__init.sql
-- CodeTrack Database Schema & Starter Seed Data

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_links (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL, -- LEETCODE, CODEFORCES
    username VARCHAR(255) NOT NULL,
    verification_code VARCHAR(32),
    code_expires_at TIMESTAMP WITH TIME ZONE,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_user_platform UNIQUE(user_id, platform)
);

-- Partial unique index on verified accounts to prevent impersonation
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_links_verified_username
ON platform_links(platform, lower(username))
WHERE verified = true;

CREATE TABLE IF NOT EXISTS problems (
    id VARCHAR(64) PRIMARY KEY,
    platform VARCHAR(32) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    difficulty VARCHAR(32) NOT NULL,
    topics TEXT, -- Comma-separated or JSON array string
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_platform_external_id UNIQUE(platform, external_id)
);

CREATE TABLE IF NOT EXISTS user_problem_status (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id VARCHAR(64) NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL, -- STARTED, SOLVED
    started_at TIMESTAMP WITH TIME ZONE,
    solved_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_user_problem UNIQUE(user_id, problem_id)
);

CREATE TABLE IF NOT EXISTS user_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL,
    snapshot_date DATE NOT NULL,
    total_solved INT NOT NULL DEFAULT 0,
    easy INT NOT NULL DEFAULT 0,
    medium INT NOT NULL DEFAULT 0,
    hard INT NOT NULL DEFAULT 0,
    rating INT,
    contests INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_platform_snapshot_date UNIQUE(user_id, platform, snapshot_date)
);

CREATE TABLE IF NOT EXISTS sync_log (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    result TEXT
);

CREATE TABLE IF NOT EXISTS daily_sync_counter (
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    count INT NOT NULL DEFAULT 0,
    PRIMARY KEY(user_id, day)
);

-- Indexes on foreign keys and frequently queried columns
CREATE INDEX IF NOT EXISTS idx_platform_links_user ON platform_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_problem_status_user ON user_problem_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_snapshots_user_platform ON user_snapshots(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_problems_platform_active ON problems(platform, active);
