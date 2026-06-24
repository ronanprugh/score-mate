-- Reset all favorites because Spec 03 swaps the data backend from
-- TheSportsDB to ESPN. Stored `external_id` values are TheSportsDB
-- ids (team `idTeam`, league `idLeague`, etc.) and don't map to ESPN.
-- Per Spec 03 Q4 answer (D): score-mate has no production users yet,
-- so a one-shot truncate is the cleanest path. Users re-favorite from
-- the new ESPN-backed search.
--
-- Related to T4.0 in Spec 03-spec-espn-backend
TRUNCATE TABLE "favorites";
