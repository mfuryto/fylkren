export const exampleTasks = [
  { reference: 'AMA-000026', title: 'Establish an alternative communications capability', owner: 'Operations section', due: '30 Nov', priority: 'High', status: 'In progress', progress: 64 },
  { reference: 'AMA-000031', title: 'Update the local continuity plan', owner: 'Planning section', due: '04 Dec', priority: 'Normal', status: 'Planning', progress: 38 },
  { reference: 'AMA-000034', title: 'Resolve the fuel supply dependency', owner: 'Logistics unit', due: '06 Dec', priority: 'High', status: 'Waiting', progress: 22 },
  { reference: 'AMA-000039', title: 'Complete quarterly readiness follow-up', owner: 'Management support', due: '12 Dec', priority: 'Normal', status: 'Registered', progress: 8 }
] as const;

export const planningSteps = [
  { number: '01', title: 'Situation', text: 'Known disruption patterns, available equipment and affected locations are documented.', status: 'Complete' },
  { number: '02', title: 'Assignment', text: 'Provide resilient communications for the emergency management team during loss of primary services.', status: 'Complete' },
  { number: '03', title: 'Intent', text: 'Maintain a predictable command channel and restore coordinated operations within 30 minutes.', status: 'In review' },
  { number: '04', title: 'Plan', text: 'Prepare equipment, establish contact procedures and verify the capability in a limited exercise.', status: 'Draft' },
  { number: '05', title: 'Administration', text: 'Confirm staffing, equipment custody, reporting and support arrangements.', status: 'Draft' }
] as const;

export const executionSteps = [
  { title: 'Prepare equipment and contact lists', owner: 'Communications team', status: 'Completed', detail: 'Equipment checked and distributed to designated locations.' },
  { title: 'Establish the alternative channel', owner: 'Duty coordinator', status: 'In progress', detail: 'Two of three locations have confirmed connectivity.' },
  { title: 'Conduct and document the exercise', owner: 'Exercise lead', status: 'Not started', detail: 'Scheduled for 15 November at 09:00.' }
] as const;

export const risks = [
  { number: 1, title: 'Insufficient radio coverage', owner: 'Communications team', due: '10 Nov', before: { likelihood: 4, consequence: 4 }, after: { likelihood: 2, consequence: 3 }, measure: 'Test coverage and position a portable repeater.' },
  { number: 2, title: 'Key personnel unavailable', owner: 'Duty coordinator', due: '12 Nov', before: { likelihood: 3, consequence: 4 }, after: { likelihood: 2, consequence: 2 }, measure: 'Train alternates and publish an updated duty roster.' },
  { number: 3, title: 'Equipment battery depletion', owner: 'Logistics unit', due: '08 Nov', before: { likelihood: 3, consequence: 3 }, after: { likelihood: 1, consequence: 2 }, measure: 'Add charging checks and spare battery sets.' }
] as const;

export const reports = [
  { reference: 'REP-2026-041', title: 'Communications readiness — October', type: 'Status report', period: 'October 2026', state: 'Approved' },
  { reference: 'REP-2026-038', title: 'Quarterly operational follow-up', type: 'Management report', period: 'Q3 2026', state: 'Approved' },
  { reference: 'REP-2026-035', title: 'Exercise Northlight', type: 'Final report', period: 'September 2026', state: 'Published' }
] as const;

export const learningPoints = [
  { signal: 'positive', reference: 'AMA-000018', text: 'Short role cards reduced the time needed to establish the coordination team.', priority: 'High', state: 'In treatment' },
  { signal: 'negative', reference: 'AMA-000021', text: 'External contact details were stored in several places and became inconsistent.', priority: 'High', state: 'Assigned' },
  { signal: 'positive', reference: 'AMA-000023', text: 'A fifteen-minute start-up briefing improved shared situational awareness.', priority: 'Normal', state: 'Accepted' },
  { signal: 'negative', reference: 'AMA-000024', text: 'The reserve equipment checklist did not identify the responsible custodian.', priority: 'Normal', state: 'New' }
] as const;

export const templates = [
  { title: 'Operational assignment', use: 'Time-sensitive work with planning, execution and final reporting', steps: ['Register', 'Plan', 'Approve', 'Execute', 'Report', 'Learn'], color: 'teal' },
  { title: 'Maintenance action', use: 'Inspection, repair and documented return to service', steps: ['Receive', 'Assess', 'Perform', 'Verify', 'Close'], color: 'blue' },
  { title: 'Compliance follow-up', use: 'Controlled treatment of findings, evidence and approval', steps: ['Finding', 'Assign', 'Treat', 'Evidence', 'Approve'], color: 'gold' }
] as const;

export const taskDomains = [
  { title: 'Preparedness and response', detail: 'Exercises, contingency actions and coordinated response work', icon: 'shield' },
  { title: 'Maintenance and field work', detail: 'Inspections, corrective actions and verified completion', icon: 'tool' },
  { title: 'IT and service operations', detail: 'Operational changes, dependencies and service restoration', icon: 'screen' },
  { title: 'Public administration', detail: 'Assigned casework with deadlines, decisions and reporting', icon: 'building' },
  { title: 'Compliance and assurance', detail: 'Findings, measures, evidence, approvals and auditability', icon: 'check' },
  { title: 'General team execution', detail: 'Any owned task that must be planned, performed and followed up', icon: 'people' }
] as const;
