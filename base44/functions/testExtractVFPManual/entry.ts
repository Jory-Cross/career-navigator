import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Manual testing endpoint for VFP extraction.
 * 
 * Call with: { "client_id": "..." }
 * 
 * This bypasses the automation trigger completely and directly tests
 * the extraction function to isolate whether extractVFPFromIntake itself
 * is the problem or the automation trigger.
 */

Deno.serve(async (req) => {
  const logs = [];
  logs.push(`[testExtractVFPManual] Function entered`);
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      logs.push(`[testExtractVFPManual] Unauthorized`);
      return Response.json({ error: 'Unauthorized', logs }, { status: 401 });
    }

    const { client_id } = await req.json();
    
    if (!client_id) {
      logs.push(`[testExtractVFPManual] Error: client_id required`);
      return Response.json({ error: 'client_id required', logs }, { status: 400 });
    }

    logs.push(`[testExtractVFPManual] Testing extraction for client_id=${client_id}`);

    // Fetch client to verify it exists
    const clients = await base44.entities.Client.list();
    const client = clients.find(c => c.id === client_id);
    
    if (!client) {
      logs.push(`[testExtractVFPManual] Client not found`);
      return Response.json({ error: 'Client not found', logs }, { status: 404 });
    }

    logs.push(`[testExtractVFPManual] Client found: ${client.first_name} ${client.last_name}`);
    logs.push(`[testExtractVFPManual] Current VFP fields: ${Object.keys(client.vocational_facts_profile || {}).length}`);

    // Call extractVFPFromIntake directly
    logs.push(`[testExtractVFPManual] Calling extractVFPFromIntake...`);
    
    try {
      const result = await base44.functions.invoke('extractVFPFromIntake', {
        client_id,
      });

      logs.push(`[testExtractVFPManual] extractVFPFromIntake returned successfully`);
      logs.push(`[testExtractVFPManual] Result status: ${result.data?.status}`);
      logs.push(`[testExtractVFPManual] Signals extracted: ${Object.keys(result.data?.extracted_signals || {}).length}`);
      logs.push(`[testExtractVFPManual] Sections processed: ${result.data?.intake_sections_processed}`);

      // Re-fetch client to verify VFP was persisted
      const refetchClients = await base44.entities.Client.list();
      const refetchClient = refetchClients.find(c => c.id === client_id);
      
      logs.push(`[testExtractVFPManual] AFTER EXTRACTION - VFP fields: ${Object.keys(refetchClient?.vocational_facts_profile || {}).length}`);
      logs.push(`[testExtractVFPManual] AFTER EXTRACTION - extracted_at: ${refetchClient?.vocational_facts_extracted_at}`);
      logs.push(`[testExtractVFPManual] AFTER EXTRACTION - extracted_by: ${refetchClient?.vocational_facts_extracted_by}`);

      console.log(logs.join('\n'));
      
      return Response.json({
        status: 'success',
        client_id,
        client_name: `${client.first_name} ${client.last_name}`,
        extraction_result: result.data,
        verification: {
          vfp_fields_before: Object.keys(client.vocational_facts_profile || {}).length,
          vfp_fields_after: Object.keys(refetchClient?.vocational_facts_profile || {}).length,
          extracted_at: refetchClient?.vocational_facts_extracted_at,
          extracted_by: refetchClient?.vocational_facts_extracted_by,
        },
        logs,
      });
    } catch (invokeErr) {
      logs.push(`[testExtractVFPManual] extractVFPFromIntake threw error: ${invokeErr.message}`);
      console.error(logs.join('\n'));
      return Response.json({ 
        error: `Extraction function failed: ${invokeErr.message}`,
        logs,
      }, { status: 500 });
    }
  } catch (error) {
    logs.push(`[testExtractVFPManual] FATAL: ${error.message}`);
    console.error(logs.join('\n'));
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});