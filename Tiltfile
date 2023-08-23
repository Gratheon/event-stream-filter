docker_compose('docker-compose.dev.yml',project_name="gratheon")
docker_build('local/event-stream-filter', '.',
	live_update = [
    # Sync local files into the container.
    sync('.', '/app/'),

    # Re-run npm install whenever package.json changes.
    run('npm i', trigger='package.json'),

    # Restart the process to pick up the changed files.
    restart_container()
  ])