FROM postgres:18-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends age awscli ca-certificates bash && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
COPY scripts/backup-worker.sh /worker/backup-worker.sh
RUN chmod 755 /worker/backup-worker.sh
ENTRYPOINT ["/usr/bin/bash", "/worker/backup-worker.sh"]
