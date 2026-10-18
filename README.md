# 电商数据分析作品集

四个业务分析案例采用统一导航、报告入口、交互看板与指标附录。

**[在线作品集](https://oi-ctfsky.github.io/ecommerce-analysis-portfolio/)**

| 案例 | 分析主线 | 在线查看 |
|---|---|---|
| 用户转化漏斗与留存 | 7天有序用户漏斗、首访队列、D1/D7/D30访问留存 | [查看](https://oi-ctfsky.github.io/ecommerce-analysis-portfolio/funnel.html) |
| 会员复购与价值分层 | 快照RFM、互斥分层、独立次月再购、成熟首购队列 | [查看](https://oi-ctfsky.github.io/ecommerce-analysis-portfolio/members.html) |
| 退货退款归因与经营改善 | 售后状态去重、商品行分母、退款金额、商品与尺码下钻 | [查看](https://oi-ctfsky.github.io/ecommerce-analysis-portfolio/refunds.html) |
| 既有达人种草分析 | 21天观察窗口、达人筛选、内容双效矩阵 | [独立项目](https://oi-ctfsky.github.io/ecommerce-analysis-portfolio/seeding.html) |

## 数据与结论

三个模拟案例的数据由固定随机种子20261018生成，不含真实企业或个人资料，不代表真实工作业绩。渠道购买倾向、会员购买频次及售后概率有模拟设定，结果用于演示分析方法。所有建议均未作为已执行的提升成果呈现。

会员价值使用观察期已实现净销售，未计算利润LTV或预测终身价值。退款原因是填报标签，未据此认定因果。三个模拟数据集之间不连接用户与金额。

## 复现

仅需Python 3标准库：

```sh
python reproduce.py
python verify.py
```

`reproduce.py`生成CSV、看板数据与校验摘要；`verify.py`将CSV导入SQLite，执行`analysis.sql`并逐组核对。`metric-definitions.md`提供完整指标与数据字典。改变生成参数后需同步更新HTML中的基线论证。

## 查看

静态HTML/CSS/JavaScript，无构建步骤和外部依赖。打开`index.html`，或在本目录运行`python -m http.server 8000`后访问本地地址。可通过GitHub Pages从main分支根目录发布。

每页支持日期与业务维度筛选、匿名样本下钻、当前汇总CSV导出、打印/保存PDF。报告文字为全样本基线；下方看板随筛选变化。


## 统一导航与图表

四个项目均提供“案例报告 / 交互看板 / 指标口径 / 作品集首页 / 打印保存PDF”。达人种草另设经营复盘。转化看板使用漏斗与渠道趋势，会员看板使用分层环图、RFM散点和队列热力表，退款看板使用商品双指标对比、支付周趋势和原因环图；所有汇总随筛选联动。
