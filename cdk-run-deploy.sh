#!/usr/bin/env bash
set -euo pipefail

echo "Starting CDK deploy with required approval never, all, and verbose logging..."
cdk deploy --require-approval never --all --verbose
echo "CDK deploy completed."
