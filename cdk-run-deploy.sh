#!/usr/bin/env bash
set -euo pipefail

# Load environment variables if .env file is present
if [ -f .env ]; then
  echo "-> .env file found. Loading environment variables..."
  export $(cat .env | sed 's/#.*//g' | xargs)
else
  echo "-> .env file not found. Assuming environment variables are set in the execution environment."
fi

echo "Synthesizing CloudFormation template..."
cdk synth

echo "Generating a diff of the changes..."
# The diff command will exit with a non-zero code if there are changes.
# We pipe to `true` to prevent the script from exiting due to `set -e`.
cdk diff --all || true

echo "Starting CDK deployment..."
# Using --require-approval never for non-interactive deployment.
# Review the diff above before running this.
cdk deploy --require-approval never --all --verbose
echo "CDK deploy completed."
