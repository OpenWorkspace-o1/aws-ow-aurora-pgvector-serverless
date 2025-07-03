#!/usr/bin/env bash
set -euo pipefail

echo "Starting CDK bootstrap with verbose logging..."
cdk bootstrap --verbose
echo "CDK bootstrap completed."
