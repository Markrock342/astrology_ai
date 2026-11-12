# HoraSard Thailand reverse geocoder

Self-hosted Nominatim 5.3 using only the Thailand Geofabrik extract. The import
is reverse-only with the `admin` style because HoraSard needs province and
district—not POI search or exact house numbers.

It runs **only on HoraSard's own server**, next to the app. It must not be
hosted on any other project's server or share another project's proxy.

Operational properties:

- persistent PostgreSQL data in the `horasard-nominatim-data` volume
- daily Geofabrik replication updates
- capped at 1 CPU / 3 GB so the app, its database and Coolify keep headroom
- **internal only**: no published port and no public domain; it joins the
  `coolify` Docker network and the app calls `http://horasard-nominatim:8080`
- the app rounds coordinates to ~110 m before calling it and falls back to
  public OSM (1 req/s) if it is down

## Deploy (on the server, as root)

```sh
install -d -m 700 /opt/horasard-nominatim
# copy docker-compose.yml from this directory to /opt/horasard-nominatim/
cd /opt/horasard-nominatim
umask 077; [ -f .env ] || printf 'NOMINATIM_PASSWORD=%s\n' "$(openssl rand -hex 24)" > .env
docker compose up -d
docker logs -f horasard-nominatim   # import: typically 30–90 minutes
```

The password stays only in that `.env`; never commit or print it.

## Verify, then switch the app

1. From the server (Bangkok, Pathum Wan):

   ```sh
   docker run --rm --network coolify curlimages/curl:8.10.1 -s \
     "http://horasard-nominatim:8080/reverse?format=jsonv2&lat=13.746&lon=100.535&zoom=14&addressdetails=1&accept-language=th"
   ```

   The JSON must contain `"state":"กรุงเทพมหานคร"`.
2. Coolify → HoraSard app → Environment variables:
   `GEOCODER_BASE_URL=http://horasard-nominatim:8080` (leave
   `GEOCODER_FALLBACK_BASE_URL` unset). Redeploy the app **after** the import
   has finished, so the build and the import do not compete for RAM.
3. Use "auto-fill province/district from location" once in the app. App logs
   must **not** show `primary reverse geocoder unavailable`.

The code has no built-in self-hosted default: with `GEOCODER_BASE_URL` unset
the app uses public OSM.
