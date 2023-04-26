sudo su - postgres
pg_dump recipes > recipes.sql
scp recipes.sql ubuntu@15.204.56.247:~/website/db-files
ssh ubuntu@15.204.56.247
sudo service apache2 stop
cd ~/website/db-files
cp recipes.sql /tmp
chmod 777 /tmp/recipes.sql
sudo su - postgres
cp /tmp/recipes.sql .
psql
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'recipes'                     
  AND pid <> pg_backend_pid();
drop database recipes;
create database recipes;
\c recipes
\i recipes.sql
\q
exit
sudo service apache2 start