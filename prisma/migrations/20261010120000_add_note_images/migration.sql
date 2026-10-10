-- Pictures of plan notes, stored apart from the note text.
CREATE TABLE IF NOT EXISTS "note_images" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_images_pkey" PRIMARY KEY ("userId","id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_images_userId_fkey') THEN
    ALTER TABLE "note_images" ADD CONSTRAINT "note_images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
