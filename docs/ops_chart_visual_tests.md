# Chart screenshot gate

`npm run test:visual:charts` renders the actual EvidenceGrid and TaksaNineGrid components with application CSS and self-hosted Thai fonts in Chromium. Synthetic fixed input and an explicit transit date keep the result independent of members, databases, AI and today's date.

Six reviewed screenshots cover desktop (1280px), mobile (390px), narrow mobile (320px), each in dark and light themes. Checks also require all ten Thai planet names/numerals, the Triwai footer, expected transit age, loaded Thai font, no Western planetary glyphs, no horizontal overflow and no browser errors.

GitHub Actions uploads expected/actual/diff images and an HTML report on failure. Coolify runs the same screenshot comparison before building Next.js or replacing the running application. A failed comparison stops deployment. At most 100 pixels may differ, with a 0.1 per-pixel threshold for small anti-aliasing differences; text checks are exact. The threshold must also reject the deliberate grayscale mutation below.

## Review an intentional change

1. Run `npm run test:visual:charts` and inspect the generated HTML report under `output/chart-visual-tests/report/`.
2. Verify that names, numerals, colors and layout are correct at every viewport and theme.
3. Run `npm run test:visual:charts:update` only after review. Commit the changed PNGs in `visual-tests/snapshots/` with the code change.
4. Run the comparison again and verify CI before merging. CI blocks `--update-snapshots` and its `-u` alias; it never replaces baselines automatically.

Baselines are separated by OS because font rasterization differs. Linux baselines gate GitHub Actions and Coolify; macOS baselines allow local comparisons. Use the lockfile's Playwright/browser version. A browser/font upgrade requires reviewing baselines again, not increasing tolerance to hide changes.

For a Linux baseline update, use an isolated Linux development container with `npm ci` and `npx playwright install --with-deps --only-shell chromium`, then run the update command outside CI. Review all six PNGs before copying them into `visual-tests/snapshots/linux/`. A macOS update only replaces the macOS baselines; both sets must accompany an intentional UI change.

To verify the gate detects a regression, run `CHART_VISUAL_MUTATION=1 npm run test:visual:charts -- --project=desktop-dark`. This test-only flag desaturates the fixture; the command must fail with an image diff. Never update baselines with this flag set. No production route or runtime behavior is modified by these tests.
