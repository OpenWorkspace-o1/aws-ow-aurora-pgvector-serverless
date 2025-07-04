#!/usr/bin/env bash
set -euo pipefail

# Load environment variables if .env file is present
if [ -f .env ]; then
  echo "-> .env file found. Loading environment variables..."
  export $(cat .env | sed 's/#.*//g' | xargs)
else
  echo "-> .env file not found. Assuming environment variables are set in the execution environment."
fi

echo "Starting CDK bootstrap..."
cdk bootstrap --verbose
echo "CDK bootstrap completed."
