#!/usr/bin/env bash
set -euo pipefail

# FANZ Repository Synchronization & Analysis Script
# Comprehensive assessment and sync plan for unified FANZ cluster ecosystem

log() { printf "\033[1;36m[FANZ-SYNC]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
ok() { printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }
error() { printf "\033[1;31m[ERROR]\033[0m %s\n" "$*"; exit 1; }

GITHUB_BASE="$HOME/Documents/GitHub"
FANZ_BASE="$HOME/Development/FANZ"
ANALYSIS_DIR="$FANZ_BASE/fanz-sync-analysis"
CSV_FILE="$ANALYSIS_DIR/repo-inventory.csv"

# Ensure analysis directory exists
mkdir -p "$ANALYSIS_DIR"

log "🔍 Starting FANZ Repository Analysis & Synchronization Plan"

# Initialize CSV with headers
echo "Repository,Path,Type,Branch,LastCommit,HasRemote,Status,HasPnpm,HasNvmrc,HasDockerfile,HasReadme,GitStatus,Notes" > "$CSV_FILE"

analyze_repo() {
    local repo_path="$1"
    local repo_name="$(basename "$repo_path")"
    local repo_type="unknown"
    local branch="unknown"
    local last_commit="unknown"
    local has_remote="no"
    local status="unknown"
    local has_pnpm="no"
    local has_nvmrc="no" 
    local has_dockerfile="no"
    local has_readme="no"
    local git_status="not-git"
    local notes=""

    # Determine repository type based on name patterns
    case "$repo_name" in
        *"BoyFanz"*|*"GirlFanz"*|*"PupFanz"*|*"DaddyFanz"*|*"CougarFanz"*|*"TabooFanz"*|*"TransFanz"*)
            repo_type="platform-cluster" ;;
        *"FanzDash"*|*"FanzProtect"*|*"FanzMediaCore"*|*"FanzTube"*|*"FanzCock"*)
            repo_type="core-system" ;;
        *"CreatorCRM"*|*"FanzFiliate"*|*"FanzSpicyAi"*)
            repo_type="specialized-service" ;;
        *"FANZ-Unified"*|*"FANZ_UNIFIED"*|*"Ecosystem"*)
            repo_type="unified-ecosystem" ;;
        *) repo_type="utility" ;;
    esac

    if [[ -d "$repo_path/.git" ]]; then
        cd "$repo_path"
        
        # Get current branch
        branch=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || "detached")
        
        # Get last commit info
        last_commit=$(git log -1 --format="%h %s" 2>/dev/null || "no-commits")
        
        # Check for remote
        if git remote -v | grep -q "origin"; then
            has_remote="yes"
        fi
        
        # Check git status
        if git status --porcelain | grep -q .; then
            git_status="dirty"
        else
            git_status="clean"
        fi
        
        # Check for key files
        [[ -f "pnpm-lock.yaml" || -f "package.json" ]] && has_pnpm="yes"
        [[ -f ".nvmrc" ]] && has_nvmrc="yes"
        [[ -f "Dockerfile" ]] && has_dockerfile="yes"
        [[ -f "README.md" ]] && has_readme="yes"
        
        # Determine overall status
        if [[ "$has_remote" == "yes" && "$git_status" == "clean" ]]; then
            status="sync-ready"
        elif [[ "$has_remote" == "yes" && "$git_status" == "dirty" ]]; then
            status="needs-commit"
        elif [[ "$has_remote" == "no" ]]; then
            status="needs-remote"
        else
            status="unknown"
        fi
        
        # Add notes for important observations
        if [[ "$repo_name" == *"FUN"* ]]; then
            notes="${notes}NEEDS-REBRAND;"
        fi
        if [[ ! -f ".gitignore" ]]; then
            notes="${notes}MISSING-GITIGNORE;"
        fi
        if [[ -d "node_modules" && ! -f ".gitignore" ]]; then
            notes="${notes}UNIGNORED-NODE-MODULES;"
        fi
        
    else
        notes="NOT-GIT-REPO"
        status="not-initialized"
    fi

    # Write to CSV
    echo "$repo_name,$repo_path,$repo_type,$branch,$last_commit,$has_remote,$status,$has_pnpm,$has_nvmrc,$has_dockerfile,$has_readme,$git_status,$notes" >> "$CSV_FILE"
    
    log "📊 Analyzed: $repo_name ($repo_type) - $status"
}

# Analyze all FANZ-related repositories
log "🔍 Scanning GitHub directory for FANZ repositories..."

cd "$GITHUB_BASE"
while IFS= read -r -d '' repo_path; do
    analyze_repo "$repo_path"
done < <(find . -maxdepth 1 -type d \( \
    -name "*FANZ*" -o \
    -name "*Fanz*" -o \
    -name "*BoyFanz*" -o \
    -name "*GirlFanz*" -o \
    -name "*PupFanz*" -o \
    -name "*DaddyFanz*" -o \
    -name "*CougarFanz*" -o \
    -name "*TabooFanz*" -o \
    -name "*TransFanz*" -o \
    -name "*CreatorCRM*" \
\) -print0 | sort -z)

# Also check Development/FANZ directory
if [[ -d "$FANZ_BASE" ]]; then
    log "🔍 Scanning Development/FANZ directory..."
    cd "$FANZ_BASE"
    while IFS= read -r -d '' repo_path; do
        analyze_repo "$repo_path"
    done < <(find . -maxdepth 1 -type d -print0 | sort -z)
