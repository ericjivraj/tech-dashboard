import { pool } from "@workspace/db";

export async function seedIfEmpty(): Promise<void> {
  const client = await pool.connect();
  try {
    // Reseed if the database doesn't have the full expected dataset.
    // We expect 9 cycles (B-J) and specific projects. If cycles < 9 we treat
    // the DB as stale and replace all data.
    const { rows } = await client.query("SELECT COUNT(*) AS c FROM cycles");
    if (parseInt(rows[0].c, 10) >= 9) return;

    // Wipe existing data in dependency order before reseeding
    await client.query("DELETE FROM project_updates");
    await client.query("DELETE FROM project_sprint_allocations");
    await client.query("DELETE FROM project_goals");
    await client.query("DELETE FROM sprint_capacity");
    await client.query("DELETE FROM projects");
    await client.query("DELETE FROM goals");
    await client.query("DELETE FROM sprints");
    await client.query("DELETE FROM cycles");

    await client.query("BEGIN");

    await client.query(`
      INSERT INTO cycles (id, name, start_date, end_date) VALUES
        (5,  'Cycle B', '2026-01-07', '2026-02-18'),
        (6,  'Cycle C', '2026-02-18', '2026-03-31'),
        (7,  'Cycle D', '2026-03-31', '2026-05-13'),
        (8,  'Cycle E', '2026-05-13', '2026-06-24'),
        (9,  'Cycle F', '2026-06-24', '2026-08-05'),
        (10, 'Cycle G', '2026-08-05', '2026-09-16'),
        (11, 'Cycle H', '2026-09-16', '2026-10-28'),
        (12, 'Cycle I', '2026-10-28', '2026-12-09'),
        (13, 'Cycle J', '2026-12-09', '2027-01-06')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO sprints (id, name, cycle_id, sprint_number, start_date, end_date) VALUES
        (41,'B/1',5,1,'2026-01-07','2026-01-21'),
        (42,'B/2',5,2,'2026-01-21','2026-02-04'),
        (43,'B/3',5,3,'2026-02-04','2026-02-18'),
        (44,'C/1',6,1,'2026-02-18','2026-03-04'),
        (45,'C/2',6,2,'2026-03-04','2026-03-18'),
        (46,'C/3',6,3,'2026-03-18','2026-03-31'),
        (47,'D/1',7,1,'2026-03-31','2026-04-15'),
        (48,'D/2',7,2,'2026-04-15','2026-04-29'),
        (49,'D/3',7,3,'2026-04-29','2026-05-13'),
        (50,'E/1',8,1,'2026-05-13','2026-05-27'),
        (51,'E/2',8,2,'2026-05-27','2026-06-10'),
        (52,'E/3',8,3,'2026-06-10','2026-06-24'),
        (53,'F/1',9,1,'2026-06-24','2026-07-08'),
        (54,'F/2',9,2,'2026-07-08','2026-07-22'),
        (55,'F/3',9,3,'2026-07-22','2026-08-05'),
        (56,'G/1',10,1,'2026-08-05','2026-08-19'),
        (57,'G/2',10,2,'2026-08-19','2026-09-02'),
        (58,'G/3',10,3,'2026-09-02','2026-09-16'),
        (59,'H/1',11,1,'2026-09-16','2026-09-30'),
        (60,'H/2',11,2,'2026-09-30','2026-10-14'),
        (61,'H/3',11,3,'2026-10-14','2026-10-28'),
        (62,'I/1',12,1,'2026-10-28','2026-11-11'),
        (63,'I/2',12,2,'2026-11-11','2026-11-25'),
        (64,'I/3',12,3,'2026-11-25','2026-12-09'),
        (65,'J/1',13,1,'2026-12-09','2026-12-19'),
        (66,'J/2',13,2,'2026-12-19','2026-12-29'),
        (67,'J/3',13,3,'2026-12-29','2027-01-06')
      ON CONFLICT (id) DO NOTHING
    `);

    // Sprint capacity (sprints 41-55 = Cycles B-F)
    const capacityRows: string[] = [];
    let capId = 1;
    for (const sprintId of [41,42,43,44,45,46,47,48,49,50,51,52,53,54,55]) {
      capacityRows.push(`(${capId++},${sprintId},'a3',27)`);
      capacityRows.push(`(${capId++},${sprintId},'backend',36)`);
      capacityRows.push(`(${capId++},${sprintId},'frontend',45)`);
    }
    await client.query(`
      INSERT INTO sprint_capacity (id, sprint_id, sub_team, capacity_points) VALUES
        ${capacityRows.join(",")}
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO goals (id, name, color) VALUES
        (1,  'Increase Bidding',           '#3b82f6'),
        (2,  'Increase Selling',           '#22c55e'),
        (3,  'Increase Consignment',       '#f59e0b'),
        (4,  'Risk Management',            '#8b5cf6'),
        (5,  'Network Synergies',          '#06b6d4'),
        (6,  'Save Staff Time',            '#f97316'),
        (7,  'Tech Capability',            '#6366f1'),
        (8,  'Data Analytics',             '#0ea5e9'),
        (9,  'Strategic: Increase EBITDA', '#dc2626'),
        (10, 'Strategic: Technology Leader','#dc2626'),
        (11, 'Strategic: Customer Relevance','#dc2626'),
        (12, 'Strategic: Talent Retention','#dc2626')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO projects (id, title, description, sponsor, team, status, confidence, story_points, start_date, end_date, impact, blocked_reason, cycle_id, sprint_id, stakeholder, completion_percent) VALUES
        (1,  'Kubernetes Platform Migration',
             'Migrate all microservices from bare-metal VMs to Kubernetes to improve scalability and resilience. Includes full cluster setup, CI/CD integration, and runbook updates.',
             'Tech', 'Development', 'in_progress', 'high', 34, '2026-03-31', '2026-05-13',
             'Enables zero-downtime deployments and horizontal scaling for all services. Estimated 40% reduction in infrastructure incidents.',
             NULL, 7, NULL, 'James Whitfield', 40),
        (4,  'Real-Time Analytics Dashboard',
             'Build an embedded analytics layer for customers showing usage metrics, adoption rates, and feature engagement. Powered by ClickHouse with a React frontend.',
             'Business Development', 'Development', 'up_next', 'high', 34, '2026-05-13', '2026-06-24',
             'Top-3 feature request from enterprise customers. Reduces churn risk by giving customers visibility into ROI.',
             NULL, 8, NULL, 'Sarah Okonkwo', 0),
        (5,  'Payment Gateway Upgrade',
             'Replace the legacy Stripe v2 integration with Stripe v4, including support for local payment methods, stronger SCA compliance, and improved webhook reliability.',
             'Finance', 'Development', 'blocked', 'at_risk', 21, '2026-03-31', '2026-05-13',
             'Ensures PCI DSS compliance ahead of Q3 audit. Unlocks new payment methods for EU market expansion.',
             'Blocked on legal sign-off for updated payment data processing agreement (DPA). Waiting on legal team - ETA unknown. Engineering is ready to proceed.',
             7, NULL, 'Linda Foster', 30),
        (6,  'API Rate Limiting & Throttling',
             'Implement per-tenant API rate limiting at the gateway layer to prevent abuse and ensure fair usage across the platform.',
             'Tech', 'Development', 'done', 'high', 8, '2026-01-07', '2026-02-18',
             'Eliminated 3 customer-reported incidents caused by runaway API clients. Improved 99th percentile API latency by 18%.',
             NULL, 5, NULL, 'James Whitfield', 100),
        (13, 'Customer Data Platform (CDP)',
             'Centralise all customer behavioural data into a unified CDP. Enable marketing and customer success teams to build segments and trigger automations without engineering.',
             'Legal & Compliance', 'Data', 'backlog', 'medium', 55, '2026-06-24', '2026-08-05',
             'Enables personalised comms at scale. Required for the planned loyalty programme in H2 2026.',
             NULL, 9, NULL, 'Priya Sharma', 0),
        (17, 'AI-Powered Smart Search',
             'Implement semantic search across the product using vector embeddings and LLMs. Replace current keyword-based search with intent-aware results.',
             'Marketing', 'Development', 'new_request', NULL, 44, NULL, NULL,
             'Expected 35% improvement in search-to-action conversion rate based on A/B testing in beta.',
             NULL, NULL, NULL, 'Priya Sharma', 0)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO project_goals (project_id, goal_id) VALUES
        (1,1),(1,4),(4,5),(4,2),(5,3),(5,2),(6,1),(6,4),(13,5),(13,2),(17,2),(17,5)
      ON CONFLICT DO NOTHING
    `);

    await client.query(`
      INSERT INTO project_sprint_allocations (id, project_id, sprint_id, sub_team, story_points) VALUES
        (1,1,47,'backend',8),(2,1,47,'frontend',4),(3,1,47,'a3',2),
        (4,1,48,'backend',7),(5,1,48,'frontend',4),(6,1,48,'a3',1),
        (7,1,49,'backend',5),(8,1,49,'frontend',2),(9,1,49,'a3',1),
        (16,6,41,'backend',3),(17,6,42,'backend',3),(18,6,43,'backend',2),
        (19,4,50,'backend',4),(20,4,50,'frontend',5),(21,4,50,'a3',3),
        (22,4,51,'backend',4),(23,4,51,'frontend',5),(24,4,51,'a3',3),
        (25,4,52,'backend',4),(26,4,52,'frontend',4),(27,4,52,'a3',2),
        (28,5,47,'backend',5),(29,5,47,'frontend',2),
        (30,5,48,'backend',5),(31,5,48,'frontend',3),
        (32,5,49,'backend',4),(33,5,49,'frontend',2)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO project_updates (id, project_id, content, author_name, created_at) VALUES
        (1, 1, 'Cluster setup complete. All 12 microservices containerised. Currently working on Helm chart configurations and namespace isolation.', 'James Whitfield', '2026-04-13 21:38:06+00'),
        (2, 1, 'CI/CD integration 80% complete. Load testing showed no regressions. Expected cutover date: May 5.', 'James Whitfield', '2026-04-17 21:38:06+00'),
        (6, 5, 'Engineering complete and tested. Awaiting legal sign-off on updated DPA. Escalated to VP Legal.', 'Linda Foster', '2026-04-12 21:38:06+00'),
        (7, 5, 'Legal confirmed DPA review will take a minimum 3 more weeks. Risk of missing Q1 compliance deadline is high.', 'Linda Foster', '2026-04-17 21:38:06+00'),
        (8, 6, 'API rate limiting shipped to production. Zero customer complaints. Monitoring looks clean.', 'James Whitfield', '2026-04-04 21:38:06+00')
      ON CONFLICT (id) DO NOTHING
    `);

    // Reset sequences so future inserts get correct auto-increment IDs
    await client.query(`
      SELECT setval('cycles_id_seq',    (SELECT MAX(id) FROM cycles));
      SELECT setval('sprints_id_seq',   (SELECT MAX(id) FROM sprints));
      SELECT setval('sprint_capacity_id_seq', (SELECT MAX(id) FROM sprint_capacity));
      SELECT setval('goals_id_seq',     (SELECT MAX(id) FROM goals));
      SELECT setval('projects_id_seq',  (SELECT MAX(id) FROM projects));
      SELECT setval('project_sprint_allocations_id_seq', (SELECT MAX(id) FROM project_sprint_allocations));
      SELECT setval('project_updates_id_seq', (SELECT MAX(id) FROM project_updates));
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
