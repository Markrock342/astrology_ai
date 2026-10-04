import { Body, Observer, SearchRiseSet, MakeTime } from "astronomy-engine";
import { registerTaksaBoundaryResolver } from "@/lib/taksa";
import { resolvePlaceCoords } from "./newhora/data/placeCoordinates";

/**
 * Real sunrise and sunset at the birthplace for the taksa day boundary (see
 * resolveTaksaBirthDay). Imported for its side effect by the engine entry
 * points; anything not on the server keeps 06:00 / 18:00.
 */
function localMinutes(date: Date, offsetMin: number): number {
  const d = new Date(date.getTime() + offsetMin * 60_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}

registerTaksaBoundaryResolver((input) => {
  const place = resolvePlaceCoords(input.country, input.province, input.district);
  const observer = new Observer(place.lat, place.lon, 0);
  // Local midnight of the civil birth date.
  const midnight = MakeTime(new Date(Date.UTC(input.year, input.month - 1, input.day) - place.utcOffsetMinutes * 60_000));
  const rise = SearchRiseSet(Body.Sun, observer, +1, midnight, 1);
  const set = SearchRiseSet(Body.Sun, observer, -1, midnight, 1);
  if (!rise || !set) return null;
  return {
    sunriseMin: localMinutes(rise.date, place.utcOffsetMinutes),
    sunsetMin: localMinutes(set.date, place.utcOffsetMinutes),
  };
});
