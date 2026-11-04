import { Kafka } from 'kafkajs';
import { logger } from '@ecommerce/shared';
import { markOutboxAttempt, markOutboxPublished, pendingOutboxEvents } from './order-repository.js';

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
  retry: { retries: 10 },
});
const producer = kafka.producer();
let publishing = false;

async function publishBatch() {
  if (publishing) return;
  publishing = true;
  try {
    const events = await pendingOutboxEvents();
    for (const event of events) {
      try {
        await producer.send({
          topic: 'order-created',
          messages: [{ key: event.aggregate_id, value: JSON.stringify(event.payload) }],
        });
        await markOutboxPublished(event.event_id);
      } catch (error) {
        await markOutboxAttempt(event.event_id).catch(() => {});
        logger.error({ error, eventId: event.event_id }, 'Failed to publish outbox event');
      }
    }
  } finally {
    publishing = false;
  }
}

export async function startOutboxPublisher() {
  await producer.connect();
  await publishBatch();
  const timer = setInterval(() => publishBatch().catch((error) => logger.error({ error }, 'Outbox loop failed')), 2000);
  timer.unref();
}

