# 联防击杀奖励（定制 0.3.1）

这是默认关闭的自定义规则 `uniteKillReward: off | per5`，在房间中启用配套声明式插件后生效，不执行插件脚本。需要包含该规则的定制核心及插件 API 2；原版服务器不支持。

每次实际执行的联防，按各协防者（包括 AI）自身干员和召唤物记录的击杀数，每满 5 次发 1 金币；[ASSUMED] 余数在本次联防丢弃，不跨阶段累积。奖励与原有赏金一起计入待发资金，在下一次整备发放。联防无法执行的合成结果不奖励；其他作战阶段不奖励。

击杀使用 `creditedKills`（旧报告回退到干员击杀统计），不使用 `killed`：后者反映敌人所属战场，而不是击杀者。项目现有客户端结果校验只检查范围，`creditedKills` 不是现有结果摘要的一部分；因此客户端权威作战模式下，该字段不能作为防作弊依据，即使启用现有的 SP_VERIFY。仅与可信玩家游玩时使用；需要服务端权威结果时使用 `SP_COMBAT=server`，或在后续实现独立服务端验证。

此插件与联防快进、战斗倍速独立启用。更新服务器需构建包含核心补丁的新镜像，同时保留插件卷、素材、字体和本地素材清单；使用独立测试端口验证后再切换。没有核心支持的旧服务器会拒绝此规则。

检查：`node --test test/match/uniteKillReward.test.js`，`node tools/plugin.mjs check unite-kill-reward --strict`，`node tools/plugin.mjs pack unite-kill-reward --zip`。
