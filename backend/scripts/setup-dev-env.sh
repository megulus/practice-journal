#!/bin/bash

# Setup local Python development environment
# This installs dependencies locally so your IDE can provide autocomplete and linting

echo "Setting up local Python development environment..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
else
    echo "Virtual environment already exists."
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies from requirements.txt..."
pip install -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "To activate the virtual environment in your terminal, run:"
echo "  source backend/venv/bin/activate"
echo ""
echo "To configure Cursor to use this environment:"
echo "  1. Open Command Palette (Cmd+Shift+P)"
echo "  2. Search for 'Python: Select Interpreter'"
echo "  3. Select the interpreter at: backend/venv/bin/python"




