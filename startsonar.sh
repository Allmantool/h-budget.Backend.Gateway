#!/bin/bash
set -euo pipefail

# Path to coverage file (relative to repository root)
COVERAGE_FILE="${COVERAGE_FILE:-test-results/backend-gateway-coverage.xml}"

# Determine if we are running in a pull request context
if [[ -n "${PULL_REQUEST_ID:-}" ]]; then
    echo "Running Sonar begin for Pull Request ${PULL_REQUEST_ID}"

    if [[ -f "$COVERAGE_FILE" ]]; then
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
        /d:sonar.exclusions="${SONAR_EXCLUSIONS}" \
        /d:sonar.coverage.exclusions="${SONAR_COVERAGE_EXCLUSIONS}" \
        ${COVERAGE_PARAM} \
        /d:sonar.pullrequest.provider="github" \
        /d:sonar.pullrequest.github.repository="Allmantool/h-budget.Backend.Gateway" \
        /d:sonar.pullrequest.github.endpoint="https://api.github.com/"
else
    # For non-PR branches
    BRANCH_NAME="${GITHUB_REF_NAME:-master}"

    if [[ "$BRANCH_NAME" == "master" ]]; then
        SONAR_BRANCH_PARAM="/d:sonar.branch.name=master"
    else
        SONAR_BRANCH_PARAM="/d:sonar.branch.name=$BRANCH_NAME"
    fi

    if [[ -f "$COVERAGE_FILE" ]]; then
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
        $SONAR_BRANCH_PARAM \
        /d:sonar.token="${SONAR_TOKEN}" \
        /d:sonar.host.url="https://sonarcloud.io" \
        ${COVERAGE_PARAM} \
        /d:sonar.exclusions="${SONAR_EXCLUSIONS}" \
        /d:sonar.coverage.exclusions="${SONAR_COVERAGE_EXCLUSIONS}"
fi
