-- AlterTable
ALTER TABLE "user" ADD COLUMN     "dodoCustomerId" TEXT;

-- CreateTable
CREATE TABLE "plan" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variant" TEXT,
    "interval" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "requestLimit" INTEGER NOT NULL,
    "contextLimit" INTEGER NOT NULL,
    "modelAccess" TEXT NOT NULL,
    "creditAmountCents" INTEGER NOT NULL DEFAULT 0,
    "dodoProductId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dodoSubscriptionId" TEXT NOT NULL,
    "dodoCustomerId" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_balance" (
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_balance_pkey" PRIMARY KEY ("userId","planId")
);

-- CreateTable
CREATE TABLE "model" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "minTier" TEXT NOT NULL,
    "inputPrice" DOUBLE PRECISION NOT NULL,
    "outputPrice" DOUBLE PRECISION NOT NULL,
    "cachedPrice" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_dodoProductId_key" ON "plan"("dodoProductId");

-- CreateIndex
CREATE INDEX "plan_tier_idx" ON "plan"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_dodoSubscriptionId_key" ON "subscription"("dodoSubscriptionId");

-- CreateIndex
CREATE INDEX "subscription_userId_idx" ON "subscription"("userId");

-- CreateIndex
CREATE INDEX "subscription_planId_idx" ON "subscription"("planId");

-- CreateIndex
CREATE INDEX "subscription_dodoSubscriptionId_idx" ON "subscription"("dodoSubscriptionId");

-- CreateIndex
CREATE INDEX "subscription_status_idx" ON "subscription"("status");

-- CreateIndex
CREATE INDEX "credit_balance_userId_idx" ON "credit_balance"("userId");

-- CreateIndex
CREATE INDEX "credit_balance_planId_idx" ON "credit_balance"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "model_slug_key" ON "model"("slug");

-- CreateIndex
CREATE INDEX "model_minTier_idx" ON "model"("minTier");

-- CreateIndex
CREATE INDEX "model_provider_idx" ON "model"("provider");

-- CreateIndex
CREATE INDEX "model_slug_idx" ON "model"("slug");

-- CreateIndex
CREATE INDEX "conversation_userId_idx" ON "conversation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_dodoCustomerId_key" ON "user"("dodoCustomerId");

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

