// Alarm translator. CloudWatch's own alarm emails are unreadable walls of
// AWS jargon, so the alarms no longer email directly: an EventBridge rule
// sends each alarm state change here, and this publishes one plain-English
// email to the Alerts topic (wording in alert-text.mjs). Transitions that
// need nobody (alarms starting up after a deploy) send nothing. If this
// function itself errors, the AlarmMailFailing alarm emails directly.
import { alarmEmail } from './alert-text.mjs';
import { publishAlert } from './notify.mjs';

export const handler = async (event) => {
  const email = alarmEmail(event);
  if (!email) return { sent: false };
  await publishAlert(email);
  return { sent: true, subject: email.subject };
};
