-- Replay guard for admin TOTP: highest accepted time-step.
ALTER TABLE "users" ADD COLUMN "totpLastStep" INTEGER;
