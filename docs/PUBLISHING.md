# Publish as a public GitHub repository

The project files are ready for a repository named `qa-signal`. No GitHub account name or repository URL is assumed in the source.

## Using the GitHub website

1. Sign in to the GitHub account you intend to use for your portfolio.
2. Create a repository called `qa-signal` and select **Public**.
3. Upload the contents of the `qa-signal` folder, keeping the existing subfolders. Put `README.md` and `package.json` at the repository root, not inside an extra `qa-signal` folder.
4. Include the `.github/workflows/checks.yml` file and `.gitignore`; some file pickers hide dot-prefixed files. Git is more reliable if these are hidden.
5. Commit the uploaded files to the default branch.
6. Check the Actions tab to confirm the workflow runs. Hosted workflow results have not yet been verified.

Suggested description:

> Local Playwright triage: compare test runs, preserve retry evidence, group failure messages, and generate investigation drafts.

Suggested topics: `qa`, `playwright`, `test-automation`, `test-reporting`, `flaky-tests`, `javascript`.

Use only the included fictional data in a public repository. Analyze real client reports locally and keep them outside the repository.

## With Git and GitHub CLI already installed and authenticated

Run from inside this project's folder after checking that your Git author email is linked to your GitHub account:

```sh
git init -b main
git add .
git commit -m "Build QA Signal Playwright triage tool"
gh repo create qa-signal --public --source=. --remote=origin --push --description "Local Playwright triage, run comparison, and investigation drafts"
```

If that repository name already exists, inspect the existing repository first; choose another name rather than overwriting its contents.

GitHub contribution processing and third-party profile scanners have their own update delays and eligibility rules. Creating this repository does not guarantee acceptance by an unspecified platform.
