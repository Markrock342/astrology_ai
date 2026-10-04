-- Opt-in Monday email of the week's good days (ปฏิทินดวง), and when it last went.
ALTER TABLE "users" ADD COLUMN "weeklyDaysEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "weeklyDaysSentAt" TIMESTAMP(3);
