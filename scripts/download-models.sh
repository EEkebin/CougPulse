#!/usr/bin/env bash
set -e

MODELS_DIR="public/models"
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

mkdir -p "$MODELS_DIR"

FILES=(
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "ssd_mobilenetv1_model-shard2"
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"
)

for FILE in "${FILES[@]}"; do
  if [ ! -f "$MODELS_DIR/$FILE" ]; then
    echo "Downloading $FILE..."
    curl -sL "$BASE_URL/$FILE" -o "$MODELS_DIR/$FILE"
  else
    echo "Skipping $FILE (already exists)"
  fi
done

echo "Models ready in $MODELS_DIR"
