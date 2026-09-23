# セルフホストランナー（母艦のMac）

`auto-ingest.yml` だけがここで動く。理由は `docs/auto-ingest.md` の「実行場所」を見ること
（YouTube が GitHub ホストランナーのIPを弾くため）。

## 登録（済み・作り直すとき用）

```bash
VER=$(gh api repos/actions/runner/releases/latest -q .tag_name | tr -d v)
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -sSL -o runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v${VER}/actions-runner-osx-arm64-${VER}.tar.gz"
tar xzf runner.tar.gz && rm runner.tar.gz

# 登録トークンはブラウザ不要（1時間で失効する）
TOKEN=$(gh api -X POST repos/kentatorimoto/shintoku-platform/actions/runners/registration-token -q .token)

./config.sh --unattended \
  --url https://github.com/kentatorimoto/shintoku-platform \
  --token "$TOKEN" \
  --name mac-boat --labels self-hosted,macos,arm64 --work _work
```

### launchd に常駐させる

```bash
cd ~/actions-runner
./svc.sh install     # ~/Library/LaunchAgents/actions.runner.*.plist を作る（RunAtLoad）
./svc.sh start
./svc.sh status
```

**ログイン時に起動する**（電源投入時ではない）。Macがログイン状態でなければ取り込みは走らない。
その間 Issue は溜まるだけなので、次に起きたときに消化される。

### PATH の注意

launchd から起動されるサービスの PATH は最小限で、Homebrew の `gh` が見えない。
`auto-ingest.ts` は `gh` を叩くので、ランナー直下の `.env` に PATH を書いておく。

```bash
echo 'PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' > ~/actions-runner/.env
./svc.sh stop && ./svc.sh start   # .env は起動時にしか読まれない
```

## 止める・外す

```bash
cd ~/actions-runner
./svc.sh stop && ./svc.sh uninstall
TOKEN=$(gh api -X POST repos/kentatorimoto/shintoku-platform/actions/runners/remove-token -q .token)
./config.sh remove --token "$TOKEN"
```

## 公開リポジトリでの安全性

fork からの PR で任意のコードが母艦で走ると危ない。本リポジトリのワークフローは
`schedule` / `workflow_dispatch` / `workflow_call` でしか起動せず、**`pull_request` で走るものは無い**。
この前提を崩すワークフローを足さないこと。足すなら `runs-on: ubuntu-latest` にする。

念のため Settings → Actions → General → Fork pull request workflows を
「Require approval for all external contributors」にしておく。
