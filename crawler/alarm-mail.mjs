// Alarm translator. CloudWatch's own alarm emails are unreadable walls of
// AWS jargon, so the alarms no longer email directly: an EventBridge rule
// sends each alarm state change here, and this publishes one plain-English
// email to the Alerts topic (wording in alert-text.mjs). Transitions that
// need nobody (alarms starting up after a deploy) send nothing.
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { alarmEmail } from './alert-text.mjs';

const sns = new SNSClient({});

export const handler = async (event) => {
  const email = alarmEmail(event);
  if (!email) return { sent: false };
  await sns.send(new PublishCommand({
    TopicArn: process.env.ALERTS_TOPIC_ARN,
    Subject: email.subject.slice(0, 100),
    Message: email.message,
  }));
  return { sent: true, subject: email.subject };
};
