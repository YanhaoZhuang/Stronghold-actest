# 联防快进：定制版安装与回滚

此功能是服主要求的可选玩法，不是官方规则。开发基线为 Stronghold-Protocol 0.3.1，
提交 `c9d804f470b8d7422ae04eb66faf671cef21ad52`，插件 manifest 2 / API 2。
实际运行容器的镜像 ID、宿主机提交仍须按下文记录；宿主机源码不一定等于旧镜像中的源码。

## 使用规则

安装配套 `unite-fast-forward-1.0.0.zip` 后，由房主在房间玩法插件中启用“快进联防”。
安装本身不会给所有房间强制启用。联防信息区显示同意人数；真人协防者全票同意才触发。
同意可以撤回；断线清除未执行的票且不视为同意。AI 不投票，只有 AI 不自动触发。
观战者、漏怪但没有协防的玩家、已淘汰玩家不能投票。

快进重放真实战斗，保留击杀、召唤、技能、超时与原玩家漏怪扣血，不是清空怪物。
计算时显示“正在快速结算”，结束走原版 LP 上限、悬赏、淘汰和回合推进。
15 秒墙钟超时或计算出错时不提交部分结果，恢复正常战斗并清除投票。
单人模拟、普通作战、最终攻势和隐秘核心不受影响。

兼容限制：需要本补丁的服务器和网页代码；原版闭合规则校验器会以 `PLUGIN_RULES` 拒绝未知开关。
此版不能与 `script` / `trusted` 脚本插件同时启用，内容组合时明确拒绝。
纯声明式内容插件可组合；它们的数据与官方数值边界快照一并传入工作线程。

## 实现与复现测试

- `rules.uniteFastForward`: `off`（缺省）或 `unanimous`，进入内容 hash 与房间规则说明。
- 请求 `g.uniteFast { round, phaseId, agree }`。身份来自连接；客户端不能指定投票人。
- `m.public.unite.fastForward`: `phaseId, round, status, eligible, votes, failed`。
  状态为 `waiting / running / complete`，重连通过常规公开状态恢复。
- `server/match/match/uniteFast.js` 管理资格、投票和阶段完成锁。
- `server/match/uniteFastJob.js` 启动限时工作线程；`uniteFastWorker.js` 使用原版
  `createBattleFromSpec` 和固定步长从服务器保存的输入重放。
- 此版本自动战斗没有人工战斗指令，已接受的战斗操作历史为空。
  若未来新增战斗内技能/部署指令，必须补充确定性的日志重放后才能继续使用此功能。
- 快进开始后的浏览器战斗报告不作为结果；正常服务器模拟可以继续作为恢复路径，
  但其完成不能绕过同一阶段完成锁。失败时客户端模式由服务器正常接管。
- 工作线程使用与房间一致的数据及边界，不重新请求远程素材；不修改模拟公式或随机数顺序。

```bash
npm ci
node --test test/match/uniteFast.test.js test/plugins/rules.test.js
node tools/plugin.mjs check unite-fast-forward --strict --json
node tools/i18n.mjs check --all --strict
npm run ci -- --keep-going
npm run golden
```

浏览器专项测试（须安装 Chrome；Windows 在 PowerShell 用 `$env:变量名='值'` 设置环境变量）：

```bash
SP_UNITE_UI=1 CHROME_PATH=/usr/bin/google-chrome \
  node --test test/ui/uniteFast.browser.test.js
```

覆盖桌面 1920×1080、手机横屏 844×390、竖屏 390×844 的原生顶栏组件、点击、撤回、
计算中禁用和旁观状态。截图位于 `test/e2e/out/`。不需要下载官方美术素材。
正式部署后仍应在实际 2 核 4 GB 机器上用代表性对局验证耗时和另一个房间的通信；
本地测试速度不能当作云服务器保证。

## 1. 先备份正在运行的容器

以下命令在阿里云 Ubuntu 的 SSH 终端执行。默认旧容器名为 `stronghold`。
备份素材从当前容器复制，保留之前在容器内补齐的文件；不能只备份宿主机源码。
执行期间不要在工作台安装、删除插件。

```bash
cd ~/Stronghold-Protocol
git rev-parse HEAD
BACKUP="$HOME/stronghold-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
docker inspect stronghold > "$BACKUP/container-inspect.json"
docker inspect --format '{{.Image}}' stronghold > "$BACKUP/image-id.txt"
git rev-parse HEAD > "$BACKUP/host-commit.txt"
git diff --binary > "$BACKUP/host-changes.patch"
docker cp stronghold:/app/public/assets "$BACKUP/assets"
docker cp stronghold:/app/public/fonts "$BACKUP/fonts"
docker cp stronghold:/app/data "$BACKUP/data"
docker cp stronghold:/app/plugins "$BACKUP/plugins"
docker image tag "$(cat "$BACKUP/image-id.txt")" stronghold-protocol:before-unite
printf '%s\n' "$BACKUP" > "$HOME/stronghold-backup-path.txt"
du -sh "$BACKUP"
```

确认复制无报错，备份里能看到素材、插件和配置。`container-inspect.json` 可能有环境变量，
留在服务器上，不要公开分享。新镜像只挂载美术目录和素材清单，不能用旧的整个 `data/`
覆盖新版游戏逻辑数据。若你额外使用 `local-assets.json`、`local-fx.json`，按原部署配置保留相应挂载。

