import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Identify and display remaining UNKNOWN values
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const fields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const unknownSourceFormCode = fields.filter(f => !f.source_form_code || f.source_form_code === 'UNKNOWN');
    const unknownDataSourceLayer = fields.filter(f => !f.data_source_layer || f.data_source_layer === 'unknown');

    const result = {
      total_active_fields: fields.length,
      unknown_source_form_code_count: unknownSourceFormCode.length,
      unknown_data_source_layer_count: unknownDataSourceLayer.length,
      unknown_source_form_code_fields: unknownSourceFormCode.map(f => ({
        field_key: f.field_key,
        entry_type_code: f.entry_type_code,
        current_value: f.source_form_code
      })),
      unknown_data_source_layer_fields: unknownDataSourceLayer.map(f => ({
        field_key: f.field_key,
        entry_type_code: f.entry_type_code,
        current_value: f.data_source_layer
      }))
    };

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});