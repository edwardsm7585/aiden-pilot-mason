-- DropForeignKey
ALTER TABLE "ai_usage" DROP CONSTRAINT "ai_usage_org_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_usage" DROP CONSTRAINT "ai_usage_user_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_org_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_org_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_owner_id_fkey";

-- DropTable
DROP TABLE "ai_usage";

-- DropTable
DROP TABLE "memberships";

-- DropTable
DROP TABLE "orgs";

-- DropTable
DROP TABLE "tickets";

