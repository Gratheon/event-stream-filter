start:
	COMPOSE_PROJECT_NAME=gratheon docker compose -f docker-compose.dev.yml up -d
develop:
	ENV_ID=dev NATIVE=1 npm run start

deploy-clean:
	ssh root@gratheon.com 'rm -rf /www/subscribe.gratheon.com/dist/*;'

deploy-copy:
	scp -r package.json package-lock.json Dockerfile .version docker-compose.yml restart.sh root@gratheon.com:/www/subscribe.gratheon.com/
	rsync -av -e ssh --exclude='node_modules' --exclude='.git'  --exclude='.idea' ./ root@gratheon.com:/www/subscribe.gratheon.com/

deploy-run:
	ssh root@gratheon.com 'chmod +x /www/subscribe.gratheon.com/restart.sh'
	ssh root@gratheon.com 'bash /www/subscribe.gratheon.com/restart.sh'

deploy:
	git rev-parse --short HEAD > .version
	# make deploy-clean
	make deploy-copy
	make deploy-run

.PHONY: deploy
