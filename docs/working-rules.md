# Working Rules

To maintain a clean git history and ensure isolated development, the following rules must be strictly followed for every implementation task.

## 🌳 Worktree Isolation Rule

**Every significant change, new feature, or bug fix must be developed in a dedicated git worktree.**

Do not make direct changes to the `main` branch or the current working directory. For every task, the following workflow is mandatory:

1. **Create a new worktree**: 
   Use the command: `git worktree add -b feature/<feature-name> ../<feature-name>`
   *(Replace `<feature-name>` with a concise, kebab-case description of the task, e.g., `feature/user-auth`)*.

2. **Switch to the worktree**:
   Move into the newly created directory to perform the work.

3. **Develop and Verify**:
   Implement the changes and run tests/app within the isolated worktree.

4. **Merge and Cleanup**:
   Once the work is verified and committed, merge the feature branch back into the target branch and remove the worktree directory.

## 🛠 Development Process

- **Plan First**: Always use `EnterPlanMode` for non-trivial changes.
- **CLI First**: Use `node ace` for all AdonisJS scaffolding (see `adonis.md`).
- **Layered Logic**: Business logic belongs in Services; data formatting belongs in Transformers.
- **Verification**: No task is considered "completed" until it has been verified via tests or a manual run of the application.
