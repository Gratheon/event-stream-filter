sudo -H -u www bash -c 'cd /www/plantnet/ && npm i' 
cd /www/plantnet/
docker-compose down
COMPOSE_PROJECT_NAME=gratheon docker-compose up -d