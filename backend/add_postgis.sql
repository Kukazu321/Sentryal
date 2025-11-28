-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Convert bbox column in infrastructures to GEOMETRY(POLYGON, 4326)
ALTER TABLE infrastructures ALTER COLUMN bbox TYPE GEOMETRY(POLYGON, 4326) USING ST_GeomFromText(bbox, 4326);

-- Convert geom column in points to GEOMETRY(POINT, 4326)
ALTER TABLE points ALTER COLUMN geom TYPE GEOMETRY(POINT, 4326) USING ST_GeomFromText(geom, 4326);

-- Convert bbox column in jobs to GEOMETRY(POLYGON, 4326)
ALTER TABLE jobs ALTER COLUMN bbox TYPE GEOMETRY(POLYGON, 4326) USING ST_GeomFromText(bbox, 4326);

-- Create spatial GIST indexes
CREATE INDEX IF NOT EXISTS infrastructures_bbox_idx ON infrastructures USING GIST (bbox);
CREATE INDEX IF NOT EXISTS points_geom_idx ON points USING GIST (geom);
CREATE INDEX IF NOT EXISTS jobs_bbox_idx ON jobs USING GIST (bbox);
