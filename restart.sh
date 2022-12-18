sudo -H -u www bash -c 'cd /www/subscribe.gratheon.com/ && npm i' 
cd /www/subscribe.gratheon.com/
docker-compose down
COMPOSE_PROJECT_NAME=gratheon docker-compose up -d