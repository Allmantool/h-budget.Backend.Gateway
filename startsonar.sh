#!/bin/bash
set -euo pipefail

# Path to coverage file (relative to repository root)
COVERAGE_FILE="${COVERAGE_FILE:-test-results/backend-gateway-coverage.xml}"

sanitize_csv_property() {
    local raw_value="${1:-}"

    if [[ -z "${raw_value}" ]]; then
        return 0
    fi

    printf '%s' "${raw_value}" | awk '
        BEGIN {
            RS = ","
            ORS = ""
        }
        {
            value = $0
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
            gsub(/^"+|"+$/, "", value)

            if (value != "" && !seen[value]++) {
                values[++count] = value
            }
        }
        END {
            for (i = 1; i <= count; i++) {
                printf "%s%s", values[i], (i < count ? "," : "")
            }
        }'
}

SONAR_EXCLUSIONS_SANITIZED="$(sanitize_csv_property "${SONAR_EXCLUSIONS:-}")"
SONAR_COVERAGE_EXCLUSIONS_SANITIZED="$(sanitize_csv_property "${SONAR_COVERAGE_EXCLUSIONS:-}")"

echo "DEBUG: SONAR_EXCLUSIONS(raw)='${SONAR_EXCLUSIONS:-}'"
echo "DEBUG: SONAR_EXCLUSIONS(sanitized)='${SONAR_EXCLUSIONS_SANITIZED}'"

scanner_args=(
    begin
    /o:"allmantool"
    /k:"Allmantool_h-budget-backend-gateway"
    /n:"h-budget-backend-gateway"
    /v:"${GITHUB_RUN_ID}"
    /d:sonar.token="${SONAR_TOKEN}"
    /d:sonar.host.url="https://sonarcloud.io"
)

# Determine if we are running in a pull request context
if [[ -n "${PULL_REQUEST_ID:-}" ]]; then
    echo "Running Sonar begin for Pull Request ${PULL_REQUEST_ID}"

    if [[ -f "$COVERAGE_FILE" ]]; then
        scanner_args+=("/d:sonar.cs.dotcover.reportsPaths=${COVERAGE_FILE}")
        echo "Coverage file found at ${COVERAGE_FILE}; will pass to Sonar."
    else
        echo "Warning: coverage file not found at ${COVERAGE_FILE}. Sonar will run without coverage report."
    fi

    scanner_args+=(
        /d:sonar.pullrequest.key="${PULL_REQUEST_ID}"
        /d:sonar.pullrequest.branch="${PULL_REQUEST_SOURCE_BRANCH}"
        /d:sonar.pullrequest.base="${PULL_REQUEST_TARGET_BRANCH}"
        /d:sonar.pullrequest.provider="github"
        /d:sonar.pullrequest.github.repository="Allmantool/h-budget.Backend.Gateway"
        /d:sonar.pullrequest.github.endpoint="https://api.github.com/"
    )
else
    # For non-PR branches
    BRANCH_NAME="${GITHUB_REF_NAME:-master}"

    if [[ "$BRANCH_NAME" == "master" ]]; then
        scanner_args+=("/d:sonar.branch.name=master")
    else
        scanner_args+=("/d:sonar.branch.name=${BRANCH_NAME}")
    fi

    if [[ -f "$COVERAGE_FILE" ]]; then
        scanner_args+=("/d:sonar.cs.dotcover.reportsPaths=${COVERAGE_FILE}")
        echo "Coverage file found at ${COVERAGE_FILE}; will pass to Sonar."
    else
        echo "Warning: coverage file not found at ${COVERAGE_FILE}. Sonar will run without coverage report."
    fi
fi

if [[ -n "${SONAR_EXCLUSIONS_SANITIZED}" ]]; then
    scanner_args+=("/d:sonar.exclusions=${SONAR_EXCLUSIONS_SANITIZED}")
fi

if [[ -n "${SONAR_COVERAGE_EXCLUSIONS_SANITIZED}" ]]; then
    scanner_args+=("/d:sonar.coverage.exclusions=${SONAR_COVERAGE_EXCLUSIONS_SANITIZED}")
fi

dotnet-sonarscanner "${scanner_args[@]}"
