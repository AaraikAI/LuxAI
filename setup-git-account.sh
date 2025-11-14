#!/bin/bash

# Script to configure Git account for current repository
# Usage: ./setup-git-account.sh <account1|account2> [name] [email]

set -e

ACCOUNT=$1
NAME=$2
EMAIL=$3

if [ -z "$ACCOUNT" ]; then
    echo "Usage: ./setup-git-account.sh <account1|account2> [name] [email]"
    echo ""
    echo "Examples:"
    echo "  ./setup-git-account.sh account1 'SuperThinks' 'superthinksai@gmail.com'"
    echo "  ./setup-git-account.sh account2 'YourName' 'your-email@example.com'"
    exit 1
fi

# Account 1 defaults (SuperThinks)
if [ "$ACCOUNT" = "account1" ]; then
    NAME=${NAME:-"SuperThinks"}
    EMAIL=${EMAIL:-"superthinksai@gmail.com"}
    SSH_HOST="github.com-account1"
    
# Account 2 defaults (you'll need to set these)
elif [ "$ACCOUNT" = "account2" ]; then
    if [ -z "$NAME" ] || [ -z "$EMAIL" ]; then
        echo "Error: For account2, please provide name and email:"
        echo "  ./setup-git-account.sh account2 'YourName' 'your-email@example.com'"
        exit 1
    fi
    SSH_HOST="github.com-account2"
else
    echo "Error: Account must be 'account1' or 'account2'"
    exit 1
fi

echo "Setting up Git for $ACCOUNT..."
echo "  Name: $NAME"
echo "  Email: $EMAIL"
echo ""

# Set local Git config
git config --local user.name "$NAME"
git config --local user.email "$EMAIL"

# Try to update remote URL to use SSH if SSH config exists
if [ -f ~/.ssh/config ] && grep -q "$SSH_HOST" ~/.ssh/config; then
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ "$CURRENT_REMOTE" == *"github.com"* ]]; then
        # Extract repo path (e.g., AaraikAI/LuxAI.git)
        REPO_PATH=$(echo "$CURRENT_REMOTE" | sed -E 's|.*github\.com[:/]([^/]+/[^/]+\.git?)|\1|')
        NEW_REMOTE="git@${SSH_HOST}:${REPO_PATH}"
        
        echo "Updating remote URL to use SSH..."
        git remote set-url origin "$NEW_REMOTE"
        echo "  Remote updated to: $NEW_REMOTE"
    fi
else
    echo "Note: SSH config not found. Using HTTPS. Set up SSH keys for automatic authentication."
fi

echo ""
echo "✅ Git configured for $ACCOUNT"
echo ""
echo "Current configuration:"
echo "  User: $(git config user.name)"
echo "  Email: $(git config user.email)"
echo "  Remote: $(git remote get-url origin)"

