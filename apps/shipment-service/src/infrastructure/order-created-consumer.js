import { Kafka } from 'kafkajs';
import { logger } from '@ecommerce/shared';
import { processOrderCreated } from './shipment-repository.js';

const kafka = new Kafka({
  clientId: 'shipment-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
  retry: { retries: 10 },
});
const consumer = kafka.consumer({ groupId: 'shipment-service-order-created-v1' });

export async function startOrderCreatedConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order-created', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        const result = await processOrderCreated(event);
        if (result.failed) logger.warn({ eventId: event?.event_id }, 'Invalid OrderCreated event recorded');
        else if (result.duplicate) logger.info({ eventId: event.event_id }, 'Duplicate event ignored');
        else logger.info({ eventId: event.event_id, shipid: result.shipid }, 'Shipment created');
      } catch (error) {
        logger.error({ error }, 'OrderCreated event processing failed');
        throw error;
      }
    },
  });
}

