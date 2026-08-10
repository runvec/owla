-- Remoção definitiva do market-maker (bot de liquidez)

-- DropIndex não aplicável (nenhum índice único sobre isBot/botEnabled).

ALTER TABLE "User" DROP COLUMN IF EXISTS "isBot";
ALTER TABLE "Market" DROP COLUMN IF EXISTS "botEnabled";

