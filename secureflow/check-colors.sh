#!/bin/bash

echo "🎨 Checking SecureFlow Color Theme..."

# Check if VS Code is running
if pgrep -f "code" > /dev/null; then
    echo "✅ VS Code is running"
else
    echo "⚠️  VS Code is not running. Please open VS Code first."
fi

# Check if Solidity extension is installed
echo ""
echo "🔍 Checking Solidity extension..."
if code --list-extensions | grep -q "juanblanco.solidity"; then
    echo "✅ Solidity extension is installed"
else
    echo "❌ Solidity extension not found. Installing..."
    code --install-extension JuanBlanco.solidity
fi

# Check if Material Theme is installed
echo ""
echo "🔍 Checking Material Theme..."
if code --list-extensions | grep -q "zhuangtongfa.Material-theme"; then
    echo "✅ Material Theme is installed"
else
    echo "❌ Material Theme not found. Installing..."
    code --install-extension zhuangtongfa.Material-theme
fi

echo ""
echo "🎯 Color Theme Status:"
echo "   🔵 Functions: Blue (#45B7D1)"
echo "   🟡 Variables: Yellow (#F7DC6F)"
echo "   🟢 Strings: Green (#58D68D)"
echo "   🟣 Keywords: Pink (#FF6B9D)"
echo "   🔷 Types: Cyan (#4ECDC4)"
echo "   🟠 Numbers: Orange (#F39C12)"
echo "   🟣 Comments: Gray (#85929E)"

echo ""
echo "💡 To see colors:"
echo "1. Open test-colors.sol in VS Code"
echo "2. Check if you see different colors for:"
echo "   - Functions (blue)"
echo "   - Variables (yellow)"
echo "   - Strings (green)"
echo "   - Keywords (pink)"
echo "   - Types (cyan)"
echo "   - Numbers (orange)"

echo ""
echo "🔧 If colors don't appear:"
echo "1. Restart VS Code completely"
echo "2. Open a .sol file"
echo "3. Press Ctrl+Shift+P and type 'Developer: Reload Window'"
echo "4. Check that the Solidity extension is active in the bottom status bar"

echo ""
echo "🚀 Your SecureFlow development environment is ready!"
