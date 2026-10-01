-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('NONE', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_ITEM');

-- CreateEnum
CREATE TYPE "LoyaltyCycleStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VisitRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MilestoneRewardStatus" AS ENUM ('UNLOCKED', 'REDEEMED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "qrToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cycleLength" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "visitNumber" INTEGER NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "rewardName" TEXT,
    "rewardDescription" TEXT,
    "rewardValue" DECIMAL(10,2),
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyCycle" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "visitCount" INTEGER NOT NULL,
    "status" "LoyaltyCycleStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitRequest" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "VisitRequestStatus" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByStaffId" TEXT,

    CONSTRAINT "VisitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "loyaltyCycleId" TEXT NOT NULL,
    "visitRequestId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "visitNumberInCycle" INTEGER NOT NULL,
    "approvedByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneReward" (
    "id" TEXT NOT NULL,
    "loyaltyCycleId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "snapshotRewardType" "RewardType" NOT NULL,
    "snapshotRewardValue" DECIMAL(10,2),
    "snapshotRewardName" TEXT,
    "snapshotRewardDescription" TEXT,
    "status" "MilestoneRewardStatus" NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByStaffId" TEXT,

    CONSTRAINT "MilestoneReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_qrToken_key" ON "Branch"("qrToken");

-- CreateIndex
CREATE INDEX "Branch_businessId_idx" ON "Branch"("businessId");

-- CreateIndex
CREATE INDEX "Staff_businessId_idx" ON "Staff"("businessId");

-- CreateIndex
CREATE INDEX "Staff_branchId_idx" ON "Staff"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "CustomerProfile_customerId_idx" ON "CustomerProfile"("customerId");

-- CreateIndex
CREATE INDEX "CustomerProfile_businessId_idx" ON "CustomerProfile"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_customerId_businessId_key" ON "CustomerProfile"("customerId", "businessId");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_businessId_idx" ON "LoyaltyProgram"("businessId");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_branchId_idx" ON "LoyaltyProgram"("branchId");

-- CreateIndex
CREATE INDEX "Milestone_programId_idx" ON "Milestone"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_programId_visitNumber_key" ON "Milestone"("programId", "visitNumber");

-- CreateIndex
CREATE INDEX "LoyaltyCycle_customerProfileId_idx" ON "LoyaltyCycle"("customerProfileId");

-- CreateIndex
CREATE INDEX "LoyaltyCycle_programId_idx" ON "LoyaltyCycle"("programId");

-- CreateIndex
CREATE INDEX "LoyaltyCycle_customerProfileId_programId_status_idx" ON "LoyaltyCycle"("customerProfileId", "programId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCycle_customerProfileId_programId_cycleNumber_key" ON "LoyaltyCycle"("customerProfileId", "programId", "cycleNumber");

-- CreateIndex
CREATE INDEX "VisitRequest_customerProfileId_idx" ON "VisitRequest"("customerProfileId");

-- CreateIndex
CREATE INDEX "VisitRequest_branchId_idx" ON "VisitRequest"("branchId");

-- CreateIndex
CREATE INDEX "VisitRequest_branchId_status_idx" ON "VisitRequest"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_visitRequestId_key" ON "Visit"("visitRequestId");

-- CreateIndex
CREATE INDEX "Visit_loyaltyCycleId_idx" ON "Visit"("loyaltyCycleId");

-- CreateIndex
CREATE INDEX "Visit_branchId_idx" ON "Visit"("branchId");

-- CreateIndex
CREATE INDEX "MilestoneReward_loyaltyCycleId_idx" ON "MilestoneReward"("loyaltyCycleId");

-- CreateIndex
CREATE INDEX "MilestoneReward_loyaltyCycleId_status_idx" ON "MilestoneReward"("loyaltyCycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneReward_loyaltyCycleId_milestoneId_key" ON "MilestoneReward"("loyaltyCycleId", "milestoneId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCycle" ADD CONSTRAINT "LoyaltyCycle_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCycle" ADD CONSTRAINT "LoyaltyCycle_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_resolvedByStaffId_fkey" FOREIGN KEY ("resolvedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_loyaltyCycleId_fkey" FOREIGN KEY ("loyaltyCycleId") REFERENCES "LoyaltyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_visitRequestId_fkey" FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_approvedByStaffId_fkey" FOREIGN KEY ("approvedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneReward" ADD CONSTRAINT "MilestoneReward_loyaltyCycleId_fkey" FOREIGN KEY ("loyaltyCycleId") REFERENCES "LoyaltyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneReward" ADD CONSTRAINT "MilestoneReward_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneReward" ADD CONSTRAINT "MilestoneReward_redeemedByStaffId_fkey" FOREIGN KEY ("redeemedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
