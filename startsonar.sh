#!/bin/bash
set -euo pipefail

# path to coverage file (relative to repository root)
COVERAGE_FILE="${COVERAGE_FILE:-test-results/backend-gateway-coverage.xml}"

if [ -n "${PULL_REQUEST_ID:-}" ]; then
    echo "Running Sonar begin for Pull Request ${PULL_REQUEST_ID}"

    if [ -f "$COVERAGE_FILE" ]; then
        COVERAGE_PARAM="/d:sonar.cs.dotcover.reportsPaths=\"$COVERAGE_FILE\""
        echo "Coverage file found at ${COVERAGE_FILE}; will pass to Sonar."
    else
        COVERAGE_PARAM=""
        echo "Warning: coverage file not found at ${COVERAGE_FILE}. Sonar will run without coverage report."
    fi

    dotnet-sonarscanner begin \
        /o:"allmantool" \
        /k:"Allmantool_h-budget-backend-gateway" \
        /n:"h-budget-backend-gateway" \
        /v:"${GITHUB_RUN_ID}" \
        /d:sonar.token="${SONAR_TOKEN}" \
        /d:sonar.host.url="https://sonarcloud.io" \
        /d:sonar.pullrequest.key="${PULL_REQUEST_ID}" \
        /d:sonar.pullrequest.branch="${PULL_REQUEST_SOURCE_BRANCH}" \
        /d:sonar.pullrequest.base="${PULL_REQUEST_TARGET_BRANCH}" \
        /d:sonar.coverage.exclusions="**/Test[s]/**/*" \
        ${COVERAGE_PARAM} \
        /d:sonar.pullrequest.provider="github" \
        /d:sonar.pullrequest.github.repository="Allmantool/h-budget.Backend.Gateway" \
        /d:sonar.pullrequest.github.endpoint="https://api.github.com/"
else
    if [[ "${PULL_REQUEST_SOURCE_BRANCH:-}" =~ "master" ]] ;then
        PULL_REQUEST_SOURCE_BRANCH=""
    fi

    if [ -f "$COVERAGE_FILE" ]; then
        COVERAGE_PARAM="/d:sonar.cs.dotcover.reportsPaths=\"$COVERAGE_FILE\""
        echo "Coverage file found at ${COVERAGE_FILE}; will pass to Sonar."
    else
        COVERAGE_PARAM=""
        echo "Warning: coverage file not found at ${COVERAGE_FILE}. Sonar will run without coverage report."
    fi

    dotnet-sonarscanner begin \
        /k:"Allmantool_h-budget-backend-gateway" \
        /o:"allmantool" \
        /n:"h-budget-backend-gateway" \
        /v:"${GITHUB_RUN_ID}" \
        /d:sonar.branch.name="master" \
        /d:sonar.token="${SONAR_TOKEN}" \
        /d:sonar.host.url="https://sonarcloud.io" \
        ${COVERAGE_PARAM} \
        /d:sonar.coverage.exclusions="Test[s]/**/*"
fi
