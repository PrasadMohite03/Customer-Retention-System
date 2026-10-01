CREATE UNIQUE INDEX unique_active_program_per_branch
ON "LoyaltyProgram" ("branchId")
WHERE "isActive" = true;

CREATE UNIQUE INDEX unique_active_cycle_per_customer_program
ON "LoyaltyCycle" ("customerProfileId", "programId")
WHERE "status" = 'ACTIVE';