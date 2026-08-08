-- AlterEnum
ALTER TYPE "request_type" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "custom_field_values" JSONB,
ADD COLUMN     "request_type_id" TEXT;

-- CreateTable
CREATE TABLE "request_type_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_type_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_type_templates_tenant_id_name_key" ON "request_type_templates"("tenant_id", "name");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_type_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_type_templates" ADD CONSTRAINT "request_type_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