## 2. 在独立目录应用补丁、构建

把交付的补丁和插件 ZIP 上传到 `~/unite-release/`。
下列独立目录名尚不存在时执行；不要覆盖当前项目目录。

```bash
cd ~
git clone https://github.com/sganggs/Stronghold-Protocol.git Stronghold-Protocol-unite
cd ~/Stronghold-Protocol-unite
git checkout --detach c9d804f470b8d7422ae04eb66faf671cef21ad52
git apply --check ~/unite-release/unite-fast-forward.patch
git apply ~/unite-release/unite-fast-forward.patch
docker build --build-arg FETCH_ASSETS=0 -t stronghold-protocol:unite-1.0.0 .
```

`git apply --check` 失败就不要继续套补丁：先核对版本，不使用强制覆盖。
原 Dockerfile 已复制整个服务端目录，因此工作线程文件会进入镜像。这里复用备份素材，
不重复在线下载。此包提供构建源码和说明，不包含已构建的 Docker 镜像。

## 3. 独立端口试运行

保留旧容器运行。先复制插件目录，测试容器不共用生产插件卷的可写内容。

```bash
BACKUP="$(cat "$HOME/stronghold-backup-path.txt")"
TESTROOT="$HOME/stronghold-unite-runtime"
mkdir -p "$TESTROOT"
cp -a "$BACKUP/plugins" "$TESTROOT/plugins"
sudo chown -R 1000:1000 "$TESTROOT/plugins"
docker run -d --name stronghold-unite-test \
  -p 127.0.0.1:3001:3000 --cpus=2 --memory=4g \
  -e SP_COMBAT=client -e SP_VERIFY=off \
  -v "$BACKUP/assets:/app/public/assets:ro" \
  -v "$BACKUP/fonts:/app/public/fonts:ro" \
  -v "$BACKUP/data/assets.json:/app/data/assets.json:ro" \
  -v "$TESTROOT/plugins:/app/plugins" \
  stronghold-protocol:unite-1.0.0
docker cp ~/unite-release/unite-fast-forward-1.0.0.zip stronghold-unite-test:/tmp/unite.zip
docker exec stronghold-unite-test node tools/plugin.mjs install /tmp/unite.zip
docker exec stronghold-unite-test node tools/plugin.mjs check unite-fast-forward --strict
curl --fail http://127.0.0.1:3001/healthz
docker logs --tail 50 stronghold-unite-test
```

若原容器有额外环境变量或挂载，以备份的启动配置补齐，不能丢掉已有反向代理配置。
在自己 Windows 的 PowerShell 保持 SSH 转发窗口打开：

```powershell
ssh -L 3001:127.0.0.1:3001 root@8.134.79.161
```

浏览器访问 `http://localhost:3001`。新建同盟房间，在房间插件选择器启用“快进联防”。
验证一人和两人协防、撤回、断线重连、自然结束、生命值与悬赏，并用另一浏览器同时开一个房间。
运行 `docker stats stronghold-unite-test` 观察资源使用。两套服务并行会竞争这台 2 核机器，
建议在原服空闲时做性能验证。

浏览器缓存按来源隔离，`localhost:3001` 重新获取素材是预期行为，不能据此判断生产缓存失效。

## 4. 没有进行中的对局时切换

先确认测试通过、生产和测试房间都已结束。保留旧容器，不删除它的可写层或插件卷。
若存在同名备份容器，先给本次备份选择新的名字，不能覆盖。

```bash
BACKUP="$(cat "$HOME/stronghold-backup-path.txt")"
TESTROOT="$HOME/stronghold-unite-runtime"
docker stop stronghold-unite-test
docker stop stronghold
docker rename stronghold stronghold-before-unite
docker run -d --name stronghold --restart unless-stopped -p 3000:3000 \
  -e SP_COMBAT=client -e SP_VERIFY=off \
  -v "$BACKUP/assets:/app/public/assets:ro" \
  -v "$BACKUP/fonts:/app/public/fonts:ro" \
  -v "$BACKUP/data/assets.json:/app/data/assets.json:ro" \
  -v "$TESTROOT/plugins:/app/plugins" \
  stronghold-protocol:unite-1.0.0
curl --fail http://127.0.0.1:3000/healthz
docker logs --tail 50 stronghold
```

玩家刷新网页加载新的前端代码；新房间按需启用插件。之前补齐的素材通过只读挂载保留。
测试容器不要与生产容器同时启动并写同一个插件目录。

## 5. 关闭功能与回滚

仅关闭功能：新建房间时取消“快进联防”；若曾设置 `plugins/config.json` 的 `default`，
从该列表删除插件 ID。已开局房间使用开局时的规则，不中途改规则。

回滚整套程序：等对局结束后执行，保留失败容器便于排查：

```bash
docker stop stronghold
docker rename stronghold stronghold-unite-stopped
docker rename stronghold-before-unite stronghold
docker start stronghold
curl --fail http://127.0.0.1:3000/healthz
```

原容器和原插件卷未被测试配置覆盖，素材修复仍在旧可写层里。回滚后玩家刷新页面。
不要执行 `docker system prune`、删除旧容器、旧镜像或备份目录，直到确认不再需要回滚。
