# Contributing to Crucible: Pandora Toolbox Enhancement (v2.0)

Thank you for your interest in contributing to Crucible! This document provides guidelines and instructions for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pre-Push Checklist (Before Pushing to Develop)](#pre-push-checklist-before-pushing-to-develop)
- [Promoting Changes Across Branches](#promoting-changes-across-branches)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)
- [Development Cleanup](#development-cleanup)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

**Unacceptable behavior includes:**
- Harassment or discriminatory language
- Trolling or inflammatory comments
- Public or private harassment
- Publishing others' private information

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+
- Git
- OpenSSL (for certificate verification)
- Podman or Docker (for container testing)
- Basic knowledge of React and Express

### Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/crucible.git
cd crucible

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/crucible.git
```

### Install Dependencies

```bash
npm run install:all
```

### Run Development Environment

```bash
npm run dev
```

---

## Development Workflow

### 1. Create a Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

- **Features**: `feature/descriptive-name`
- **Bug fixes**: `fix/bug-description`
- **Documentation**: `docs/what-changed`
- **Refactoring**: `refactor/what-refactored`

### 2. Make Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run the application
npm run dev

# Test all modules:
# - Upload chemicals via Excel
# - Create samples
# - Add screening data
# - Bulk operations
# - API endpoints
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add bulk export functionality"
```

See [Commit Guidelines](#commit-guidelines) below.

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Pre-Push Checklist (Before Pushing to Develop)

> ⚠️ **IMPORTANT**: The `develop` branch is the shared integration branch. Follow this checklist **every time** before pushing to avoid breaking the deployment or leaking sensitive files.

### 🔒 Step 1: Verify No Sensitive Files Are Staged

SSL certificates, private keys, and database files must **never** be committed.

```bash
# Check what's staged for commit
git status

# Look for ANY of these — they should NOT appear:
#   certs/          *.key    *.crt    *.pem    *.cer
#   data/           .env     .env.local

# Double-check staged files explicitly
git diff --cached --name-only | grep -iE '\.(key|crt|pem|cer|p12|pfx)$|certs/|data/|\.env'
# ✅ This command should return NOTHING. If it returns files, unstage them:
# git reset HEAD <file>
```

### 🧪 Step 2: Test the Application Locally

```bash
# Option A: Quick dev test
npm run dev
# Open http://localhost:5173 and verify:
#   - Dashboard loads with stats
#   - Chemical upload works
#   - No console errors in browser DevTools

# Option B: Full container test (recommended before pushing)
./container.sh build
./container.sh start-ssl

# Verify HTTPS endpoint responds
curl --noproxy '*' -k -s https://localhost:5942/api/stats
# ✅ Should return JSON with chemicals/samples/screening/toxicology counts

# Check container logs for errors
podman logs --tail 20 crucible
# ✅ Should show "HTTPS Server running" with no errors

# Clean up after testing
./container.sh stop
```

### 📋 Step 3: Verify the Build Succeeds

```bash
# Build the production frontend
npm run build
# ✅ Should complete without errors

# Build the container image
./container.sh build
# ✅ Should show "Image built successfully"
```

### 🔍 Step 4: Review Your Changes

```bash
# See what files changed
git --no-pager diff --stat

# Review actual code changes (look for debug code, console.logs, etc.)
git --no-pager diff

# If changes are already staged:
git --no-pager diff --cached
```

**Remove before committing:**
- `console.log()` debugging statements
- Hardcoded localhost URLs (use relative paths or environment variables)
- Commented-out code blocks
- Temporary test files

### ✅ Step 5: Verify .gitignore Is Intact

```bash
# Ensure .gitignore still protects sensitive files
cat .gitignore | grep -E 'certs|key|crt|pem|data'
# ✅ Should show: certs/, *.key, *.crt, *.pem, data/

# Verify no tracked files should be ignored
git ls-files -i --exclude-standard
# ✅ Should return NOTHING
```

### 📝 Step 6: Follow Commit Message Conventions

```bash
# Use conventional commit format
git commit -m "feat(chemicals): add bulk export to CSV"
git commit -m "fix(api): handle duplicate chemical IDs"
git commit -m "docs(readme): update HTTPS setup instructions"

# For multiple changes, use descriptive body:
git commit -m "feat(upload): add SDF file format support

Add parser for SDF chemical structure files.
Includes mol_block extraction and validation.

Closes #42"
```

### 🚀 Step 7: Push to Develop

```bash
# Pull latest changes from develop first (avoid conflicts)
git pull origin develop

# If there are merge conflicts, resolve them and test again (Steps 2-3)

# Push your changes
git push origin develop
```

### 📌 Step 8: Post-Push Verification

```bash
# SSH into the server and verify the deployment
ssh rdkannanab@nr-ubp-dev-02.nihs.ch.nestle.com

cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement
git pull origin develop

# Rebuild and restart
./container.sh stop
podman rm crucible
./container.sh build
./container.sh start-ssl

# Verify it's working
curl --noproxy '*' -k -s https://localhost:5942/api/stats

# Check application in browser
# https://nr-ubp-dev-02.nihs.ch.nestle.com:5942
```

### 🛑 Quick Reference — DO NOT Push If:

| Check | Command | Expected |
|-------|---------|----------|
| No certs/keys staged | `git diff --cached --name-only \| grep -iE '\.(key\|crt\|pem)'` | Empty output |
| No data files staged | `git diff --cached --name-only \| grep 'data/'` | Empty output |
| Build succeeds | `npm run build` | No errors |
| Container starts | `./container.sh build && ./container.sh start-ssl` | "Image built successfully" |
| API responds | `curl -k -s https://localhost:5942/api/stats` | Valid JSON |
| No debug code | `grep -rn 'console.log' client/src/ server/src/` | Review & remove |
| .gitignore intact | `cat .gitignore \| grep certs` | `certs/` present |

---

## Promoting Changes Across Branches

`develop`, `beta`, and `master` form a **linear promotion chain**. To move a change up the
chain **while keeping the identical commit SHA on every branch**, promote by **fast-forward** —
never with GitHub's *Merge / Squash / Rebase and merge* buttons for `beta`/`master`, because
each of those mints a **new** SHA and causes `ahead/behind` divergence.

> 💡 A branch keeps the same SHA as another **only** when it is advanced by a fast-forward
> (the ref pointer moves to the exact same commit — no new commit is created). GitHub has no
> "fast-forward merge" button, so this promotion is done from the CLI.

### Prerequisites

- A local `develop` that tracks the remote:
  ```bash
  git fetch origin
  git switch develop            # first time: git switch -c develop origin/develop
  ```
- `beta` and `master` are **fast-forwardable** from `develop` (they carry no commits of their
  own). If they diverge, realign once (see below) and fast-forward promotion works again.
- Direct pushes to `beta`/`master` are allowed — branch protection with *"Require a pull
  request"* will reject the direct fast-forward pushes.

### Standard flow — you are on local `develop`

```bash
# 1. Commit your change on develop — this is the single SHA that lands on all three branches
git add -A
git commit -m "feat(scope): describe the change"

# 2. Push develop AND fast-forward beta + master to that SAME commit (one command)
git push origin develop develop:beta develop:master
```

`develop:beta` / `develop:master` move those remote refs onto develop's exact commit, so
`develop`, `beta`, and `master` all end up on the **identical SHA**.

Explicit, safety-checked variant (`--ff-only` errors instead of creating a new SHA if a branch
cannot be fast-forwarded):

```bash
git push origin develop
git switch beta   && git merge --ff-only develop && git push origin beta
git switch master && git merge --ff-only beta    && git push origin master
git switch develop
```

### Verify all three match

```bash
git fetch origin
for b in develop beta master; do echo "$b -> $(git rev-parse --short origin/$b)"; done
# ✅ all three print the SAME short SHA
```

### Keep your local branches in sync

After promoting, your local `master` (and any local `beta`) is simply **behind** its remote by
the commit(s) you just pushed — a clean **fast-forward**, *not* a divergence. That is the payoff
of promoting by fast-forward instead of a merge/rebase button. Bring them up to date:

```bash
git fetch origin
git branch -f master origin/master      # fast-forward local master without checking it out
# git branch -f beta origin/beta        # repeat if you keep a local beta
```

Or, when the branch is checked out:

```bash
git switch master
git pull --ff-only origin master        # refuses (instead of merging) if it ever diverged
git switch develop
```

> `git branch -f <branch> origin/<branch>` fast-forwards safely **only** when the local branch is
> an **ancestor** of the remote — true right after a clean promotion (`git branch -vv` shows
> `behind N`). If it ever shows `ahead N, behind M`, that is real divergence — use
> *Realigning a diverged branch* below instead.

### Realigning a diverged branch (one-time fix)

If `git branch -vv` shows `ahead N, behind M`, or the branches show different SHAs for
identical content, collapse them onto one commit. This example points `develop` and `beta` at
`master`'s commit (so the protected `master` is not force-pushed):

```bash
git fetch origin
git push --force-with-lease origin origin/master:develop origin/master:beta
git switch master && git reset --hard origin/master     # sync local master
```

> ⚠️ `--force-with-lease` rewrites the shared `develop`/`beta` refs — coordinate with the team,
> and note branch protection may block it. It is content-safe **only** when all branches already
> hold identical content.

### ❌ What breaks SHA parity (avoid)

- GitHub **"Rebase and merge" / "Squash and merge" / "Create a merge commit"** to promote to `beta`/`master`.
- Committing directly on `beta` or `master`.
- `git pull` on a branch that was rebase/squash-merged on the remote — use `git reset --hard origin/<branch>` instead.

> Use PRs (any merge strategy) **only** for `feature/* → develop`. Promote `develop → beta → master` by fast-forward.

---

## Coding Standards

### JavaScript/React

- Use ES6+ syntax
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Use destructuring where appropriate
- Keep functions small and focused

**Example:**

```javascript
// Good
const getChemicals = async ({ page = 1, limit = 20 }) => {
  const response = await api.get('/chemicals', { params: { page, limit } });
  return response.data;
};

// Avoid
function getChemicals(page, limit) {
  page = page || 1;
  limit = limit || 20;
  var response = api.get('/chemicals', { params: { page: page, limit: limit } });
  return response.data;
}
```

### React Components

- Use functional components with hooks
- Keep components small and reusable
- Use meaningful prop names
- Add PropTypes or TypeScript types

**Example:**

```jsx
// Good
const ChemicalCard = ({ chemical, onDelete }) => {
  const handleDelete = () => onDelete(chemical.id);
  
  return (
    <div className="card">
      <h3>{chemical.name}</h3>
      <button onClick={handleDelete}>Delete</button>
    </div>
  );
};

// Avoid large components with multiple responsibilities
```

### Backend (Express)

- Use async/await instead of callbacks
- Handle errors properly
- Validate input data
- Use meaningful variable names

**Example:**

```javascript
// Good
router.post('/chemicals', async (req, res) => {
  try {
    const { chemical_id, name } = req.body;
    
    if (!chemical_id || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const chemical = await createChemical(req.body);
    res.status(201).json({ message: 'Success', chemical });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### CSS/Tailwind

- Use Tailwind utility classes
- Keep custom CSS minimal
- Use responsive design classes
- Follow mobile-first approach

**Example:**

```jsx
// Good
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <Card />
</div>

// Avoid inline styles
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
```

---

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process or auxiliary tool changes

### Examples

```bash
# Feature
git commit -m "feat(chemicals): add bulk export to CSV"

# Bug fix
git commit -m "fix(api): handle duplicate chemical IDs properly"

# Documentation
git commit -m "docs(api): add examples for bulk operations"

# Refactoring
git commit -m "refactor(dashboard): extract stats card into component"

# With body
git commit -m "feat(screening): add IC50 calculation

Add automatic IC50 calculation from dose-response curves.
Supports both linear and logarithmic scales.

Closes #123"
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] No console.log or debugging code
- [ ] No merge conflicts with main

### PR Title

Follow commit message format:

```
feat(chemicals): add bulk export functionality
fix(api): resolve pagination issue
docs(readme): update installation instructions
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Changes Made
- Change 1
- Change 2

## Testing
How were these changes tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #123
Refs #456
```

### Review Process

1. Automated checks must pass
2. At least one approval from maintainers
3. No unresolved discussions
4. Up-to-date with main branch

---

## Testing

### Manual Testing Checklist

**Chemicals Module:**
- [ ] Upload Excel file with valid data
- [ ] Upload Excel with invalid data (error handling)
- [ ] Create chemical manually
- [ ] Edit chemical
- [ ] Delete single chemical
- [ ] Bulk select and delete
- [ ] Bulk update fields
- [ ] Search functionality
- [ ] Pagination

**Dashboard:**
- [ ] Statistics display correctly
- [ ] Auto-refresh works (5s interval)
- [ ] Manual refresh button
- [ ] Capacity bars update

**API:**
- [ ] All endpoints return correct status codes
- [ ] Error responses are properly formatted
- [ ] Pagination works correctly
- [ ] Search/filter works

### Testing Commands

```bash
# Run development server
npm run dev

# Build production
npm run build

# Test container build
./container.sh build
./container.sh start-ssl
./container.sh logs

# Test HTTPS endpoint
curl --noproxy '*' -k -s https://localhost:5942/api/stats
```

---

## Documentation

### Code Documentation

- Add JSDoc comments for functions
- Document complex algorithms
- Explain non-obvious code

**Example:**

```javascript
/**
 * Upload chemicals from Excel file
 * @param {File} file - Excel file (.xlsx, .xls, .csv)
 * @returns {Promise<Object>} Upload results with counts and errors
 */
async function uploadChemicalsExcel(file) {
  // Implementation
}
```

### Update Documentation

When making changes, update relevant documentation:

- **README.md**: Overview, installation, quick start
- **API.md**: API endpoint changes
- **DEPLOYMENT.md**: Deployment process changes
- **CONTRIBUTING.md**: Development process changes

---

## File Structure

When adding new files, follow this structure:

```
client/src/
├── components/        # Reusable React components
├── pages/            # Page components
├── services/         # API service functions
├── utils/            # Utility functions
└── styles/           # Global styles

server/src/
├── routes/           # Express route handlers
├── utils/            # Utility functions
└── database.js       # Database configuration

Root:
├── container.sh      # Container management script
├── monitor.sh        # Health monitoring script
├── setup-after-clone.sh  # Post-clone setup with SSL certs
├── uninstall.sh      # Uninstall & cleanup script
├── .gitignore        # Protects certs, data, keys
├── Dockerfile        # Container image definition
└── docs/             # Documentation
```

### Security Notes for Contributors

- **Never commit** SSL certificates, private keys, or database files
- The `.gitignore` is configured to exclude `certs/`, `data/`, `*.key`, `*.crt`, `*.pem`
- Always test with `./container.sh start-ssl` to verify HTTPS works
- Run `openssl x509/rsa` verification after any certificate changes

---

## Common Tasks

### Adding a New API Endpoint

1. Add route in `server/src/routes/`
2. Implement handler with error handling
3. Add API function in `client/src/services/api.js`
4. Document in `API.md`
5. Test with cURL or Postman

### Adding a New UI Component

1. Create component in `client/src/components/`
2. Use Tailwind for styling
3. Add PropTypes or TypeScript
4. Import and use in page component
5. Test in different screen sizes

### Adding a New Page

1. Create page in `client/src/pages/`
2. Add route in `client/src/App.jsx`
3. Add navigation link
4. Update documentation

---

## Development Cleanup

After you're done developing or before switching to a different project, clean up your local environment.

### Quick Cleanup (Recommended)

Use the `uninstall.sh` script:

```bash
# Partial cleanup — removes container, image, cron, logs, keeps source code
./uninstall.sh --partial

# Preview what would be removed first
./uninstall.sh --dry-run
```

### Manual Cleanup

If you prefer to run steps individually:

```bash
# Stop the dev server (if running via npm run dev)
# Press Ctrl+C in the terminal

# Stop and remove container + image
./container.sh clean

# Remove monitoring cron job
crontab -l | grep -v 'monitor.sh' | crontab -
rm -f /tmp/pandora-monitor.log

# Free disk space
rm -rf node_modules/ client/node_modules/ server/node_modules/
rm -rf client/dist/
rm -rf certs/ data/
```

### Full Uninstall

```bash
# Removes everything including data and project directory
./uninstall.sh --full
```

See the [Uninstall & Cleanup guide](DEPLOYMENT.md#uninstall--cleanup) in the Deployment documentation for complete details.

---

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Create an Issue with details
- **Security**: Email security@example.com
- **Slack**: Join #crucible channel

---

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project README

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Crucible! 🎉
