-- Test PostGIS functions
SELECT ST_AsText(ST_Envelope(ST_Collect(ST_GeomFromText(geom, 4326)))) as bbox
FROM points
WHERE infrastructure_id = '76f2c8c2-5fa5-4e17-a261-62cb6474f666';
