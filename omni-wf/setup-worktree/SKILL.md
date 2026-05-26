---
name: setup-worktree
description: |
  为 omni-wf 的隔离开发创建和管理 git worktree。
  强制目录到 ~/.worktrees，所有 worktree 统一创建到此目录。
  支持基于 Issue 的隔离开发，确保多任务并行时互不干扰。
triggers:
  - setup-worktree
  - worktree
  - create worktree
  - 创建工作树
---

# Setup Worktree — 隔离开发工作树管理

## CRITICAL — 执行约束

**所有 omni-wf 的 worktree 必须统一创建到 ~/.worktrees 目录。严禁在 repo 内部或其他位置创建 worktree。**

### 强制要求

| 要求 | 说明 |
|------|------|
| 统一目录 | 所有 worktree 必须创建在 `~/.worktrees/` 下 |
| 自动创建 | 若目录不存在，自动创建 |
| 命名规范 | `~/.worktrees/{repo-name}/{branch-name}` |
| 隔离保证 | 每个 Issue / 分支必须有独立的 worktree |
| 路径回传 | worktree 创建后必须将路径回传给调用方 |

---

## Preamble

```bash
_WORKTREE_BASE="$HOME/.worktrees"
mkdir -p "$WORKTREE_BASE"

_REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
_REPO_NAME=$(basename "$REPO_ROOT" 2>/dev/null || echo "unknown")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

if [ -z "$REPO_ROOT" ]; then
  echo "ERROR: not a git repository"
  exit 1
fi

echo "WORKTREE_BASE: $WORKTREE_BASE"
echo "REPO_ROOT: $REPO_ROOT"
echo "REPO_NAME: $REPO_NAME"
echo "CURRENT_BRANCH: $BRANCH"
```

---

## 工作树创建

### 1.1 确定工作树路径

**命名规则**：

```
~/.worktrees/{repo-name}/{branch-name}
```

- `repo-name`: git repo 的根目录名（如 `labs`, `omni-skills`）
- `branch-name`: 当前分支名（如 `feat-auth-system`，将 `/` 替换为 `-` 避免子目录歧义）

**示例**：
- 当前 repo: `/home/user/labs`，分支: `feat/auth-system`
- 工作树路径: `~/.worktrees/labs/feat-auth-system`

### 1.2 创建工作树

```bash
# 将分支名中的 / 替换为 -，防止创建嵌套子目录
_SAFE_BRANCH=$(echo "$BRANCH" | tr '/' '-')
_WORKTREE_PATH="$WORKTREE_BASE/$REPO_NAME/$_SAFE_BRANCH"

# 检查是否已存在
if [ -d "$WORKTREE_PATH" ]; then
  echo "WORKTREE_EXISTS: yes"
  echo "WORKTREE_PATH: $WORKTREE_PATH"

  # 验证当前 HEAD 是否一致
  _HEAD_IN_WORKTREE=$(git -C "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo "unknown")
  _HEAD_IN_REPO=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

  if [ "$_HEAD_IN_WORKTREE" = "$_HEAD_IN_REPO" ]; then
    echo "HEAD_SYNC: yes"
  else
    echo "HEAD_SYNC: no"
    echo "WORKTREE_HEAD: $_HEAD_IN_WORKTREE"
    echo "REPO_HEAD: $_HEAD_IN_REPO"
    echo "ACTION: 建议删除并重新创建工作树"
  fi
else
  # 创建父目录
  mkdir -p "$(dirname "$WORKTREE_PATH")"

  # 创建 worktree（优先基于当前分支，失败则用 detached HEAD）
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git worktree add "$WORKTREE_PATH" "$BRANCH"
  else
    git worktree add --detach "$WORKTREE_PATH" HEAD
  fi

  echo "WORKTREE_CREATED: yes"
  echo "WORKTREE_PATH: $WORKTREE_PATH"
fi
```

### 1.3 验证工作树

```bash
# 验证目标路径在 git worktree 列表中
if git worktree list | grep -q "$WORKTREE_PATH"; then
  echo "WORKTREE_VALID: yes"
else
  echo "WORKTREE_VALID: no"
fi

# 列出该 repo 的所有 worktree
echo "--- ALL WORKTREES ---"
git worktree list
```

---

## 工作树清理

### 2.1 按需清理指定 worktree

```bash
# 由调用方提供要清理的 worktree 路径（通过参数传入）
_TARGET_WT="${1:-}"
if [ -n "$TARGET_WT" ] && [ -d "$TARGET_WT" ]; then
  git worktree remove "$TARGET_WT" 2>/dev/null || rm -rf "$TARGET_WT"
  git worktree prune
  echo "CLEANED: $TARGET_WT"
else
  echo "CLEANED: none"
fi
```

### 2.2 批量清理已合并分支的 worktree

```bash
# 列出所有 worktree，排除主工作区
git worktree list | awk 'NR>1 && $1 !~ /\(bare\)$/ {print $1}' | while read -r wt_path; do
  # 检查对应分支是否已合并到当前分支
  _WT_BRANCH=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ -n "$_WT_BRANCH" ] && [ "$_WT_BRANCH" != "HEAD" ]; then
    if git branch --merged | grep -q "$_WT_BRANCH"; then
      git worktree remove "$wt_path" 2>/dev/null || rm -rf "$wt_path"
      echo "CLEANED_MERGED: $wt_path (branch: $_WT_BRANCH)"
    fi
  fi
done
git worktree prune
```

---

## 输出规范

工作树创建完成后，必须输出以下信息供调用方使用：

```
WORKTREE_PATH: /home/user/.worktrees/labs/feat-auth-system
WORKTREE_BRANCH: feat/auth-system
WORKTREE_BASE: /home/user/.worktrees
REPO_ROOT: /home/user/labs
STATUS: ready
```

---

## 与 omni-wf 集成

**在 omni-wf 中的调用时机**：

1. **CONSTRUCTION 阶段开始时**：为当前分支创建主 worktree（如果未创建）
2. **并行 subagent 执行前**：为每个并发 Issue 创建独立 worktree（如需要物理隔离）
3. **上下文重置后恢复时**：通过 state.md 中记录的 worktree_path 重新定位工作区

**调用方式**：由 omni-wf 的 Orchestrator 在需要时调用 `/setup-worktree`。

**Issue 关联**：每个 Issue 在 state.md 中必须记录对应的 `worktree_path`，确保上下文重置后仍能定位工作区。
