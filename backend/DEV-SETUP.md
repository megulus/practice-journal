# Backend Development Setup



## Local Development Environment Setup

A Python virtual environment (`venv/`) has been created with all project dependencies installed. This allows your IDE to understand the imports without affecting the Docker environment.


```bash
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

All dependencies from `requirements.txt` should now be installed in `backend/venv/`.

### 🔧 Configure Cursor IDE

Workspace settings have been configured automatically in `.vscode/settings.json` and `.cursor/settings.json` to use the virtual environment.

**To verify it's working:**

1. **Check the status bar** (bottom right of Cursor window):
   - Should show "Python 3.12.0 ('venv': venv)" or similar
   - Note: It might show the path to the system Python due to symlinks, but if it says 'venv', it's correct

2. **Reload Window**: Press `Cmd+Shift+P` → "Developer: Reload Window"

3. **Manually select interpreter** (if needed):
   - Press `Cmd+Shift+P`
   - Type "Python: Select Interpreter"
   - Choose: `./backend/venv/bin/python` (shows as 'venv': venv)


### 📝 Verify It Works

After configuring the interpreter:

- Open `backend/app/models.py`
- Hover over `from sqlmodel import Field, SQLModel, Relationship`
- You should see type hints and documentation (no red squiggles)
- Autocomplete should work when typing `SQLModel.`

### 🚀 Running the Application

**Important**: The virtual environment is **only for IDE support**. Always run the application using Docker:

```bash
# From project root
docker compose up
```

The Docker containers have their own isolated Python environment and will not use your local `venv/`.

### 🔄 Updating Dependencies

If you add new packages to `requirements.txt`:

1. **Update Docker** (required for runtime):
   ```bash
   docker compose up --build
   ```

2. **Update local venv** (optional, for IDE support):
   ```bash
   cd backend
   venv/bin/pip install -r requirements.txt
   ```

### 🗑️ Already in .gitignore

The `venv/` directory is already excluded from Git (see `.gitignore` line 8), so it won't be committed to your repository.

## Troubleshooting

### "Operation not permitted" when creating venv

This is a macOS System Integrity Protection (SIP) issue with the system Python. The issue has been resolved by using Python 3.12 which has appropriate permissions.

### Imports still showing errors after selecting interpreter

1. Reload the Cursor window: `Cmd+Shift+P` → "Developer: Reload Window"
2. Verify the correct interpreter is selected in the status bar (bottom right)
3. Check that the venv exists: `ls -l backend/venv/bin/python`

### Want to use a different Python version?

If you prefer a different Python version (e.g., from Homebrew):

```bash
cd backend
rm -rf venv
/path/to/your/python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

Then reconfigure Cursor to use the new venv.



