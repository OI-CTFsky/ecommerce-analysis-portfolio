-- Executable SQLite 3 reference queries. Input tables are named after CSV files
-- with '-' replaced by '_', without the .csv extension; see verify.py.
-- All amounts are integer CNY cents. All data is synthetic.

-- QUERY: funnel
WITH first_view_rank AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time,event_id) AS rn
  FROM funnel_events WHERE event_type='view'
), v AS (
  SELECT user_id,channel,event_time AS view_time,event_day AS cohort
  FROM first_view_rank WHERE rn=1
), c AS (
  SELECT v.*, MIN(e.event_time) AS cart_time FROM v
  LEFT JOIN funnel_events e ON e.user_id=v.user_id AND e.event_type='cart'
    AND e.event_time>=v.view_time AND e.event_day<=DATE(v.cohort,'+7 day')
  GROUP BY v.user_id
), o AS (
  SELECT c.*, MIN(e.event_time) AS order_time FROM c
  LEFT JOIN funnel_events e ON e.user_id=c.user_id AND e.event_type='order'
    AND e.event_time>=c.cart_time AND e.event_day<=DATE(c.cohort,'+7 day')
  GROUP BY c.user_id
), p AS (
  SELECT o.*, MIN(e.event_time) AS pay_time FROM o
  LEFT JOIN funnel_events e ON e.user_id=o.user_id AND e.event_type='pay'
    AND e.event_time>=o.order_time AND e.event_day<=DATE(o.cohort,'+7 day')
  GROUP BY o.user_id
)
SELECT channel,COUNT(*) AS view_uv,COUNT(cart_time) AS cart_uv,
  COUNT(order_time) AS order_uv,COUNT(pay_time) AS pay_uv
FROM p GROUP BY channel ORDER BY channel;

-- QUERY: retention
WITH cohort AS (
  SELECT user_id,MIN(event_day) AS first_day FROM funnel_events
  WHERE event_type='view' GROUP BY user_id
), active AS (
  SELECT DISTINCT user_id,event_day FROM funnel_events
  WHERE event_type IN ('view','visit')
), lags(k) AS (VALUES(1),(7),(30))
SELECT SUBSTR(c.first_day,1,7) AS cohort_month,l.k,
  COUNT(*) AS eligible_users,COUNT(a.user_id) AS retained_users
FROM cohort c CROSS JOIN lags l
LEFT JOIN active a ON a.user_id=c.user_id AND a.event_day=DATE(c.first_day,'+'||l.k||' day')
WHERE DATE(c.first_day,'+'||l.k||' day')<='2025-07-31'
GROUP BY cohort_month,l.k ORDER BY cohort_month,l.k;

-- QUERY: members
WITH hist AS (
  SELECT *,paid_cents-CASE WHEN refund_day<>'' AND refund_day<='2025-06-30'
    THEN refund_cents ELSE 0 END AS net FROM member_orders
  WHERE paid_day BETWEEN '2025-01-01' AND '2025-06-30'
), features AS (
  SELECT member_id,CAST(JULIANDAY('2025-06-30')-JULIANDAY(MAX(paid_day)) AS INTEGER) AS r,
    COUNT(DISTINCT order_id) AS f,SUM(net) AS m
  FROM hist WHERE net>0 GROUP BY member_id
), thresholds AS (
  SELECT
    (SELECT r FROM features ORDER BY r LIMIT 1 OFFSET (SELECT (COUNT(*)+1)/2-1 FROM features)) AS r50,
    (SELECT f FROM features ORDER BY f LIMIT 1 OFFSET (SELECT (COUNT(*)*75+99)/100-1 FROM features)) AS f75,
    (SELECT m FROM features ORDER BY m LIMIT 1 OFFSET (SELECT (COUNT(*)*75+99)/100-1 FROM features)) AS m75
), segments AS (
  SELECT features.*,CASE
    WHEN r<=r50 AND f>=f75 AND m>=m75 THEN '高价值活跃'
    WHEN r>r50 AND f>=f75 THEN '高频沉睡待核查'
    WHEN r<=r50 AND f=1 THEN '近期首购待培育'
    WHEN r>r50 AND f=1 THEN '首购后沉默'
    ELSE '常规维护' END AS segment
  FROM features CROSS JOIN thresholds
), future AS (
  SELECT member_id,COUNT(DISTINCT order_id) AS next_orders,
    SUM(paid_cents-refund_cents) AS next_net
  FROM member_orders WHERE paid_day BETWEEN '2025-07-01' AND '2025-07-31'
    AND paid_cents-refund_cents>0 GROUP BY member_id
)
SELECT segment,COUNT(*) AS members,SUM(s.f) AS historical_orders,SUM(s.m) AS historical_net,
  SUM(CASE WHEN f.next_orders>0 THEN 1 ELSE 0 END) AS next_buyers,
  SUM(COALESCE(f.next_net,0)) AS next_net
FROM segments s LEFT JOIN future f USING(member_id)
GROUP BY segment ORDER BY segment;

-- QUERY: refunds
WITH latest AS (
  SELECT *,ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY status_day DESC) AS rn
  FROM refund_status_history WHERE status_day<='2025-08-31'
), base AS (
  SELECT i.*,l.status AS latest_status,l.refund_cents AS latest_refund
  FROM refund_items i LEFT JOIN latest l ON i.id=l.item_id AND l.rn=1
  WHERE DATE(i.day,'+30 day')<='2025-08-31'
)
SELECT product,COUNT(*) AS paid_items,SUM(apply) AS requested_items,
  SUM(CASE WHEN latest_status='退款成功' THEN 1 ELSE 0 END) AS successful_items,
  SUM(paid) AS paid_cents,SUM(COALESCE(latest_refund,0)) AS refund_cents
FROM base GROUP BY product ORDER BY product;
