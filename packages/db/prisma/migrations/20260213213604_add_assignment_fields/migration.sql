-- AlterTable
ALTER TABLE "run_items" ADD COLUMN     "assigned_to_id" TEXT;

-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "assigned_to_id" TEXT;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
