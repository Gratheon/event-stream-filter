start:
	rm -rf dist
	source $(HOME)/.nvm/nvm.sh && nvm install 20 && nvm use && npm i && npm run build
	COMPOSE_PROJECT_NAME=gratheon docker compose -f docker-compose.dev.yml up --build

stop:
	COMPOSE_PROJECT_NAME=gratheon docker compose -f docker-compose.dev.yml down

start:
	source $(HOME)/.nvm/nvm.sh && nvm install 20 && nvm use && npm i && npm run build
	COMPOSE_PROJECT_NAME=gratheon docker compose -f docker-compose.dev.yml up --build


