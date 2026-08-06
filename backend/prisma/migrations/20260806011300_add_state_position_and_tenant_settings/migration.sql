-- AlterTable
ALTER TABLE "tenant_config" ADD COLUMN     "enabled_modules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "primary_color" TEXT,
ADD COLUMN     "system_name" TEXT;

-- AlterTable
ALTER TABLE "workflow_states" ADD COLUMN     "position_x" DOUBLE PRECISION,
ADD COLUMN     "position_y" DOUBLE PRECISION;
