-- CreateTable
CREATE TABLE "jadwal" (
    "id" SERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "tanggal" TEXT NOT NULL,
    "jam" TEXT NOT NULL,
    "agenda" TEXT NOT NULL,
    "sudah_diingatkan" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jadwal_pkey" PRIMARY KEY ("id")
);
