FROM node:22-bookworm-slim AS ui
WORKDIR /ui
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
ARG INSTALL_ML=0
WORKDIR /app
COPY pyproject.toml ./
COPY backend/ backend/
RUN pip install --no-cache-dir . && if [ "$INSTALL_ML" = "1" ]; then pip install --no-cache-dir '.[ml]'; fi
COPY --from=ui /ui/dist frontend/dist
RUN useradd --create-home --uid 10001 forge && mkdir /data && chown forge /data
USER forge
ENV MODELFORGE_DATA_DIR=/data
ENV MODELFORGE_PROJECT_ROOT=/app
ENV HF_HOME=/data/huggingface
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "modelforge.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
