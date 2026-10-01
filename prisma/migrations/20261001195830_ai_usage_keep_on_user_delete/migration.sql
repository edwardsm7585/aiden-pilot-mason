-- DropForeignKey
ALTER TABLE "ai_usage" DROP CONSTRAINT "ai_usage_user_id_fkey";

-- AlterTable
ALTER TABLE "ai_usage" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
