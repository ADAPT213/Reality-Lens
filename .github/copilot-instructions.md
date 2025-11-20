 - [x] Verify that the copilot-instructions.md file in the .github directory is created.
   - Verified present at `.github/copilot-instructions.md`.

 - [x] Clarify Project Requirements
   - Backend: NestJS 10 on port `4010`; Frontend: Next.js; PPE slotting engine with auditable receipts; Swagger in dev.

 - [x] Scaffold the Project
   - Existing repository used; no scaffolding required.

 - [x] Customize the Project
   - Added Slotting and Ingest modules; secured app with Helmet, validation, throttling; versioned routes under `/api/v1`.

 - [x] Install Required Extensions
   - No additional extensions required by setup; skipped.

 - [x] Compile the Project
   - Build succeeds with `tsc -p tsconfig.build.json` after pruning optional modules.

 - [x] Create and Run Task
   - No VS Code tasks needed; npm scripts are sufficient.

 - [x] Launch the Project
   - Running at `http://localhost:4010/api`; Swagger at `/api/docs` in dev.

 - [x] Ensure Documentation is Complete
   - README/QUICKSTART updated for port `4010`; this file cleaned of HTML comments and marked complete.
