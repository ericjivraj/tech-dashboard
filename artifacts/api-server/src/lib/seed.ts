import { pool } from "@workspace/db";

export async function seedIfEmpty(): Promise<void> {
  const client = await pool.connect();
  try {
    // Reseed if the database doesn't have the full expected dataset.
    // We expect 18 sprints (30-47) and specific projects. If sprints < 18 we
    // treat the DB as stale and replace all data.
    const { rows } = await client.query("SELECT COUNT(*) AS c FROM sprints");
    if (parseInt(rows[0].c, 10) >= 18) return;

    // Wipe existing data in dependency order before reseeding
    await client.query("DELETE FROM project_updates");
    await client.query("DELETE FROM project_sprint_allocations");
    await client.query("DELETE FROM project_goals");
    await client.query("DELETE FROM projects");
    await client.query("DELETE FROM goals");
    await client.query("DELETE FROM sprints");

    await client.query("BEGIN");

    await client.query(`
      INSERT INTO sprints (id, name, sprint_number, start_date, end_date) VALUES
        (30, 'Sprint 30', 30, '2026-08-05', '2026-09-02'),
        (31, 'Sprint 31', 31, '2026-09-03', '2026-09-30'),
        (32, 'Sprint 32', 32, '2026-10-01', '2026-11-04'),
        (33, 'Sprint 33', 33, '2026-11-05', '2026-12-02'),
        (34, 'Sprint 34', 34, '2026-12-03', '2026-12-30'),
        (35, 'Sprint 35', 35, '2026-12-31', '2027-02-03'),
        (36, 'Sprint 36', 36, '2027-02-04', '2027-03-03'),
        (37, 'Sprint 37', 37, '2027-03-04', '2027-04-01'),
        (38, 'Sprint 38', 38, '2027-04-02', '2027-05-05'),
        (39, 'Sprint 39', 39, '2027-05-06', '2027-06-03'),
        (40, 'Sprint 40', 40, '2027-06-04', '2027-07-01'),
        (41, 'Sprint 41', 41, '2027-07-02', '2027-07-29'),
        (42, 'Sprint 42', 42, '2027-07-30', '2027-08-26'),
        (43, 'Sprint 43', 43, '2027-08-27', '2027-09-23'),
        (44, 'Sprint 44', 44, '2027-09-24', '2027-10-21'),
        (45, 'Sprint 45', 45, '2027-10-22', '2027-11-18'),
        (46, 'Sprint 46', 46, '2027-11-19', '2027-12-16'),
        (47, 'Sprint 47', 47, '2027-12-17', '2028-01-13')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO goals (id, name, color) VALUES
        (1, 'Increase Revenue',    '#22c55e'),
        (2, 'Cost Savings',        '#3b82f6'),
        (3, 'Customer Experience', '#f59e0b')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO projects (id, title, description, sponsor, team, status, story_points, start_date, end_date, impact, sprint_id) VALUES
        (1,  'Kubernetes Platform Migration',
             'Migrate all microservices from bare-metal VMs to Kubernetes to improve scalability and resilience. Includes full cluster setup, CI/CD integration, and runbook updates.',
             'Tech', 'Development', 'in_progress', 34, '2026-03-31', '2026-05-13',
             'Enables zero-downtime deployments and horizontal scaling for all services. Estimated 40% reduction in infrastructure incidents.',
             NULL),
        (4,  'Real-Time Analytics Dashboard',
             'Build an embedded analytics layer for customers showing usage metrics, adoption rates, and feature engagement. Powered by ClickHouse with a React frontend.',
             'Business Development', 'Development', 'up_next', 34, '2026-05-13', '2026-06-24',
             'Top-3 feature request from enterprise customers. Reduces churn risk by giving customers visibility into ROI.',
             NULL),
        (5,  'Payment Gateway Upgrade',
             'Replace the legacy Stripe v2 integration with Stripe v4, including support for local payment methods, stronger SCA compliance, and improved webhook reliability.',
             'Finance', 'Development', 'blocked', 21, '2026-03-31', '2026-05-13',
             'Ensures PCI DSS compliance ahead of Q3 audit. Unlocks new payment methods for EU market expansion.',
             NULL),
        (6,  'API Rate Limiting & Throttling',
             'Implement per-tenant API rate limiting at the gateway layer to prevent abuse and ensure fair usage across the platform.',
             'Tech', 'Development', 'done', 8, '2026-01-07', '2026-02-18',
             'Eliminated 3 customer-reported incidents caused by runaway API clients. Improved 99th percentile API latency by 18%.',
             NULL),
        (13, 'Customer Data Platform (CDP)',
             'Centralise all customer behavioural data into a unified CDP. Enable marketing and customer success teams to build segments and trigger automations without engineering.',
             'Legal & Compliance', 'Data', 'backlog', 55, '2026-06-24', '2026-08-05',
             'Enables personalised comms at scale. Required for the planned loyalty programme in H2 2026.',
             NULL),
        (17, 'AI-Powered Smart Search',
             'Implement semantic search across the product using vector embeddings and LLMs. Replace current keyword-based search with intent-aware results.',
             'Marketing', 'Development', 'new_request', 44, NULL, NULL,
             'Expected 35% improvement in search-to-action conversion rate based on A/B testing in beta.',
             NULL)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO project_goals (project_id, goal_id) VALUES
        (1,2),(1,3),(4,1),(4,3),(5,2),(5,3),(6,2),(13,1),(13,3),(17,1),(17,3)
      ON CONFLICT DO NOTHING
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
      SELECT setval('sprints_id_seq',   (SELECT MAX(id) FROM sprints));
      SELECT setval('goals_id_seq',     (SELECT MAX(id) FROM goals));
      SELECT setval('projects_id_seq',  (SELECT MAX(id) FROM projects));
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
