-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "project_member_status" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "request_type" AS ENUM ('LEAVE', 'TASK_RETURN');

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "task_id" TEXT,
ADD COLUMN     "task_reset_at" TIMESTAMP(3),
ADD COLUMN     "type" "request_type" NOT NULL DEFAULT 'LEAVE',
ALTER COLUMN "start_date" DROP NOT NULL,
ALTER COLUMN "end_date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "project_members" ADD COLUMN     "status" "project_member_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "status" "project_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "pending_done_confirmation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenant_config" ADD COLUMN     "max_employees" INTEGER;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
