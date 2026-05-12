---
description: Run a full review of the WorldQuiz codebase covering code quality, security, database queries, and UI. Spawns all four specialist agents in parallel and summarises findings by severity.
---

Run a complete review of the WorldQuiz project. Launch all four specialist agents in parallel:

1. **php-reviewer** — code quality, session guards, output safety, PSR style
2. **security-auditor** — known vulnerabilities (plaintext passwords, SQL injection, CSRF, session fixation, open admin registration)
3. **db-reviewer** — MySQLi queries, schema design, prepared statement usage
4. **ui-reviewer** — CSS consistency with the design system, accessibility, responsive gaps

After all four agents complete, produce a unified report:

## CRITICAL
List all CRITICAL findings from all agents. These must be fixed before any commit.

## HIGH
All HIGH findings. Should be fixed soon.

## MEDIUM
All MEDIUM findings. Address during refactoring.

## LOW / Suggestions
All LOW findings and improvement suggestions.

## Summary
One paragraph: overall health of the codebase and the top three priorities.
