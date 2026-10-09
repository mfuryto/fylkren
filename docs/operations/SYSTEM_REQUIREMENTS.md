# System requirements and capacity planning

These figures are initial sizing profiles, not verified limits or performance guarantees. Validate the selected profile against the actual organizational structure, concurrency, task volume, report size, audit history, notifications and response-time requirements before production use.

Registered users are not the primary capacity driver. Concurrent activity, request rate and retained data matter more. An installation with 1,000 registered users and 15 active users may need roughly the same resources as one with 100 registered users and the same concurrency. The profiles assume that Fylkren stores document references, not document files.

## Initial sizing profiles

| Registered users | Typical concurrent activity | Suggested starting profile | Notes |
| --- | --- | --- | --- |
| 10–50 | 1–10 | 1–2 vCPU, 2 GB RAM, 20 GB SSD | One Docker Compose server and one API instance |
| 50–100 | 5–20 | 2 vCPU, 4 GB RAM, 40 GB SSD | Expected normal single-server profile |
| 100–1,000 | 5–50 | 2–4 vCPU, 4–8 GB RAM, 40–100 GB SSD | May match the smaller profile when concurrency and retained data are similar |
| 1,000+ | Measure; usually a fraction of accounts | Start with 4 vCPU, 8 GB RAM and 100 GB SSD for moderate concurrency | Account count alone does not require multiple API instances or a separate database host |

Figures cover the web gateway, API and database. Fylkren is a compact modular monolith that primarily stores structured text and references. Large task trees, long retention or unusually high concurrency may require more resources.

## Capacity drivers

### API and memory

API memory is driven by concurrent requests, task/report payload size, serialization, identity adapters and instance count. Monitor process memory, response time, failure rate, queue length and restarts. Many inactive accounts consume little API memory.

### PostgreSQL

Persistent capacity is primarily driven by tasks and recursive subtasks, workflow steps, autosaved text, timelines, final reports, classifications, audit events, notification delivery, organization/identity history, indexes, WAL and temporary workspace. PostgreSQL benefits from available page-cache memory; database RAM and fast storage often matter more than extra memory for one API process.

### Storage and backup

Plan local capacity for more than the database itself:

```text
required local capacity = active database + indexes + WAL/temp + upgrade margin + at least 30% free space
```

Backups must use a separate storage target and follow the retention policy. A backup on the database disk is not disaster recovery. Measure real database growth during a representative period and extrapolate it across the required retention window.

## Requirements for every profile

- a supported 64-bit Linux host, or Windows Server 2022/2025 with Hyper-V and a
  dedicated supported 64-bit Linux VM as documented in
  [Windows Server installation](WINDOWS_SERVER_INSTALLATION.md);
- SSD-backed active storage;
- a stable clock and correct timezone;
- daily automated backup and regular restore tests;
- monitoring of CPU, RAM, disk, I/O, database connections, response time and service restarts;
- TLS except in a strictly bounded trusted internal network;
- separate capacity for reverse proxy, identity provider, SMTP and backup storage when they share the host.

An isolated installation must also provide the applicable internal DNS, NTP, PKI, backup, security-log and optional integration services listed in the [air-gapped service matrix](DEPLOYMENT_AND_OFFLINE.md#internal-services-for-an-air-gapped-network). Core runtime operation requires no vendor cloud or internet route.

## Production capacity verification

High availability, high expected concurrency or security-critical use requires a documented capacity test. The representative dataset must cover expected sites, organization depth, active and completed tasks, subtasks, workflow steps, report length and audit volume.

At minimum, measure:

- login and loading of Overview, Tasks, Planning, Execution and Reports;
- registration, delegation and reporting across multiple levels and sites;
- search, filtering and pagination with the expected history;
- concurrent autosaves and notification events;
- database growth, WAL production and backup/restore duration;
- restart, database interruption and low-disk behavior.

Published supported profiles require repeatable results that identify the Fylkren version, hardware, topology, dataset, concurrency and acceptance criteria.
