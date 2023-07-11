sudo -H -u www bash -c 'cd /www/subscribe.gratheon.com/ && npm i && npm build' 
cd /www/subscribe.gratheon.com/
COMPOSE_PROJECT_NAME=gratheon docker-compose down
COMPOSE_PROJECT_NAME=gratheon docker-compose up -d --build