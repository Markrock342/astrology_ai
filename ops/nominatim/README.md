# HoraSard Thailand reverse geocoder

Self-hosted Nominatim 5.3 using only the Thailand Geofabrik extract. The import
is reverse-only with the `admin` style because HoraSard needs province and
district—not POI search or exact house numbers.

Operational properties:

- persistent PostgreSQL data in `horasard-nominatim-data`
- daily Geofabrik replication updates
- CPU/RAM caps so the existing VPS workloads keep headroom
- HTTPS through the shared nginx container
- only `/reverse` is public; per-IP and global nginx limits protect the service
- the app rounds coordinates before calling this service

Deploy from this directory with `docker compose up -d`. Keep the generated
database password only in the server-side `.env`; never commit it.
