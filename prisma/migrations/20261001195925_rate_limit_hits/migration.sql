-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_hits_key_at_idx" ON "rate_limit_hits"("key", "at");

-- CreateIndex
CREATE INDEX "rate_limit_hits_at_idx" ON "rate_limit_hits"("at");
