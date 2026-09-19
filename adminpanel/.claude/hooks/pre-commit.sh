#!/bin/bash
# Pre-commit hook: block commit if build fails
cd "$(dirname "$0")/../../.." || exit 1

echo "🔍 Running build check..."
npm run build 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo "❌ Build failed. Fix errors before committing."
  exit 2
fi

echo "✅ Build passed."
exit 0
