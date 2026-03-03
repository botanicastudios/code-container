# Code Container

Isolated Docker environment for running coding tools on projects with full system protection.

## Overview

- **Project Isolation**: One container per project with complete isolation
- **State Persistence**: All changes and packages persist between sessions
- **Shared Resources**: npm cache, pip cache, and Claude history shared across projects
- **Security**: Changes within a container don't affect your host or other projects

## Prerequisites

- **Docker** — [Install Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine
- **A POSIX-Compatible System** — Linux, macOS, WSL

## Initial Setup

### 1. Install as Global Command

To use the `container` command from anywhere, create a symlink in a PATH-tracked folder:

```bash
ln -s "$(pwd)/container.sh" /usr/local/bin/container
```

### 2. Configure Harnesses

Copy configurations into this repo (shared across all containers):

```bash
# OpenCode
cp -R ~/.config/opencode ./.opencode

# Codex
cp -R ~/.codex ./.codex

# Claude Code
cp -R ~/.claude ./.claude && cp ~/.claude.json container.claude.json
```

### 3. Build Docker Image

```bash
container --build    # Run once, or when rebuilding
```

**Includes**: Ubuntu 24.04 LTS, Node.js 22 LTS, Python 3, Claude Code, OpenCode, OpenAI Codex CLI, git

## Usage

```bash
cd /path/to/your/project
container                    # Enter container
```

Inside the container:
```bash
opencode                     # Start OpenCode
codex                        # Start OpenAI Codex
npm install <package>        # Persists per container
pip install <package>        # Persists per container
exit                         # Auto-stops container on exit
```

Container state is saved. Next invocation resumes where you left off. AI conversations and settings persist across all projects.

### Container Isolation

Destructive actions are localized inside containers. You can let your harness run with full permissions.

`.opencode/opencode.json`
```json
{
  "permission": "allow"
}
```

`.codex/config.toml`
```toml
approval_policy = "never"
sandbox_mode = "danger-full-access"
```

`.claude/settings.json`
```json
{
  "permissions": {
    "allow": [
      "*",
      "Bash"
    ]
  }
}
```


## Common Commands

```bash
container                  # Enter the container
container --list           # List all containers
container --stop           # Stop current project's container
container --remove         # Remove current project's container
container --build          # Rebuild Docker image

# With explicit path:
container /path/to/project
container --stop /path/to/project
container --remove /path/to/project
```

## What Persists

**Per-Container**:
- All installed system packages, npm packages, Python packages
- All file modifications, databases, shell history
- Container filesystem state

**Shared Across All Projects:**
- Harness configuration and conversation history
- npm and pip download caches
- Python user packages

**Read-only from Host:**
- Git configuration, SSH keys

## Simultaneous Work

You and your harness can work on the same project simultaneously.

**Safe**: File editing, reading files, most development operations

**Avoid**: Git operations from both sides, installing conflicting `node_modules`

**Recommended**: Let AI work autonomously in container while you work; review afterwards and commit.

## Customization

**Add tools/packages** — Edit `Dockerfile` and rebuild:
```dockerfile
RUN apt-get update && apt-get install -y postgresql-client redis-tools && rm -rf /var/lib/apt/lists/*
```

**Add shared volumes** — Edit `docker run -it` in `container.sh`:
```bash
-v "$SCRIPT_DIR/new-shared-dir:/root/target-path"
```

## Security

- Container runs as root with no network restrictions
- SSH keys and Git config mounted read-only
- Project isolation prevents cross-contamination
- Host filesystem protected (no access outside mounted directories)

## Tips

```bash
container --list          # Track containers
container --remove        # Save disk space after project completion
docker system prune -a    # Clean up unused Docker data
```
