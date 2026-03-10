# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY serving/requirements.txt ./
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy the serving app and model registry into the container
COPY serving/ ./
COPY model_registry/ ../model_registry/

EXPOSE 4030

CMD ["python", "app.py"]
