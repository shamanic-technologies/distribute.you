-- One row per arm of the open-tracking comparison, aggregated in the instantly_service DB.
-- Read-only. :cutoff is an exclusive upper bound on the sequence's creation, set 14 days
-- before the read so every counted sequence had time to draw its replies.
--
-- Arm = whether the tracking pixel was in the email:
--   on  : an Instantly campaign whose FIRST stored config says open_tracking = true
--   off : open_tracking = false, or a sequence we dispatched ourselves (self:), which never
--         carries a pixel
-- A sequence with no stored config that is not self-sent cannot be placed: it is counted
-- under "unplaced" and left out of both arms.
-- A lead counts once. Only real events count (inferred = false): an inferred open or send
-- is a projection, not an observation.
WITH first_cfg AS (
  SELECT DISTINCT ON (instantly_campaign_id) instantly_campaign_id, payload->>'open_tracking' AS ot
  FROM instantly_campaigns_config_raw
  ORDER BY instantly_campaign_id, fetched_at
),
ev AS (
  SELECT campaign_id,
    count(DISTINCT step) FILTER (WHERE event_type = 'email_sent') AS emails,
    bool_or(event_type IN ('reply_received','lead_interested','lead_referral','lead_info_requested',
      'lead_meeting_requested','lead_meeting_booked','lead_closed','lead_not_interested',
      'lead_wrong_person','lead_changed_job','lead_opt_out_requested','lead_neutral')) AS replied,
    bool_or(event_type IN ('auto_reply_received','lead_out_of_office')) AS auto_replied,
    bool_or(event_type = 'email_bounced') AS bounced,
    bool_or(event_type = 'email_link_clicked') AS clicked,
    bool_or(event_type = 'lead_unsubscribed') AS unsubscribed,
    bool_or(event_type = 'email_opened') AS opened
  FROM instantly_events
  WHERE NOT inferred
  GROUP BY campaign_id
),
seq AS (
  SELECT
    CASE WHEN c.instantly_campaign_id LIKE 'self:%' THEN 'off'
         WHEN f.ot = 'true' THEN 'on'
         WHEN f.ot = 'false' THEN 'off'
         ELSE 'unplaced' END AS arm,
    c.created_at, c.reply_classification, ev.*
  FROM instantly_campaigns c
  JOIN ev ON ev.campaign_id = c.instantly_campaign_id
  LEFT JOIN first_cfg f USING (instantly_campaign_id)
  WHERE ev.emails > 0 AND c.created_at < :'cutoff'::date
)
SELECT json_build_object(
  'readAt', now(),
  'cutoff', :'cutoff',
  'arms', (SELECT json_agg(a ORDER BY a.arm) FROM (
    SELECT arm,
      count(*) AS leads,
      sum(emails)::int AS emails,
      count(*) FILTER (WHERE replied) AS replied,
      count(*) FILTER (WHERE reply_classification = 'positive') AS positive,
      count(*) FILTER (WHERE auto_replied) AS auto_replied,
      count(*) FILTER (WHERE bounced) AS bounced,
      count(*) FILTER (WHERE NOT bounced) AS delivered,
      count(*) FILTER (WHERE replied AND NOT bounced) AS replied_delivered,
      count(*) FILTER (WHERE clicked) AS clicked,
      count(*) FILTER (WHERE unsubscribed) AS unsubscribed,
      count(*) FILTER (WHERE opened) AS opened,
      min(created_at)::date AS first_day,
      max(created_at)::date AS last_day
    FROM seq GROUP BY arm) a)
);
