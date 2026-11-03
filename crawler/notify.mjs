// One way to send an alert email: publish to the Alerts SNS topic. Shared
// by the crawler (lambda.mjs) and the alarm translator (alarm-mail.mjs).
// Throws on failure; callers decide whether that matters.
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { asciiSubject } from './alert-text.mjs';

const sns = new SNSClient({});

export async function publishAlert({ subject, message }) {
  const topic = process.env.ALERTS_TOPIC_ARN;
  if (!topic) throw new Error('ALERTS_TOPIC_ARN is not set');
  await sns.send(new PublishCommand({ TopicArn: topic, Subject: asciiSubject(subject), Message: message }));
}
