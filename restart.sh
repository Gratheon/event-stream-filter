sudo -H -u www bash -c 'cd /www/event-stream-filter/ && npm i && npm build' 
cd /www/event-stream-filter/
COMPOSE_PROJECT_NAME=gratheon docker-compose down
COMPOSE_PROJECT_NAME=gratheon docker-compose up -d --build