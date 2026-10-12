FROM postgres:18-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends age ca-certificates curl unzip && rm -rf /var/lib/apt/lists/*
COPY --from=amazon/aws-cli:2 /usr/local/aws-cli /usr/local/aws-cli
RUN ln -s /usr/local/aws-cli/v2/current/bin/aws /usr/local/bin/aws
WORKDIR /worker
COPY scripts/backup-worker.sh /worker/backup-worker.sh
RUN chmod 755 /worker/backup-worker.sh
ENTRYPOINT ["/worker/backup-worker.sh"]
