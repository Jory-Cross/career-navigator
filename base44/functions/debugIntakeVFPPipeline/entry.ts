import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Debug utility to inspect intake sections and VFP state for a client.
 * Shows what intake data exists and what was extracted into VFP.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id } = await req.json();
    if (!client_id) {
      return Response.json({ error: 'client_id required' }, { status: 400 });
    }

    const logs = [];
    logs.push(`[debugIntakeVFPPipeline] client_id: ${client_id}`);

    // Fetch client
    const clients = await base44.entities.Client.list();
    const client = clients.find(c => c.id === client_id);
    if (!client) {
      logs.push(`[debugIntakeVFPPipeline] ERROR: Client not found`);
      return Response.json({ error: 'Client not found', logs }, { status: 404 });
    }

    logs.push(`[debugIntakeVFPPipeline] Client: ${client.first_name} ${client.last_name}`);

    // Fetch all IntakeSections (all statuses)
    const allIntakeSections = await base44.entities.IntakeSection.filter({ client_id });
    logs.push(`[debugIntakeVFPPipeline] Total IntakeSections: ${(allIntakeSections || []).length}`);

    const intakeSummary = [];
    if (allIntakeSections && allIntakeSections.length > 0) {
      for (const section of allIntakeSections) {
        const answerKeys = Object.keys(section.answers || {});
        intakeSummary.push({
          id: section.id,
          section_key: section.section_key,
          status: section.status,
          answer_count: answerKeys.length,
          answer_keys: answerKeys,
          completed_at: section.completed_at,
        });
        logs.push(`  [${section.section_key}] status=${section.status}, answers=${answerKeys.length}, keys=${answerKeys.join(', ')}`);
      }
    }

    // Check VFP state
    const vfp = client.vocational_facts_profile || {};
    logs.push(`[debugIntakeVFPPipeline] Current VFP fields: ${Object.keys(vfp).length}`);
    logs.push(`[debugIntakeVFPPipeline] VFP keys: ${Object.keys(vfp).join(', ')}`);

    // Check for intake extraction metadata
    const intakeMetadata = vfp._intake_signals || {};
    logs.push(`[debugIntakeVFPPipeline] Intake extraction metadata present: ${Object.keys(intakeMetadata).length > 0}`);
    logs.push(`[debugIntakeVFPPipeline] Last extraction: ${vfp._intake_extracted_at || 'never'}`);
    logs.push(`[debugIntakeVFPPipeline] Extracted by: ${vfp._intake_extracted_by || 'unknown'}`);

    const logStr = logs.join('\n');
    console.log(logStr);

    return Response.json({
      client_id,
      client_name: `${client.first_name} ${client.last_name}`,
      intake_sections: intakeSummary,
      vfp_state: {
        total_fields: Object.keys(vfp).length,
        field_names: Object.keys(vfp),
        has_intake_metadata: Object.keys(intakeMetadata).length > 0,
        last_extracted_at: vfp._intake_extracted_at,
        extraction_source_count: vfp._intake_sources_count,
      },
      logs,
    });
  } catch (error) {
    console.error('[debugIntakeVFPPipeline] ERROR:', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});