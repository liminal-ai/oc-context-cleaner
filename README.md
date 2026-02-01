# OCC - OpenClaw Context Cleaner

A CLI tool for cleaning and managing OpenClaw session transcripts. Reduce context window usage by stripping tool calls, thinking blocks, and other verbose content from session files.

## Installation

```bash
npm install -g oc-context-cleaner
```

Or run directly with npx:

```bash
npx oc-context-cleaner <command>
```

## Usage

### List Sessions

```bash
# List all sessions for the default agent
occ list

# List sessions for a specific agent
occ list --agent my-agent

# Limit results
occ list -n 10

# Output as JSON
occ list --json
```

### Edit Sessions (In-Place)

Edit modifies the session file in place, creating a backup first.

```bash
# Edit with default tool stripping preset
occ edit abc123 --strip-tools

# Edit with aggressive preset
occ edit abc123 --strip-tools aggressive

# Auto-detect current session
occ edit --strip-tools
```

### Clone Sessions

Clone creates a new session file, optionally with tool stripping.

```bash
# Clone without modifications
occ clone abc123

# Clone with tool stripping
occ clone abc123 --strip-tools

# Clone to custom output path
occ clone abc123 -o ./cleaned-session.jsonl

# Clone without registering in session index
occ clone abc123 --no-register
```

### Session Info

```bash
# View session statistics
occ info abc123
```

### Restore from Backup

```bash
# Restore a session from its backup
occ restore abc123
```

## Tool Stripping Presets

| Preset | Behavior |
|--------|----------|
| `default` | Keep 5 most recent tool turns, truncate 50% of kept turns |
| `aggressive` | Keep 3 most recent tool turns, truncate 70% of kept turns |
| `extreme` | Keep 1 most recent tool turn, truncate 100% of kept turns |

## Configuration

Create a `.occrc.json` or `occ.config.ts` file in your project or home directory:

```json
{
  "defaultAgentId": "main",
  "defaultPreset": "default",
  "outputFormat": "human",
  "verboseOutput": false,
  "stateDirectory": "~/.openclaw",
  "customPresets": {
    "minimal": {
      "name": "minimal",
      "keepTurnsWithTools": 2,
      "truncatePercent": 80
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultAgentId` | string | `"main"` | Default agent ID when not specified |
| `defaultPreset` | string | `"default"` | Default tool stripping preset |
| `outputFormat` | `"human"` \| `"json"` | `"human"` | Default output format |
| `verboseOutput` | boolean | `false` | Show detailed statistics by default |
| `stateDirectory` | string | `"~/.openclaw"` | OpenClaw state directory path |
| `customPresets` | object | `{}` | Custom tool removal presets |

## Output Formats

### Human-Readable (default)

```
Session edited successfully
  Session: abc123...
  Backup: ~/.openclaw/agents/main/backups/abc123.backup.jsonl
  Tool calls: 15 -> 5 (10 removed, 3 truncated)
  Size: 125KB -> 45KB (64% reduction)
```

### JSON

```bash
occ edit abc123 --strip-tools --json
```

```json
{
  "success": true,
  "mode": "edit",
  "sessionId": "abc123...",
  "statistics": {
    "toolCallsOriginal": 15,
    "toolCallsRemoved": 10,
    "toolCallsTruncated": 3,
    "reductionPercent": 64
  }
}
```

## License

MIT
