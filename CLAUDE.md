# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taiwan Lawyer Bar Exam Quiz App (台灣律師一試考題專家) — a pure static web app for practicing Taiwan's first-stage lawyer bar exam. No build step, no frameworks, no dependencies. Just HTML + CSS + JS serving static JSON question banks.

## Development

No build required. Serve with any static server:

```
npx serve .
```

Then open `http://localhost:3000`.

Deployed to **GitHub Pages** via `.github/workflows/deploy.yml` (direct static file upload, no build step).

## Architecture

Three files + question bank data:

- **index.html** — HTML structure with 4 screen sections (home, loading, quiz, result) toggled via `.hidden` class
- **style.css** — All styling. Mobile-first responsive. Color palette: indigo (primary), emerald (correct), rose (wrong), slate (neutral), amber (info)
- **app.js** — All logic. Single `state` object, DOM manipulation, fetch for JSON data. Key functions: `init()`, `renderBankGrid()`, `startQuiz()`, `showQuestion()`, `handleAnswer()`, `showResults()`

### Question Bank Data

Static JSON files in `bank/`:
- `manifest.json` — lists all bank filenames
- 31 JSON files named `[YEAR]_[SUBJECT_CODE].json` (e.g., `104_1301.json`)
- Question IDs follow pattern: `"104-1301-001"`
- Subject codes: 1301 (刑法系), 2301 (憲法系), 3301 (民法系), 4301 (商法系)
- Each question has: `question_id`, `year`, `subject_code`, `question_no`, `question_type` (single/multiple), `stem`, `choices[]`, `correct_choice_ids[]`, `answer[]`

### localStorage

Only stores user preferences (key: `quiz_preferences`): selected bank files and max question count. No other persistent state.
