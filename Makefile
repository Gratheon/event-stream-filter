start:
	# nvm use
	npm i
	npm run build
	COMPOSE_PROJECT_NAME=gratheon docker compose -f docker-compose.dev.yml up --build -d
stop:
	COMPOSE_PROJECT_NAME=gratheon docker compose -f docker-compose.dev.yml down
develop:
	ENV_ID=dev NATIVE=1 npm run start

deploy-clean:
	ssh root@gratheon.com 'rm -rf /www/event-stream-filter/dist/*;'

deploy-copy:
	scp -r package.json package-lock.json Dockerfile .version docker-compose.yml restart.sh root@gratheon.com:/www/event-stream-filter/
	rsync -av -e ssh --exclude='node_modules' --exclude='.git'  --exclude='.idea' ./ root@gratheon.com:/www/event-stream-filter/

deploy-run:
	ssh root@gratheon.com 'chmod +x /www/event-stream-filter/restart.sh'
	ssh root@gratheon.com 'bash /www/event-stream-filter/restart.sh'

deploy:
	git rev-parse --short HEAD > .version
	# make deploy-clean
	make deploy-copy
	make deploy-run

.PHONY: deploy
