# @skills - Ajoursystem Custom Skills

This folder contains custom skills for the Ajoursystem project. These skills extend Claude Code functionality with project-specific commands and automation.

## Available Skills

- **code-review** - Automated code review workflows
- **review-jira** - Integration with Jira for reviews
- **ship** - Deployment and shipping utilities
- **skill-creator** - Tools for creating new skills
- **technotes** - Technical documentation helpers
- **worklog** - Jira worklog tracking

## Installation

To use these skills in your Ajoursystem build environment, copy the skill folders to your local Claude Code configuration:

### Steps

1. Navigate to your ajoursystem-build-web project
2. Copy individual skill folders from this repository to your Claude Code skills directory
3. Restart Claude Code or reload the configuration

### Directory Structure

```
<your-project-folder>/
└── ajoursystem-build-web/
    └── .claude/
        └── skills/
```

### Example

To copy the `review-jira` skill from this repository:

```bash
# From your ajoursystem-build-web project root:
cp -r /path/to/ajoursystem-claude/skills/review-jira ./.claude/skills/
```

Or copy all skills at once:

```bash
# Copy all custom skills
cp -r /path/to/ajoursystem-claude/skills/* <your-folder-path>/ajoursystem-build-web/.claude/skills/
```

After copying, the skill will be available in Claude Code within that project context.

## Using the Skills

Once installed, you can invoke skills using the `/skill-name` command in Claude Code. For example:

```
/review-jira
/ship
/code-review
```

Refer to individual skill folders for specific documentation and usage instructions.
