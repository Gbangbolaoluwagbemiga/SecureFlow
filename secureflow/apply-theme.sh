#!/bin/bash

echo "🎨 Applying SecureFlow Color Theme..."

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ VS Code not found. Please install VS Code first."
    exit 1
fi

# Install recommended extensions
echo "📦 Installing recommended extensions..."
code --install-extension JuanBlanco.solidity
code --install-extension zhuangtongfa.Material-theme
code --install-extension PKief.material-icon-theme
code --install-extension esbenp.prettier-vscode
code --install-extension tintinweb.solidity-visual-auditor

echo "✅ Extensions installed!"
echo ""
echo "🎯 To apply the theme:"
echo "1. Open VS Code"
echo "2. Press Ctrl+Shift+P"
echo "3. Type 'Preferences: Color Theme'"
echo "4. Select 'One Dark Pro' or 'Material Theme'"
echo ""
echo "🔧 Your Solidity code will now have beautiful colors:"
echo "   🔵 Functions: Blue (#45B7D1)"
echo "   🟡 Variables: Yellow (#F7DC6F)"
echo "   🟢 Strings: Green (#58D68D)"
echo "   🟣 Keywords: Pink (#FF6B9D)"
echo "   🔷 Types: Cyan (#4ECDC4)"
echo "   🟠 Numbers: Orange (#F39C12)"
echo ""
echo "🚀 Happy coding with SecureFlow!"
