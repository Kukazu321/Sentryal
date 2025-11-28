#!/bin/bash
set -e

echo 'Installing Redis...'
apt-get install -y redis-server
service redis-server start

echo 'Installing PostgreSQL and PostGIS...'
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib postgis postgresql-14-postgis-3

echo 'Starting PostgreSQL...'
service postgresql start

echo 'Configuring Database...'
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'Pos08sql';"
sudo -u postgres psql -c "CREATE DATABASE sentryal_dev;" || true
sudo -u postgres psql -d sentryal_dev -c "CREATE EXTENSION IF NOT EXISTS postgis;"

echo 'Database setup complete!'
