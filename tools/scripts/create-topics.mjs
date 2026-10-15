#!/usr/bin/env node
/**
 * Creates every Kafka topic (plus its `.dlq` twin) with the partition counts declared in
 * libs/contracts. Run once against a fresh cluster:
 *
 *   KAFKA_BROKERS=localhost:29092 npm run kafka:topics
 *
 * Auto-creation is disabled on the broker so that partition counts are always an
 * explicit decision - a topic created implicitly gets the broker default, and Kafka
 * cannot reduce partitions afterwards.
 *
 * Services also call `KafkaAdminService.ensureTopics()` on boot when
 * KAFKA_AUTO_CREATE_TOPICS=true, so this script is for CI/ops rather than a hard
 * prerequisite in dev.
 */
import { Kafka, logLevel } from 'kafkajs';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Reads the topic registry straight out of the TypeScript source, so there is one list. */
function loadTopicRegistry() {
  const source = readFileSync(join(root, 'libs/contracts/src/lib/events/topics.ts'), 'utf8');

  const topics = [...source.matchAll(/^\s+[A-Z_]+:\s+'([a-z0-9.-]+)',/gm)].map((m) => m[1]);

  const partitions = {};
  const block = source.match(/TOPIC_PARTITIONS[^{]*\{([\s\S]*?)\};/);
  if (block) {
    for (const m of block[1].matchAll(/\[KafkaTopics\.([A-Z_]+)\]:\s*(\d+)/g)) {
      const key = m[1];
      const value = source.match(new RegExp(`^\\s+${key}:\\s+'([a-z0-9.-]+)'`, 'm'))?.[1];
      if (value) partitions[value] = Number(m[2]);
    }
  }

  const defaults = Number(source.match(/DEFAULT_PARTITIONS = (\d+)/)?.[1] ?? 6);
  const replication = Number(source.match(/DEFAULT_REPLICATION_FACTOR = (\d+)/)?.[1] ?? 1);

  return { topics: [...new Set(topics)], partitions, defaults, replication };
}

function loadEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:29092').split(',');
const { topics, partitions, defaults, replication } = loadTopicRegistry();

const kafka = new Kafka({ clientId: 'topic-setup', brokers, logLevel: logLevel.WARN });
const admin = kafka.admin();

try {
  await admin.connect();
  const existing = new Set(await admin.listTopics());

  const wanted = [...topics, ...topics.map((t) => `${t}.dlq`)];
  const missing = wanted.filter((t) => !existing.has(t));

  if (missing.length === 0) {
    console.log(`[topics] all ${wanted.length} topics already exist on ${brokers.join(',')}`);
  } else {
    await admin.createTopics({
      waitForLeaders: true,
      topics: missing.map((topic) => ({
        topic,
        numPartitions: partitions[topic] ?? defaults,
        replicationFactor: replication,
        configEntries: [
          { name: 'retention.ms', value: String(7 * 24 * 3600 * 1000) },
          { name: 'cleanup.policy', value: 'delete' },
        ],
      })),
    });
    console.log(`[topics] created ${missing.length} topics:`);
    for (const topic of missing) {
      console.log(`  - ${topic} (${partitions[topic] ?? defaults} partitions)`);
    }
  }
} finally {
  await admin.disconnect();
}
