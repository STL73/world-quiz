---
description: Audit the WorldQuiz UI for design quality, accessibility gaps, responsive issues, and improvements to the quiz experience. Uses the ui-reviewer agent and produces a prioritised improvement list.
---

Audit the WorldQuiz UI/UX. Read these files:
- `CSS/style.css` — full design system
- `index.php` — quiz gameplay page (main experience)
- `login_form.php` — login page
- `create_account.php` — registration page
- `user_panel.php` — user dashboard
- `admin_panel.php` — admin dashboard
- `view_questions.php` — question management

Then launch the **ui-reviewer** agent on the full CSS and HTML output.

After the agent completes, produce a prioritised improvement list:

## P1 — Broken or inaccessible (fix immediately)
Issues that affect usability or exclude users.

## P2 — Design consistency gaps
Things that look off compared to the established design system.

## P3 — Responsive design
The current CSS has no `@media` queries. The `.question-box` is hardcoded at `1000px × 500px`.
Identify which pages would break on a 768px tablet or 375px mobile screen.

## P4 — Enhancement opportunities
Improvements that would meaningfully improve the quiz experience without a full redesign.

For each finding: which file/selector, what the issue is, and a concrete suggestion.
