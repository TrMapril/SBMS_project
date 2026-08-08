-- AlterTable
ALTER TABLE "tenant_config" ADD COLUMN     "landing_background_color" TEXT,
ADD COLUMN     "landing_background_image_url" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "is_disabled" BOOLEAN NOT NULL DEFAULT false;