fi

# Generate summary report
log "📋 Generating summary report..."

cat > "$ANALYSIS_DIR/sync-summary.md" << 'EOF'
# FANZ Repository Synchronization Summary

## Analysis Results

EOF

# Count repositories by type and status
echo "### Repository Count by Type" >> "$ANALYSIS_DIR/sync-summary.md"
tail -n +2 "$CSV_FILE" | cut -d',' -f3 | sort | uniq -c | while read count type; do
    echo "- $type: $count repositories" >> "$ANALYSIS_DIR/sync-summary.md"
done

echo -e "\n### Repository Status Distribution" >> "$ANALYSIS_DIR/sync-summary.md"
tail -n +2 "$CSV_FILE" | cut -d',' -f7 | sort | uniq -c | while read count status; do
    echo "- $status: $count repositories" >> "$ANALYSIS_DIR/sync-summary.md"
done

# Identify repositories needing attention
echo -e "\n### Repositories Requiring Attention" >> "$ANALYSIS_DIR/sync-summary.md"
echo "#### Repositories needing rebranding (contain 'FUN'):" >> "$ANALYSIS_DIR/sync-summary.md"
tail -n +2 "$CSV_FILE" | grep "NEEDS-REBRAND" | cut -d',' -f1 | while read repo; do
    echo "- $repo" >> "$ANALYSIS_DIR/sync-summary.md"
done

echo -e "\n#### Repositories without Git remotes:" >> "$ANALYSIS_DIR/sync-summary.md"
tail -n +2 "$CSV_FILE" | grep "needs-remote" | cut -d',' -f1 | while read repo; do
    echo "- $repo" >> "$ANALYSIS_DIR/sync-summary.md"
done

echo -e "\n#### Repositories with uncommitted changes:" >> "$ANALYSIS_DIR/sync-summary.md"
tail -n +2 "$CSV_FILE" | grep "needs-commit" | cut -d',' -f1 | while read repo; do
    echo "- $repo" >> "$ANALYSIS_DIR/sync-summary.md"
done

# Generate actionable recommendations
cat >> "$ANALYSIS_DIR/sync-summary.md" << 'EOF'

## Recommended Actions

### 1. Immediate Synchronization Priorities

1. **Commit and push uncommitted changes** to preserve work
2. **Set up Git remotes** for repositories without them  
3. **Rebrand repositories** containing 'FUN' references
4. **Standardize toolchain** (add .nvmrc, pnpm-lock.yaml, Dockerfile)
5. **Implement SSO integration** for unified authentication

### 2. Repository Consolidation Strategy

- **Keep platform-specific repos** for BoyFanz, GirlFanz, PupFanz, etc.
- **Consolidate core systems** into unified services
- **Create shared workspace** for common packages and utilities
- **Archive duplicate/obsolete repositories**

### 3. Next Steps for SSO Integration

1. Deploy FanzSSO service (Keycloak/Ory Stack)
2. Create unified profile service (FanzProfile)
3. Implement OIDC flows in each platform
4. Set up FanzDash as the central control panel
5. Enable cross-platform profile sharing

EOF

ok "✅ Analysis complete! Results saved to:"
ok "   📊 CSV: $CSV_FILE"
ok "   📋 Summary: $ANALYSIS_DIR/sync-summary.md"

# Generate sync scripts for next phase
log "🔧 Generating synchronization scripts..."

cat > "$ANALYSIS_DIR/sync-repos.sh" << 'EOF'
#!/usr/bin/env bash
# Auto-generated repository synchronization script

set -euo pipefail

log() { printf "\033[1;36m[SYNC]\033[0m %s\n" "$*"; }
ok() { printf "\033[1;32m[OK]\033[0m %s\n" "$*"; }

GITHUB_BASE="$HOME/Documents/GitHub"

# Function to sync a repository
sync_repo() {
    local repo_path="$1"
    local repo_name="$(basename "$repo_path")"
    
    if [[ -d "$repo_path/.git" ]]; then
        cd "$repo_path"
        log "🔄 Syncing $repo_name..."
        
        # Stash any uncommitted changes
        if ! git diff --quiet || ! git diff --staged --quiet; then
            log "💾 Stashing changes in $repo_name"
            git stash push -m "Pre-sync stash $(date -Iseconds)" || true
        fi
        
        # Pull latest changes
        if git remote get-url origin >/dev/null 2>&1; then
            log "⬇️ Pulling latest changes for $repo_name"
            git pull --rebase origin $(git symbolic-ref --short HEAD) || git pull origin $(git symbolic-ref --short HEAD) || true
        fi
        
        ok "✅ $repo_name synchronized"
    else
        log "⚠️ Skipping $repo_name (not a git repository)"
    fi
}

EOF

# Add sync commands for all repositories
tail -n +2 "$CSV_FILE" | while IFS=',' read -r name path type branch commit remote status pnpm nvmrc dockerfile readme git_status notes; do
    if [[ "$status" == "sync-ready" || "$status" == "needs-commit" ]]; then
        echo "sync_repo \"$path\"" >> "$ANALYSIS_DIR/sync-repos.sh"
    fi
done

chmod +x "$ANALYSIS_DIR/sync-repos.sh"

ok "🎯 Synchronization script ready: $ANALYSIS_DIR/sync-repos.sh"

log "🚀 FANZ Repository Analysis Complete!"
log "   Next: Review the summary and run the sync script when ready"