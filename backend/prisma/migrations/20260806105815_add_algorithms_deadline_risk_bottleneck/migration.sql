-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "risk_score" DOUBLE PRECISION,
ADD COLUMN     "risk_score_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_config" ADD COLUMN     "assignment_weights" JSONB NOT NULL DEFAULT '{"workload":0.3,"onTimeRate":0.3,"stepSpeed":0.25,"returnRate":0.15}';

-- CreateTable
CREATE TABLE "bottleneck_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "window_days" INTEGER NOT NULL DEFAULT 30,
    "state_stats" JSONB NOT NULL,
    "transition_stats" JSONB NOT NULL,
    "overall_backward_rate" DOUBLE PRECISION NOT NULL,
    "delta_backward_rate_vs_previous" DOUBLE PRECISION,

    CONSTRAINT "bottleneck_snapshots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bottleneck_snapshots" ADD CONSTRAINT "bottleneck_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bottleneck_snapshots" ADD CONSTRAINT "bottleneck_snapshots_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
