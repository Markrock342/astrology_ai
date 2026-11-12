# HoraSard Thailand reverse geocoder

Self-hosted Nominatim 5.3 using only the Thailand Geofabrik extract. The import
is reverse-only with the `admin` style because HoraSard needs province and
district—not POI search or exact house numbers.

It runs **only on HoraSard's own server**, as a Coolify resource next to the
app. It must not be hosted on any other project's server or share another
project's proxy.

Operational properties:

- persistent PostgreSQL data in the resource's `nominatim-data` volume
- daily Geofabrik replication updates
- CPU/RAM caps so the app and its database keep headroom
- **internal only**: no published port and no public domain; the app calls it
  over the Coolify network, so no TLS or public rate limits are needed
- the app rounds coordinates to ~110 m before calling it and falls back to
  public OSM (1 req/s) if it is down

## Deploy (Coolify UI)

1. Before deploying, check the host has room: about 4–6 GB free RAM and
   15 GB free disk for the import.
2. Project of the HoraSard app → **New resource → Docker Compose (empty)** →
   paste `docker-compose.yml` from this directory.
3. Environment variables: set `NOMINATIM_PASSWORD` to a new random value. Keep
   it only in Coolify; never commit it.
4. Enable **Connect to Predefined Network** so the app can reach it.
5. Deploy. The first start downloads the extract and imports it; follow the
   logs until Nominatim reports it is serving (typically 20–60 minutes).
6. Note the container name Coolify shows for the `nominatim` service
   (`nominatim-<uuid>`).

## Verify, then switch the app

1. From the app's terminal in Coolify (Bangkok, Pathum Wan):

   ```sh
   curl -s "http://nominatim-<uuid>:8080/reverse?format=jsonv2&lat=13.746&lon=100.535&zoom=14&addressdetails=1&accept-language=th"
   ```

   The JSON must contain `"state":"กรุงเทพมหานคร"`.
2. App → Environment variables: set
   `GEOCODER_BASE_URL=http://nominatim-<uuid>:8080`, replacing any older value,
   and leave `GEOCODER_FALLBACK_BASE_URL` unset. Redeploy the app.
3. Use "auto-fill province/district from location" once in the app. App logs
   must **not** show `primary reverse geocoder unavailable`.

The code has no built-in self-hosted default: with `GEOCODER_BASE_URL` unset
the app uses public OSM. If production still sets it to an address outside
HoraSard's server, switch it (step 2) before that old instance is removed;
until then the app falls back to public OSM automatically.
