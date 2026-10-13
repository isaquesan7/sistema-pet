-- Optional global user profile fields. Existing credentials and roles remain unchanged.
ALTER TABLE "usuarios" ADD COLUMN "nomeExibicao" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "fotoUrl" TEXT;
