# Hooks

Shell scripts in this folder are not active until registered in `.claude/settings.json` under the `hooks` key.

Hooks fire on events like `PreToolUse` and `PostToolUse`. Example registration:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/validate-bash.sh" }
        ]
      }
    ]
  }
}
```

See the Claude Code hooks documentation for available events and matchers.
