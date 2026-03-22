start:
	rm -rf dist
	source $HOME/.nvm/nvm.sh && nvm install 25 && nvm use && npm install -g pnpm@10.29.2 && pnpm install && pnpm run build
	COMPOSE_PROJECT_NAME=gratheon docker compose -f docker-compose.dev.yml up --build

stop:
	COMPOSE_PROJECT_NAME=gratheon docker compose -f docker-compose.dev.yml down

