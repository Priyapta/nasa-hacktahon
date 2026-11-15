FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1

WORKDIR /app
# Rasterio wheels require the Expat runtime even on the slim base image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.lock.txt ./requirements.lock.txt
RUN pip install --no-cache-dir --only-binary=:all: -r requirements.lock.txt \
    && groupadd --gid 10001 atlas \
    && useradd --uid 10001 --gid atlas --no-create-home atlas \
    && mkdir -p /var/lib/field-shift \
    && chown atlas:atlas /var/lib/field-shift

COPY app ./app
COPY migrations ./migrations
COPY data/catalog ./data/catalog
COPY data/economics ./data/economics
USER atlas
RUN python -c "from app.main import app; assert '/api/v1/health' in app.openapi()['paths']"
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*", "--limit-concurrency", "32", "--backlog", "64", "--timeout-keep-alive", "5", "--timeout-graceful-shutdown", "30", "--no-access-log"]
