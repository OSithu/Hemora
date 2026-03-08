#!/bin/bash
# Download ML model weights from GitHub Release
# Usage: bash download_models.sh
# This script is run once after deployment to fetch model files

set -e

REPO="Nizith/Hemora"
TAG="models-v1"
BASE_URL="https://github.com/$REPO/releases/download/$TAG"
MODEL_DIR="$(dirname "$0")/models"

echo "=== Downloading Hemora ML Models ==="

# Create model directories
mkdir -p "$MODEL_DIR/thalassemia"
mkdir -p "$MODEL_DIR/all_leukemia"
mkdir -p "$MODEL_DIR/sickle_cell"
mkdir -p "$MODEL_DIR/ida"

# Thalassemia models (~22MB)
echo "[1/7] Downloading thalassemia models..."
curl -L -o "$MODEL_DIR/thalassemia/thal_yolo_best.pt" "$BASE_URL/thal_yolo_best.pt"
curl -L -o "$MODEL_DIR/thalassemia/thal_hybrid_best.pt" "$BASE_URL/thal_hybrid_best.pt"
curl -L -o "$MODEL_DIR/thalassemia/thal_scaler.pkl" "$BASE_URL/thal_scaler.pkl"

# ALL Leukemia models (~39MB)
echo "[2/7] Downloading ALL leukemia models..."
curl -L -o "$MODEL_DIR/all_leukemia/all_cnn_best.keras" "$BASE_URL/all_cnn_best.keras"
curl -L -o "$MODEL_DIR/all_leukemia/all_yolo_best.pt" "$BASE_URL/all_yolo_best.pt"

# Sickle Cell models (~57MB)
echo "[3/7] Downloading sickle cell models..."
curl -L -o "$MODEL_DIR/sickle_cell/scd_rcnn_local_classifier.pt" "$BASE_URL/scd_rcnn_local_classifier.pt"
curl -L -o "$MODEL_DIR/sickle_cell/scd_yolov8_local_detect.pt" "$BASE_URL/scd_yolov8_local_detect.pt"

# IDA models (~112MB)
echo "[4/7] Downloading IDA models..."
curl -L -o "$MODEL_DIR/ida/ida_resnet50_best.pt" "$BASE_URL/ida_resnet50_best.pt"
curl -L -o "$MODEL_DIR/ida/ida_yolo_best.pt" "$BASE_URL/ida_yolo_best.pt"

echo "=== All models downloaded successfully! ==="
ls -lhR "$MODEL_DIR"
