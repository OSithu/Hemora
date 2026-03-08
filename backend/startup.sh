#!/bin/bash
set -e

echo "=== Hemora Backend Startup ==="

# Use persistent virtual environment under /home (survives restarts)
VENV_DIR="/home/site/venv"
MARKER_FILE="$VENV_DIR/.requirements_installed"
REQ_HASH=$(md5sum requirements.txt | awk '{print $1}')

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating persistent virtual environment..."
    python -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

# Only pip install if requirements changed or never installed
if [ ! -f "$MARKER_FILE" ] || [ "$(cat $MARKER_FILE)" != "$REQ_HASH" ]; then
    echo "Installing backend dependencies (this takes a while on first run)..."
    pip install --no-cache-dir -r requirements.txt
    echo "$REQ_HASH" > "$MARKER_FILE"
else
    echo "Dependencies already installed, skipping pip install."
fi

# Install Tesseract OCR for CBC report extraction
if ! command -v tesseract &> /dev/null; then
    echo "Installing Tesseract OCR..."
    apt-get update && apt-get install -y tesseract-ocr --no-install-recommends && rm -rf /var/lib/apt/lists/*
fi

# Download ML models if not present
if [ ! -f "models/thalassemia/thal_yolo_best.pt" ]; then
    echo "ML models not found, downloading..."
    bash download_models.sh
else
    echo "ML models already present, skipping download."
fi

# Build React frontend if not already built
FRONTEND_SRC="/home/site/wwwroot/frontend"
FRONTEND_BUILD="/home/site/wwwroot/backend/frontend_build"

if [ -d "$FRONTEND_SRC" ] && [ ! -d "$FRONTEND_BUILD" ]; then
    echo "=== Building React Frontend ==="
    # Install Node.js if not available
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    cd "$FRONTEND_SRC"
    npm install
    VITE_API_BASE_URL="/api" npm run build
    cp -r dist "$FRONTEND_BUILD"
    cd /home/site/wwwroot/backend
    echo "Frontend build complete."
elif [ -d "$FRONTEND_BUILD" ]; then
    echo "Frontend build already exists, skipping."
fi

# Collect static files
python manage.py collectstatic --noinput

# Run database migrations
python manage.py migrate --noinput

echo "=== Starting Gunicorn ==="

# Start gunicorn (Azure App Service expects port 8000)
gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --timeout 300 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --access-logfile '-' \
    --error-logfile '-'
