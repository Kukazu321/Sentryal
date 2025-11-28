#!/bin/bash
service postgresql start
service redis-server start
su - postgres -c "psql -c \"CREATE USER sentryal WITH PASSWORD 'changeme';\""
su - postgres -c "psql -c \"CREATE DATABASE sentryal_dev OWNER sentryal;\""
su - postgres -c "psql -d sentryal_dev -c \"CREATE EXTENSION postgis;\""
