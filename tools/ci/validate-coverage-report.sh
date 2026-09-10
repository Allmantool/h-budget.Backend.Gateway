#!/usr/bin/env bash
set -euo pipefail

coverage_report="${1:?COV_REPORT_PATH_REQUIRED}"

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

if [[ ! -f "$coverage_report" ]]; then
    fail "COV_REPORT_MISSING: $coverage_report"
fi

if [[ ! -s "$coverage_report" ]]; then
    fail "COV_REPORT_EMPTY: $coverage_report"
fi

if ! command -v xmllint >/dev/null 2>&1; then
    fail 'COV_REPORT_VALIDATOR_UNAVAILABLE: xmllint is required to validate Visual Studio coverage XML.'
fi

if ! validation_error="$(xmllint --noout "$coverage_report" 2>&1)"; then
    validation_error="$(printf '%s' "$validation_error" | tr '\r\n' '  ' | cut -c 1-512)"
    fail "COV_REPORT_MALFORMED: $validation_error"
fi

if ! module_count="$(xmllint --xpath 'count(/results/modules/module[@line_coverage and @blocks_covered and @blocks_not_covered])' "$coverage_report" 2>&1)"; then
    module_count="$(printf '%s' "$module_count" | tr '\r\n' '  ' | cut -c 1-512)"
    fail "COV_REPORT_INCOMPATIBLE: $module_count"
fi

if [[ "$module_count" == '0' ]]; then
    fail 'COV_REPORT_INCOMPATIBLE: Visual Studio coverage modules with coverage attributes were not found.'
fi

: "${GITHUB_ENV:?COV_REPORT_ENV_UNAVAILABLE}"
printf 'COVERAGE_FILE=%s\n' "$coverage_report" >> "$GITHUB_ENV"
printf 'COV_REPORT_VALID: path=%s bytes=%s modules=%s\n' "$coverage_report" "$(wc -c < "$coverage_report")" "$module_count"
