-- This is a no-op: createdAt/updatedAt were already part of the initial device_code table
-- in migration 20260601105723_device_flow. This migration is already recorded as applied
-- in the main database but needs to pass in shadow DB for future migrations.
SELECT 1;